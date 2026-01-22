/**
 * ログインページのJavaScript
 */

// APIのベースURL（auth.jsが読み込まれている場合はそれを使用、そうでない場合は定義）
// auth.jsで既にconst API_BASE_URLが定義されているため、window.API_BASE_URLを直接参照
if (typeof window.API_BASE_URL === 'undefined') {
    window.API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:8787'
        : 'https://image-generation-api.tkwshnsk.workers.dev';
}
// auth.jsで既にconst API_BASE_URLが定義されているため、window.API_BASE_URLを直接参照
// login.js内では window.API_BASE_URL を直接使用する（const API_BASE_URLは定義しない）

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('loginForm');
    form.addEventListener('submit', handleLogin);
    
    // 既にログインしている場合はリダイレクト
    checkAuthAndRedirect();
});

/**
 * ログイン処理
 */
async function handleLogin(event) {
    event.preventDefault();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const loginBtn = document.getElementById('loginBtn');
    const errorSection = document.getElementById('errorSection');
    const errorMessage = document.getElementById('errorMessage');

    // バリデーション
    if (!email || !password) {
        showError('メールアドレスとパスワードを入力してください');
        return;
    }

    // UIのリセット
    errorSection.style.display = 'none';
    loginBtn.disabled = true;
    loginBtn.textContent = 'ログイン中...';

    try {
        const response = await fetch(`${window.API_BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({ email, password }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'ログインに失敗しました');
        }

        // ログイン成功
        window.location.href = 'index.html';

    } catch (error) {
        console.error('Error:', error);
        showError(error.message || 'ログインに失敗しました');
    } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = 'ログイン';
    }
}

/**
 * エラー表示
 */
function showError(message) {
    const errorSection = document.getElementById('errorSection');
    const errorMessage = document.getElementById('errorMessage');
    errorMessage.textContent = message;
    errorSection.style.display = 'block';
}

/**
 * 認証状態を確認してリダイレクト
 */
async function checkAuthAndRedirect() {
    const user = await getCurrentUser();
    if (user) {
        window.location.href = 'index.html';
    }
}
