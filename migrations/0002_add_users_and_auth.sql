-- ユーザーテーブルの作成
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    student_id TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
);

-- 学籍番号のインデックス
CREATE INDEX IF NOT EXISTS idx_student_id ON users(student_id);
CREATE INDEX IF NOT EXISTS idx_email ON users(email);

-- imagesテーブルにuser_idカラムを追加
ALTER TABLE images ADD COLUMN user_id INTEGER;

-- user_idのインデックス
CREATE INDEX IF NOT EXISTS idx_images_user_id ON images(user_id);

-- 外部キー制約（SQLiteではサポートされていないため、アプリケーション側で管理）
-- FOREIGN KEY (user_id) REFERENCES users(id)
