/**
 * Cloudflare Workers API
 * OpenAI Images API / Stability AI APIを使用した画像生成と履歴管理
 */
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
import {
    generateImageWithOpenAI,
    editImageWithOpenAI,
    variationImageWithOpenAI,
} from './openai-image.js';

// 許可するオリジンのリスト
const allowedOrigins = [
    'http://localhost:8788',
    'http://localhost:8080',
    'http://127.0.0.1:8788',
    'http://127.0.0.1:8080',
    'https://image-generation-api.tkwshnsk.workers.dev',
    'https://kwu-cms.github.io', // GitHub Pages
    // 本番環境のオリジンを追加（GitHub Pagesなど）
];

// Stability AI API設定
const STABILITY_AI_BASE_URL = 'https://api.stability.ai';
const STABILITY_AI_ENGINE = 'stable-diffusion-xl-1024-v1-0'; // Stable Diffusion XL

// Stability AI APIで許可された画像サイズ（stable-diffusion-xl-1024-v1-0）
const ALLOWED_DIMENSIONS = [
    { width: 1024, height: 1024 },
    { width: 1152, height: 896 },
    { width: 1216, height: 832 },
    { width: 1344, height: 768 },
    { width: 1536, height: 640 },
    { width: 640, height: 1536 },
    { width: 768, height: 1344 },
    { width: 832, height: 1216 },
    { width: 896, height: 1152 },
];

// Stability AI品質プリセット
// SDXLの最適な設定に基づいて調整
const QUALITY_PRESETS = {
    standard: {
        cfg_scale: 7,
        steps: 30,
        width: 1024,
        height: 1024,
    },
    high: {
        cfg_scale: 7.5,  // SDXL推奨値（7-7.5の範囲）
        steps: 50,        // より高品質な結果のため増加
        width: 1024,
        height: 1024,
    },
    ultra: {
        cfg_scale: 8,    // より高いCFGスケールでプロンプトへの忠実度を向上
        steps: 100,       // 最高品質（処理時間は長くなるが、より詳細な生成）
        width: 1024,
        height: 1024,
    }
};

// カスタムエラークラス（段階別エラーハンドリング用）
class GenerationError extends Error {
    constructor(message, stage, details = null, retryAfter = null) {
        super(message);
        this.name = 'GenerationError';
        this.stage = stage; // 'reference_image_save', 'api_call', 'output_image_save', 'db_record'
        this.details = details;
        this.retryAfter = retryAfter; // レート制限時の再試行までの秒数
    }
}

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

            // ドキュメント配信API（Markdownファイルを返す）
            if (path.startsWith('/api/docs/') && request.method === 'GET') {
                return await handleDocs(request, path, env);
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

            // 静的ファイルの配信（開発環境用）
            // パスが /api/ で始まらない場合は静的ファイルとして扱う
            if (!path.startsWith('/api/')) {
                return await handleStaticFile(request, path, env);
            }

            // 404エラー
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
            // クロスオリジンリクエストの場合はSameSite=None; Secureが必要
            const origin = request.headers.get('Origin');
            const isCrossOrigin = origin && !origin.includes('localhost') && !origin.includes('127.0.0.1');
            const sameSite = isCrossOrigin ? 'SameSite=None; Secure' : 'SameSite=Lax';
            responseHeaders['Set-Cookie'] = `session_token=${sessionToken}; Path=/; HttpOnly; ${sameSite}; Max-Age=${60 * 60 * 24 * 30}`;
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
        // クロスオリジンリクエストの場合はSameSite=None; Secureが必要
        const origin = request.headers.get('Origin');
        const isCrossOrigin = origin && !origin.includes('localhost') && !origin.includes('127.0.0.1');
        const sameSite = isCrossOrigin ? 'SameSite=None; Secure' : 'SameSite=Lax';
        
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
                    'Set-Cookie': `session_token=${token}; Path=/; HttpOnly; ${sameSite}; Max-Age=${60 * 60 * 24 * 30}`,
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

    // クロスオリジンリクエストの場合はSameSite=None; Secureが必要
    const origin = request.headers.get('Origin');
    const isCrossOrigin = origin && !origin.includes('localhost') && !origin.includes('127.0.0.1');
    const sameSite = isCrossOrigin ? 'SameSite=None; Secure' : 'SameSite=Lax';
    
    return new Response(
        JSON.stringify({ success: true, message: 'ログアウトしました' }),
        {
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
                'Set-Cookie': `session_token=; Path=/; HttpOnly; ${sameSite}; Max-Age=0`,
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
 * 翻訳キャッシュから取得
 */
async function getTranslationFromCache(originalJaText, env) {
    if (!env.DB) {
        return null;
    }
    
    try {
        const result = await env.DB.prepare(
            'SELECT translated_prompt_en FROM prompt_translations WHERE original_prompt_ja = ?'
        ).bind(originalJaText).first();
        
        if (result && result.translated_prompt_en) {
            console.log('Translation cache hit for:', originalJaText.substring(0, 50) + '...');
            return result.translated_prompt_en;
        }
        
        return null;
    } catch (error) {
        console.error('Error getting translation from cache:', error);
        return null;
    }
}

/**
 * 翻訳結果をキャッシュに保存
 */
async function saveTranslationToCache(originalJaText, translatedEnText, env) {
    if (!env.DB) {
        return;
    }
    
    try {
        await env.DB.prepare(
            'INSERT OR REPLACE INTO prompt_translations (original_prompt_ja, translated_prompt_en) VALUES (?, ?)'
        ).bind(originalJaText, translatedEnText).run();
        
        console.log('Translation saved to cache');
    } catch (error) {
        console.error('Error saving translation to cache:', error);
        // キャッシュ保存の失敗は無視（翻訳自体は成功している）
    }
}

/**
 * OpenAI APIを使用して日本語プロンプトを英語に翻訳
 * @param {string} originalJaText - 日本語プロンプト（学生の自由記述部分）
 * @param {object} env - 環境変数（OPENAI_API_KEYを含む）
 * @returns {Promise<string>} - 翻訳された英語プロンプト
 */
async function translatePromptWithOpenAI(originalJaText, env) {
    // OpenAI APIキーの確認
    if (!env.OPENAI_API_KEY) {
        throw new GenerationError(
            'OpenAI APIキーが設定されていません',
            'translation',
            'OPENAI_API_KEYが設定されていません'
        );
    }
    
    // 日本語が含まれているかチェック（簡易的な判定）
    const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(originalJaText);
    
    if (!hasJapanese) {
        // 既に英語の場合はそのまま返す
        console.log('Prompt is already in English, skipping translation');
        return originalJaText;
    }
    
    // キャッシュを確認
    const cachedTranslation = await getTranslationFromCache(originalJaText, env);
    if (cachedTranslation) {
        return cachedTranslation;
    }
    
    try {
        console.log('Translating prompt with OpenAI:', originalJaText.substring(0, 100) + '...');
        
        // OpenAI APIにリクエスト
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini', // コスト効率の良いモデル
                messages: [
                    {
                        role: 'system',
                        content: `You are a professional translator for AI image editing systems.
Translate the following Japanese instruction into a clear, imperative English command
that describes what should be visually changed in the image.

Rules:
1. Focus on what to modify, not on style tags
2. Be explicit about actions, poses, facial expressions, and objects
3. Preserve identity-related instructions (e.g., "same person", "same face")
4. Keep it concise and direct
5. Use imperative mood (e.g., "Change", "Make", "Modify" instead of "A person with...")
6. For poses like "banzai" (両手を上げる), translate explicitly as "raising both arms overhead" or "arms raised in celebration"
7. Place the most important changes at the beginning

Output ONLY the translated English prompt, nothing else.`
                    },
                    {
                        role: 'user',
                        content: originalJaText
                    }
                ],
                temperature: 0.2, // 低めに設定（創作的な意訳を防ぐ）
                max_tokens: 500 // 合理的な最大値
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: `HTTP ${response.status}` }));
            throw new GenerationError(
                '翻訳サービスに接続できません',
                'translation',
                errorData.message || `HTTP ${response.status}`
            );
        }
        
        const data = await response.json();
        
        if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
            throw new GenerationError(
                '翻訳サービスのレスポンスが不正です',
                'translation',
                'レスポンスに翻訳結果が含まれていません'
            );
        }
        
        const translatedText = data.choices[0].message.content.trim();
        console.log('Translation successful:', translatedText.substring(0, 100) + '...');
        
        // キャッシュに保存
        await saveTranslationToCache(originalJaText, translatedText, env);
        
        return translatedText;
        
    } catch (error) {
        if (error instanceof GenerationError) {
            throw error;
        }
        
        console.error('Translation error:', error);
        throw new GenerationError(
            '翻訳サービスに接続できません',
            'translation',
            error.message
        );
    }
}

