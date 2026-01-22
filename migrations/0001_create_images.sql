-- 画像生成履歴テーブルの作成
CREATE TABLE IF NOT EXISTS images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prompt TEXT NOT NULL,
    image_url TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- インデックスの作成（作成日時でソートするため）
CREATE INDEX IF NOT EXISTS idx_created_at ON images(created_at DESC);
