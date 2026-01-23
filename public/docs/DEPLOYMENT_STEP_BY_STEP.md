# デプロイ手順（ステップバイステップ）

## 📋 現在の状態

✅ **完了済み:**
- データベースマイグレーション完了
- コードの準備完了

⏭️ **次にやること:**
- Secretsの確認・設定
- デプロイの実行
- 動作確認

---

## ステップ1: Secretsの確認と設定

### 1-1. 現在設定されているSecretsを確認

ターミナルで以下を実行：

```bash
cd "/Users/takawo/Library/CloudStorage/Dropbox/260122AIを使った画像生成のウェブページ"
wrangler secret list
```

**注意**: `wrangler secret list`は表示されない場合があります。その場合は、次のステップで設定を確認してください。

### 1-2. 必要なSecretsを設定

以下の2つのSecretsが必要です。未設定の場合は設定してください。

#### OpenAI APIキーの設定

```bash
wrangler secret put OPENAI_API_KEY
```

実行すると、プロンプトが表示されます：
```
Enter the secret value:
```

ここに、OpenAI APIキー（`sk-`で始まる文字列）を入力してEnterキーを押してください。

#### Stability AI APIキーの設定

```bash
wrangler secret put STABILITY_AI_API_KEY
```

実行すると、プロンプトが表示されます：
```
Enter the secret value:
```

ここに、Stability AI APIキーを入力してEnterキーを押してください。

**APIキーの確認方法:**
- OpenAI: https://platform.openai.com/api-keys
- Stability AI: https://platform.stability.ai/account/keys

---

## ステップ2: コードのデプロイ

### 2-1. Cloudflare Workers APIのデプロイ

ターミナルで以下を実行：

```bash
cd "/Users/takawo/Library/CloudStorage/Dropbox/260122AIを使った画像生成のウェブページ"
npm run deploy
```

または：

```bash
wrangler deploy
```

**実行すると:**
- コードがCloudflare Workersにアップロイされます
- デプロイが完了すると、URLが表示されます（例: `https://image-generation-api.xxxxx.workers.dev`）

**エラーが出た場合:**
- Secretsが設定されていない場合は、ステップ1に戻って設定してください
- その他のエラーは、エラーメッセージを確認してください

---

## ステップ3: フロントエンドのデプロイ

### オプションA: GitHub Actionsで自動デプロイ（推奨）

GitHubリポジトリにpushするだけで自動的にデプロイされます：

```bash
cd "/Users/takawo/Library/CloudStorage/Dropbox/260122AIを使った画像生成のウェブページ"

# 変更をコミット
git add .
git commit -m "Deploy: OpenAI API統合とマイグレーション完了"

# GitHubにpush
git push
```

**確認方法:**
1. GitHubリポジトリの「Actions」タブを開く
2. デプロイが成功しているか確認（緑のチェックマーク）
3. GitHub PagesのURLにアクセスして確認

### オプションB: 手動デプロイ

GitHub Actionsを使わない場合：

```bash
cd "/Users/takawo/Library/CloudStorage/Dropbox/260122AIを使った画像生成のウェブページ"
npm run pages:deploy
```

または：

```bash
wrangler pages deploy public
```

---

## ステップ4: 動作確認

### 4-1. フロントエンドにアクセス

1. GitHub PagesのURLにアクセス（例: `https://your-username.github.io/image-generator/`）
2. または、手動デプロイした場合は、デプロイ時に表示されたURLにアクセス

### 4-2. ログインまたは新規登録

- 既存のアカウントでログイン
- または、新規登録

### 4-3. 画像生成テスト

#### テスト1: 参照画像なしで生成

1. プロンプトを入力（例: "A beautiful sunset over the ocean"）
2. 「生成」ボタンをクリック
3. 画像が生成されることを確認
4. OpenAI DALL-E 3が使用されることを確認

#### テスト2: 参照画像ありで生成

1. 参照画像をアップロード
2. プロンプトを入力（例: "Change the background to a beach"）
3. 「生成」ボタンをクリック
4. 画像が生成されることを確認
5. OpenAI DALL-E 2（編集モード）が使用されることを確認

### 4-4. データベースの確認

ターミナルで以下を実行：

```bash
wrangler d1 execute image-generation-db --remote --command "SELECT id, model_provider, model_name, edit_mode, created_at FROM generations ORDER BY created_at DESC LIMIT 5"
```

**期待される結果:**
- `model_provider`が`'openai'`または`'stability'`で記録されている
- `model_name`が`'dall-e-3'`, `'dall-e-2'`などで記録されている
- `edit_mode`が`'generate'`, `'edit'`などで記録されている

---

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
   - OpenAI APIキーが有効か確認: https://platform.openai.com/api-keys
   - Stability AI APIキーが有効か確認: https://platform.stability.ai/account/keys
   - クレジット残高を確認

2. **ログの確認**
   ```bash
   wrangler tail
   ```
   リアルタイムでログを確認できます

3. **Cloudflareダッシュボードで確認**
   - https://dash.cloudflare.com/ にログイン
   - 「Workers & Pages」を選択
   - `image-generation-api`を選択
   - 「Logs」タブでログを確認

---

## 完了後の確認事項

✅ Secretsが設定されている
✅ Cloudflare Workers APIがデプロイされている
✅ フロントエンドがデプロイされている（GitHub PagesまたはCloudflare Pages）
✅ 画像生成が正常に動作する
✅ データベースに`model_provider`, `model_name`, `edit_mode`が記録されている

すべて確認できたら、デプロイ完了です！
