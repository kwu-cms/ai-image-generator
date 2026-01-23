/**
 * Cloudflare Workers API
 * OpenAI DALL-E APIを使用した画像生成と履歴管理
 */

import OpenAI from 'openai';
import {
    hashPassword,
    verifyPassword,
    generateSessionToken,
    generateResetToken,
    saveSession,
    getSession,
    deleteSession,
    getSessionTokenFromRequest,
    validateStudentId,
    validateEmail,
    validatePassword,
    extractStudentIdFromEmail,
} from './auth.js';

// 許可するオリジンのリスト
const allowedOrigins = [
    'http://localhost:8788',
    'http://localhost:8080',
    'http://127.0.0.1:8788',
    'http://127.0.0.1:8080',
    'https://image-generation-api.tkwshnsk.workers.dev',
    // 本番環境のオリジンを追加（GitHub Pagesなど）
];

/**
 * CORSヘッダーを動的に生成
 * credentials: 'include'を使用する場合、Access-Control-Allow-Originはワイルドカードではなく具体的なオリジンを指定する必要がある
 */
function getCorsHeaders(request) {
    const origin = request.headers.get('Origin');
    
    // ローカルホストの場合は常に許可（開発環境用）
    const isLocalhost = origin && (
        origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:')
    );
    
    // 許可リストに含まれているか、ローカルホストの場合
    const allowedOrigin = origin && (
        allowedOrigins.includes(origin) || 
        isLocalhost
    ) ? origin : null;
    
    // credentials: 'include'を使用する場合、Access-Control-Allow-Originは具体的なオリジンでなければならない
    // 許可されていないオリジンの場合は、Originを返さない（CORSエラーになる）
    if (!allowedOrigin) {
        // 許可されていないオリジンの場合でも、CORSヘッダーは返す（ただし、credentialsはfalse）
        return {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Credentials': 'false',
        };
    }
    
    return {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Credentials': 'true',
    };
}

/**
 * リクエストハンドラー
 */
export default {
    async fetch(request, env) {
        // OPTIONSリクエスト（CORSプリフライト）の処理
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: getCorsHeaders(request) });
        }

        const url = new URL(request.url);
        const path = url.pathname;

        try {
            // 認証API
            if (path === '/api/auth/register' && request.method === 'POST') {
                return await handleRegister(request, env);
            }
            if (path === '/api/auth/login' && request.method === 'POST') {
                return await handleLogin(request, env);
            }
            if (path === '/api/auth/logout' && request.method === 'POST') {
                return await handleLogout(request, env);
            }
            if (path === '/api/auth/me' && request.method === 'GET') {
                return await handleMe(request, env);
            }
            if (path === '/api/auth/reset-request' && request.method === 'POST') {
                return await handleResetRequest(request, env);
            }
            if (path === '/api/auth/reset-password' && request.method === 'POST') {
                return await handleResetPassword(request, env);
            }
            if (path === '/api/auth/change-password' && request.method === 'POST') {
                return await handleChangePassword(request, env);
            }

            // 画像生成API（認証必須）
            if (path === '/api/generate' && request.method === 'POST') {
                const user = await getCurrentUser(request, env);
                if (!user) {
                    return new Response(
                        JSON.stringify({ error: 'ログインが必要です' }),
                        { status: 401, headers: { ...getCorsHeaders(request), 'Content-Type': 'application/json' } }
                    );
                }
                return await handleGenerate(request, env, user);
            }

            // 履歴取得API（認証必須）
            if (path === '/api/history' && request.method === 'GET') {
                const user = await getCurrentUser(request, env);
                if (!user) {
                    return new Response(
                        JSON.stringify({ error: 'ログインが必要です' }),
                        { status: 401, headers: { ...getCorsHeaders(request), 'Content-Type': 'application/json' } }
                    );
                }
                return await handleHistory(request, env, user);
            }

            // 全画像取得API（認証不要）
            if (path === '/api/images' && request.method === 'GET') {
                return await handleAllImages(request, env);
            }

            // 画像配信API（R2から画像を取得）
            if (path.startsWith('/api/image/') && request.method === 'GET') {
                return await handleImage(request, path, env);
            }

            // 参照画像アップロードAPI（認証必須）
            if (path === '/api/reference-images/upload' && request.method === 'POST') {
                const user = await getCurrentUser(request, env);
                if (!user) {
                    return new Response(
                        JSON.stringify({ error: 'ログインが必要です' }),
                        { status: 401, headers: { ...getCorsHeaders(request), 'Content-Type': 'application/json' } }
                    );
                }
                return await handleReferenceImageUpload(request, env, user);
            }

            // 参照画像一覧取得API（認証必須）
            if (path === '/api/reference-images' && request.method === 'GET') {
                const user = await getCurrentUser(request, env);
                if (!user) {
                    return new Response(
                        JSON.stringify({ error: 'ログインが必要です' }),
                        { status: 401, headers: { ...getCorsHeaders(request), 'Content-Type': 'application/json' } }
                    );
                }
                return await handleReferenceImagesList(request, env, user);
            }

            // 404エラー（静的ファイルはwrangler.tomlの[site]設定で配信）
            return new Response('Not Found', {
                status: 404,
                headers: getCorsHeaders(request)
            });
        } catch (error) {
            console.error('Error:', error);
            return new Response(
                JSON.stringify({ error: error.message }),
                {
                    status: 500,
                    headers: { ...getCorsHeaders(request), 'Content-Type': 'application/json' }
                }
            );
        }
    },
};

