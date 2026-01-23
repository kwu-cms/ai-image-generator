# Stability AI API調査結果

## API基本情報

### エンドポイント
- **ベースURL**: `https://api.stability.ai`
- **APIバージョン**: v1

### 認証
- **方法**: Bearer Token認証
- **ヘッダー**: `Authorization: Bearer {api_key}`
- **APIキー取得**: https://platform.stability.ai/account/keys

### レート制限
- **制限**: 150リクエスト/10秒
- **超過時**: 429エラー、60秒のタイムアウト

## 主要エンドポイント

### 1. Text-to-Image
```
POST /v1/generation/{engine_id}/text-to-image
```

**リクエスト例:**
```bash
curl -X POST https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "text_prompts": [
      {
        "text": "A beautiful sunset over the ocean"
      }
    ],
    "cfg_scale": 7,
    "height": 1024,
    "width": 1024,
    "samples": 1,
    "steps": 30
  }'
```

**レスポンス:**
```json
{
  "artifacts": [
    {
      "base64": "iVBORw0KGgoAAAANSUhEUgAA...",
      "finishReason": "SUCCESS",
      "seed": 1234567890
    }
  ]
}
```

### 2. Image-to-Image
```
POST /v1/generation/{engine_id}/image-to-image
```

**リクエスト例:**
```bash
curl -X POST https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/image-to-image \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -F "init_image=@input.png" \
  -F "text_prompts[0][text]=A beautiful sunset over the ocean" \
  -F "image_strength=0.35" \
  -F "cfg_scale=7" \
  -F "samples=1" \
  -F "steps=30"
```

**パラメータ:**
- `init_image`: 入力画像（ファイルまたはbase64）
- `image_strength`: 0.0-1.0（0.0=完全に新しい画像、1.0=元の画像に近い）
- `text_prompts`: テキストプロンプト配列

### 3. Inpainting（マスク指定編集）
```
POST /v1/generation/{engine_id}/image-to-image/masking
```

**リクエスト例:**
```bash
curl -X POST https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/image-to-image/masking \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -F "init_image=@input.png" \
  -F "mask_image=@mask.png" \
  -F "text_prompts[0][text]=A beautiful sunset" \
  -F "mask_source=MASK_IMAGE_WHITE"
```

### 4. 利用可能なエンジン一覧
```
GET /v1/engines/list
```

**レスポンス例:**
```json
{
  "engines": [
    {
      "id": "stable-diffusion-xl-1024-v1-0",
      "name": "Stable Diffusion XL 1.0",
      "description": "...",
      "type": "PICTURE"
    }
  ]
}
```

## 推奨エンジン

### Stable Diffusion XL
- **エンジンID**: `stable-diffusion-xl-1024-v1-0`
- **解像度**: 1024x1024（推奨）
- **用途**: 高品質な画像生成

### Stable Diffusion 1.5
- **エンジンID**: `stable-diffusion-v1-5`
- **解像度**: 512x512, 768x768
- **用途**: 標準的な画像生成

## リクエスト形式

### multipart/form-data（推奨）
- 画像ファイルを直接送信可能
- メモリ効率が良い

### JSON（base64エンコード）
- 画像をbase64エンコードして送信
- Cloudflare Workersではこちらが適している可能性

## レスポンス形式

### 成功時
```json
{
  "artifacts": [
    {
      "base64": "iVBORw0KGgoAAAANSUhEUgAA...",
      "finishReason": "SUCCESS",
      "seed": 1234567890
    }
  ]
}
```

### エラー時
```json
{
  "name": "invalid_request_error",
  "message": "Invalid request parameters"
}
```

## 課金体系

- **クレジット制**: 生成1回につきクレジットを消費
- **クレジット残高確認**: `GET /v1/user/balance`
- **料金**: エンジンと解像度によって異なる

## 実装上の注意点

### 1. メモリ制限
- Cloudflare Workersのメモリ制限: 128MB
- base64エンコード後のサイズを考慮
- 複数画像の同時処理に注意

### 2. 画像形式
- **入力**: PNG, JPEG, WebP
- **出力**: base64エンコードされたPNG

### 3. 画像サイズ
- **最大サイズ**: エンジンによって異なる
- **推奨**: 1024x1024（SDXL）

### 4. エラーハンドリング
- レート制限: 429エラー、60秒待機
- クレジット不足: 402エラー
- 無効なリクエスト: 400エラー

## 参考リンク

- [公式ドキュメント](https://platform.stability.ai/docs)
- [APIリファレンス](https://platform.stability.ai/docs/api-reference)
- [APIキー管理](https://platform.stability.ai/account/keys)
- [FAQ](https://platform.stability.ai/faq)
