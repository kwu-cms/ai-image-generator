# OAuth認証（Google/Gmail）実装ガイド

## 実装難易度

### 難易度: **中程度** ⭐⭐⭐☆☆

**理由:**
- Cloudflare Workers環境でのOAuth実装は標準的な手順に従えば可能
- Web Crypto APIを使用したJWT署名が必要（やや複雑）
- セキュリティ要件（PKCE、state検証など）の実装が必要
- ただし、既存の認証システムと統合する必要がある

## 実装に必要なもの

### 1. Google Cloud Console設定
- Google Cloud プロジェクトの作成
- OAuth 2.0 クライアントIDの作成
- リダイレクトURIの登録（例: `https://your-domain.com/api/auth/callback/google`）

### 2. 環境変数（Secrets）
```bash
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put OAUTH_REDIRECT_URI
```

### 3. データベーススキーマ変更
```sql
-- usersテーブルにOAuth関連カラムを追加
ALTER TABLE users ADD COLUMN oauth_provider TEXT; -- 'google', 'email'など
ALTER TABLE users ADD COLUMN oauth_id TEXT; -- OAuthプロバイダーのユーザーID
ALTER TABLE users ADD COLUMN oauth_email TEXT; -- OAuthから取得したメールアドレス
```

## 実装手順

### ステップ1: OAuth認証フローの実装

#### 1.1 認証開始エンドポイント（`/api/auth/google`）

```javascript
// src/worker.js に追加

if (path === '/api/auth/google' && request.method === 'GET') {
    return await handleGoogleAuth(request, env);
}

async function handleGoogleAuth(request, env) {
    // PKCE用のcode_verifierとcode_challengeを生成
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const state = generateRandomState();
    const nonce = generateRandomNonce();

    // state, codeVerifier, nonceをKVに保存（10分間有効）
    await env.SESSIONS.put(`oauth:state:${state}`, JSON.stringify({
        codeVerifier,
        nonce,
        createdAt: Date.now()
    }), { expirationTtl: 600 });

    // Google OAuth認証URLを生成
    const authURL = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authURL.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
    authURL.searchParams.set('redirect_uri', env.OAUTH_REDIRECT_URI);
    authURL.searchParams.set('response_type', 'code');
    authURL.searchParams.set('scope', 'openid email profile');
    authURL.searchParams.set('state', state);
    authURL.searchParams.set('code_challenge', codeChallenge);
    authURL.searchParams.set('code_challenge_method', 'S256');
    authURL.searchParams.set('nonce', nonce);

    return Response.redirect(authURL.toString(), 302);
}
```

#### 1.2 コールバックエンドポイント（`/api/auth/callback/google`）

```javascript
if (path === '/api/auth/callback/google' && request.method === 'GET') {
    return await handleGoogleCallback(request, env);
}

async function handleGoogleCallback(request, env) {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    if (error) {
        return Response.redirect(`${env.FRONTEND_URL}/login.html?error=${encodeURIComponent(error)}`, 302);
    }

    // stateの検証
    const stateData = await env.SESSIONS.get(`oauth:state:${state}`);
    if (!stateData) {
        return Response.redirect(`${env.FRONTEND_URL}/login.html?error=invalid_state`, 302);
    }

    const { codeVerifier, nonce } = JSON.parse(stateData);
    await env.SESSIONS.delete(`oauth:state:${state}`);

    // 認証コードをアクセストークンに交換
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: env.GOOGLE_CLIENT_ID,
            client_secret: env.GOOGLE_CLIENT_SECRET,
            code,
            grant_type: 'authorization_code',
            redirect_uri: env.OAUTH_REDIRECT_URI,
            code_verifier: codeVerifier
        })
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) {
        return Response.redirect(`${env.FRONTEND_URL}/login.html?error=token_exchange_failed`, 302);
    }

    // IDトークンからユーザー情報を取得
    const userInfo = await getUserInfoFromIdToken(tokenData.id_token, nonce, env);
    
    // ユーザーをデータベースに登録または取得
    let user = await env.DB.prepare(
        'SELECT * FROM users WHERE oauth_provider = ? AND oauth_id = ?'
    ).bind('google', userInfo.sub).first();

    if (!user) {
        // 新規ユーザー登録（学籍番号は後で入力させる）
        const result = await env.DB.prepare(
            'INSERT INTO users (email, oauth_provider, oauth_id, oauth_email) VALUES (?, ?, ?, ?)'
        ).bind(userInfo.email, 'google', userInfo.sub, userInfo.email).run();
        
        user = {
            id: result.meta.last_row_id,
            email: userInfo.email,
            oauth_provider: 'google',
            oauth_id: userInfo.sub
        };
    }

    // セッションを作成
    const sessionToken = generateSessionToken();
    await saveSession(env.SESSIONS, sessionToken, user.id, user.email);

    // ログイン成功 - フロントエンドにリダイレクト
    return Response.redirect(`${env.FRONTEND_URL}/index.html`, 302, {
        headers: {
            'Set-Cookie': `session_token=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}; Secure`
        }
    });
}
```

