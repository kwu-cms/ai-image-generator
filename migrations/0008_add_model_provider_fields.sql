-- モデルプロバイダー識別用フィールドの追加
-- OpenAI APIとStability AI APIの混在履歴を区別可能にする

-- generationsテーブルにモデル識別用カラムを追加
ALTER TABLE generations ADD COLUMN model_provider TEXT DEFAULT 'stability'; -- 'openai' | 'stability'
ALTER TABLE generations ADD COLUMN model_name TEXT; -- 'dall-e-3', 'dall-e-2', 'stable-diffusion-xl-1024-v1-0' など
ALTER TABLE generations ADD COLUMN edit_mode TEXT; -- 'generate' | 'edit' | 'variation' | 'image-to-image' | 'text-to-image'

-- インデックスの作成（検索・集計用）
CREATE INDEX IF NOT EXISTS idx_generations_model_provider ON generations(model_provider);
CREATE INDEX IF NOT EXISTS idx_generations_model_name ON generations(model_name);
CREATE INDEX IF NOT EXISTS idx_generations_edit_mode ON generations(edit_mode);
