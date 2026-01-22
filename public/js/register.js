/**
 * ユーザー登録ページのJavaScript
 */

// APIのベースURL（auth.jsが読み込まれている場合はそれを使用、そうでない場合は定義）
// auth.jsで既にconst API_BASE_URLが定義されているため、window.API_BASE_URLを直接参照
if (typeof window.API_BASE_URL === 'undefined') {
    window.API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:8787'
        : 'https://image-generation-api.tkwshnsk.workers.dev';
}
// auth.jsで既にconst API_BASE_URLが定義されているため、window.API_BASE_URLを直接参照
// register.js内では window.API_BASE_URL を直接使用する

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
        console.log('Registering user:', { email: finalEmail, apiUrl: `${window.API_BASE_URL}/api/auth/register` });
        
        const response = await fetch(`${window.API_BASE_URL}/api/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({ email: finalEmail, password }),
        });

        console.log('Response status:', response.status, response.statusText);
        console.log('Response headers:', Object.fromEntries(response.headers.entries()));

        // レスポンスがJSONかどうかを確認
        const contentType = response.headers.get('content-type');
        let data;
        
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('Non-JSON response:', text);
            throw new Error(`サーバーエラー: ${response.status} ${response.statusText} - ${text}`);
        }

        data = await response.json();
        console.log('Response data:', data);

        if (!response.ok) {
            throw new Error(data.error || 'ユーザー登録に失敗しました');
        }

        // 登録成功 - 自動的にログイン状態になる
        if (data.success) {
            console.log('Registration successful, redirecting...');
            
            // 成功メッセージを表示
            const successSection = document.createElement('div');
            successSection.className = 'alert alert-success mt-3 fade-in-up';
            successSection.id = 'successSection';
            successSection.innerHTML = `
                <strong>登録完了！</strong> 自動的にログインしました。TOPページに移動します...
            `;
            errorSection.parentElement.insertBefore(successSection, errorSection);
            
            // フォームをリセット
            document.getElementById('email').value = '';
            document.getElementById('password').value = '';
            document.getElementById('passwordConfirm').value = '';
            
            // 少し待ってからTOPページにリダイレクト
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1500);
        } else {
            throw new Error(data.error || 'ユーザー登録に失敗しました');
        }

    } catch (error) {
        console.error('Registration error:', error);
        console.error('Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        
        let errorMessage = 'ユーザー登録に失敗しました';
        
        if (error.message) {
            errorMessage = error.message;
        } else if (error instanceof TypeError && error.message.includes('fetch')) {
            errorMessage = `APIサーバーに接続できません。サーバーが起動しているか確認してください。\nAPI URL: ${API_BASE_URL}`;
        }
        
        showError(errorMessage);
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
