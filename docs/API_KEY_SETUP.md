# APIキー設定完了

## 設定状況

### ローカル環境（.dev.vars）
- ✅ `STABILITY_AI_API_KEY` を追加しました

### 本番環境（Workers Secrets）
以下のコマンドで設定してください：

```bash
wrangler secret put STABILITY_AI_API_KEY
```

プロンプトが表示されたら、以下のAPIキーを入力：
```
sk-Ml1Q4JlfQsKsCZrqMYWamIfi3at1SKWAP7qp96t1YiZyY0X2
```

## 動作確認

### 1. APIキーの確認

```bash
curl https://api.stability.ai/v1/user/account \
  -H "Authorization: Bearer sk-Ml1Q4JlfQsKsCZrqMYWamIfi3at1SKWAP7qp96t1YiZyY0X2"
```

### 2. クレジット残高の確認

```bash
curl https://api.stability.ai/v1/user/balance \
  -H "Authorization: Bearer sk-Ml1Q4JlfQsKsCZrqMYWamIfi3at1SKWAP7qp96t1YiZyY0X2"
```

### 3. 簡単な画像生成テスト

```bash
curl -X POST https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image \
  -H "Authorization: Bearer sk-Ml1Q4JlfQsKsCZrqMYWamIfi3at1SKWAP7qp96t1YiZyY0X2" \
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

## セキュリティ注意事項

⚠️ **重要**: 
- APIキーは`.dev.vars`に保存されており、`.gitignore`で除外されています
- このファイルはGitにコミットされません
- APIキーを公開しないでください
- 漏洩した場合は、Stability AI Platformでキーを削除して再生成してください

## 次のステップ

1. ✅ APIキーの設定完了
2. ⏭️ 本番環境のWorkers Secretsに設定
3. ⏭️ 動作確認テストの実行
4. ⏭️ 実装作業の開始
