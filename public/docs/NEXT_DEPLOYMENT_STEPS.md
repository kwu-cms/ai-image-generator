# 次のステップ：デプロイと動作確認

## 現在の状態

✅ **マイグレーション完了**
- リモートデータベースにすべてのマイグレーションが適用済み
- `generations`テーブルに`model_provider`, `model_name`, `edit_mode`カラムが追加済み
- データベース構造はコードと一致

## デプロイ前の確認事項

### 1. 必要なSecretsの確認

本番環境で必要なSecretsが設定されているか確認してください：

```bash
# 設定済みのSecretsを確認（一覧表示はできないため、個別に確認）
wrangler secret list
```

**必要なSecrets:**
- `OPENAI_API_KEY` - OpenAI APIキー（必須）
- `STABILITY_AI_API_KEY` - Stability AI APIキー（必須）

**オプション（R2を直接操作する場合のみ）:**
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`

### 2. Secretsの設定（未設定の場合）

```bash
# OpenAI APIキー
wrangler secret put OPENAI_API_KEY

# Stability AI APIキー
wrangler secret put STABILITY_AI_API_KEY
```

## デプロイ手順

### 1. コードのデプロイ

```bash
# Cloudflare Workersにデプロイ
wrangler deploy
```

### 2. フロントエンドのデプロイ（GitHub Pagesを使用している場合）

GitHub Actionsで自動デプロイされる場合は、pushするだけ：

```bash
git add .
git commit -m "Deploy: OpenAI API統合とマイグレーション完了"
git push
```

手動デプロイの場合：

```bash
wrangler pages deploy public
```

## 動作確認

### 1. 基本的な動作確認

1. **フロントエンドにアクセス**
   - GitHub PagesのURLまたはデプロイしたURLにアクセス

2. **ログイン**
   - 既存のアカウントでログイン、または新規登録

3. **画像生成テスト（参照画像なし）**
   - プロンプトを入力して画像生成
   - OpenAI DALL-E 3が使用されることを確認
   - 生成履歴に`model_provider: 'openai'`, `model_name: 'dall-e-3'`が記録されることを確認

4. **画像生成テスト（参照画像あり）**
   - 参照画像をアップロードして画像生成
   - OpenAI DALL-E 2（編集モード）が使用されることを確認
   - 生成履歴に`model_provider: 'openai'`, `model_name: 'dall-e-2'`, `edit_mode: 'edit'`が記録されることを確認

### 2. データベースの確認

```bash
# 最新の生成履歴を確認
wrangler d1 execute image-generation-db --remote --command "SELECT id, model_provider, model_name, edit_mode, created_at FROM generations ORDER BY created_at DESC LIMIT 5"
```

**期待される結果:**
- `model_provider`が`'openai'`または`'stability'`で記録されている
- `model_name`が`'dall-e-3'`, `'dall-e-2'`などで記録されている
- `edit_mode`が`'generate'`, `'edit'`などで記録されている

### 3. エラーログの確認

```bash
# Cloudflare Workersのログを確認
wrangler tail
```

または、Cloudflareダッシュボードでログを確認：
1. [Cloudflareダッシュボード](https://dash.cloudflare.com/)にログイン
2. 「Workers & Pages」を選択
3. `image-generation-api`を選択
4. 「Logs」タブでログを確認

## トラブルシューティング

### エラー: "OPENAI_API_KEY is not defined"

**原因**: Secretsが設定されていない

**解決方法**:
```bash
wrangler secret put OPENAI_API_KEY
```

### エラー: "STABILITY_AI_API_KEY is not defined"

**原因**: Secretsが設定されていない

**解決方法**:
```bash
wrangler secret put STABILITY_AI_API_KEY
```

### エラー: "no such column: model_provider"

**原因**: マイグレーションが実行されていない

**解決方法**:
```bash
wrangler d1 execute image-generation-db --remote --file=./migrations/0008_add_model_provider_fields.sql
```

### 画像生成が失敗する

1. **APIキーの確認**
   - OpenAI APIキーが有効か確認
   - Stability AI APIキーが有効か確認
   - クレジット残高を確認

2. **ログの確認**
   ```bash
   wrangler tail
   ```

3. **データベースの確認**
   - マイグレーションが正しく実行されているか確認
   - `generations`テーブルの構造を確認

## 次の改善点（オプション）

デプロイ後の動作確認が完了したら、以下の改善を検討できます：

1. **履歴表示の改善**
   - `model_provider`, `model_name`, `edit_mode`を履歴画面に表示
   - フィルタリング機能（OpenAI/Stability AIで絞り込み）

2. **エラーハンドリングの改善**
   - より詳細なエラーメッセージ
   - リトライ機能の追加

3. **パフォーマンスの最適化**
   - 画像生成の並列処理
   - キャッシュの活用
