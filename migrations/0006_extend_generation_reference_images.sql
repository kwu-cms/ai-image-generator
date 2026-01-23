-- Stability AI移行: generation_reference_imagesテーブルの拡張

-- 1. r2_object_keyカラムを追加（参照画像のR2キーを保存）
ALTER TABLE generation_reference_images ADD COLUMN r2_object_key TEXT;

-- 2. image_hashカラムを追加（参照画像のハッシュ値を保存）
ALTER TABLE generation_reference_images ADD COLUMN image_hash TEXT;

-- 3. weightカラムを追加（将来的な拡張用：画像の影響度）
ALTER TABLE generation_reference_images ADD COLUMN weight REAL DEFAULT 1.0;

-- 4. 既存データの移行（reference_imagesテーブルから情報を取得）
-- 注意: 既存のgeneration_reference_imagesレコードにr2_object_keyとimage_hashを設定
UPDATE generation_reference_images
SET 
    r2_object_key = (
        SELECT ri.r2_object_key 
        FROM reference_images ri 
        WHERE ri.id = generation_reference_images.reference_image_id
    ),
    image_hash = (
        SELECT ri.image_hash 
        FROM reference_images ri 
        WHERE ri.id = generation_reference_images.reference_image_id
    )
WHERE r2_object_key IS NULL;

-- 5. インデックスの追加（必要に応じて）
CREATE INDEX IF NOT EXISTS idx_gen_ref_r2_key ON generation_reference_images(r2_object_key);
CREATE INDEX IF NOT EXISTS idx_gen_ref_image_hash ON generation_reference_images(image_hash);
