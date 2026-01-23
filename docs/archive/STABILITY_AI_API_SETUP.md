# Stability AI API - セットアップ手順

## 概要

Stability AI APIを使用するために必要な、アカウント作成からAPIキー取得までの手順です。

## ステップ1: アカウントの作成

### 1.1 アカウント登録

1. **Stability AI Platformにアクセス**
   - URL: https://platform.stability.ai/
   - 「Sign Up」または「Get Started」をクリック

2. **アカウント情報の入力**
   - メールアドレス
   - パスワード
   - 必要に応じて組織情報

3. **メール認証**
   - 登録したメールアドレスに認証メールが送信される
   - メール内のリンクをクリックして認証を完了

## ステップ2: プランの選択と契約

### 2.1 利用可能なプラン

Stability AI APIは**クレジット制**で課金されます。

#### プランの種類（一般的な例）
- **無料プラン**: 試用用の少量クレジット
- **Pay-as-you-go**: 使用量に応じてクレジットを購入
- **サブスクリプション**: 月額固定でクレジットを提供

### 2.2 料金体系の確認

**重要**: 実際の料金は公式サイトで確認してください。

一般的な料金例（参考）:
- **Stable Diffusion XL**: 1画像あたり約0.04クレジット（1024x1024）
- **Stable Diffusion 1.5**: 1画像あたり約0.01クレジット（512x512）

### 2.3 クレジットの購入

1. **アカウントダッシュボードにログイン**
   - https://platform.stability.ai/account

2. **クレジット購入ページへ**
   - 「Credits」または「Billing」セクション
   - 必要なクレジット数を選択

3. **支払い情報の登録**
   - クレジットカード情報を入力
   - 必要に応じて請求先情報を設定

4. **購入の完了**
   - クレジットがアカウントに追加される

## ステップ3: APIキーの取得

### 3.1 APIキーの生成

1. **API Keysページにアクセス**
   - URL: https://platform.stability.ai/account/keys
   - または、ダッシュボードから「API Keys」を選択

2. **新しいAPIキーを作成**
   - 「Create API Key」ボタンをクリック
   - キーの名前を入力（例: "Gen-Image.ai Production"）
   - 権限を設定（必要に応じて）

3. **APIキーをコピー**
   - ⚠️ **重要**: APIキーは一度しか表示されません
   - 必ず安全な場所に保存してください
   - 漏洩した場合はすぐに削除して再生成

### 3.2 APIキーの管理

- **複数のAPIキー**: 環境ごと（開発/本番）に分けることを推奨
- **キーの削除**: 不要になったキーは削除可能
- **使用量の確認**: 各キーの使用量をダッシュボードで確認可能

## ステップ4: クレジット残高の確認

### 4.1 API経由での確認

```bash
curl https://api.stability.ai/v1/user/balance \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**レスポンス例:**
```json
{
  "credits": 1000.0
}
```

### 4.2 ダッシュボードでの確認

- https://platform.stability.ai/account で確認可能
- 使用量の履歴も確認可能

## ステップ5: Cloudflare Workers Secretsへの設定

### 5.1 ローカル開発環境（.dev.vars）

```bash
# .dev.varsファイルに追加
STABILITY_AI_API_KEY=sk-your-api-key-here
```

### 5.2 本番環境（Workers Secrets）

```bash
# Workers Secretsに設定
wrangler secret put STABILITY_AI_API_KEY
# プロンプトが表示されたら、APIキーを入力
```

### 5.3 wrangler.tomlの確認

```toml
[env.production]
# Secretsはwrangler.tomlには記載しない（セキュリティのため）
# wrangler secret put コマンドで設定
```

## ステップ6: テスト実行

### 6.1 簡単なテスト

```bash
# APIキーが正しく設定されているか確認
curl https://api.stability.ai/v1/user/account \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### 6.2 画像生成のテスト

```bash
curl -X POST https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "text_prompts": [{"text": "A beautiful sunset"}],
    "cfg_scale": 7,
    "height": 1024,
    "width": 1024,
    "samples": 1,
    "steps": 30
  }'
```

## 注意事項

### セキュリティ
- ⚠️ **APIキーは絶対に公開しない**
- ⚠️ Gitリポジトリにコミットしない（.gitignoreに追加）
- ⚠️ 漏洩した場合はすぐに削除して再生成

### 課金管理
- **使用量の監視**: 定期的にクレジット残高を確認
- **アラート設定**: 残高が少なくなったら通知を受け取る
- **予算の設定**: 月次予算を設定して超過を防ぐ

### レート制限
- **制限**: 150リクエスト/10秒
- **超過時**: 429エラー、60秒待機
- **対策**: リトライロジックの実装が必要

## トラブルシューティング

### APIキーが無効
- キーが正しくコピーされているか確認
- キーが削除されていないか確認
- 新しいキーを生成して再設定

### クレジット不足
- ダッシュボードで残高を確認
- 必要に応じてクレジットを購入

### レート制限エラー
- リクエスト頻度を下げる
- リトライロジックを実装

## 参考リンク

- [Stability AI Platform](https://platform.stability.ai/)
- [API Keys管理](https://platform.stability.ai/account/keys)
- [アカウント管理](https://platform.stability.ai/account)
- [料金ページ](https://platform.stability.ai/pricing)（実際のURLを確認）
- [APIドキュメント](https://platform.stability.ai/docs)

## チェックリスト

### アカウント準備
- [ ] Stability AIアカウントを作成
- [ ] メール認証を完了
- [ ] プランを選択・契約
- [ ] クレジットを購入（必要に応じて）

### APIキー設定
- [ ] APIキーを生成
- [ ] APIキーを安全に保存
- [ ] ローカル環境（.dev.vars）に設定
- [ ] 本番環境（Workers Secrets）に設定

### 動作確認
- [ ] APIキーでアカウント情報を取得できるか確認
- [ ] クレジット残高を確認
- [ ] 簡単な画像生成テストを実行
