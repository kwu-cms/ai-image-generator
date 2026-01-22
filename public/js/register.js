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
    const password = document.getElementById('password').value;
    const passwordConfirm = document.getElementById('passwordConfirm').value;
    const registerBtn = document.getElementById('registerBtn');
    const errorSection = document.getElementById('errorSection');
    const errorMessage = document.getElementById('errorMessage');

    // バリデーション
    if (!email || !password || !passwordConfirm) {
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

    // メールアドレスの形式チェック（自動補完されていない場合は補完を試みる）
    let finalEmail = email;
    if (!email.includes('@')) {
        // kで始まる8文字（k + 7文字）の場合は自動補完
        if (email.startsWith('k') && email.length === 8) {
            const studentPart = email.substring(1);
            if (/^(a\d{6}|\d{7})$/.test(studentPart)) {
                finalEmail = email + '@konan-wu.ac.jp';
                document.getElementById('email').value = finalEmail;
            }
        } else {
            // その他の場合は、@konan-wu.ac.jpを追加
            if (email.length > 0 && /^[a-zA-Z0-9._-]+$/.test(email)) {
                finalEmail = email + '@konan-wu.ac.jp';
                document.getElementById('email').value = finalEmail;
            }
        }
    }
    
    // @konan-wu.ac.jp で終わるメールアドレスを許可
    if (!finalEmail.match(/^[a-zA-Z0-9._-]+@konan-wu\.ac\.jp$/)) {
        showError('メールアドレスの形式が正しくありません（@konan-wu.ac.jp で終わるメールアドレスを入力してください）');
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
            body: JSON.stringify({ email: finalEmail, password }),
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
