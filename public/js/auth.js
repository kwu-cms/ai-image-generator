/**
 * 認証関連の共通関数
 */

console.log('auth.js loaded');

// APIのベースURL（グローバルに定義）
if (typeof window.API_BASE_URL === 'undefined') {
  window.API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8787'
    : 'https://image-generation-api.tkwshnsk.workers.dev';
  console.log('window.API_BASE_URL defined in auth.js:', window.API_BASE_URL);
} else {
  console.log('window.API_BASE_URL already defined:', window.API_BASE_URL);
}
const API_BASE_URL = window.API_BASE_URL;

/**
 * 現在のユーザー情報を取得
 */
async function getCurrentUser() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
      credentials: 'include',
    });
    
    // 401 (Unauthorized) は認証されていない状態を示す正常なレスポンスなので、エラーとして扱わない
    if (response.status === 401) {
      return null;
    }
    
    if (!response.ok) {
      // 401以外のエラーの場合のみログを出力
      console.error('Error getting current user:', response.status, response.statusText);
      return null;
    }
    
    const data = await response.json();
    return data.user || null;
  } catch (error) {
    // ネットワークエラーなどの場合のみログを出力
    console.error('Error getting current user:', error);
    return null;
  }
}

/**
 * ログイン状態を確認
 */
async function checkAuth() {
  const user = await getCurrentUser();
  return user !== null;
}

/**
 * ログアウト
 */
async function logout() {
  try {
    await fetch(`${API_BASE_URL}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
    window.location.href = 'login.html';
  } catch (error) {
    console.error('Logout error:', error);
    window.location.href = 'login.html';
  }
}

/**
 * 認証が必要なページでログイン状態を確認
 */
async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = 'login.html';
    return null;
  }
  return user;
}