/**
 * 現在のユーザーを取得
 */
async function getCurrentUser(request, env) {
    if (!env.SESSIONS) return null; // KVが設定されていない場合はnullを返す

    const token = getSessionTokenFromRequest(request);
    if (!token) return null;

    const session = await getSession(env.SESSIONS, token);
    if (!session) return null;

    return {
        id: session.userId,
        email: session.email,
    };
}

/**
 * ユーザー登録処理
 */
async function handleRegister(request, env) {
    const corsHeaders = getCorsHeaders(request);
    
    if (!env.DB) {
        return new Response(
            JSON.stringify({ error: 'データベースが設定されていません' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    let body;
    try {
        body = await request.json();
    } catch (error) {
        return new Response(
            JSON.stringify({ error: 'リクエストボディの解析に失敗しました' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    const { email, password } = body;

    // バリデーション
    if (!email || !validateEmail(email)) {
        return new Response(
            JSON.stringify({ error: '有効なメールアドレスを入力してください（例: ka225053@konan-wu.ac.jp）' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    if (!password || !validatePassword(password)) {
        return new Response(
            JSON.stringify({ error: 'パスワードは4文字以上12文字以下で入力してください' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    // メールアドレスから学籍番号を自動抽出
    const studentId = extractStudentIdFromEmail(email);
    if (!studentId) {
        return new Response(
            JSON.stringify({ error: 'メールアドレスから学籍番号を抽出できませんでした（例: ka225053@konan-wu.ac.jp）' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    try {
        // 既存ユーザーの確認
        const existingUser = await env.DB.prepare(
            'SELECT id FROM users WHERE email = ? OR student_id = ?'
        ).bind(email, studentId).first();

        if (existingUser) {
            return new Response(
                JSON.stringify({ error: 'このメールアドレスまたは学籍番号は既に登録されています' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // パスワードをハッシュ化
        const passwordHash = await hashPassword(password);

        // ユーザーを登録
        const result = await env.DB.prepare(
            'INSERT INTO users (email, student_id, password_hash) VALUES (?, ?, ?)'
        ).bind(email, studentId, passwordHash).run();

        const userId = result.meta.last_row_id;

        // 登録後、自動的にログイン（セッションを作成）
        let sessionToken = null;
        if (env.SESSIONS) {
            sessionToken = generateSessionToken();
            await saveSession(env.SESSIONS, sessionToken, userId, email);
        }

        // Cookieを設定したレスポンスを返す
        const responseHeaders = {
            ...corsHeaders,
            'Content-Type': 'application/json',
        };

        if (sessionToken && env.SESSIONS) {
            responseHeaders['Set-Cookie'] = `session_token=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`;
        }

        return new Response(
            JSON.stringify({
                success: true,
                message: 'ユーザー登録が完了しました',
                userId: userId,
                user: {
                    id: userId,
                    email: email,
                    studentId: studentId,
                },
            }),
            { headers: responseHeaders }
        );
    } catch (error) {
        console.error('Registration error:', error);
        console.error('Error stack:', error.stack);
        console.error('Error details:', {
            email: email,
            studentId: studentId,
            errorMessage: error.message,
            errorName: error.name
        });
        // 開発環境では詳細なエラー情報を返す
        const isDevelopment = request.headers.get('Origin')?.includes('localhost') || 
                              request.headers.get('Origin')?.includes('127.0.0.1');
        return new Response(
            JSON.stringify({ 
                error: 'ユーザー登録に失敗しました',
                details: isDevelopment ? error.message : undefined,
                stack: isDevelopment ? error.stack : undefined
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
}

/**
 * ログイン処理
 */
async function handleLogin(request, env) {
    const corsHeaders = getCorsHeaders(request);
    
    if (!env.DB || !env.SESSIONS) {
        return new Response(
            JSON.stringify({ error: 'データベースまたはセッションストレージが設定されていません' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    let body;
    try {
        body = await request.json();
    } catch (error) {
        return new Response(
            JSON.stringify({ error: 'リクエストボディの解析に失敗しました' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    const { email, password } = body;

    if (!email || !password) {
        return new Response(
            JSON.stringify({ error: 'メールアドレスとパスワードを入力してください' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    try {
        // ユーザーを検索
        const user = await env.DB.prepare(
            'SELECT id, email, student_id, password_hash FROM users WHERE email = ?'
        ).bind(email).first();

        if (!user) {
            return new Response(
                JSON.stringify({ error: 'メールアドレスまたはパスワードが正しくありません' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // パスワードを検証
        const isValid = await verifyPassword(password, user.password_hash);
        if (!isValid) {
            return new Response(
                JSON.stringify({ error: 'メールアドレスまたはパスワードが正しくありません' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // セッショントークンを生成
        const token = generateSessionToken();
        await saveSession(env.SESSIONS, token, user.id, user.email);

        // 最終ログイン時刻を更新
        await env.DB.prepare(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?'
        ).bind(user.id).run();

        // Cookieを設定したレスポンスを返す
        return new Response(
            JSON.stringify({
                success: true,
                message: 'ログインに成功しました',
                user: {
                    id: user.id,
                    email: user.email,
                    studentId: user.student_id,
                },
            }),
            {
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json',
                    'Set-Cookie': `session_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`,
                },
            }
        );
    } catch (error) {
        console.error('Login error:', error);
        return new Response(
            JSON.stringify({ error: 'ログインに失敗しました' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
}

/**
 * ログアウト処理
 */
async function handleLogout(request, env) {
    const corsHeaders = getCorsHeaders(request);
    
    if (!env.SESSIONS) {
        return new Response(
            JSON.stringify({ error: 'セッションストレージが設定されていません' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    const token = getSessionTokenFromRequest(request);
    if (token) {
        await deleteSession(env.SESSIONS, token);
    }

    return new Response(
        JSON.stringify({ success: true, message: 'ログアウトしました' }),
        {
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
                'Set-Cookie': 'session_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
            },
        }
    );
}

/**
 * 現在のユーザー情報取得
 */
async function handleMe(request, env) {
    const corsHeaders = getCorsHeaders(request);
    const user = await getCurrentUser(request, env);

    if (!user) {
        return new Response(
            JSON.stringify({ error: 'ログインしていません' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    // データベースからユーザー情報を取得
    if (env.DB) {
        const userInfo = await env.DB.prepare(
            'SELECT id, email, student_id, created_at, last_login FROM users WHERE id = ?'
        ).bind(user.id).first();

        return new Response(
            JSON.stringify({
                success: true,
                user: {
                    id: userInfo.id,
                    email: userInfo.email,
                    studentId: userInfo.student_id,
                    createdAt: userInfo.created_at,
                    lastLogin: userInfo.last_login,
                },
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(
        JSON.stringify({
            success: true,
            user: {
                id: user.id,
                email: user.email,
            },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
}

/**
 * パスワード再設定リクエスト処理
 */
async function handleResetRequest(request, env) {
    const corsHeaders = getCorsHeaders(request);
    if (!env.DB) {
        return new Response(
            JSON.stringify({ error: 'データベースが設定されていません' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    let body;
    try {
        body = await request.json();
    } catch (error) {
        return new Response(
            JSON.stringify({ error: 'リクエストボディの解析に失敗しました' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    const { email } = body;

    if (!email || !validateEmail(email)) {
        return new Response(
            JSON.stringify({ error: '有効なメールアドレスを入力してください' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    try {
        // ユーザーを検索
        const user = await env.DB.prepare(
            'SELECT id, email FROM users WHERE email = ?'
        ).bind(email).first();

        // セキュリティ上の理由で、ユーザーが存在しない場合でも成功メッセージを返す
        let resetToken = null;
        if (user) {
            // リセットトークンを生成
            resetToken = generateResetToken();
            const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1時間後

            // データベースにリセットトークンを保存
            await env.DB.prepare(
                'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?'
            ).bind(resetToken, expiresAt.toISOString(), user.id).run();

            // 注意: 本番環境では、ここでメール送信機能を実装する必要があります
            // 現在は開発用にトークンをログに出力（本番では削除してください）
            console.log(`[開発用] パスワードリセットトークン: ${resetToken} (ユーザー: ${user.email})`);
        }

        // セキュリティ上の理由で、常に成功メッセージを返す
        // 注意: 開発環境ではトークンを返しますが、本番環境では削除してください
        const responseData = {
            success: true,
            message: 'パスワード再設定のリクエストを受け付けました。メールアドレスに再設定リンクを送信しました。',
        };
        
        // 開発用: トークンを返す（本番環境では削除してください）
        if (resetToken) {
            responseData.resetToken = resetToken;
        }

        return new Response(
            JSON.stringify(responseData),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        console.error('Reset request error:', error);
        return new Response(
            JSON.stringify({ error: 'パスワード再設定リクエストに失敗しました' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
}

/**
 * パスワード再設定実行処理
 */
async function handleResetPassword(request, env) {
    const corsHeaders = getCorsHeaders(request);
    if (!env.DB) {
        return new Response(
            JSON.stringify({ error: 'データベースが設定されていません' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    let body;
    try {
        body = await request.json();
    } catch (error) {
        return new Response(
            JSON.stringify({ error: 'リクエストボディの解析に失敗しました' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    const { token, newPassword } = body;

    if (!token) {
        return new Response(
            JSON.stringify({ error: 'リセットトークンが必要です' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    if (!newPassword || !validatePassword(newPassword)) {
        return new Response(
            JSON.stringify({ error: 'パスワードは4文字以上12文字以下で入力してください' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    try {
        // トークンでユーザーを検索
        const user = await env.DB.prepare(
            'SELECT id, email, reset_token, reset_token_expires FROM users WHERE reset_token = ?'
        ).bind(token).first();

        if (!user) {
            return new Response(
                JSON.stringify({ error: '無効または期限切れのリセットトークンです' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // トークンの有効期限を確認
        const expiresAt = new Date(user.reset_token_expires);
        if (expiresAt < new Date()) {
            // 期限切れトークンをクリア
            await env.DB.prepare(
                'UPDATE users SET reset_token = NULL, reset_token_expires = NULL WHERE id = ?'
            ).bind(user.id).run();

            return new Response(
                JSON.stringify({ error: 'リセットトークンの有効期限が切れています' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // パスワードをハッシュ化
        const passwordHash = await hashPassword(newPassword);

        // パスワードを更新し、リセットトークンをクリア
        await env.DB.prepare(
            'UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?'
        ).bind(passwordHash, user.id).run();

        return new Response(
            JSON.stringify({
                success: true,
                message: 'パスワードの再設定が完了しました',
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        console.error('Reset password error:', error);
        return new Response(
            JSON.stringify({ error: 'パスワードの再設定に失敗しました' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
}

/**
 * パスワード変更処理（ログイン済みユーザー用）
 */
async function handleChangePassword(request, env) {
    const corsHeaders = getCorsHeaders(request);
    
    if (!env.DB) {
        return new Response(
            JSON.stringify({ error: 'データベースが設定されていません' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    // 認証チェック
    const user = await getCurrentUser(request, env);
    if (!user) {
        return new Response(
            JSON.stringify({ error: 'ログインが必要です' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    let body;
    try {
        body = await request.json();
    } catch (error) {
        return new Response(
            JSON.stringify({ error: 'リクエストボディの解析に失敗しました' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
        return new Response(
            JSON.stringify({ error: '現在のパスワードと新しいパスワードを入力してください' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    if (!validatePassword(newPassword)) {
        return new Response(
            JSON.stringify({ error: 'パスワードは4文字以上12文字以下で入力してください' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    if (currentPassword === newPassword) {
        return new Response(
            JSON.stringify({ error: '現在のパスワードと新しいパスワードが同じです' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    try {
        // ユーザー情報を取得
        const userData = await env.DB.prepare(
            'SELECT id, email, password_hash FROM users WHERE id = ?'
        ).bind(user.id).first();

        if (!userData) {
            return new Response(
                JSON.stringify({ error: 'ユーザーが見つかりません' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // 現在のパスワードを検証
        const isValid = await verifyPassword(currentPassword, userData.password_hash);
        if (!isValid) {
            return new Response(
                JSON.stringify({ error: '現在のパスワードが正しくありません' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // 新しいパスワードをハッシュ化
        const newPasswordHash = await hashPassword(newPassword);

        // パスワードを更新
        await env.DB.prepare(
            'UPDATE users SET password_hash = ? WHERE id = ?'
        ).bind(newPasswordHash, user.id).run();

        return new Response(
            JSON.stringify({
                success: true,
                message: 'パスワードが正常に変更されました',
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        console.error('Change password error:', error);
        return new Response(
            JSON.stringify({ error: 'パスワードの変更に失敗しました' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
}

/**
 * 役割ラベルの説明を取得
 */
function getRoleDescription(role) {
    const descriptions = {
        '構図': 'この画像のレイアウトとカメラアングルを維持する',
        'スタイル': 'この画像の色調とレンダリングスタイルを適用する',
        '色調': 'この画像の色彩とトーンを反映する',
        '質感': 'この画像の質感とマテリアル感を再現する',
        'ディテール': 'この画像の細部の表現方法を参考にする',
        'その他': 'この画像の特徴を参考にする'
    };
    return descriptions[role] || descriptions['その他'];
}

/**
 * プロンプトに役割情報を埋め込む
 */
function enhancePromptWithRoles(basePrompt, referenceImages) {
    if (!referenceImages || referenceImages.length === 0) {
        return basePrompt;
    }
    
    let enhancedPrompt = basePrompt;
    
    referenceImages.forEach((ref, index) => {
        const roleLabel = ref.role || 'その他';
        const roleDescription = getRoleDescription(roleLabel);
        const imageLabel = String.fromCharCode(65 + index); // A, B, C...
        enhancedPrompt += `\n参照画像${imageLabel}（${roleLabel}）：${roleDescription}`;
    });
    
    return enhancedPrompt;
}

/**
 * 画像生成処理
 */
async function handleGenerate(request, env, user) {
    const corsHeaders = getCorsHeaders(request);
    // リクエストボディの取得
    let body;
    try {
        body = await request.json();
    } catch (error) {
        return new Response(
            JSON.stringify({ error: 'リクエストボディの解析に失敗しました' }),
            {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        );
    }

    const { prompt, referenceImages, generationOptions } = body;

    if (!prompt || prompt.trim() === '') {
        return new Response(
            JSON.stringify({ error: 'プロンプトが入力されていません' }),
            {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        );
    }

    // 参照画像の処理
    let processedReferenceImages = [];
    if (referenceImages && Array.isArray(referenceImages) && referenceImages.length > 0) {
        // 参照画像数の上限チェック（最大5枚）
        if (referenceImages.length > 5) {
            return new Response(
                JSON.stringify({ error: '参照画像は最大5枚まで指定できます' }),
                {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                }
            );
        }

        // 参照画像の処理
        for (const refImage of referenceImages) {
            if (!refImage.role) {
                return new Response(
                    JSON.stringify({ error: '参照画像に役割ラベルが指定されていません' }),
                    {
                        status: 400,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    }
                );
            }

            // 既存画像IDが指定されている場合
            if (refImage.id) {
                const existingRef = await env.DB.prepare(
                    'SELECT id, r2_object_key FROM reference_images WHERE id = ?'
                ).bind(refImage.id).first();

                if (!existingRef) {
                    return new Response(
                        JSON.stringify({ error: `参照画像ID ${refImage.id} が見つかりません` }),
                        {
                            status: 404,
                            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                        }
                    );
                }

                processedReferenceImages.push({
                    reference_image_id: existingRef.id,
                    role_label: refImage.role,
                    r2_object_key: existingRef.r2_object_key
                });
            } else {
                return new Response(
                    JSON.stringify({ error: '参照画像IDが指定されていません（新規アップロードは別APIを使用してください）' }),
                    {
                        status: 400,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    }
                );
            }
        }
    }

    // OpenAI APIキーの確認
    if (!env.OPENAI_API_KEY) {
        return new Response(
            JSON.stringify({ error: 'OpenAI APIキーが設定されていません' }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        );
    }

    // OpenAI APIクライアントの初期化
    const openai = new OpenAI({
        apiKey: env.OPENAI_API_KEY,
    });

    try {
        // 生成開始時間を記録
        const startTime = Date.now();

        // プロンプトに役割情報を埋め込む
        const enhancedPrompt = enhancePromptWithRoles(prompt, processedReferenceImages);

        // 生成オプションの設定
        const size = generationOptions?.size || '1024x1024';
        const quality = generationOptions?.quality || 'standard';
        const style = generationOptions?.style || 'vivid';

        // DALL-E APIで画像生成
        const response = await openai.images.generate({
            model: 'dall-e-3',
            prompt: enhancedPrompt,
            n: 1,
            size: size,
            quality: quality,
            style: style,
        });

        const imageUrl = response.data[0].url;

        // 画像ダウンロード開始時間
        const downloadStartTime = Date.now();

        // 生成された画像をダウンロード
        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) {
            throw new Error('画像のダウンロードに失敗しました');
        }
        const imageBuffer = await imageResponse.arrayBuffer();

        // ダウンロード完了時間
        const downloadEndTime = Date.now();

        // R2に画像をアップロード
        const uploadStartTime = Date.now();
        const fileName = `images/${Date.now()}-${Math.random().toString(36).substring(7)}.png`;
        
        console.log('Uploading to R2:', {
            fileName: fileName,
            imageSize: imageBuffer.byteLength,
            hasR2Bucket: !!env.R2_BUCKET
        });
        
        if (!env.R2_BUCKET) {
            throw new Error('R2 storage is not configured');
        }
        
        await env.R2_BUCKET.put(fileName, imageBuffer, {
            httpMetadata: {
                contentType: 'image/png',
            },
        });
        const uploadEndTime = Date.now();
        
        console.log('Image uploaded to R2 successfully:', fileName);

        // R2の公開URLを生成（Workers経由で配信するURL）
        const r2ImageUrl = `/api/image/${fileName}`;

        // データベースに保存（ユーザーIDを含む）
        let generationId = null;
        if (env.DB) {
            const generationOptionsJson = JSON.stringify(generationOptions || {});
            const result = await env.DB.prepare(
                'INSERT INTO images (prompt, image_url, user_id, generation_options) VALUES (?, ?, ?, ?)'
            ).bind(enhancedPrompt, r2ImageUrl, user.id, generationOptionsJson).run();
            
            generationId = result.meta.last_row_id;

            // 参照画像との紐づけを保存
            if (processedReferenceImages.length > 0) {
                for (let i = 0; i < processedReferenceImages.length; i++) {
                    const refImage = processedReferenceImages[i];
                    await env.DB.prepare(
                        'INSERT INTO generation_reference_images (generation_id, reference_image_id, role_label, display_order) VALUES (?, ?, ?, ?)'
                    ).bind(generationId, refImage.reference_image_id, refImage.role_label, i).run();
                }
            }
        }

        // 処理時間を計算（秒単位）
        const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
        const generationTime = ((downloadStartTime - startTime) / 1000).toFixed(1);
        const downloadTime = ((downloadEndTime - downloadStartTime) / 1000).toFixed(1);
        const uploadTime = ((uploadEndTime - uploadStartTime) / 1000).toFixed(1);

        // レスポンスを返す
        return new Response(
            JSON.stringify({
                success: true,
                prompt: enhancedPrompt,
                original_prompt: prompt,
                image_url: r2ImageUrl,
                generation_id: generationId,
                reference_images: processedReferenceImages.map(ref => ({
                    reference_image_id: ref.reference_image_id,
                    role_label: ref.role_label,
                    image_url: `/api/image/${ref.r2_object_key}`
                })),
                timing: {
                    total: totalTime,
                    generation: generationTime,
                    download: downloadTime,
                    upload: uploadTime
                }
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        );
    } catch (error) {
        console.error('OpenAI API Error:', error);
        return new Response(
            JSON.stringify({
                error: error.message || '画像の生成に失敗しました',
                details: error.message
            }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        );
    }
}

/**
 * 履歴取得処理
 */
async function handleHistory(request, env, user) {
    const corsHeaders = getCorsHeaders(request);
    if (!env.DB) {
        return new Response(
            JSON.stringify({ error: 'データベースが設定されていません' }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        );
    }

    // データベースからユーザーの履歴を取得（新しい順）
    const result = await env.DB.prepare(
        'SELECT id, prompt, image_url, generation_options, created_at FROM images WHERE user_id = ? ORDER BY created_at DESC'
    ).bind(user.id).all();

    // 各履歴に参照画像情報を追加
    const historyWithReferences = await Promise.all((result.results || []).map(async (item) => {
        // 参照画像を取得
        const refImagesResult = await env.DB.prepare(
            `SELECT gri.role_label, gri.display_order, ri.r2_object_key, ri.id as reference_image_id
             FROM generation_reference_images gri
             JOIN reference_images ri ON gri.reference_image_id = ri.id
             WHERE gri.generation_id = ?
             ORDER BY gri.display_order ASC`
        ).bind(item.id).all();

        const referenceImages = (refImagesResult.results || []).map(ref => ({
            reference_image_id: ref.reference_image_id,
            image_url: `/api/image/${ref.r2_object_key}`,
            role_label: ref.role_label,
            display_order: ref.display_order
        }));

        return {
            ...item,
            generation_options: item.generation_options ? JSON.parse(item.generation_options) : null,
            reference_images: referenceImages
        };
    }));

    return new Response(
        JSON.stringify({
            success: true,
            history: historyWithReferences,
        }),
        {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
    );
}

/**
 * 全画像取得処理（認証不要）
 */
async function handleAllImages(request, env) {
    const corsHeaders = getCorsHeaders(request);
    if (!env.DB) {
        return new Response(
            JSON.stringify({ error: 'データベースが設定されていません' }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        );
    }

    // データベースから全画像を取得（新しい順、最大100件）
    const result = await env.DB.prepare(
        'SELECT id, prompt, image_url, generation_options, created_at FROM images ORDER BY created_at DESC LIMIT 100'
    ).all();

    // 各画像に参照画像情報を追加
    const imagesWithReferences = await Promise.all((result.results || []).map(async (item) => {
        // 参照画像を取得
        const refImagesResult = await env.DB.prepare(
            `SELECT gri.role_label, gri.display_order, ri.r2_object_key, ri.id as reference_image_id
             FROM generation_reference_images gri
             JOIN reference_images ri ON gri.reference_image_id = ri.id
             WHERE gri.generation_id = ?
             ORDER BY gri.display_order ASC`
        ).bind(item.id).all();

        const referenceImages = (refImagesResult.results || []).map(ref => ({
            reference_image_id: ref.reference_image_id,
            image_url: `/api/image/${ref.r2_object_key}`,
            role_label: ref.role_label,
            display_order: ref.display_order
        }));

        return {
            ...item,
            generation_options: item.generation_options ? JSON.parse(item.generation_options) : null,
            reference_images: referenceImages
        };
    }));

    return new Response(
        JSON.stringify({
            success: true,
            images: imagesWithReferences,
        }),
        {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
    );
}

/**
 * 画像配信処理（R2から画像を取得）
 */
async function handleImage(request, path, env) {
    const corsHeaders = getCorsHeaders(request);
    // パスからファイル名を抽出（/api/image/images/xxx.png → images/xxx.png）
    const fileName = path.replace('/api/image/', '');
    
    console.log('handleImage called:', {
        path: path,
        fileName: fileName,
        hasR2Bucket: !!env.R2_BUCKET
    });

    try {
        if (!env.R2_BUCKET) {
            console.error('R2_BUCKET is not configured');
            return new Response('R2 storage is not configured', {
                status: 500,
                headers: corsHeaders
            });
        }
        
        // R2から画像を取得
        console.log('Fetching from R2:', fileName);
        const object = await env.R2_BUCKET.get(fileName);
        
        console.log('R2 object:', {
            exists: !!object,
            key: object?.key,
            size: object?.size,
            contentType: object?.httpMetadata?.contentType
        });

        if (!object) {
            console.error('Image not found in R2:', fileName);
            return new Response('Image not found', {
                status: 404,
                headers: corsHeaders
            });
        }

        // 画像データを取得
        const imageData = await object.arrayBuffer();
        console.log('Image data retrieved, size:', imageData.byteLength);

        // 画像を返す
        return new Response(imageData, {
            headers: {
                ...corsHeaders,
                'Content-Type': object.httpMetadata?.contentType || 'image/png',
                'Cache-Control': 'public, max-age=31536000', // 1年間キャッシュ
            }
        });
    } catch (error) {
        console.error('Error fetching image:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        return new Response(`Error fetching image: ${error.message}`, {
            status: 500,
            headers: corsHeaders
        });
    }
}

/**
 * SHA-256ハッシュを計算
 */
async function calculateSHA256(buffer) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * ファイル拡張子を取得
 */
function getFileExtension(filename) {
    const parts = filename.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : 'png';
}

/**
 * 参照画像アップロード処理
 */
async function handleReferenceImageUpload(request, env, user) {
    const corsHeaders = getCorsHeaders(request);
    
    if (!env.R2_BUCKET || !env.DB) {
        return new Response(
            JSON.stringify({ error: 'ストレージまたはデータベースが設定されていません' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    try {
        // FormDataから画像ファイルを取得
        const formData = await request.formData();
        const file = formData.get('file');
        const visibility = formData.get('visibility') || 'private';

        if (!file || !(file instanceof File)) {
            return new Response(
                JSON.stringify({ error: '画像ファイルが指定されていません' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // ファイルサイズチェック（最大10MB）
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            return new Response(
                JSON.stringify({ error: '画像ファイルのサイズが大きすぎます（最大10MB）' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // ファイル形式チェック
        const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            return new Response(
                JSON.stringify({ error: 'サポートされていない画像形式です（PNG、JPEG、WebPのみ）' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // 画像データを取得
        const imageBuffer = await file.arrayBuffer();

        // SHA-256ハッシュを計算
        const imageHash = await calculateSHA256(imageBuffer);

        // 既存の参照画像をチェック
        const existingRef = await env.DB.prepare(
            'SELECT id, r2_object_key FROM reference_images WHERE image_hash = ?'
        ).bind(imageHash).first();

        if (existingRef) {
            // 既存の参照画像がある場合は、そのIDとURLを返す
            const imageUrl = `/api/image/${existingRef.r2_object_key}`;
            return new Response(
                JSON.stringify({
                    success: true,
                    reference_image_id: existingRef.id,
                    image_url: imageUrl,
                    image_hash: imageHash,
                    message: '既存の参照画像を使用します'
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // ファイル拡張子を取得
        const extension = getFileExtension(file.name);
        const r2ObjectKey = `reference-images/${imageHash}.${extension}`;

        // R2に画像をアップロード
        await env.R2_BUCKET.put(r2ObjectKey, imageBuffer, {
            httpMetadata: {
                contentType: file.type,
            },
        });

        // データベースに保存
        const result = await env.DB.prepare(
            'INSERT INTO reference_images (user_id, image_hash, r2_object_key, visibility) VALUES (?, ?, ?, ?)'
        ).bind(user.id, imageHash, r2ObjectKey, visibility).run();

        const referenceImageId = result.meta.last_row_id;
        const imageUrl = `/api/image/${r2ObjectKey}`;

        return new Response(
            JSON.stringify({
                success: true,
                reference_image_id: referenceImageId,
                image_url: imageUrl,
                image_hash: imageHash
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        console.error('Reference image upload error:', error);
        return new Response(
            JSON.stringify({ error: '参照画像のアップロードに失敗しました', details: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
}

/**
 * 参照画像一覧取得処理
 */
async function handleReferenceImagesList(request, env, user) {
    const corsHeaders = getCorsHeaders(request);
    
    if (!env.DB) {
        return new Response(
            JSON.stringify({ error: 'データベースが設定されていません' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    try {
        const url = new URL(request.url);
        const visibility = url.searchParams.get('visibility'); // 'private', 'class_shared', 'teacher_sample', または null（全て）

        let query = 'SELECT id, user_id, image_hash, r2_object_key, visibility, created_at FROM reference_images WHERE ';
        let params = [];

        // 権限に応じてフィルタリング
        // ユーザー専用: 自分の画像
        // クラス共有: visibility='class_shared'の画像
        // 教員固定サンプル: visibility='teacher_sample'の画像（将来的に教員権限チェックを追加）
        if (visibility) {
            if (visibility === 'private') {
                query += 'user_id = ? AND visibility = ?';
                params = [user.id, 'private'];
            } else {
                query += 'visibility = ?';
                params = [visibility];
            }
        } else {
            // 全ての参照画像を取得（ユーザー専用 + クラス共有 + 教員固定サンプル）
            query += '(user_id = ? AND visibility = ?) OR visibility = ? OR visibility = ?';
            params = [user.id, 'private', 'class_shared', 'teacher_sample'];
        }

        query += ' ORDER BY created_at DESC';

        const result = await env.DB.prepare(query).bind(...params).all();

        const referenceImages = (result.results || []).map(img => ({
            id: img.id,
            user_id: img.user_id,
            image_hash: img.image_hash,
            image_url: `/api/image/${img.r2_object_key}`,
            visibility: img.visibility,
            created_at: img.created_at
        }));

        return new Response(
            JSON.stringify({
                success: true,
                reference_images: referenceImages
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        console.error('Reference images list error:', error);
        return new Response(
            JSON.stringify({ error: '参照画像一覧の取得に失敗しました', details: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
}

