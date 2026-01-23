-- Stability AI移行: imagesテーブルをgenerationsテーブルにリネーム
-- 注意: SQLiteではALTER TABLE RENAME TOが使用可能

-- 1. imagesテーブルをgenerationsにリネーム
ALTER TABLE images RENAME TO generations;

-- 2. promptカラムをfinal_promptにリネーム
-- 注意: SQLiteではALTER TABLE RENAME COLUMNが使用可能（SQLite 3.25.0以降）
-- 古いバージョンの場合は、新しいテーブルを作成してデータを移行する必要がある

-- SQLite 3.25.0以降の場合
ALTER TABLE generations RENAME COLUMN prompt TO final_prompt;

-- 古いSQLiteバージョンの場合（上記が失敗する場合）は、以下の手順を実行：
-- 1. 新しいテーブルを作成
-- CREATE TABLE generations_new (
--     id INTEGER PRIMARY KEY AUTOINCREMENT,
--     final_prompt TEXT NOT NULL,
--     image_url TEXT NOT NULL,
--     created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
--     user_id INTEGER,
--     generation_options TEXT
-- );
-- 2. データをコピー
-- INSERT INTO generations_new (id, final_prompt, image_url, created_at, user_id, generation_options)
-- SELECT id, prompt, image_url, created_at, user_id, generation_options FROM generations;
-- 3. 古いテーブルを削除
-- DROP TABLE generations;
-- 4. 新しいテーブルをリネーム
-- ALTER TABLE generations_new RENAME TO generations;

-- 3. generation_optionsカラムをgeneration_settingsにリネーム
ALTER TABLE generations RENAME COLUMN generation_options TO generation_settings;

-- 4. image_urlカラムをoutput_image_r2_keyにリネーム
ALTER TABLE generations RENAME COLUMN image_url TO output_image_r2_key;

-- 5. インデックスの再作成（リネーム後、インデックス名を更新）
-- 既存のインデックスは自動的に維持されるが、名前を明確にするため再作成
DROP INDEX IF EXISTS idx_created_at;
CREATE INDEX IF NOT EXISTS idx_generations_created_at ON generations(created_at DESC);

DROP INDEX IF EXISTS idx_images_user_id;
CREATE INDEX IF NOT EXISTS idx_generations_user_id ON generations(user_id);