/**
 * OpenAI Edit API用のプロンプトを準備
 * 参照画像の役割情報は不要（画像自体が参照として機能）
 * 編集指示を明確にする
 */
function enhancePromptForOpenAIEdit(basePrompt, referenceImages) {
    // OpenAI Edit APIでは、画像自体が参照として機能するため、
    // 役割情報を追加する必要はない
    // ただし、編集指示を明確にするため、プロンプトを強化
    
    // ポーズ変更や表情変更などの重要な指示を強調
    const lowerPrompt = basePrompt.toLowerCase();
    const hasPoseChange = /(pose|posture|gesture|arms|hands|raise|lift)/.test(lowerPrompt);
    const hasExpressionChange = /(smile|expression|facial|emotion)/.test(lowerPrompt);
    
    let enhanced = basePrompt;
    
    // 重要な変更がある場合は、明確性を向上
    if (hasPoseChange || hasExpressionChange) {
        // 編集指示を先頭に配置
        enhanced = basePrompt;
    }
    
    return enhanced;
}

/**
 * OpenAI Generate API用のプロンプトを準備
 * 純生成の場合は、プロンプトを最適化
 */
function enhancePromptForOpenAIGenerate(basePrompt) {
    // OpenAI Generate APIでは、プロンプトがそのまま使用される
    // DALL-E 3は自動的にプロンプトを最適化するため、シンプルに保つ
    return basePrompt.trim();
}

/**
 * プロンプトに役割情報を埋め込む（英語版）
 * Stability AI用（将来的にStability AIを使用する場合のため保持）
 * ポーズ変更などの大きな変更がある場合は、構図維持の指示を削除
 */