#### 1.3 ヘルパー関数

```javascript
// src/auth.js に追加

/**
 * PKCE用のcode_verifierを生成
 */
export function generateCodeVerifier() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return base64UrlEncode(Array.from(array, byte => byte.toString(16).padStart(2, '0')).join(''));
}

/**
 * code_challengeを生成（SHA-256）
 */
export async function generateCodeChallenge(verifier) {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return base64UrlEncode(hashArray.map(b => b.toString(16).padStart(2, '0')).join(''));
}

/**
 * ランダムなstateを生成
 */
export function generateRandomState() {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return base64UrlEncode(Array.from(array, byte => byte.toString(16).padStart(2, '0')).join(''));
}

/**
 * ランダムなnonceを生成
 */
export function generateRandomNonce() {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return base64UrlEncode(Array.from(array, byte => byte.toString(16).padStart(2, '0')).join(''));
}

/**
 * Base64URLエンコード
 */
function base64UrlEncode(str) {
    return btoa(str)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

/**
 * IDトークンからユーザー情報を取得（簡易版 - 実際にはJWT検証が必要）
 */
async function getUserInfoFromIdToken(idToken, nonce, env) {
    // 実際の実装では、JWTの署名を検証し、nonceを確認する必要がある
    // ここでは簡易的にデコードのみ（本番環境では必ず検証すること）
    const parts = idToken.split('.');
    const payload = JSON.parse(atob(parts[1]));
    
    // nonceの検証
    if (payload.nonce !== nonce) {
        throw new Error('Invalid nonce');
    }
    
    return {
        sub: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture
    };
}
```

### ステップ2: フロントエンドの実装

#### 2.1 ログインページにGoogleログインボタンを追加

```html
<!-- public/login.html に追加 -->
<div class="d-grid mb-3">
    <a href="/api/auth/google" class="btn btn-outline-secondary">
        <svg>...</svg> Googleでログイン
    </a>
</div>
<div class="text-center my-3">
    <span class="text-muted">または</span>
</div>
```

### ステップ3: 学籍番号の後入力

OAuthでログインしたユーザーは学籍番号を持っていないため、初回ログイン時に学籍番号を入力させる必要があります。

```javascript
// ユーザー登録時に学籍番号がない場合の処理
if (user.oauth_provider && !user.student_id) {
    // 学籍番号入力ページにリダイレクト
    return Response.redirect(`${env.FRONTEND_URL}/complete-profile.html`, 302);
}
```

## 実装の複雑さ

### 比較的簡単な部分
- ✅ Google OAuth URLの生成
- ✅ リダイレクト処理
- ✅ セッション管理（既存システムを活用）

### やや複雑な部分
- ⚠️ PKCEの実装（code_verifier, code_challenge）
- ⚠️ JWT IDトークンの検証（本番環境では必須）
- ⚠️ state検証によるCSRF対策
- ⚠️ エラーハンドリング

### 注意が必要な部分
- 🔴 学籍番号の後入力フロー
- 🔴 OAuthユーザーと通常ユーザーの統合
- 🔴 メールアドレスの重複チェック（OAuthのメールと学籍メール）

## 推奨実装時間

- **基本実装**: 4-6時間
- **セキュリティ強化（JWT検証など）**: +2-3時間
- **学籍番号後入力フロー**: +2-3時間
- **テストとデバッグ**: +2-4時間

**合計**: 約10-16時間

## 代替案

### 1. Cloudflare Access（最も簡単）
- Cloudflareの管理画面で設定
- コード実装が最小限
- ただし、有料プランが必要な場合あり

### 2. 既存のライブラリを使用
- `workers-oauth-provider`（Cloudflare公式）
- ただし、このプロジェクトの規模では過剰かも

## 結論

**実装は可能だが、中程度の難易度**

- 既存の認証システムと統合する必要がある
- セキュリティ要件（PKCE、JWT検証）の実装が必要
- 学籍番号の後入力フローが必要

**推奨**: 
- 授業用途であれば、現在のメール/パスワード認証で十分
- OAuthが必要な場合は、段階的に実装（まずはGoogleのみ）
