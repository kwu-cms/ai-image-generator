# ローカルデータベースの修正手順

## 問題

ローカル開発環境でアプリケーションを実行している場合、ローカルデータベースにもマイグレーション0004を実行する必要があります。

エラーメッセージ：
```
D1_ERROR: no such column: generation_options at offset 30: SQLITE_ERROR
```

## 解決方法

### 1. ローカルデータベースにマイグレーション0004を実行

```bash
wrangler d1 execute image-generation-db --local --file=./migrations/0004_add_reference_images.sql
```

### 2. 実行後の確認

```bash
# テーブル一覧の確認
wrangler d1 execute image-generation-db --local --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"

# imagesテーブルにgeneration_optionsカラムが追加されたか確認
wrangler d1 execute image-generation-db --local --command "PRAGMA table_info(images)"
```

**期待される結果:**
- `reference_images` テーブルが存在する
- `generation_reference_images` テーブルが存在する
- `images` テーブルに `generation_options` カラムが存在する

### 3. アプリケーションの再起動

マイグレーション実行後、`wrangler dev` を再起動してください。

## 注意事項

- ローカルデータベースとリモートデータベースは別々のデータベースです
- 両方にマイグレーションを実行する必要があります
- ローカル開発環境では `--local` フラグを使用します
- 本番環境では `--remote` フラグを使用します
