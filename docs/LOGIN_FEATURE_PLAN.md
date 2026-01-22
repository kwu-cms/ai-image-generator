# ログイン機能実装計画

## 概要

ユーザー認証機能を追加し、ユーザーごとの履歴管理を実現します。

## 実装方針

### オプション1: Cloudflare Workers Auth（推奨）

**メリット:**
- Cloudflareの無料サービスで完結
- 設定が簡単
- セキュリティが高い

**実装内容:**
- Cloudflare Accessを使用
- GitHub OAuth連携（推奨）またはメール/パスワード認証
- ユーザーIDをセッションで管理

### オプション2: シンプルな認証（授業用）

**メリット:**
- 実装が簡単
- 追加のサービス不要

**実装内容:**
- ユーザー名とパスワードをD1データベースに保存
- セッション管理をWorkers KVで実装
- パスワードはハッシュ化して保存

## データベーススキーマ変更

### users テーブル（新規）

```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### images テーブル（変更）

```sql
ALTER TABLE images ADD COLUMN user_id INTEGER;
CREATE INDEX idx_user_id ON images(user_id);
```

## APIエンドポイント追加

### 認証関連

- `POST /api/auth/register` - ユーザー登録
- `POST /api/auth/login` - ログイン
- `POST /api/auth/logout` - ログアウト
- `GET /api/auth/me` - 現在のユーザー情報取得

### 履歴関連（変更）

- `GET /api/history` - 現在のユーザーの履歴のみ取得
- `DELETE /api/history/:id` - 自分の履歴を削除

## 実装ステップ

1. **データベースマイグレーション**
   - usersテーブルの作成
   - imagesテーブルにuser_idカラムを追加

2. **認証APIの実装**
   - ユーザー登録機能
   - ログイン機能
   - セッション管理

3. **フロントエンドの実装**
   - ログインページ
   - ユーザー登録ページ
   - 認証状態の管理

4. **履歴機能の変更**
   - ユーザーごとの履歴表示
   - 自分の履歴のみ表示

## セキュリティ考慮事項

- パスワードはbcryptなどでハッシュ化
- セッショントークンは安全に管理
- CSRF対策の実装
- 入力値のバリデーション

## 推奨実装順序

1. シンプルな認証（オプション2）から実装
2. 動作確認後、必要に応じてCloudflare Accessに移行

## 見積もり

- **開発時間**: 4〜6時間
- **データベース変更**: マイグレーション必要
- **追加の依存関係**: bcryptライブラリなど