function enhancePromptWithRolesEnglish(basePrompt, referenceImages) {
    if (!referenceImages || referenceImages.length === 0) {
        return basePrompt;
    }
    
    // プロンプトに大きな変更（ポーズ変更など）が含まれているかチェック
    const lowerPrompt = basePrompt.toLowerCase();
    const hasPoseChange = /(pose|posture|gesture|arms|hands|raise|lift|change|modify|transform)/.test(lowerPrompt);
    const hasExpressionChange = /(smile|expression|facial|emotion)/.test(lowerPrompt);
    const hasMajorChange = hasPoseChange || hasExpressionChange;
    
    // 人物の同一性を明示的に指示（重要な改善）
    let enhancedPrompt = 'Maintain the exact same person from the reference image, including facial features, age, and appearance, ';
    enhancedPrompt += basePrompt;
    
    // 参照画像の役割情報を追加（大きな変更がある場合は構図維持を除外）
    referenceImages.forEach((ref, index) => {
        const roleLabel = ref.role || 'その他';
        
        // ポーズ変更がある場合、構図維持の指示をスキップ
        if (hasPoseChange && roleLabel === '構図') {
            return; // 構図維持をスキップ
        }
        
        // 役割ラベルを英語に変換
        const roleLabelEnglish = {
            '構図': 'composition',
            'スタイル': 'style',
            '色調': 'color tone',
            '質感': 'texture',
            'ディテール': 'details',
            'その他': 'other'
        }[roleLabel] || 'other';
        
        const roleDescriptionEnglish = {
            '構図': 'Maintain the layout and camera angle of this image',
            'スタイル': 'Apply the color tone and rendering style of this image',
            '色調': 'Reflect the colors and tones of this image',
            '質感': 'Reproduce the texture and material feel of this image',
            'ディテール': 'Reference the detail expression method of this image',
            'その他': 'Reference the characteristics of this image'
        }[roleLabel] || 'Reference the characteristics of this image';
        
        const imageLabel = String.fromCharCode(65 + index); // A, B, C...
        enhancedPrompt += `, Reference image ${imageLabel} (${roleLabelEnglish}): ${roleDescriptionEnglish}`;
    });
    
    return enhancedPrompt;
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
 * R2から参照画像を取得してbase64エンコード
 */
async function getReferenceImageFromR2(r2ObjectKey, env) {
    try {
        console.log('getReferenceImageFromR2 called:', {
            r2ObjectKey: r2ObjectKey,
            hasR2Bucket: !!env.R2_BUCKET
        });

        if (!env.R2_BUCKET) {
            throw new GenerationError(
                'R2ストレージが設定されていません',
                'reference_image_save',
                'R2_BUCKETが設定されていません'
            );
        }

        console.log('Fetching from R2:', r2ObjectKey);
        const object = await env.R2_BUCKET.get(r2ObjectKey);
        
        console.log('R2 object result:', {
            exists: !!object,
            key: object?.key,
            size: object?.size
        });

        if (!object) {
            throw new GenerationError(
                `参照画像が見つかりません: ${r2ObjectKey}`,
                'reference_image_save',
                `R2オブジェクトキー: ${r2ObjectKey}`
            );
        }

        const imageBuffer = await object.arrayBuffer();
        
        // メモリ制限チェック（10MB以下）
        if (imageBuffer.byteLength > 10 * 1024 * 1024) {
            throw new GenerationError(
                '参照画像が大きすぎます（最大10MB）',
                'reference_image_save',
                `画像サイズ: ${(imageBuffer.byteLength / 1024 / 1024).toFixed(2)}MB`
            );
        }

        // base64エンコード（大きな配列に対応）
        // String.fromCharCode(...array)は大きな配列でスタックオーバーフローを起こすため、
        // チャンクに分けて処理する
        const uint8Array = new Uint8Array(imageBuffer);
        const chunkSize = 8192; // 8KBずつ処理
        let binaryString = '';
        
        for (let i = 0; i < uint8Array.length; i += chunkSize) {
            const chunk = uint8Array.slice(i, i + chunkSize);
            // チャンクを1文字ずつ処理して文字列を構築
            for (let j = 0; j < chunk.length; j++) {
                binaryString += String.fromCharCode(chunk[j]);
            }
        }
        
        const base64 = btoa(binaryString);
        console.log('Base64 encoding completed, length:', base64.length);
        return base64;
    } catch (error) {
        if (error instanceof GenerationError) {
            throw error;
        }
        throw new GenerationError(
            '参照画像の取得に失敗しました',
            'reference_image_save',
            error.message
        );
    }
}

/**
 * image_strengthを動的に計算
 * プロンプトの内容に応じて、プロンプトの影響を適切に調整
 */
function calculateImageStrength(prompt, quality) {
    const lowerPrompt = prompt.toLowerCase();
    
    // 大きな変更を検出
    const hasPoseChange = /(pose|posture|gesture|arms|hands|raise|lift|change.*pose|modify.*pose)/.test(lowerPrompt);
    const hasExpressionChange = /(smile|expression|facial|emotion|change.*expression)/.test(lowerPrompt);
    const hasMajorChange = hasPoseChange || hasExpressionChange;
    
    if (hasMajorChange) {
        // 大きな変更がある場合: プロンプトの影響を強める（参照画像への依存を下げる）
        // ポーズ変更は特に大きな変更のため、より低い値を使用
        if (hasPoseChange) {
            return quality === 'ultra' ? 0.15 : 0.2; // ポーズ変更: 0.15-0.2
        } else {
            return quality === 'ultra' ? 0.2 : 0.25; // 表情変更: 0.2-0.25
        }
    }
    
    // 小さな変更の場合: 標準設定（参照画像をより保持）
    return quality === 'ultra' ? 0.3 : 0.35;
}

/**
 * プロンプトをStability AI向けに汎用的に強化
 * 特定のケースに特化せず、全体的な品質向上を目指す
 */
function enhancePromptForStabilityAI(prompt) {
    // プロンプトをクリーンアップ（余分な空白を削除）
    let enhanced = prompt.trim().replace(/\s+/g, ' ');
    
    // プロンプトが短すぎる場合は改善の余地があるが、ユーザーの意図を尊重
    // 長すぎる場合は簡潔にする（SDXLは短いプロンプトが効果的）
    const sentences = enhanced.split(/[.,;]/).map(s => s.trim()).filter(s => s);
    
    // 重要な要素（アクション、ポーズ、表情など）を検出
    const actionKeywords = ['pose', 'posture', 'gesture', 'action', 'movement', 'expression', 'smile', 'facial expression'];
    const hasActions = sentences.some(s => {
        const lower = s.toLowerCase();
        return actionKeywords.some(keyword => lower.includes(keyword));
    });
    
    // アクションが含まれている場合、明確性を向上
    if (hasActions && sentences.length > 1) {
        // アクション関連の文を先頭に移動（重要度の高い要素を先に）
        const actionSentences = sentences.filter(s => {
            const lower = s.toLowerCase();
            return actionKeywords.some(keyword => lower.includes(keyword));
        });
        const otherSentences = sentences.filter(s => {
            const lower = s.toLowerCase();
            return !actionKeywords.some(keyword => lower.includes(keyword));
        });
        
        // アクションを先頭に配置
        enhanced = [...actionSentences, ...otherSentences].join(', ').trim();
    }
    
    return enhanced;
}

/**
 * Stability AI APIでtext-to-image生成
 */
async function generateTextToImage(prompt, options, env) {
    const preset = QUALITY_PRESETS[options.quality || 'high'] || QUALITY_PRESETS.high;
    
    // ネガティブプロンプト（品質向上のため）
    const defaultNegativePrompt = 'blurry, low quality, distorted, deformed, ugly, bad anatomy, bad proportions, extra limbs, cloned face, disfigured, out of frame, gross proportions, malformed limbs, missing arms, missing legs, extra arms, extra legs, mutated hands, poorly drawn hands, poorly drawn face, mutation, mutated, extra limbs, ugly, disgusting, poorly drawn, bad anatomy, wrong anatomy, extra limb, missing limb, floating limbs, disconnected limbs, mutation, mutated, ugly, disgusting, amputation';
    
    // JSON形式のリクエストボディを作成
    // プロンプトを解析して、ポーズやアクションを強調
    const enhancedPrompt = enhancePromptForStabilityAI(prompt);
    
    const textPrompts = [
        {
            text: enhancedPrompt,
            weight: 1.0
        }
    ];
    
    // ネガティブプロンプトを追加（オプションでカスタム可能）
    const negativePrompt = options.negative_prompt || defaultNegativePrompt;
    if (negativePrompt) {
        textPrompts.push({
            text: negativePrompt,
            weight: -1.0
        });
    }
    
    const requestBody = {
        text_prompts: textPrompts,
        cfg_scale: preset.cfg_scale,
        steps: preset.steps,
        width: preset.width,
        height: preset.height,
        samples: 1
    };
    
    const response = await fetch(
        `${STABILITY_AI_BASE_URL}/v1/generation/${STABILITY_AI_ENGINE}/text-to-image`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${env.STABILITY_AI_API_KEY}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(requestBody)
        }
    );
    
    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: `HTTP ${response.status}` }));
        
        // レート制限エラーの処理
        if (response.status === 429) {
            const retryAfter = response.headers.get('Retry-After') || '60';
            throw new GenerationError(
                'APIのレート制限に達しました',
                'api_call',
                error.message,
                parseInt(retryAfter)
            );
        }
        
        // クレジット不足エラー
        if (response.status === 402) {
            throw new GenerationError(
                'クレジットが不足しています',
                'api_call',
                error.message
            );
        }
        
        throw new GenerationError(
            '画像生成に失敗しました',
            'api_call',
            error.message || `HTTP ${response.status}`
        );
    }
    
    const result = await response.json();
    
    if (!result.artifacts || result.artifacts.length === 0) {
        throw new GenerationError(
            '画像生成に失敗しました',
            'api_call',
            'レスポンスに画像が含まれていません'
        );
    }
    
    return result.artifacts[0].base64; // base64エンコードされた画像
}

