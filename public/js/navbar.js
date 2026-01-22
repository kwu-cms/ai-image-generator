/**
 * ナビゲーションバーのスクロールエフェクトとログイン状態の表示
 */

document.addEventListener('DOMContentLoaded', async () => {
    const navbar = document.querySelector('.navbar');
    
    if (!navbar) return;
    
    // スクロールエフェクト
    let lastScroll = 0;
    
    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;
        
        // スクロール時にシャドウを追加
        if (currentScroll > 10) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
        
        lastScroll = currentScroll;
    });
    
    // ログイン状態の更新
    await updateNavbarAuthState();
});

/**
 * ナビゲーションバーのログイン状態を更新
 */
async function updateNavbarAuthState() {
    const userInfo = document.getElementById('userInfo');
    const loginLink = document.getElementById('loginLink');
    const userEmail = document.getElementById('userEmail');
    const userDropdown = document.getElementById('userDropdown');
    const userDropdownToggle = document.getElementById('userDropdownToggle');
    
    // getCurrentUser関数が利用可能か確認
    if (typeof getCurrentUser !== 'function') {
        console.warn('getCurrentUser function is not available');
        return;
    }
    
    try {
        const user = await getCurrentUser();
        
        if (user) {
            // ログイン済みの場合
            if (userInfo) {
                userInfo.style.display = 'none';
            }
            if (loginLink) {
                loginLink.style.display = 'none';
            }
            if (userDropdown) {
                userDropdown.style.display = 'block';
            }
            if (userDropdownToggle) {
                const emailSpan = userDropdownToggle.querySelector('.user-email');
                if (emailSpan) {
                    emailSpan.textContent = user.email;
                }
            }
        } else {
            // 未ログインの場合
            if (userInfo) {
                userInfo.style.display = 'none';
            }
            if (loginLink) {
                loginLink.style.display = 'block';
            }
            if (userDropdown) {
                userDropdown.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('Error updating navbar auth state:', error);
        // エラー時は未ログイン状態として表示
        if (userInfo) {
            userInfo.style.display = 'none';
        }
        if (loginLink) {
            loginLink.style.display = 'block';
        }
        if (userDropdown) {
            userDropdown.style.display = 'none';
        }
    }
}
