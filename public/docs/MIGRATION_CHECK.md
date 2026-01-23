# データベースマイグレーション確認・実行ガイド

データベースの現在の状態を確認し、必要なマイグレーションを実行する手順です。

## 現状確認

### 1. リモートデータベースの状態確認

以下のコマンドで、リモートデータベースに存在するテーブルを確認します：

```bash
wrangler d1 execute image-generation-db --remote --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
```

**期待される結果：**
- `images` テーブルが存在する
- `users` テーブルが存在する（ログイン機能実装後）

### 2. usersテーブルの構造確認

usersテーブルが存在する場合、その構造を確認します：

```bash
wrangler d1 execute image-generation-db --remote --command "PRAGMA table_info(users)"
```

**期待されるカラム：**
- `id` (INTEGER PRIMARY KEY)
- `email` (TEXT UNIQUE NOT NULL)
- `student_id` (TEXT UNIQUE NOT NULL)
- `password_hash` (TEXT NOT NULL)
- `created_at` (DATETIME)
- `last_login` (DATETIME)
- `reset_token` (TEXT) ← 0003で追加
- `reset_token_expires` (DATETIME) ← 0003で追加

### 3. imagesテーブルの構造確認

imagesテーブルの構造を確認します：

```bash
wrangler d1 execute image-generation-db --remote --command "PRAGMA table_info(images)"
```

**期待されるカラム：**
- `id` (INTEGER PRIMARY KEY)
- `prompt` (TEXT NOT NULL)
- `image_url` (TEXT NOT NULL)
- `created_at` (DATETIME)
- `user_id` (INTEGER) ← 0002で追加

## マイグレーション実行

### マイグレーション1: 基本テーブル作成（0001）

```bash
wrangler d1 execute image-generation-db --remote --file=./migrations/0001_create_images.sql
```

**実行内容：**
- `images` テーブルの作成
- `idx_created_at` インデックスの作成

**確認：**
```bash
wrangler d1 execute image-generation-db --remote --command "SELECT name FROM sqlite_master WHERE type='table' AND name='images'"
```

### マイグレーション2: ユーザー認証機能（0002）

```bash
wrangler d1 execute image-generation-db --remote --file=./migrations/0002_add_users_and_auth.sql
```

**実行内容：**
- `users` テーブルの作成
- `idx_student_id` インデックスの作成
- `idx_email` インデックスの作成
- `images` テーブルに `user_id` カラムを追加
- `idx_images_user_id` インデックスの作成

**確認：**
```bash
# usersテーブルの存在確認
wrangler d1 execute image-generation-db --remote --command "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"

# imagesテーブルにuser_idカラムが追加されたか確認
wrangler d1 execute image-generation-db --remote --command "PRAGMA table_info(images)"
```

### マイグレーション3: パスワードリセット機能（0003）

```bash
wrangler d1 execute image-generation-db --remote --file=./migrations/0003_add_password_reset.sql
```

**実行内容：**
- `users` テーブルに `reset_token` カラムを追加
- `users` テーブルに `reset_token_expires` カラムを追加
- `idx_reset_token` インデックスの作成

**確認：**
```bash
# usersテーブルにreset_tokenカラムが追加されたか確認
wrangler d1 execute image-generation-db --remote --command "PRAGMA table_info(users)"
```

## ローカル開発環境での確認・実行

ローカル開発環境でも同様の手順で確認・実行できます。コマンドに `--local` フラグを追加してください：

```bash
# ローカルデータベースのテーブル確認
wrangler d1 execute image-generation-db --local --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"

# ローカルデータベースにマイグレーション実行
wrangler d1 execute image-generation-db --local --file=./migrations/0002_add_users_and_auth.sql
wrangler d1 execute image-generation-db --local --file=./migrations/0003_add_password_reset.sql
```

## エラー対処

### エラー: "table already exists"

テーブルが既に存在する場合、`CREATE TABLE IF NOT EXISTS` を使用しているため、エラーは発生しません。安全に再実行できます。

### エラー: "duplicate column name"

カラムが既に存在する場合、`ALTER TABLE` コマンドが失敗します。この場合は、そのマイグレーションは既に実行済みです。

### エラー: "no such table"

テーブルが存在しない場合、前のマイグレーションが実行されていない可能性があります。順番に実行してください。

## チェックリスト

マイグレーション実行前の確認：

- [ ] リモートデータベースに接続できることを確認
- [ ] 現在のテーブル一覧を確認
- [ ] 各テーブルの構造を確認
- [ ] 不足しているマイグレーションを特定

マイグレーション実行：

- [ ] 0001_create_images.sql を実行（未実行の場合）
- [ ] 0002_add_users_and_auth.sql を実行（未実行の場合）
- [ ] 0003_add_password_reset.sql を実行（未実行の場合）

マイグレーション実行後の確認：

- [ ] すべてのテーブルが存在することを確認
- [ ] すべてのカラムが正しく追加されていることを確認
- [ ] インデックスが作成されていることを確認
- [ ] アプリケーションが正常に動作することを確認

## 注意事項

1. **データのバックアップ**: 本番環境のデータベースを変更する前に、必要に応じてバックアップを取得してください
2. **順番の重要性**: マイグレーションは番号順に実行してください（0001 → 0002 → 0003）
3. **ローカルとリモート**: ローカル開発環境とリモート環境は別々のデータベースです。両方に適用する必要があります
4. **既存データ**: 既存のデータがある場合、マイグレーション実行時にデータが失われることはありません（`ALTER TABLE ADD COLUMN` は既存データを保持します）