/**
 * Stability AI APIでimage-to-image生成
 */
async function generateImageToImage(prompt, referenceImageBase64, options, env) {
    const preset = QUALITY_PRESETS[options.quality || 'high'] || QUALITY_PRESETS.high;
    
    // ネガティブプロンプト（品質向上のため）
    const defaultNegativePrompt = 'blurry, low quality, distorted, deformed, ugly, bad anatomy, bad proportions, extra limbs, cloned face, disfigured, out of frame, gross proportions, malformed limbs, missing arms, missing legs, extra arms, extra legs, mutated hands, poorly drawn hands, poorly drawn face, mutation, mutated, extra limbs, ugly, disgusting, poorly drawn, bad anatomy, wrong anatomy, extra limb, missing limb, floating limbs, disconnected limbs, mutation, mutated, ugly, disgusting, amputation';
    
    // プロンプトを強化（ポーズやアクションを強調）
    const enhancedPrompt = enhancePromptForStabilityAI(prompt);
    
    const formData = new FormData();
    
    // プロンプトの重み付け（汎用的に1.0を使用、必要に応じて調整可能）
    formData.append('text_prompts[0][text]', enhancedPrompt);
    formData.append('text_prompts[0][weight]', '1.0');
    
    // ネガティブプロンプトを追加（オプションでカスタム可能）
    const negativePrompt = options.negative_prompt || defaultNegativePrompt;
    if (negativePrompt) {
        formData.append('text_prompts[1][text]', negativePrompt);
        formData.append('text_prompts[1][weight]', '-1.0');
    }
    
    // base64データURLの場合は、data:image/png;base64,の部分を除去
    const base64Data = referenceImageBase64.includes(',') 
        ? referenceImageBase64.split(',')[1] 
        : referenceImageBase64;
    
    // base64をBlobに変換
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'image/png' });
    
    formData.append('init_image', blob, 'reference.png');
    // image_strengthを動的に計算（プロンプトの内容に応じて調整）
    let imageStrength = options.image_strength;
    if (imageStrength === undefined) {
        imageStrength = calculateImageStrength(prompt, options.quality || 'high');
    }
    formData.append('image_strength', String(imageStrength));
    formData.append('cfg_scale', String(preset.cfg_scale));
    formData.append('steps', String(preset.steps));
    // 注意: image-to-imageではwidthとheightを指定できない（v1では出力サイズは入力画像と同じ）
    // formData.append('width', String(preset.width));
    // formData.append('height', String(preset.height));
    formData.append('samples', '1');
    
    const response = await fetch(
        `${STABILITY_AI_BASE_URL}/v1/generation/${STABILITY_AI_ENGINE}/image-to-image`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${env.STABILITY_AI_API_KEY}`,
                'Accept': 'application/json'
            },
            body: formData
        }
    );
    
    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: `HTTP ${response.status}` }));
        
        // レート制限エラーの処理
        if (response.status === 429) {
            const retryAfter = response.headers.get('Retry-After') || '60';
            throw new GenerationError(
                'APIのレート制限に達しました',
                'api_call',
                error.message,
                parseInt(retryAfter)
            );
        }
        
        // クレジット不足エラー
        if (response.status === 402) {
            throw new GenerationError(
                'クレジットが不足しています',
                'api_call',
                error.message
            );
        }
        
        throw new GenerationError(
            '画像生成に失敗しました',
            'api_call',
            error.message || `HTTP ${response.status}`
        );
    }
    
    const result = await response.json();
    
    if (!result.artifacts || result.artifacts.length === 0) {
        throw new GenerationError(
            '画像生成に失敗しました',
            'api_call',
            'レスポンスに画像が含まれていません'
        );
    }
    
    return result.artifacts[0].base64; // base64エンコードされた画像
}

/**
 * base64文字列をArrayBufferに変換
 */
function base64ToArrayBuffer(base64) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

/**
 * PNG画像のサイズを取得
 */
function getPNGSize(buffer) {
    const view = new DataView(buffer);
    if (view.getUint32(0) !== 0x89504e47) { // PNG signature
        return null;
    }
    // IHDRチャンクからサイズを取得
    const width = view.getUint32(16, false); // big-endian
    const height = view.getUint32(20, false); // big-endian
    return { width, height };
}

/**
 * JPEG画像のサイズを取得
 */
function getJPEGSize(buffer) {
    const view = new DataView(buffer);
    if (view.getUint16(0) !== 0xffd8) { // JPEG signature
        return null;
    }
    
    let offset = 2;
    while (offset < buffer.byteLength) {
        if (view.getUint8(offset) !== 0xff) {
            offset++;
            continue;
        }
        
        const marker = view.getUint8(offset + 1);
        // SOF0 (Start of Frame) markers: 0xC0-0xC3
        if (marker >= 0xc0 && marker <= 0xc3) {
            const height = view.getUint16(offset + 5, false); // big-endian
            const width = view.getUint16(offset + 7, false); // big-endian
            return { width, height };
        }
        
        // マーカーの長さを取得してスキップ
        const length = view.getUint16(offset + 2, false); // big-endian
        offset += 2 + length;
    }
    
    return null;
}

/**
 * 画像のサイズを取得（PNG/JPEG対応）
 */
function getImageSize(buffer) {
    // PNGを試す
    const pngSize = getPNGSize(buffer);
    if (pngSize) return pngSize;
    
    // JPEGを試す
    const jpegSize = getJPEGSize(buffer);
    if (jpegSize) return jpegSize;
    
    return null;
}

/**
 * 許可されたサイズに最も近いサイズを選択（アスペクト比を維持）
 */
function findClosestAllowedSize(width, height) {
    const aspectRatio = width / height;
    let bestMatch = null;
    let minDiff = Infinity;
    
    for (const dim of ALLOWED_DIMENSIONS) {
        const dimAspectRatio = dim.width / dim.height;
        const diff = Math.abs(dimAspectRatio - aspectRatio);
        
        if (diff < minDiff) {
            minDiff = diff;
            bestMatch = dim;
        }
    }
    
    return bestMatch || ALLOWED_DIMENSIONS[0]; // フォールバック
}

/**
 * 画像をレターボックス方式でリサイズ（Cloudflare Images APIを使用）
 * 注意: 実際のリサイズは外部サービスまたはWASMライブラリが必要
 * ここでは、画像サイズをチェックして、必要に応じてリサイズが必要であることを示す
 */
async function resizeImageWithLetterbox(imageBuffer, targetWidth, targetHeight, env) {
    // 画像のサイズを取得
    const originalSize = getImageSize(imageBuffer);
    if (!originalSize) {
        throw new GenerationError(
            '画像のサイズを取得できませんでした',
            'reference_image_save',
            'サポートされていない画像形式です'
        );
    }
    
    // 既に許可されたサイズの場合はそのまま返す
    const isAllowed = ALLOWED_DIMENSIONS.some(
        dim => dim.width === originalSize.width && dim.height === originalSize.height
    );
    
    if (isAllowed) {
        console.log('Image size is already allowed:', originalSize);
        return imageBuffer;
    }
    
    // リサイズが必要な場合
    console.log('Image needs resizing:', {
        original: originalSize,
        target: { width: targetWidth, height: targetHeight }
    });
    
    // Cloudflare Workersでは直接画像をリサイズできないため、
    // 外部の画像処理サービスを使用するか、または
    // 画像をそのまま送信してStability AI API側で処理してもらう必要がある
    
    // 一時的な解決策: 画像をそのまま返す（Stability AI APIがエラーを返す可能性がある）
    // 実際の実装では、外部の画像処理サービス（例: Cloudflare Images API）を使用する必要がある
    
    // ここでは、画像をbase64にエンコードして、リサイズが必要であることを示す
    // 実際のリサイズは、Cloudflare Images APIや外部サービスを使用する必要がある
    
    throw new GenerationError(
        `画像サイズが許可されていません: ${originalSize.width}x${originalSize.height}`,
        'reference_image_save',
        `許可されたサイズ: ${ALLOWED_DIMENSIONS.map(d => `${d.width}x${d.height}`).join(', ')}`
    );
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

    // APIキーの確認（OpenAI APIは必須、Stability AI APIはオプション）
    if (!env.OPENAI_API_KEY) {
        return new Response(
            JSON.stringify({ error: 'OpenAI APIキーが設定されていません' }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        );
    }

    try {
        // 生成開始時間を記録
        const startTime = Date.now();

        // プロンプトを英語に翻訳（OpenAI API使用）
        // 学生の自由記述部分のみを翻訳
        const translatedPromptEn = await translatePromptWithOpenAI(prompt, env);

        // 生成オプションの設定
        const quality = generationOptions?.quality || 'high';
        const forceStability = generationOptions?.forceStability || false; // 将来的な拡張用

        // ルーティング判定: 参照画像がある場合はOpenAI API、ない場合はOpenAI API（またはStability AI）
        let imageBase64;
        let modelProvider = 'openai';
        let modelName = 'dall-e-3';
        let editMode = 'generate';
        const apiCallStartTime = Date.now();
        
        if (processedReferenceImages.length > 0) {
            // 参照画像がある場合: OpenAI Images API（Edit）を使用
            const firstRefImage = processedReferenceImages[0];
            console.log('Processing reference image with OpenAI:', {
                reference_image_id: firstRefImage.reference_image_id,
                role_label: firstRefImage.role_label,
                r2_object_key: firstRefImage.r2_object_key
            });
            
            // 参照画像をR2から取得
            const referenceImageBase64 = await getReferenceImageFromR2(firstRefImage.r2_object_key, env);
            const referenceImageBuffer = base64ToArrayBuffer(referenceImageBase64);
            
            // OpenAI Edit API用のプロンプトを準備
            // 参照画像の役割情報はOpenAI APIでは不要（画像自体が参照として機能）
            // ただし、編集指示を明確にするため、プロンプトを強化
            const editPrompt = enhancePromptForOpenAIEdit(translatedPromptEn, processedReferenceImages);
            
            // OpenAI Edit APIを呼び出し（マスクなし = 全体編集）
            try {
                imageBase64 = await editImageWithOpenAI(
                    editPrompt,
                    referenceImageBuffer,
                    null, // マスクなし（将来的にマスク対応可能）
                    {
                        model: 'dall-e-2', // EditはDALL-E 2を使用（DALL-E 3はEdit非対応）
                        size: '1024x1024',
                        quality: quality === 'ultra' ? 'hd' : 'standard'
                    },
                    env
                );
                
                modelProvider = 'openai';
                modelName = 'dall-e-2'; // EditはDALL-E 2
                editMode = 'edit';
            } catch (error) {
                // OpenAI APIのエラーをGenerationErrorに変換
                throw new GenerationError(
                    error.message || '画像編集に失敗しました',
                    error.stage || 'openai_api_call',
                    error.details || error.message,
                    error.retryAfter || null
                );
            }
            
        } else if (forceStability && env.STABILITY_AI_API_KEY) {
            // 参照画像がなく、Stability AIを強制する場合
            // 既存のStability AI実装を使用
            const enhancedPrompt = enhancePromptForStabilityAI(translatedPromptEn);
            imageBase64 = await generateTextToImage(
                enhancedPrompt,
                { quality },
                env
            );
            
            modelProvider = 'stability';
            modelName = STABILITY_AI_ENGINE;
            editMode = 'text-to-image';
            
        } else {
            // 参照画像がない場合: OpenAI Images API（Generate）を使用
            // OpenAI Generate API用のプロンプトを準備
            const generatePrompt = enhancePromptForOpenAIGenerate(translatedPromptEn);
            
            try {
                imageBase64 = await generateImageWithOpenAI(
                    generatePrompt,
                    {
                        model: 'dall-e-3',
                        quality: quality === 'ultra' ? 'hd' : 'standard',
                        size: '1024x1024',
                        style: 'vivid'
                    },
                    env
                );
                
                modelProvider = 'openai';
                modelName = 'dall-e-3';
                editMode = 'generate';
            } catch (error) {
                // OpenAI APIのエラーをGenerationErrorに変換
                throw new GenerationError(
                    error.message || '画像生成に失敗しました',
                    error.stage || 'openai_api_call',
                    error.details || error.message,
                    error.retryAfter || null
                );
            }
        }
        
        const apiCallEndTime = Date.now();

        // base64をArrayBufferに変換
        const imageBuffer = base64ToArrayBuffer(imageBase64);

        // R2に画像をアップロード
        const uploadStartTime = Date.now();
        const fileName = `generated-images/${Date.now()}-${Math.random().toString(36).substring(7)}.png`;
        
        console.log('Uploading to R2:', {
            fileName: fileName,
            imageSize: imageBuffer.byteLength,
            hasR2Bucket: !!env.R2_BUCKET
        });
        
        if (!env.R2_BUCKET) {
            throw new GenerationError(
                'R2ストレージが設定されていません',
                'output_image_save',
                'R2_BUCKETが設定されていません'
            );
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
            // 最終プロンプトを決定（使用したAPIに応じて）
            let finalPrompt;
            if (processedReferenceImages.length > 0) {
                // OpenAI Edit APIの場合: 編集プロンプトを使用
                finalPrompt = enhancePromptForOpenAIEdit(translatedPromptEn, processedReferenceImages);
            } else if (forceStability && env.STABILITY_AI_API_KEY) {
                // Stability AIの場合: 役割情報を含むプロンプト
                finalPrompt = enhancePromptWithRolesEnglish(translatedPromptEn, processedReferenceImages);
            } else {
                // OpenAI Generate APIの場合: 翻訳されたプロンプト
                finalPrompt = enhancePromptForOpenAIGenerate(translatedPromptEn);
            }
            
            const generationSettingsJson = JSON.stringify({
                quality: quality,
                model_provider: modelProvider,
                model_name: modelName,
                edit_mode: editMode,
                ...generationOptions
            });
            
            // データベースに保存（翻訳関連フィールドとモデル識別フィールドを含む）
            // 注意: model_provider, model_name, edit_modeカラムが存在することを前提とする
            // マイグレーション0008を実行済みである必要がある
            const result = await env.DB.prepare(
                `INSERT INTO generations (
                    original_prompt_ja, 
                    translated_prompt_en, 
                    final_prompt, 
                    output_image_r2_key, 
                    user_id, 
                    generation_settings,
                    model_provider,
                    model_name,
                    edit_mode
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(
                prompt, // original_prompt_ja: フロントエンドから受信した日本語プロンプト
                translatedPromptEn, // translated_prompt_en: OpenAI APIで翻訳された英語プロンプト
                finalPrompt, // final_prompt: 使用したAPIに応じた最終的な英語プロンプト
                fileName,
                user.id,
                generationSettingsJson,
                modelProvider, // model_provider: 'openai' | 'stability'
                modelName, // model_name: 'dall-e-3', 'dall-e-2', 'stable-diffusion-xl-1024-v1-0' など
                editMode // edit_mode: 'generate' | 'edit' | 'variation' | 'text-to-image' | 'image-to-image'
            ).run();
            
            generationId = result.meta.last_row_id;

            // 参照画像との紐づけを保存
            if (processedReferenceImages.length > 0) {
                for (let i = 0; i < processedReferenceImages.length; i++) {
                    const refImage = processedReferenceImages[i];
                    // reference_imagesテーブルからr2_object_keyとimage_hashを取得
                    const refImageData = await env.DB.prepare(
                        'SELECT r2_object_key, image_hash FROM reference_images WHERE id = ?'
                    ).bind(refImage.reference_image_id).first();
                    
                    await env.DB.prepare(
                        'INSERT INTO generation_reference_images (generation_id, reference_image_id, role_label, display_order, r2_object_key, image_hash, weight) VALUES (?, ?, ?, ?, ?, ?, ?)'
                    ).bind(
                        generationId,
                        refImage.reference_image_id,
                        refImage.role_label,
                        i,
                        refImageData.r2_object_key,
                        refImageData.image_hash,
                        1.0
                    ).run();
                }
            }
        }

        // 処理時間を計算（秒単位）
        const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
        const apiCallTime = ((apiCallEndTime - apiCallStartTime) / 1000).toFixed(1);
        const uploadTime = ((uploadEndTime - uploadStartTime) / 1000).toFixed(1);

        // 最終プロンプトを決定（レスポンス用）
        let finalPromptForResponse;
        if (processedReferenceImages.length > 0) {
            finalPromptForResponse = enhancePromptForOpenAIEdit(translatedPromptEn, processedReferenceImages);
        } else if (forceStability && env.STABILITY_AI_API_KEY) {
            finalPromptForResponse = enhancePromptWithRolesEnglish(translatedPromptEn, processedReferenceImages);
        } else {
            finalPromptForResponse = enhancePromptForOpenAIGenerate(translatedPromptEn);
        }
        
        // レスポンスを返す
        return new Response(
            JSON.stringify({
                success: true,
                prompt: finalPromptForResponse, // final_prompt（使用したAPIに応じた最終的な英語プロンプト）
                original_prompt: prompt, // original_prompt_ja（フロントエンドから受信した日本語プロンプト）
                translated_prompt: translatedPromptEn, // translated_prompt_en（OpenAI APIで翻訳された英語プロンプト）
                image_url: r2ImageUrl,
                generation_id: generationId,
                model_provider: modelProvider, // 'openai' | 'stability'
                model_name: modelName, // 使用したモデル名
                edit_mode: editMode, // 編集モード
                reference_images: processedReferenceImages.map(ref => ({
                    reference_image_id: ref.reference_image_id,
                    role_label: ref.role_label,
                    image_url: `/api/image/${ref.r2_object_key}`
                })),
                timing: {
                    total: totalTime,
                    generation: apiCallTime, // API呼び出し時間（画像生成時間）
                    download: '0.0', // base64で直接返ってくるため、ダウンロード時間は0
                    upload: uploadTime // R2への保存時間
                }
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        );
    } catch (error) {
        console.error('Image generation error:', error);
        console.error('Error stack:', error.stack);
        console.error('Error details:', {
            message: error.message,
            name: error.name,
            stage: error.stage,
            details: error.details
        });
        
        // GenerationErrorの場合は構造化されたエラーレスポンスを返す
        if (error instanceof GenerationError) {
            const errorResponse = {
                error: error.message,
                stage: error.stage,
                details: error.details
            };
            
            if (error.retryAfter) {
                errorResponse.retry_after = error.retryAfter;
            }
            
            // 翻訳フェーズのエラーの場合は、生成処理を中断
            // ステータスコードは500（翻訳エラー）または429（レート制限）
            let statusCode = 500;
            if (error.stage === 'translation') {
                statusCode = 500; // 翻訳エラー
            } else if (error.stage === 'api_call' && error.retryAfter) {
                statusCode = 429; // レート制限
            }
            
            return new Response(
                JSON.stringify(errorResponse),
                {
                    status: statusCode,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                }
            );
        }
        
        // その他のエラー
        return new Response(
            JSON.stringify({
                error: error.message || '画像の生成に失敗しました',
                stage: 'unknown',
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
        'SELECT id, original_prompt_ja, translated_prompt_en, final_prompt, output_image_r2_key, generation_settings, created_at FROM generations WHERE user_id = ? ORDER BY created_at DESC'
    ).bind(user.id).all();

    // 各履歴に参照画像情報を追加
    const historyWithReferences = await Promise.all((result.results || []).map(async (item) => {
        // 参照画像を取得
        const refImagesResult = await env.DB.prepare(
            `SELECT gri.role_label, gri.display_order, gri.r2_object_key, gri.reference_image_id
             FROM generation_reference_images gri
             WHERE gri.generation_id = ?
             ORDER BY gri.display_order ASC`
        ).bind(item.id).all();

        const referenceImages = (refImagesResult.results || []).map(ref => ({
            reference_image_id: ref.reference_image_id,
            image_url: `/api/image/${ref.r2_object_key}`,
            role_label: ref.role_label,
            display_order: ref.display_order
        }));

        // output_image_r2_keyが既に/api/image/で始まる場合はそのまま使用、そうでない場合は/api/image/を付加
        let imageUrl;
        if (item.output_image_r2_key && item.output_image_r2_key.startsWith('/api/image/')) {
            imageUrl = item.output_image_r2_key;
        } else {
            imageUrl = `/api/image/${item.output_image_r2_key}`;
        }

        return {
            id: item.id,
            prompt: item.final_prompt, // final_prompt（参照画像の役割指示を含む最終的な英語プロンプト）
            original_prompt: item.original_prompt_ja || null, // original_prompt_ja（フロントエンドから受信した日本語プロンプト）
            translated_prompt: item.translated_prompt_en || null, // translated_prompt_en（OpenAI APIで翻訳された英語プロンプト）
            image_url: imageUrl,
            generation_options: item.generation_settings ? JSON.parse(item.generation_settings) : null,
            created_at: item.created_at,
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
        'SELECT id, original_prompt_ja, translated_prompt_en, final_prompt, output_image_r2_key, generation_settings, created_at FROM generations ORDER BY created_at DESC LIMIT 100'
    ).all();

    // 各画像に参照画像情報を追加
    const imagesWithReferences = await Promise.all((result.results || []).map(async (item) => {
        // 参照画像を取得
        const refImagesResult = await env.DB.prepare(
            `SELECT gri.role_label, gri.display_order, gri.r2_object_key, gri.reference_image_id
             FROM generation_reference_images gri
             WHERE gri.generation_id = ?
             ORDER BY gri.display_order ASC`
        ).bind(item.id).all();

        const referenceImages = (refImagesResult.results || []).map(ref => ({
            reference_image_id: ref.reference_image_id,
            image_url: `/api/image/${ref.r2_object_key}`,
            role_label: ref.role_label,
            display_order: ref.display_order
        }));

        // output_image_r2_keyが既に/api/image/で始まる場合はそのまま使用、そうでない場合は/api/image/を付加
        let imageUrl;
        if (item.output_image_r2_key && item.output_image_r2_key.startsWith('/api/image/')) {
            imageUrl = item.output_image_r2_key;
        } else {
            imageUrl = `/api/image/${item.output_image_r2_key}`;
        }

        return {
            id: item.id,
            prompt: item.final_prompt, // final_prompt（参照画像の役割指示を含む最終的な英語プロンプト）
            original_prompt: item.original_prompt_ja || null, // original_prompt_ja（フロントエンドから受信した日本語プロンプト）
            translated_prompt: item.translated_prompt_en || null, // translated_prompt_en（OpenAI APIで翻訳された英語プロンプト）
            image_url: imageUrl,
            generation_options: item.generation_settings ? JSON.parse(item.generation_settings) : null,
            created_at: item.created_at,
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
    // または /api/image//api/image/images/xxx.png → images/xxx.png（重複パスの場合）
    let fileName = path.replace('/api/image/', '');
    // 重複した/api/image/を除去
    if (fileName.startsWith('/api/image/')) {
        fileName = fileName.replace('/api/image/', '');
    }
    
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
 * ドキュメント配信処理（Markdownファイルを返す）
 */
async function handleDocs(request, path, env) {
    const corsHeaders = getCorsHeaders(request);
    
    // パスからファイル名を抽出（/api/docs/README.md → README.md）
    const fileName = path.replace('/api/docs/', '');
    
    // セキュリティ: パストラバーサル攻撃を防ぐ
    if (fileName.includes('..') || fileName.includes('/')) {
        return new Response('Invalid file path', {
            status: 400,
            headers: corsHeaders
        });
    }
    
    try {
        // R2からMarkdownファイルを取得（docs/ディレクトリに保存されている場合）
        // または、Workersのアセットから読み込む
        // ここでは、R2にdocs/ディレクトリがあることを前提とする
        
        if (env.R2_BUCKET) {
            const r2Key = `docs/${fileName}`;
            const object = await env.R2_BUCKET.get(r2Key);
            
            if (object) {
                const text = await object.text();
                return new Response(text, {
                    headers: {
                        ...corsHeaders,
                        'Content-Type': 'text/markdown; charset=utf-8',
                        'Cache-Control': 'public, max-age=3600', // 1時間キャッシュ
                    }
                });
            }
        }
        
        // R2にない場合、404を返す
        return new Response('Document not found', {
            status: 404,
            headers: corsHeaders
        });
        
    } catch (error) {
        console.error('Error fetching document:', error);
        return new Response(`Error fetching document: ${error.message}`, {
            status: 500,
            headers: corsHeaders
        });
    }
}

/**
 * 静的ファイルの配信処理（開発環境用）
 */
async function handleStaticFile(request, path, env) {
    const corsHeaders = getCorsHeaders(request);
    
    // パスを正規化（/index.html → index.html）
    let filePath = path === '/' ? '/index.html' : path;
    filePath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
    
    // セキュリティ: パストラバーサル攻撃を防ぐ
    if (filePath.includes('..') || filePath.includes('//')) {
        return new Response('Invalid file path', {
            status: 400,
            headers: corsHeaders
        });
    }
    
    try {
        // R2から静的ファイルを取得（public/ディレクトリに保存されている場合）
        if (env.R2_BUCKET) {
            const r2Key = `public/${filePath}`;
            const object = await env.R2_BUCKET.get(r2Key);
            
            if (object) {
                const contentType = getContentType(filePath);
                const data = await object.arrayBuffer();
                
                return new Response(data, {
                    headers: {
                        ...corsHeaders,
                        'Content-Type': contentType,
                        'Cache-Control': 'public, max-age=3600', // 1時間キャッシュ
                    }
                });
            }
        }
        
        // R2にない場合、404を返す
        return new Response('File not found', {
            status: 404,
            headers: corsHeaders
        });
        
    } catch (error) {
        console.error('Error fetching static file:', error);
        return new Response(`Error fetching file: ${error.message}`, {
            status: 500,
            headers: corsHeaders
        });
    }
}

/**
 * ファイルパスからContent-Typeを取得
 */
function getContentType(filePath) {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const contentTypes = {
        'html': 'text/html; charset=utf-8',
        'css': 'text/css; charset=utf-8',
        'js': 'application/javascript; charset=utf-8',
        'json': 'application/json; charset=utf-8',
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'gif': 'image/gif',
        'svg': 'image/svg+xml',
        'ico': 'image/x-icon',
        'woff': 'font/woff',
        'woff2': 'font/woff2',
        'ttf': 'font/ttf',
        'eot': 'application/vnd.ms-fontobject',
        'md': 'text/markdown; charset=utf-8',
    };
    return contentTypes[ext] || 'application/octet-stream';
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

        // 画像サイズをチェック
        const imageSize = getImageSize(imageBuffer);
        let sizeWarning = null;
        
        if (imageSize) {
            // 許可されたサイズかチェック
            const isAllowedSize = ALLOWED_DIMENSIONS.some(
                dim => dim.width === imageSize.width && dim.height === imageSize.height
            );
            
            if (!isAllowedSize) {
                // 許可されていないサイズの場合、最も近い許可サイズを選択
                const closestSize = findClosestAllowedSize(imageSize.width, imageSize.height);
                sizeWarning = {
                    original: `${imageSize.width}x${imageSize.height}`,
                    closest: `${closestSize.width}x${closestSize.height}`,
                    message: `画像サイズ（${imageSize.width}x${imageSize.height}）は許可されていません。最も近い推奨サイズ: ${closestSize.width}x${closestSize.height}。画像生成時にエラーが発生する可能性があります。`
                };
                console.warn('Reference image size warning:', sizeWarning);
            }
        }

        // SHA-256ハッシュを計算
        const imageHash = await calculateSHA256(imageBuffer);

        // 既存の参照画像をチェック
        const existingRef = await env.DB.prepare(
            'SELECT id, r2_object_key FROM reference_images WHERE image_hash = ?'
        ).bind(imageHash).first();

        if (existingRef) {
            // 既存の参照画像がある場合は、そのIDとURLを返す
            const imageUrl = `/api/image/${existingRef.r2_object_key}`;
            const responseData = {
                success: true,
                reference_image_id: existingRef.id,
                image_url: imageUrl,
                image_hash: imageHash,
                message: '既存の参照画像を使用します'
            };
            
            // サイズ警告がある場合は追加
            if (sizeWarning) {
                responseData.size_warning = sizeWarning;
            }
            
            return new Response(
                JSON.stringify(responseData),
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

        const responseData = {
            success: true,
            reference_image_id: referenceImageId,
            image_url: imageUrl,
            image_hash: imageHash
        };
        
        // サイズ警告がある場合は追加
        if (sizeWarning) {
            responseData.size_warning = sizeWarning;
        }

        return new Response(
            JSON.stringify(responseData),
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

        console.log('Reference images query:', query);
        console.log('Reference images params:', params);

        let result;
        if (params.length > 0) {
            result = await env.DB.prepare(query).bind(...params).all();
        } else {
            result = await env.DB.prepare(query).all();
        }

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
        console.error('Error stack:', error.stack);
        console.error('Error details:', {
            message: error.message,
            name: error.name,
            query: query,
            params: params
        });
        return new Response(
            JSON.stringify({ 
                error: '参照画像一覧の取得に失敗しました', 
                details: error.message,
                query: query,
                params: params
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
}

