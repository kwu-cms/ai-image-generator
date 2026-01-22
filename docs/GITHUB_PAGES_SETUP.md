# GitHub Pages設定手順

GitHub Pagesでフロントエンドをホスティングする手順です。

## 前提条件

- GitHubリポジトリが既に作成済み（`ai-image-generator`）
- Cloudflare Workers APIがデプロイ済み（`https://image-generation-api.tkwshnsk.workers.dev`）

## 設定手順

### 1. GitHubリポジトリの設定

1. GitHubリポジトリ（`http://192.168.1.24:3000/takawo/ai-image-generator`）にアクセス
2. 「Settings」タブをクリック
3. 左メニューから「Pages」を選択
4. 「Source」セクションで以下を設定：
   - **Branch**: `main`
   - **Folder**: `/public`
5. 「Save」をクリック

### 2. GitHub PagesのURL確認

設定後、数分でGitHub PagesのURLが表示されます：
```
http://192.168.1.24:3000/takawo/ai-image-generator
```
または、Giteaの設定により異なる場合があります。

### 3. 動作確認

1. GitHub PagesのURLにアクセス
2. 画像生成を試す
3. APIが正常に動作することを確認

## ローカル開発

ローカル開発時は、自動的に`http://localhost:8787`を使用します。

```bash
# Workers APIを起動
npm run dev

# 別のターミナルで静的ファイルサーバーを起動
cd public
npx http-server -p 8080 --cors
```

ブラウザで `http://localhost:8080` にアクセスしてください。

## デプロイフロー

### フロントエンドの更新

1. `public/`ディレクトリ内のファイルを編集
2. 変更をコミット
3. GitHubにプッシュ
4. GitHub Pagesが自動的に更新される（数分かかる場合があります）

### APIの更新

1. `src/worker.js`を編集
2. 変更をコミット
3. `npm run deploy`でWorkersにデプロイ

## トラブルシューティング

### CORSエラーが発生する場合

- Workers側のCORS設定は既に実装済みです
- ブラウザのコンソールでエラーを確認してください

### APIが動作しない場合

- WorkersのURLが正しいか確認：`https://image-generation-api.tkwshnsk.workers.dev`
- Workersがデプロイされているか確認：`npm run deploy`

### GitHub Pagesが更新されない場合

- 設定で正しいブランチとディレクトリが選択されているか確認
- 数分待ってから再度確認
- GitHub Pagesの設定ページで「Re-run」を試す

## 現在の構成

- **フロントエンド**: GitHub Pages（`public/`ディレクトリ）
- **API**: Cloudflare Workers（`https://image-generation-api.tkwshnsk.workers.dev`）
- **データベース**: Cloudflare D1
- **ストレージ**: Cloudflare R2

すべて無料で運用可能です。
