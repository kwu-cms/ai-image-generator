# GitHub Actions自動デプロイ設定

GitHub Actionsでpush時に自動デプロイする設定手順です。

## 設定手順

### 1. Cloudflare APIトークンの取得

1. [Cloudflareダッシュボード](https://dash.cloudflare.com/)にログイン
2. 右上のプロフィールアイコンをクリック
3. 「My Profile」を選択
4. 「API Tokens」タブをクリック
5. 「Create Token」をクリック
6. 「Edit Cloudflare Workers」テンプレートを選択
7. 権限を確認して「Continue to summary」をクリック
8. 「Create Token」をクリック
9. **トークンをコピーして保存**（2度と表示されません）

### 2. CloudflareアカウントIDの確認

1. Cloudflareダッシュボードの右上を確認
2. 「Account ID」をコピー
   - または、R2ページの右上に表示されているAccount IDを使用

### 3. GitHub Secretsの設定

1. [GitHubリポジトリ](https://github.com/kwu-cms/ai-image-generator)にアクセス
2. 「Settings」タブをクリック
3. 左メニューから「Secrets and variables」→「Actions」を選択
4. 「New repository secret」をクリック
5. 以下の2つのSecretを追加：

   **Secret 1:**
   - Name: `CLOUDFLARE_API_TOKEN`
   - Value: 取得したCloudflare APIトークン

   **Secret 2:**
   - Name: `CLOUDFLARE_ACCOUNT_ID`
   - Value: CloudflareアカウントID（例：`8b7a255f441e2ee915cc02ddd344dabd`）

### 4. GitHub Pagesの設定

1. GitHubリポジトリの「Settings」→「Pages」にアクセス
2. 「Source」で「GitHub Actions」を選択
3. これで自動デプロイが有効になります

## 動作確認

### 1. テスト用の変更をpush

```bash
# 何か小さな変更を加える（例：READMEの更新）
echo "# Test" >> README.md
git add README.md
git commit -m "Test: GitHub Actions"
git push github main
```

### 2. GitHub Actionsの実行を確認

1. GitHubリポジトリの「Actions」タブをクリック
2. ワークフローの実行状況を確認
3. 成功（緑のチェックマーク）になることを確認

### 3. デプロイの確認

- **フロントエンド**: GitHub PagesのURLにアクセスして確認
- **Workers API**: `https://image-generation-api.tkwshnsk.workers.dev/api/history` にアクセスして確認

## デプロイの動作

### フロントエンドのデプロイ

- `public/`ディレクトリ内のファイルが変更された場合
- 自動的にGitHub Pagesにデプロイされます
- 数分で反映されます

### Workers APIのデプロイ

- `src/`ディレクトリまたは`wrangler.toml`が変更された場合
- 自動的にCloudflare Workersにデプロイされます
- 1〜2分で反映されます

## トラブルシューティング

### GitHub Actionsが失敗する場合

1. 「Actions」タブでエラーログを確認
2. Secretsが正しく設定されているか確認
3. Cloudflare APIトークンの権限を確認

### デプロイが反映されない場合

1. GitHub Actionsの実行が成功しているか確認
2. GitHub Pagesの設定で「GitHub Actions」が選択されているか確認
3. 数分待ってから再度確認

## 注意事項

- Cloudflare APIトークンは機密情報です。GitHub Secretsで管理してください
- APIトークンは「Edit Cloudflare Workers」権限が必要です
- アカウントIDは公開されても問題ありませんが、Secretsで管理することを推奨します
