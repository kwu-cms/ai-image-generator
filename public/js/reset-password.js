/**
 * パスワード再設定ページの処理
 */

// APIのベースURL（auth.jsが読み込まれている場合はそれを使用、そうでない場合は定義）
// auth.jsで既にconst API_BASE_URLが定義されているため、window.API_BASE_URLを直接参照
if (typeof window.API_BASE_URL === 'undefined') {
    window.API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:8787'
        : 'https://image-generation-api.tkwshnsk.workers.dev';
}
// auth.jsで既にconst API_BASE_URLが定義されているため、window.API_BASE_URLを直接参照
// reset-password.js内では window.API_BASE_URL を直接使用する（const API_BASE_URLは定義しない）

// URLパラメータからトークンを取得
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('token');

// ページ読み込み時にトークンがあるかチェック
document.addEventListener('DOMContentLoaded', () => {
    if (token) {
        // トークンがある場合はパスワード再設定フォームを表示
        document.getElementById('requestSection').style.display = 'none';
        document.getElementById('resetSection').style.display = 'block';
        document.getElementById('resetToken').value = token;
    } else {
        // トークンがない場合はリセットリクエストフォームを表示
        document.getElementById('requestSection').style.display = 'block';
        document.getElementById('resetSection').style.display = 'none';
    }
});

/**
 * パスワード再設定リクエストの処理
 */
document.getElementById('resetRequestForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const emailInput = document.getElementById('email');
    const email = emailInput.value.trim();
    const requestBtn = document.getElementById('requestBtn');
    const errorSection = document.getElementById('errorSection');
    const errorMessage = document.getElementById('errorMessage');
    const successSection = document.getElementById('successSection');
    const successMessage = document.getElementById('successMessage');

    // エラーメッセージを非表示
    errorSection.style.display = 'none';
    successSection.style.display = 'none';

    // バリデーション
    if (!email) {
        errorMessage.textContent = 'メールアドレスを入力してください';
        errorSection.style.display = 'block';
        return;
    }

    // メールアドレスの自動補完を適用
    let finalEmail = email;
    if (!email.includes('@')) {
        // 有効な文字列の場合、自動補完
        if (email.length > 0 && /^[a-zA-Z0-9._-]+$/.test(email)) {
            finalEmail = email + '@konan-wu.ac.jp';
            emailInput.value = finalEmail;
        } else {
            errorMessage.textContent = '有効なメールアドレスを入力してください';
            errorSection.style.display = 'block';
            return;
        }
    }
    
    // @konan-wu.ac.jp で終わるメールアドレスをチェック
    if (!finalEmail.match(/^[a-zA-Z0-9._-]+@konan-wu\.ac\.jp$/)) {
        errorMessage.textContent = 'メールアドレスは@konan-wu.ac.jpで終わる必要があります';
        errorSection.style.display = 'block';
        return;
    }

    // ボタンを無効化
    requestBtn.disabled = true;
    requestBtn.textContent = '送信中...';

    try {
        const response = await fetch(`${window.API_BASE_URL}/api/auth/reset-request`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email: finalEmail }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
            // 開発環境ではトークンを表示
            if (data.resetToken) {
                const resetUrl = `${window.location.origin}${window.location.pathname}?token=${data.resetToken}`;
                successMessage.innerHTML = `
                    <strong>リクエストを受け付けました</strong><br>
                    <small class="text-muted">[開発用] 以下のリンクからパスワードを再設定できます：<br>
                    <a href="${resetUrl}" class="text-break">${resetUrl}</a></small>
                `;
            } else {
                successMessage.textContent = data.message || 'パスワード再設定のリクエストを受け付けました。メールアドレスに再設定リンクを送信しました。';
            }
            successSection.style.display = 'block';
            
            // フォームをリセット
            emailInput.value = '';
        } else {
            errorMessage.textContent = data.error || 'パスワード再設定リクエストに失敗しました';
            errorSection.style.display = 'block';
        }
    } catch (error) {
        console.error('Reset request error:', error);
        errorMessage.textContent = 'ネットワークエラーが発生しました。しばらくしてから再度お試しください。';
        errorSection.style.display = 'block';
    } finally {
        // ボタンを再有効化
        requestBtn.disabled = false;
        requestBtn.textContent = '再設定リンクを送信';
    }
});

/**
 * パスワード再設定の処理
 */
document.getElementById('resetPasswordForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const resetToken = document.getElementById('resetToken').value;
    const newPassword = document.getElementById('newPassword').value;
    const newPasswordConfirm = document.getElementById('newPasswordConfirm').value;
    const resetBtn = document.getElementById('resetBtn');
    const resetErrorSection = document.getElementById('resetErrorSection');
    const resetErrorMessage = document.getElementById('resetErrorMessage');
    const resetSuccessSection = document.getElementById('resetSuccessSection');
    const resetSuccessMessage = document.getElementById('resetSuccessMessage');

    // エラーメッセージを非表示
    resetErrorSection.style.display = 'none';
    resetSuccessSection.style.display = 'none';

    // バリデーション
    if (!resetToken) {
        resetErrorMessage.textContent = 'リセットトークンが無効です';
        resetErrorSection.style.display = 'block';
        return;
    }

    if (!newPassword || newPassword.length < 4 || newPassword.length > 12) {
        resetErrorMessage.textContent = 'パスワードは4文字以上12文字以下で入力してください';
        resetErrorSection.style.display = 'block';
        return;
    }

    if (newPassword !== newPasswordConfirm) {
        resetErrorMessage.textContent = 'パスワードが一致しません';
        resetErrorSection.style.display = 'block';
        return;
    }

    // ボタンを無効化
    resetBtn.disabled = true;
    resetBtn.textContent = '再設定中...';

    try {
        const response = await fetch(`${window.API_BASE_URL}/api/auth/reset-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                token: resetToken,
                newPassword: newPassword,
            }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
            resetSuccessMessage.textContent = data.message || 'パスワードの再設定が完了しました。ログインページからログインしてください。';
            resetSuccessSection.style.display = 'block';
            
            // フォームを非表示
            document.getElementById('resetPasswordForm').style.display = 'none';
            
            // 3秒後にログインページにリダイレクト
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 3000);
        } else {
            resetErrorMessage.textContent = data.error || 'パスワードの再設定に失敗しました';
            resetErrorSection.style.display = 'block';
        }
    } catch (error) {
        console.error('Reset password error:', error);
        resetErrorMessage.textContent = 'ネットワークエラーが発生しました。しばらくしてから再度お試しください。';
        resetErrorSection.style.display = 'block';
    } finally {
        // ボタンを再有効化
        resetBtn.disabled = false;
        resetBtn.textContent = 'パスワードを再設定';
    }
});
