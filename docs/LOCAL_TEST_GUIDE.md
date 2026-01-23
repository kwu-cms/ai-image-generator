# ローカル環境での動作テストガイド

## 前提条件

1. 開発サーバーが起動していること
   ```bash
   npm run dev
   ```

2. ローカルデータベースにマイグレーションが適用されていること
   ```bash
   wrangler d1 execute image-generation-db --local --file=./migrations/0005_rename_images_to_generations.sql
   wrangler d1 execute image-generation-db --local --file=./migrations/0006_extend_generation_reference_images.sql
   ```

3. `.dev.vars`に`STABILITY_AI_API_KEY`が設定されていること

## テスト手順

### 1. ブラウザでアクセス

1. ブラウザで `http://localhost:8788` にアクセス
2. 既存のアカウントでログイン（または新規登録）

### 2. 画像生成テスト（text-to-image）

1. メインページでプロンプトを入力（例: "A beautiful sunset over the ocean"）
2. 「生成」ボタンをクリック
3. 以下を確認:
   - エラーが発生しないこと
   - 画像が生成されること
   - 生成された画像が表示されること
   - 履歴に記録されること

### 3. 画像生成テスト（image-to-image）

1. 参照画像をアップロード（「参照画像を追加」ボタン）
2. 役割ラベルを選択（例: "構図"）
3. プロンプトを入力
4. 「生成」ボタンをクリック
5. 以下を確認:
   - エラーが発生しないこと
   - 参照画像を使用して画像が生成されること
   - 生成された画像が表示されること

### 4. 履歴表示テスト

1. 「履歴」ページにアクセス
2. 以下を確認:
   - 生成履歴が正しく表示されること
   - 参照画像が表示されること（参照画像を使用した生成の場合）
   - プロンプトが正しく表示されること

## 確認項目

### データベース

```bash
# generationsテーブルの確認
wrangler d1 execute image-generation-db --local --command="SELECT COUNT(*) as count FROM generations;"

# generation_reference_imagesテーブルの確認
wrangler d1 execute image-generation-db --local --command="SELECT * FROM generation_reference_images LIMIT 5;"
```

### エラーログ

開発サーバーのコンソールで以下のエラーがないか確認:
- Stability AI API呼び出しエラー
- データベースエラー
- R2ストレージエラー

## トラブルシューティング

### 405エラー（Method Not Allowed）

- 開発サーバーが正しく起動しているか確認
- ブラウザで直接アクセスしてテスト

### 500エラー（Internal Server Error）

- 開発サーバーのコンソールでエラーログを確認
- `.dev.vars`に`STABILITY_AI_API_KEY`が設定されているか確認
- データベースマイグレーションが適用されているか確認

### 画像が生成されない

- Stability AI APIキーが正しいか確認
- クレジット残高を確認（`curl https://api.stability.ai/v1/user/balance -H "Authorization: Bearer YOUR_API_KEY"`）
- ネットワーク接続を確認
