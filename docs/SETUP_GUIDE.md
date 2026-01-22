# 実装前の準備手順

## 必要なアカウントと情報

### 1. Cloudflareアカウント（無料）

**手順：**

1. [Cloudflare](https://dash.cloudflare.com/sign-up) にアクセス
2. メールアドレスでアカウント作成（無料）
3. メール認証を完了

**必要な情報：**

- Cloudflareアカウントのメールアドレス
- Cloudflareアカウントのパスワード

**確認方法：**

- [Cloudflareダッシュボード](https://dash.cloudflare.com/) にログインできることを確認

---

### 2. OpenAI APIキー取得（個人アカウントでOK）

**手順：**

**方法1: 直接URLでアクセス（推奨）**

1. [OpenAI Platform](https://platform.openai.com/) にアクセス
2. 「Sign up」または「Log in」でアカウント作成/ログイン
3. 以下のURLに直接アクセス：

   ```
   https://platform.openai.com/api-keys
   ```

4. 「Create new secret key」をクリック
5. キー名を入力（例：`image-generation-app`）
6. 生成されたAPIキーを**必ずコピーして安全な場所に保存**（2度と表示されません）

**方法2: アカウントメニューから**

1. [OpenAI Platform](https://platform.openai.com/) にログイン
2. 画面右上のプロフィール写真/名前をクリック
3. ドロップダウンメニューから「API keys」または「View API keys」を選択
4. 「Create new secret key」をクリック
5. キー名を入力してAPIキーを生成・保存

**方法3: 左メニューから（UIによっては表示される場合）**

1. [OpenAI Platform](https://platform.openai.com/) にログイン
2. 左メニューに「API keys」があれば選択
3. 「Create new secret key」をクリック
4. キー名を入力してAPIキーを生成・保存

**必要な情報：**

- OpenAI APIキー（`sk-`で始まる文字列）

**注意事項：**

- APIキーは秘密情報です。他人に共有しないでください
- 無料クレジットが付与されている場合があります（$5程度）
- 使用量に応じて課金されます（DALL-E 3は画像1枚あたり約$0.04〜$0.12）
- 支払い方法の登録が必要な場合があります

**確認方法：**

- [OpenAI Usage](https://platform.openai.com/usage) でクレジット残高を確認

**トラブルシューティング：**

- API keysのリンクが見つからない場合：
  - 直接URL（<https://platform.openai.com/api-keys）にアクセスしてみてください>
  - 支払い方法が登録されていない場合は、先に登録が必要な場合があります
  - 組織アカウントの場合は、管理者権限が必要な場合があります

---

### 3. Cloudflare R2 ストレージ作成（最初に設定）

**手順：**

**ステップ1: R2バケットの作成**

1. Cloudflareダッシュボードにログイン
2. ウェルカム画面（「How would you like to get started?」）が表示される場合：
   - 右側のサイドバーで「**R2 ストレージバケット**」をクリック
   - または、左メニューから「R2」を選択
3. R2ページで「**Create bucket**」または「**バケットを作成**」をクリック
4. バケット名を入力（例：`image-generation-storage`）
   - 注意：バケット名は小文字、数字、ハイフンのみ使用可能
5. リージョンを選択（推奨：`ap-northeast-1` - 東京）
6. 「**Create bucket**」をクリック
7. バケットが作成されたことを確認

**ステップ2: R2 APIトークンの作成**

1. R2ページの上部メニューで「**Manage R2 API Tokens**」または「**R2 APIトークンを管理**」をクリック
   - または、左メニューから「**R2**」→「**Manage R2 API Tokens**」を選択
2. 「**Create API token**」または「**APIトークンを作成**」をクリック
3. トークン名を入力（例：`image-app-token`）
4. 権限を設定：
   - 「**Object Read & Write**」を選択
   - 「**Permissions**」で作成したバケットを選択（例：`image-generation-storage`）
5. 「**Create API Token**」をクリック
6. **重要：以下の情報を必ずコピーして安全な場所に保存**（2度と表示されません）：
   - **Access Key ID**（例：`xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`）
   - **Secret Access Key**（例：`yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy`）
7. 「**I've saved these credentials**」をクリックして完了

**ステップ3: Account IDの確認**

1. R2ページの右上またはダッシュボードの右上を確認
2. 「**Account ID**」をコピーして保存
   - 形式：32文字の英数字（例：`8b7a255f441e2ee915cc02ddd344dabd`）

**必要な情報：**

- R2バケット名（例：`image-generation-storage`）
- R2 Access Key ID
- R2 Secret Access Key
- R2 Account ID

**取得した情報の保存：**

取得したR2の情報は、後で`.dev.vars`ファイルに追加します。

---

### 4. Cloudflare Workers & Pages の確認

**手順：**

1. Cloudflareダッシュボードにログイン
2. ウェルカム画面の場合：
   - 右側のサイドバーで「**Workers**」または「**Pages**」を確認
   - または、左メニューから「**Workers & Pages**」を選択
3. 初回は「Get started」が表示される場合がありますが、実装時に設定します

**必要な情報：**

- 特に事前準備は不要（実装時に設定します）

---

### 5. Cloudflare D1 データベース作成

**手順：**
実装時に `wrangler` コマンドで作成しますが、事前に確認：

1. Cloudflareダッシュボード → 「**Workers & Pages**」
2. 左メニューから「**D1**」を選択
3. データベース一覧が表示されることを確認（初回は空のリスト）

**必要な情報：**

- データベース名（実装時に決定、例：`image-generation-db`）

---

### 6. 開発環境のセットアップ

**必要なツール：**

- Node.js（v18以上推奨）
- npm（Node.jsに含まれる）
- Git（オプション）

**確認方法：**

```bash
node --version  # v18以上であることを確認
npm --version   # バージョンが表示されればOK
```

**インストール方法（未インストールの場合）：**

- [Node.js公式サイト](https://nodejs.org/) からダウンロード・インストール

---

## 実装時に必要な情報のまとめ

実装を開始する前に、以下の情報を準備してください：

### 必須情報

1. **OpenAI APIキー**
   - 形式：`sk-`で始まる文字列
   - 取得場所：<https://platform.openai.com/api-keys>

2. **Cloudflare R2設定**
   - バケット名（例：`image-generation-storage`）
   - Access Key ID
   - Secret Access Key
   - Account ID

3. **Cloudflare D1データベース名**
   - 実装時に作成しますが、名前を決めておく（例：`image-generation-db`）

### オプション情報

- Cloudflareアカウントのメールアドレス（ログイン用）

---

## 実装手順の概要

1. **プロジェクト初期化**
   - `wrangler.toml` の作成
   - `package.json` の作成
   - 依存関係のインストール

2. **Cloudflare D1データベース作成**

   ```bash
   wrangler d1 create image-generation-db
   ```

3. **データベースマイグレーション**

   ```bash
   wrangler d1 execute image-generation-db --file=./migrations/0001_create_images.sql
   ```

4. **Cloudflare Workers Secrets設定**

   ```bash
   wrangler secret put OPENAI_API_KEY
   wrangler secret put R2_BUCKET_NAME
   wrangler secret put R2_ACCOUNT_ID
   wrangler secret put R2_ACCESS_KEY_ID
   wrangler secret put R2_SECRET_ACCESS_KEY
   ```

5. **ローカル開発環境設定**
   - `.dev.vars` ファイルの作成（ローカル開発用）

6. **デプロイ**

   ```bash
   wrangler pages deploy public
   wrangler deploy
   ```

---

## チェックリスト

実装を開始する前に、以下を確認してください：

- [ ] Cloudflareアカウント作成済み
- [ ] OpenAI APIキー取得済み（`.dev.vars`ファイルに保存済み）
- [ ] Cloudflare R2バケット作成済み
- [ ] Cloudflare R2 APIトークン作成済み（Access Key ID、Secret Access Key、Account IDを保存済み）
- [ ] R2の情報を`.dev.vars`ファイルに追加済み（後で実装時に追加）
- [ ] Node.jsインストール済み（v18以上）
- [ ] npmインストール済み
- [ ] 上記の情報を安全な場所にメモ済み

---

## トラブルシューティング

### OpenAI APIキーが見つからない

- [OpenAI Platform](https://platform.openai.com/api-keys) にログインして再生成可能

### Cloudflare R2の設定がわからない

- Cloudflareダッシュボード → 右側サイドバーの「R2 ストレージバケット」をクリック
- または、左メニューから「R2」を選択
- R2ページで「Manage R2 API Tokens」からAPIトークンを作成
- Account IDはR2ページの右上またはダッシュボードの右上に表示されています

### R2 APIトークンが見つからない

- R2ページの上部メニューに「Manage R2 API Tokens」があります
- または、左メニューから「R2」→「Manage R2 API Tokens」を選択

### Node.jsのバージョンが古い

- [Node.js公式サイト](https://nodejs.org/) から最新のLTS版をインストール

---

## 次のステップ

上記の準備が完了したら、実装を開始できます。
実装時に必要な情報があれば、このドキュメントを参照してください。
