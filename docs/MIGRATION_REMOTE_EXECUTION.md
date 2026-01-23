# リモートデータベースマイグレーション実行ガイド

## 重要: ローカルとリモートは別々のデータベース

Cloudflare D1では、ローカル開発用と本番環境用のデータベースが**別々**に存在します。

- **ローカル**: `.wrangler/state/v3/d1/` に保存（開発用）
- **リモート**: Cloudflareの本番環境（実際に使用されるデータベース）

**マイグレーションは両方で実行する必要があります。**

---

## マイグレーション0008の実行（リモート）

### 実行コマンド

```bash
wrangler d1 execute image-generation-db --remote --file=./migrations/0008_add_model_provider_fields.sql
```

### 実行前の確認（オプション）

現在のリモートデータベースの状態を確認：

```bash
# generationsテーブルの構造を確認
wrangler d1 execute image-generation-db --remote --command "PRAGMA table_info(generations)"
```

### 実行後の確認

マイグレーションが正しく適用されたか確認：

```bash
# generationsテーブルの構造を再確認（model_provider, model_name, edit_modeカラムが追加されているか）
wrangler d1 execute image-generation-db --remote --command "PRAGMA table_info(generations)"
```

**期待される結果:**
- `model_provider` カラムが存在する
- `model_name` カラムが存在する
- `edit_mode` カラムが存在する

---

## その他のマイグレーションの確認

### 既存のマイグレーションがリモートで実行済みか確認

```bash
# テーブル一覧を確認
wrangler d1 execute image-generation-db --remote --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
```

**期待されるテーブル:**
- `generations` (0005でリネーム)
- `users` (0002)
- `reference_images` (0004)
- `generation_reference_images` (0006)
- `prompt_translations` (0007)

### 未実行のマイグレーションがある場合

必要に応じて、以下のマイグレーションもリモートで実行してください：

```bash
# 0005: imagesテーブルをgenerationsテーブルにリネーム
wrangler d1 execute image-generation-db --remote --file=./migrations/0005_rename_images_to_generations.sql

# 0006: generation_reference_imagesテーブルの拡張
wrangler d1 execute image-generation-db --remote --file=./migrations/0006_extend_generation_reference_images.sql

# 0007: 翻訳関連フィールドの追加
wrangler d1 execute image-generation-db --remote --file=./migrations/0007_add_translation_fields.sql

# 0008: モデル識別フィールドの追加（今回）
wrangler d1 execute image-generation-db --remote --file=./migrations/0008_add_model_provider_fields.sql
```

---

## 注意事項

1. **本番環境への影響**: リモートデータベースへのマイグレーションは本番環境に影響します
2. **バックアップ**: 重要なデータがある場合は、事前にバックアップを推奨
3. **実行順序**: マイグレーションは順番に実行する必要があります（0001 → 0002 → ... → 0008）

---

## トラブルシューティング

### エラー: "duplicate column name"

既にカラムが存在する場合、このエラーが発生します。以下のコマンドで確認：

```bash
wrangler d1 execute image-generation-db --remote --command "PRAGMA table_info(generations)"
```

既にカラムが存在する場合は、マイグレーションをスキップして問題ありません。

### エラー: "no such table: generations"

`generations`テーブルが存在しない場合、先に0005のマイグレーションを実行する必要があります。
