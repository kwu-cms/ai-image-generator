/**
 * 認証ユーティリティ
 * パスワードハッシュ化、検証、セッション管理
 */

/**
 * パスワードをハッシュ化（Web Crypto API使用）
 */
export async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * パスワードを検証
 */
export async function verifyPassword(password, hash) {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

/**
 * セッショントークンを生成
 */
export function generateSessionToken() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * セッションを保存
 */
export async function saveSession(kv, token, userId, email) {
  const sessionData = {
    userId,
    email,
    createdAt: Date.now(),
  };
  // セッションは30日間有効
  await kv.put(`session:${token}`, JSON.stringify(sessionData), { expirationTtl: 60 * 60 * 24 * 30 });
}

/**
 * セッションを取得
 */
export async function getSession(kv, token) {
  if (!token) return null;
  const sessionData = await kv.get(`session:${token}`);
  if (!sessionData) return null;
  return JSON.parse(sessionData);
}

/**
 * セッションを削除
 */
export async function deleteSession(kv, token) {
  if (token) {
    await kv.delete(`session:${token}`);
  }
}

/**
 * リクエストからセッショントークンを取得
 */
export function getSessionTokenFromRequest(request) {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) return null;
  
  const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    acc[key] = value;
    return acc;
  }, {});
  
  return cookies['session_token'] || null;
}

/**
 * 学籍番号のバリデーション
 */
export function validateStudentId(studentId) {
  // aで始まる（2025年度以降）または数字のみ（それ以前）
  const pattern = /^(a\d{6}|\d{7})$/;
  return pattern.test(studentId);
}

/**
 * メールアドレスのバリデーション
 */
export function validateEmail(email) {
  // ka225053@konan-wu.ac.jp または k1524005@konan-wu.ac.jp 形式
  // k + (a + 6桁の数字 または 7桁の数字) + @konan-wu.ac.jp
  const pattern = /^k(a\d{6}|\d{7})@konan-wu\.ac\.jp$/;
  return pattern.test(email);
}

/**
 * 学籍番号とメールアドレスの整合性をチェック
 */
export function validateEmailStudentIdMatch(email, studentId) {
  // メールアドレスから学籍番号部分を抽出
  // ka225053@konan-wu.ac.jp → a225053
  // k1524005@konan-wu.ac.jp → 1524005
  const match = email.match(/^k(a\d{6}|\d{7})@konan-wu\.ac\.jp$/);
  if (!match) {
    return false;
  }
  
  const emailStudentId = match[1]; // メールアドレスから抽出した学籍番号部分
  
  // 学籍番号と一致するか確認
  return emailStudentId === studentId;
}

/**
 * パスワードのバリデーション
 */
export function validatePassword(password) {
  // 4文字以上12文字以下
  return password.length >= 4 && password.length <= 12;
}
