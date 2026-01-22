/**
 * 認証ユーティリティ
 * パスワードハッシュ化、検証、セッション管理
 */

// PBKDF2設定（Cloudflare Workersの制約を考慮して最大100,000イテレーション）
const PBKDF2_ITERATIONS = 100000;
const PBKDF2_HASH_ALGORITHM = 'SHA-256';
const SALT_LENGTH = 32; // 32バイト（256ビット）のソルト

/**
 * ランダムなソルトを生成
 */
function generateSalt() {
  const array = new Uint8Array(SALT_LENGTH);
  crypto.getRandomValues(array);
  return array;
}

/**
 * ArrayBufferを16進数文字列に変換
 */
function arrayBufferToHex(buffer) {
  const array = new Uint8Array(buffer);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * 16進数文字列をArrayBufferに変換
 */
function hexToArrayBuffer(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes.buffer;
}

/**
 * パスワードをPBKDF2でハッシュ化（ソルト付き）
 * 形式: pbkdf2:iterations:salt:hash
 */
export async function hashPassword(password) {
  const encoder = new TextEncoder();
  const passwordData = encoder.encode(password);
  
  // ランダムなソルトを生成
  const salt = generateSalt();
  
  // インポートキーを作成
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordData,
    'PBKDF2',
    false,
    ['deriveBits']
  );
  
  // PBKDF2でハッシュを生成
  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: PBKDF2_ITERATIONS,
      hash: PBKDF2_HASH_ALGORITHM,
    },
    keyMaterial,
    256 // 256ビット（32バイト）のハッシュ
  );
  
  // ソルトとハッシュを16進数文字列に変換
  const saltHex = arrayBufferToHex(salt);
  const hashHex = arrayBufferToHex(hashBuffer);
  
  // 形式: pbkdf2:iterations:salt:hash
  return `pbkdf2:${PBKDF2_ITERATIONS}:${saltHex}:${hashHex}`;
}

/**
 * パスワードを検証
 * 後方互換性のため、古いSHA-256ハッシュも検証可能
 */
export async function verifyPassword(password, storedHash) {
  // 新しいPBKDF2形式かどうかを確認
  if (storedHash.startsWith('pbkdf2:')) {
    // 形式: pbkdf2:iterations:salt:hash
    const parts = storedHash.split(':');
    if (parts.length !== 4) {
      return false;
    }
    
    const iterations = parseInt(parts[1], 10);
    const saltHex = parts[2];
    const expectedHashHex = parts[3];
    
    const encoder = new TextEncoder();
    const passwordData = encoder.encode(password);
    const salt = hexToArrayBuffer(saltHex);
    
    // インポートキーを作成
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordData,
      'PBKDF2',
      false,
      ['deriveBits']
    );
    
    // PBKDF2でハッシュを生成
    const hashBuffer = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: iterations,
        hash: PBKDF2_HASH_ALGORITHM,
      },
      keyMaterial,
      256 // 256ビット（32バイト）のハッシュ
    );
    
    const computedHashHex = arrayBufferToHex(hashBuffer);
    return computedHashHex === expectedHashHex;
  } else {
    // 古いSHA-256形式（後方互換性のため）
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex === storedHash;
  }
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
  // 任意の文字列を許可（空文字列は不可）
  // 既存形式: aで始まる（2025年度以降）または数字のみ（それ以前）
  // 新形式: 任意の文字列（例: takawo）
  if (!studentId || studentId.length === 0) {
    return false;
  }
  // 基本的な文字列チェック（英数字、アンダースコア、ハイフン、ドットを許可）
  const pattern = /^[a-zA-Z0-9._-]+$/;
  return pattern.test(studentId);
}

/**
 * メールアドレスのバリデーション
 */
export function validateEmail(email) {
  // @konan-wu.ac.jp で終わるメールアドレスを許可
  // 既存形式: ka225053@konan-wu.ac.jp または k1524005@konan-wu.ac.jp
  // 新形式: takawo@konan-wu.ac.jp など任意のローカル部分
  const pattern = /^[a-zA-Z0-9._-]+@konan-wu\.ac\.jp$/;
  return pattern.test(email);
}

/**
 * メールアドレスから学籍番号を抽出
 * @param {string} email - メールアドレス（例: ka225053@konan-wu.ac.jp または takawo@konan-wu.ac.jp）
 * @returns {string|null} - 学籍番号（例: a225053, 1524005, takawo）、無効な場合はnull
 */
export function extractStudentIdFromEmail(email) {
  // @konan-wu.ac.jp で終わるメールアドレスからローカル部分を抽出
  const match = email.match(/^([a-zA-Z0-9._-]+)@konan-wu\.ac\.jp$/);
  if (!match) {
    return null;
  }
  return match[1]; // メールアドレスのローカル部分（@の前）
}

/**
 * 学籍番号とメールアドレスの整合性をチェック
 */
export function validateEmailStudentIdMatch(email, studentId) {
  // メールアドレスから学籍番号部分を抽出
  const emailStudentId = extractStudentIdFromEmail(email);
  if (!emailStudentId) {
    return false;
  }
  
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

/**
 * パスワードリセットトークンを生成
 */
export function generateResetToken() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}
