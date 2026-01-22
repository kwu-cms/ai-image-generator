# AI画像生成Webアプリケーション

OpenAI DALL-E APIを使用した画像生成Webアプリケーションです。Cloudflare Workers + D1 + R2 + Pagesで構築されており、完全無料で運用可能です。

## 機能

- プロンプト入力によるAI画像生成
- 生成画像とプロンプトのデータベース保存
- 生成履歴の閲覧

## 注意事項

### OpenAI APIの課金について

- OpenAI APIは使用量ベースの課金です
- 新規アカウントには無料クレジット（$5程度）が付与されることがあります
- クレジットを使い切ると、課金設定が必要になります
- DALL-E 3の料金: 画像1枚あたり約$0.04〜$0.12（サイズによる）

**エラー「Billing hard limit has been reached」が表示される場合：**

1. [OpenAI Usage](https://platform.openai.com/usage) でクレジット残高を確認
2. 支払い方法を登録する必要がある場合があります
3. 使用量制限を確認・調整してください

## 技術スタック

- **バックエンド**: Cloudflare Workers（サーバーレス関数）
- **データベース**: Cloudflare D1（SQLite互換）
- **ストレージ**: Cloudflare R2（画像保存用）
- **フロントエンド**: HTML/CSS/JavaScript
- **API**: OpenAI DALL-E API

## セットアップ手順

詳細なセットアップ手順は [SETUP_GUIDE.md](./SETUP_GUIDE.md) を参照してください。

### 1. 依存関係のインストール

```bash
npm install
```

### 2. Cloudflare D1データベースの作成

```bash
wrangler d1 create image-generation-db
```

作成後、`wrangler.toml`のD1設定のコメントを外して、データベースIDを設定してください。

### 3. データベースマイグレーション

```bash
wrangler d1 execute image-generation-db --file=./migrations/0001_create_images.sql
```

### 4. 環境変数の設定

`.dev.vars`ファイルに必要な環境変数を設定してください（既に設定済み）。

本番環境では、Cloudflare Workers Secretsを使用：

```bash
wrangler secret put OPENAI_API_KEY
wrangler secret put R2_BUCKET_NAME
wrangler secret put R2_ACCOUNT_ID
wrangler secret put R2_ACCESS_KEY_ID
wrangler secret put R2_SECRET_ACCESS_KEY
```

### 5. ローカル開発

**方法1: Workersのみ起動（APIテスト用）**

```bash
npm run dev
```

Workersが`http://localhost:8787`で起動します。APIエンドポイントのみ利用可能です。

**方法2: 静的ファイルサーバーとWorkersを同時に起動（推奨）**

ターミナル1（Workers API）:

```bash
npm run dev
```

ターミナル2（静的ファイル）:

```bash
# http-serverをインストール（初回のみ）
npm install -g http-server

# publicディレクトリで静的ファイルを配信
cd public
http-server -p 8080 --cors
```

ブラウザで`http://localhost:8080`にアクセスしてください。

### 6. デプロイ

**Workers APIのデプロイ：**

```bash
npm run deploy
```

**Pages（フロントエンド）のデプロイ：**

```bash
npm run pages:deploy
```

## プロジェクト構成

```
/
├── wrangler.toml           # Cloudflare Workers設定
├── package.json            # 依存関係定義
├── src/
│   └── worker.js           # Workers API（メイン）
├── migrations/
│   └── 0001_create_images.sql  # D1データベーススキーマ
├── public/                 # 静的ファイル（Pages用）
│   ├── index.html          # メインページ（画像生成）
│   ├── history.html        # 履歴表示ページ
│   ├── css/
│   │   └── style.css       # スタイルシート
│   └── js/
│       ├── main.js         # メインページのJavaScript
│       └── history.js      # 履歴ページのJavaScript
├── .dev.vars               # ローカル開発用環境変数
├── .gitignore
└── README.md               # このファイル
```

## データベーススキーマ

**images テーブル**

- `id` (INTEGER PRIMARY KEY) - 自動採番ID
- `prompt` (TEXT) - プロンプト内容
- `image_url` (TEXT) - R2に保存された画像のURL
- `created_at` (DATETIME) - 作成日時

## ライセンス

MIT
