/**
 * ユーザー登録ページのJavaScript
 */

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('registerForm');
    form.addEventListener('submit', handleRegister);
    
    // パスワード確認のバリデーション
    const passwordConfirm = document.getElementById('passwordConfirm');
    passwordConfirm.addEventListener('input', validatePasswordMatch);
});

/**
 * ユーザー登録処理
 */
async function handleRegister(event) {
    event.preventDefault();

    const email = document.getElementById('email').value.trim();
    const studentId = document.getElementById('studentId').value.trim();
    const password = document.getElementById('password').value;
    const passwordConfirm = document.getElementById('passwordConfirm').value;
    const registerBtn = document.getElementById('registerBtn');
    const errorSection = document.getElementById('errorSection');
    const errorMessage = document.getElementById('errorMessage');

    // バリデーション
    if (!email || !studentId || !password || !passwordConfirm) {
        showError('すべての項目を入力してください');
        return;
    }

    if (password !== passwordConfirm) {
        showError('パスワードが一致しません');
        return;
    }

    if (password.length < 4 || password.length > 12) {
        showError('パスワードは4文字以上12文字以下で入力してください');
        return;
    }

    // メールアドレスの形式チェック
    if (!email.match(/^k(a\d{6}|\d{7})@konan-wu\.ac\.jp$/)) {
        showError('メールアドレスの形式が正しくありません（例: ka225053@konan-wu.ac.jp または k1524005@konan-wu.ac.jp）');
        return;
    }

    // 学籍番号の形式チェック
    if (!studentId.match(/^(a\d{6}|\d{7})$/)) {
        showError('学籍番号の形式が正しくありません（例: a225053 または 1524005）');
        return;
    }

    // メールアドレスと学籍番号の整合性チェック
    const emailMatch = email.match(/^k(a\d{6}|\d{7})@konan-wu\.ac\.jp$/);
    if (!emailMatch || emailMatch[1] !== studentId) {
        showError('メールアドレスと学籍番号が一致しません（例: 学籍番号がa225053の場合、メールアドレスはka225053@konan-wu.ac.jp）');
        return;
    }

    // UIのリセット
    errorSection.style.display = 'none';
    registerBtn.disabled = true;
    registerBtn.textContent = '登録中...';

    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({ email, studentId, password }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'ユーザー登録に失敗しました');
        }

        // 登録成功
        alert('ユーザー登録が完了しました。ログインページに移動します。');
        window.location.href = 'login.html';

    } catch (error) {
        console.error('Error:', error);
        showError(error.message || 'ユーザー登録に失敗しました');
    } finally {
        registerBtn.disabled = false;
        registerBtn.textContent = '登録';
    }
}

/**
 * パスワード一致確認
 */
function validatePasswordMatch() {
    const password = document.getElementById('password').value;
    const passwordConfirm = document.getElementById('passwordConfirm').value;
    const confirmField = document.getElementById('passwordConfirm');

    if (passwordConfirm && password !== passwordConfirm) {
        confirmField.setCustomValidity('パスワードが一致しません');
    } else {
        confirmField.setCustomValidity('');
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
