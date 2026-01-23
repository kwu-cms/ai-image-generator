-- 参照画像機能のためのテーブル作成

-- 参照画像テーブル
CREATE TABLE IF NOT EXISTS reference_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    image_hash TEXT UNIQUE NOT NULL,
    r2_object_key TEXT NOT NULL,
    visibility TEXT NOT NULL DEFAULT 'private', -- 'private', 'class_shared', 'teacher_sample'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 参照画像テーブルのインデックス
CREATE INDEX IF NOT EXISTS idx_reference_images_hash ON reference_images(image_hash);
CREATE INDEX IF NOT EXISTS idx_reference_images_user_id ON reference_images(user_id);
CREATE INDEX IF NOT EXISTS idx_reference_images_visibility ON reference_images(visibility);

-- imagesテーブルに生成オプションを保存するカラムを追加
ALTER TABLE images ADD COLUMN generation_options TEXT; -- JSON形式で保存

-- 生成履歴と参照画像の紐づけテーブル
CREATE TABLE IF NOT EXISTS generation_reference_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    generation_id INTEGER NOT NULL,
    reference_image_id INTEGER NOT NULL,
    role_label TEXT NOT NULL, -- 役割ラベル（構図、スタイル、色調、質感、ディテール、その他）
    display_order INTEGER NOT NULL DEFAULT 0, -- 参照画像の順序
    FOREIGN KEY (generation_id) REFERENCES images(id),
    FOREIGN KEY (reference_image_id) REFERENCES reference_images(id)
);

-- 生成履歴と参照画像の紐づけテーブルのインデックス
CREATE INDEX IF NOT EXISTS idx_gen_ref_gen_id ON generation_reference_images(generation_id);
CREATE INDEX IF NOT EXISTS idx_gen_ref_ref_id ON generation_reference_images(reference_image_id);
