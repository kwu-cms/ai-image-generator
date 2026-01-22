# ローカル開発・確認方法

ローカル環境でアプリケーションを動作確認する手順です。

## 前提条件

- Node.js（v18以上）がインストールされていること
- npmがインストールされていること
- `.dev.vars`ファイルに必要な環境変数が設定されていること

## 確認方法

### 1. 依存関係のインストール

```bash
npm install
```

### 2. Workers APIの起動

ターミナル1で以下を実行：

```bash
npm run dev
```

正常に起動すると、以下のようなメッセージが表示されます：

```
Ready on http://localhost:8787
```

### 3. 静的ファイルサーバーの起動

**方法1: http-serverを使用（推奨）**

新しいターミナル（ターミナル2）で以下を実行：

```bash
cd public
npx http-server -p 8080 --cors
```

**方法2: Pythonを使用**

Pythonがインストールされている場合：

```bash
cd public
python3 -m http.server 8080
```

### 4. ブラウザでアクセス

ブラウザで以下のURLにアクセス：

```
http://localhost:8080
```

## 動作確認のポイント

### 画像生成の確認

1. プロンプトを入力（例：「美しい夕日の風景」）
2. 「画像を生成」ボタンをクリック
3. 生成結果が表示されることを確認
4. 処理時間が表示されることを確認

### 履歴の確認

1. ナビゲーションの「履歴」をクリック
2. 生成した画像とプロンプトが一覧表示されることを確認
3. 画像が正しく表示されることを確認

### ガイドページの確認

1. ナビゲーションの「ガイド」をクリック
2. ガイドページが表示されることを確認
3. リンクが正しく動作することを確認

## APIエンドポイントの直接確認

### 履歴取得API

ブラウザで直接アクセス：

```
http://localhost:8787/api/history
```

正常な場合、以下のようなJSONが返されます：

```json
{
  "success": true,
  "history": [...]
}
```

### 画像生成API（テスト用）

ブラウザのコンソールで実行：

```javascript
fetch('http://localhost:8787/api/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ prompt: 'test' })
})
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);
```

## トラブルシューティング

### Workersが起動しない

- `.dev.vars`ファイルが存在するか確認
- 必要な環境変数が設定されているか確認
- Node.jsのバージョンがv18以上か確認

### 静的ファイルサーバーが起動しない

- ポート8080が使用されていないか確認
- 別のポートを指定：`npx http-server -p 3000 --cors`

### APIに接続できない

- Workersが`http://localhost:8787`で起動しているか確認
- ブラウザのコンソールでエラーを確認
- CORSエラーが出る場合は、`--cors`オプションを確認

### 画像が表示されない

- Workersのログでエラーを確認
- R2バケットが正しく設定されているか確認
- 画像配信API（`/api/image/`）が正常に動作しているか確認

## 開発時の便利なコマンド

### Workersのログを確認

Workersを起動したターミナルで、リアルタイムにログが表示されます。

### データベースの確認

```bash
# ローカルデータベースの確認
wrangler d1 execute image-generation-db --local --command "SELECT * FROM images LIMIT 10"

# リモートデータベースの確認
wrangler d1 execute image-generation-db --remote --command "SELECT * FROM images LIMIT 10"
```

### 環境変数の確認

`.dev.vars`ファイルの内容を確認（APIキーは表示されません）：

```bash
cat .dev.vars | grep -v "API_KEY"
```

## 注意事項

- ローカル開発時は、`.dev.vars`の環境変数が使用されます
- 本番環境とは異なるデータベース（ローカル）が使用されます
- 画像はローカルのR2シミュレーターに保存されます（本番のR2には保存されません）
