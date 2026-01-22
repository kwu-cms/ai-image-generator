/**
 * 設定ページのJavaScript
 */

console.log('settings.js loaded');

// APIのベースURL（auth.jsが読み込まれている場合はそれを使用、そうでない場合は定義）
if (typeof window.API_BASE_URL === 'undefined') {
    window.API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:8787'
        : 'https://image-generation-api.tkwshnsk.workers.dev';
    console.log('window.API_BASE_URL defined in settings.js:', window.API_BASE_URL);
} else {
    console.log('window.API_BASE_URL already defined:', window.API_BASE_URL);
}

document.addEventListener('DOMContentLoaded', async () => {
    // 既に表示されているfade-in-up要素にanimate-inクラスを追加
    setTimeout(() => {
        document.querySelectorAll('.fade-in-up').forEach(el => {
            const rect = el.getBoundingClientRect();
            const isVisible = rect.top < window.innerHeight && rect.bottom > 0;
            if (isVisible) {
                el.classList.add('animate-in');
            }
        });
    }, 100);
    
    // 認証チェック
    const user = await requireAuth();
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    // アカウント情報の読み込み
    await loadAccountInfo();

    // パスワード変更フォームのイベントリスナー
    const changePasswordForm = document.getElementById('changePasswordForm');
    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', handlePasswordChange);
    }
});

/**
 * アカウント情報を読み込んで表示
 */
async function loadAccountInfo() {
    const accountInfo = document.getElementById('accountInfo');
    console.log('loadAccountInfo called, accountInfo element:', accountInfo);
    console.log('accountInfo initial HTML:', accountInfo?.innerHTML);
    console.log('accountInfo initial display style:', accountInfo ? window.getComputedStyle(accountInfo).display : 'N/A');
    
    if (!accountInfo) {
        console.error('accountInfo element not found');
        return;
    }

    try {
        console.log('Getting current user...');
        const user = await getCurrentUser();
        console.log('Current user:', user);
        
        if (!user) {
            accountInfo.innerHTML = '<div class="alert alert-warning">アカウント情報を取得できませんでした。</div>';
            return;
        }

        // ユーザー情報を取得（詳細情報を含む）
        const apiUrl = `${window.API_BASE_URL}/api/auth/me`;
        console.log('Fetching user info from:', apiUrl);
        console.log('window.API_BASE_URL:', window.API_BASE_URL);
        
        const response = await fetch(apiUrl, {
            credentials: 'include',
        });
        
        console.log('Response status:', response.status);

        if (!response.ok) {
            throw new Error('アカウント情報の取得に失敗しました');
        }

        const data = await response.json();
        console.log('User info response:', data);
        const userInfo = data.user;
        console.log('User info:', userInfo);

        // アカウント情報を表示
        const accountInfoHtml = `
            <div class="row">
                <div class="col-md-6 mb-3">
                    <label class="form-label text-muted small">メールアドレス</label>
                    <div class="p-2 bg-light rounded border">${escapeHtml(userInfo.email)}</div>
                </div>
                <div class="col-md-6 mb-3">
                    <label class="form-label text-muted small">学籍番号</label>
                    <div class="p-2 bg-light rounded border">${escapeHtml(userInfo.studentId || '未設定')}</div>
                </div>
                <div class="col-md-6 mb-3">
                    <label class="form-label text-muted small">アカウント作成日</label>
                    <div class="p-2 bg-light rounded border">${formatDate(userInfo.createdAt)}</div>
                </div>
                <div class="col-md-6 mb-3">
                    <label class="form-label text-muted small">最終ログイン</label>
                    <div class="p-2 bg-light rounded border">${userInfo.lastLogin ? formatDate(userInfo.lastLogin) : '未ログイン'}</div>
                </div>
            </div>
        `;
        
        console.log('Setting accountInfo.innerHTML');
        console.log('accountInfoHtml:', accountInfoHtml);
        accountInfo.innerHTML = accountInfoHtml;
        console.log('Account info displayed successfully');
        console.log('accountInfo after setting:', accountInfo.innerHTML.substring(0, 200));
        
        // 表示確認
        const accountInfoDisplay = window.getComputedStyle(accountInfo);
        console.log('accountInfo computed style:', {
            display: accountInfoDisplay.display,
            visibility: accountInfoDisplay.visibility,
            opacity: accountInfoDisplay.opacity,
            height: accountInfoDisplay.height
        });
    } catch (error) {
        console.error('Error loading account info:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack
        });
        accountInfo.innerHTML = `<div class="alert alert-danger">アカウント情報の読み込みに失敗しました: ${error.message}</div>`;
    }
}

/**
 * パスワード変更処理
 */
async function handlePasswordChange(event) {
    event.preventDefault();

    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const errorDiv = document.getElementById('passwordChangeError');
    const successDiv = document.getElementById('passwordChangeSuccess');
    const submitBtn = event.target.querySelector('button[type="submit"]');

    // エラーメッセージをクリア
    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';
    errorDiv.textContent = '';

    // バリデーション
    if (!currentPassword || !newPassword || !confirmPassword) {
        errorDiv.textContent = 'すべてのフィールドを入力してください';
        errorDiv.style.display = 'block';
        return;
    }

    if (newPassword.length < 4 || newPassword.length > 12) {
        errorDiv.textContent = 'パスワードは4文字以上12文字以下で入力してください';
        errorDiv.style.display = 'block';
        return;
    }

    if (newPassword !== confirmPassword) {
        errorDiv.textContent = '新しいパスワードが一致しません';
        errorDiv.style.display = 'block';
        return;
    }

    if (currentPassword === newPassword) {
        errorDiv.textContent = '現在のパスワードと新しいパスワードが同じです';
        errorDiv.style.display = 'block';
        return;
    }

    // パスワード変更リクエスト
    submitBtn.disabled = true;
    submitBtn.textContent = '変更中...';

    try {
        const response = await fetch(`${window.API_BASE_URL}/api/auth/change-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
                currentPassword,
                newPassword,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'パスワードの変更に失敗しました');
        }

        // 成功メッセージを表示
        successDiv.textContent = 'パスワードが正常に変更されました';
        successDiv.style.display = 'block';

        // フォームをリセット
        document.getElementById('changePasswordForm').reset();

        // 3秒後にメッセージを非表示
        setTimeout(() => {
            successDiv.style.display = 'none';
        }, 3000);
    } catch (error) {
        console.error('Password change error:', error);
        errorDiv.textContent = error.message || 'パスワードの変更に失敗しました';
        errorDiv.style.display = 'block';
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'パスワードを変更';
    }
}

/**
 * HTMLエスケープ
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * 日付をフォーマット（日本時間で表示）
 * Cloudflare WorkersはUTC時間を使用するため、日本時間（JST、UTC+9）に変換
 */
function formatDate(dateString) {
    if (!dateString) return '未設定';
    // UTC時間として解釈（データベースはUTCで保存されている）
    const date = new Date(dateString + (dateString.includes('Z') ? '' : 'Z'));
    // 日本時間（JST、UTC+9）に変換
    const jstDate = new Date(date.getTime() + (9 * 60 * 60 * 1000));
    return jstDate.toLocaleString('ja-JP', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}
