-- OpenAI翻訳レイヤー実装: 翻訳関連フィールドの追加

-- 1. generationsテーブルに翻訳関連フィールドを追加
ALTER TABLE generations ADD COLUMN original_prompt_ja TEXT;
ALTER TABLE generations ADD COLUMN translated_prompt_en TEXT;

-- 2. 翻訳キャッシュテーブルの作成
CREATE TABLE IF NOT EXISTS prompt_translations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_prompt_ja TEXT NOT NULL,
    translated_prompt_en TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(original_prompt_ja)
);

-- 3. インデックスの作成
CREATE INDEX IF NOT EXISTS idx_prompt_translations_original ON prompt_translations(original_prompt_ja);
CREATE INDEX IF NOT EXISTS idx_generations_original_prompt_ja ON generations(original_prompt_ja);
CREATE INDEX IF NOT EXISTS idx_generations_translated_prompt_en ON generations(translated_prompt_en);
