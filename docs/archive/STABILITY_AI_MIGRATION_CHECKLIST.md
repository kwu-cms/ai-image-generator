# Stability AI移行 - 実行前チェックリスト

## ⚠️ 重要な注意事項

### マイグレーション実行前の確認

1. **既存データのバックアップ**
   - 本番環境のデータベースをバックアップ
   - 必要に応じて、データのエクスポート

2. **SQLiteバージョンの確認**
   - Cloudflare D1が`ALTER TABLE RENAME COLUMN`をサポートしているか確認
   - サポートされていない場合、代替マイグレーションを使用

3. **既存コードとの互換性**
   - `images`テーブルを参照しているコードを確認
   - マイグレーション実行前に、コードの更新が必要

## 実行手順

### ステップ1: ローカル環境でのテスト

```bash
# 1. 現在のテーブル構造を確認
wrangler d1 execute image-generation-db --local --command "PRAGMA table_info(images)"

# 2. マイグレーション0005を実行
wrangler d1 execute image-generation-db --local --file=./migrations/0005_rename_images_to_generations.sql

# 3. テーブルがリネームされたか確認
wrangler d1 execute image-generation-db --local --command "SELECT name FROM sqlite_master WHERE type='table' AND name='generations'"

# 4. カラム名が変更されたか確認
wrangler d1 execute image-generation-db --local --command "PRAGMA table_info(generations)"

# 5. マイグレーション0006を実行
wrangler d1 execute image-generation-db --local --file=./migrations/0006_extend_generation_reference_images.sql

# 6. generation_reference_imagesテーブルの構造を確認
wrangler d1 execute image-generation-db --local --command "PRAGMA table_info(generation_reference_images)"
```

### ステップ2: エラーが発生した場合

#### エラー: "no such column" または "ALTER TABLE RENAME COLUMN"がサポートされていない

**対処法**: 代替マイグレーションを使用

```sql
-- 0005_rename_images_to_generations_alternative.sql を作成
-- 1. 新しいテーブルを作成
CREATE TABLE generations_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    final_prompt TEXT NOT NULL,
    output_image_r2_key TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER,
    generation_settings TEXT
);

-- 2. データをコピー
INSERT INTO generations_new (id, final_prompt, output_image_r2_key, created_at, user_id, generation_settings)
SELECT id, prompt, image_url, created_at, user_id, generation_options FROM images;

-- 3. 外部キー参照を更新（generation_reference_images）
UPDATE generation_reference_images
SET generation_id = generation_id; -- 実際には変更不要だが、整合性チェック

-- 4. 古いテーブルを削除
DROP TABLE images;

-- 5. 新しいテーブルをリネーム
ALTER TABLE generations_new RENAME TO generations;

-- 6. インデックスの再作成
CREATE INDEX IF NOT EXISTS idx_generations_created_at ON generations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generations_user_id ON generations(user_id);
```

### ステップ3: リモート環境への適用

**⚠️ 注意**: 本番環境への適用前に、必ずローカル環境でテストしてください。

```bash
# 1. リモート環境の現在の状態を確認
wrangler d1 execute image-generation-db --remote --command "PRAGMA table_info(images)"

# 2. マイグレーション0005を実行
wrangler d1 execute image-generation-db --remote --file=./migrations/0005_rename_images_to_generations.sql

# 3. マイグレーション0006を実行
wrangler d1 execute image-generation-db --remote --file=./migrations/0006_extend_generation_reference_images.sql

# 4. 確認
wrangler d1 execute image-generation-db --remote --command "PRAGMA table_info(generations)"
```

## コード更新が必要な箇所

マイグレーション実行後、以下のコードを更新する必要があります：

### 1. worker.js
- `images`テーブル → `generations`テーブル
- `prompt` → `final_prompt`
- `image_url` → `output_image_r2_key`
- `generation_options` → `generation_settings`

### 2. 影響を受ける関数
- `handleGenerate()`: INSERT文の更新
- `handleHistory()`: SELECT文の更新
- `handleAllImages()`: SELECT文の更新

## 実行タイミング

### 推奨される実行順序

1. **コード更新前**: マイグレーションを実行しない
2. **コード更新後**: マイグレーションを実行
3. **動作確認**: アプリケーションが正常に動作するか確認

### または

1. **マイグレーション実行**: テーブル名とカラム名を変更
2. **コード更新**: 新しいテーブル名とカラム名に対応
3. **動作確認**: アプリケーションが正常に動作するか確認

**推奨**: コード更新とマイグレーションを同時に行う（ダウンタイムを最小化）
