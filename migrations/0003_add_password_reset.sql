-- パスワードリセットトークンと有効期限を追加
ALTER TABLE users ADD COLUMN reset_token TEXT;
ALTER TABLE users ADD COLUMN reset_token_expires DATETIME;

-- リセットトークンのインデックス
CREATE INDEX IF NOT EXISTS idx_reset_token ON users(reset_token);
