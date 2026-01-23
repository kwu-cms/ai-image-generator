# Stability AI API移行 - 技術仕様書

## API仕様

### Stability AI APIの基本情報

- **ベースURL**: `https://api.stability.ai`
- **APIバージョン**: v1
- **認証**: Bearer Token認証（`Authorization: Bearer {api_key}`）
- **リクエスト形式**: multipart/form-data または JSON（base64エンコード）
- **レート制限**: 150リクエスト/10秒（超過時は429エラー、60秒待機）

### 主要エンドポイント

1. **Text-to-Image**: `POST /v1/generation/{engine_id}/text-to-image`
2. **Image-to-Image**: `POST /v1/generation/{engine_id}/image-to-image`
3. **Inpainting**: `POST /v1/generation/{engine_id}/image-to-image/masking`
4. **エンジン一覧**: `GET /v1/engines/list`

### 推奨エンジン

- **Stable Diffusion XL**: `stable-diffusion-xl-1024-v1-0`（1024x1024、高品質）
- **Stable Diffusion 1.5**: `stable-diffusion-v1-5`（512x512、768x768、標準）

### 主要なエンドポイント

1. **text-to-image**: テキストから画像を生成
2. **image-to-image**: 画像を入力として画像を生成（img2img）
3. **inpainting**: マスク指定による部分編集

### 認証

```javascript
headers: {
    'Authorization': `Bearer ${STABILITY_AI_API_KEY}`,
    'Accept': 'application/json'
}
```

## 実装詳細

### 1. API呼び出し関数の実装

#### 1.1 text-to-image

```javascript
async function generateTextToImage(prompt, options, env) {
    const formData = new FormData();
    formData.append('text_prompts[0][text]', prompt);
    formData.append('text_prompts[0][weight]', '1.0');
    formData.append('cfg_scale', String(options.cfg_scale || 7));
    formData.append('steps', String(options.steps || 30));
    formData.append('width', String(options.width || 1024));
    formData.append('height', String(options.height || 1024));
    formData.append('samples', '1');
    
    const engineId = options.model || 'stable-diffusion-xl-1024-v1-0';
    
    const response = await fetch(
        `https://api.stability.ai/v1/generation/${engineId}/text-to-image`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${env.STABILITY_AI_API_KEY}`,
                'Accept': 'application/json'
            },
            body: formData
        }
    );
    
    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: `HTTP ${response.status}` }));
        
        // レート制限エラーの処理
        if (response.status === 429) {
            const retryAfter = response.headers.get('Retry-After') || '60';
            throw new GenerationError(
                'APIのレート制限に達しました',
                'api_call',
                error.message,
                parseInt(retryAfter)
            );
        }
        
        // クレジット不足エラー
        if (response.status === 402) {
            throw new GenerationError(
                'クレジットが不足しています',
                'api_call',
                error.message
            );
        }
        
        throw new GenerationError(
            '画像生成に失敗しました',
            'api_call',
            error.message || `HTTP ${response.status}`
        );
    }
    
    const result = await response.json();
    
    if (!result.artifacts || result.artifacts.length === 0) {
        throw new GenerationError(
            '画像生成に失敗しました',
            'api_call',
            'レスポンスに画像が含まれていません'
        );
    }
    
    return result.artifacts[0].base64; // base64エンコードされた画像
}
```

#### 1.2 image-to-image

```javascript
async function generateImageToImage(prompt, referenceImageBase64, options, env) {
    const formData = new FormData();
    formData.append('text_prompts[0][text]', prompt);
    formData.append('text_prompts[0][weight]', '1.0');
    
    // base64エンコードされた画像をBlobに変換
    // 注意: base64データURLの場合は、data:image/png;base64,の部分を除去
    const base64Data = referenceImageBase64.includes(',') 
        ? referenceImageBase64.split(',')[1] 
        : referenceImageBase64;
    
    // base64をBlobに変換
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'image/png' });
    
    formData.append('init_image', blob, 'reference.png');
    formData.append('image_strength', String(options.image_strength || 0.35)); // 0.0-1.0
    formData.append('cfg_scale', String(options.cfg_scale || 7));
    formData.append('steps', String(options.steps || 30));
    formData.append('width', String(options.width || 1024));
    formData.append('height', String(options.height || 1024));
    formData.append('samples', '1');
    
    const engineId = options.model || 'stable-diffusion-xl-1024-v1-0';
    
    const response = await fetch(
        `https://api.stability.ai/v1/generation/${engineId}/image-to-image`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${env.STABILITY_AI_API_KEY}`,
                'Accept': 'application/json'
            },
            body: formData
        }
    );
    
    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: `HTTP ${response.status}` }));
        
        // レート制限エラーの処理
        if (response.status === 429) {
            const retryAfter = response.headers.get('Retry-After') || '60';
            throw new GenerationError(
                'APIのレート制限に達しました',
                'api_call',
                error.message,
                parseInt(retryAfter)
            );
        }
        
        // クレジット不足エラー
        if (response.status === 402) {
            throw new GenerationError(
                'クレジットが不足しています',
                'api_call',
                error.message
            );
        }
        
        throw new GenerationError(
            '画像生成に失敗しました',
            'api_call',
            error.message || `HTTP ${response.status}`
        );
    }
    
    const result = await response.json();
    
    if (!result.artifacts || result.artifacts.length === 0) {
        throw new GenerationError(
            '画像生成に失敗しました',
            'api_call',
            'レスポンスに画像が含まれていません'
        );
    }
    
    return result.artifacts[0].base64;
}
```

### 2. 参照画像の取得とエンコード

```javascript
async function getReferenceImageAsBase64(env, r2ObjectKey) {
    // R2から画像を取得
    const object = await env.R2_BUCKET.get(r2ObjectKey);
    if (!object) {
        throw new Error(`参照画像が見つかりません: ${r2ObjectKey}`);
    }
    
    // メモリ制限チェック（10MB以下）
    const maxSize = 10 * 1024 * 1024;
    if (object.size > maxSize) {
        throw new Error(`参照画像のサイズが大きすぎます: ${object.size} bytes`);
    }
    
    // ArrayBufferに変換
    const imageBuffer = await object.arrayBuffer();
    
    // base64エンコード
    const base64 = btoa(
        String.fromCharCode(...new Uint8Array(imageBuffer))
    );
    
    return `data:${object.httpMetadata?.contentType || 'image/png'};base64,${base64}`;
}
```

### 3. プロンプト生成ロジック

```javascript
function enhancePromptWithRoles(basePrompt, referenceImages) {
    if (!referenceImages || referenceImages.length === 0) {
        return basePrompt;
    }
    
    let enhancedPrompt = basePrompt;
    
    referenceImages.forEach((ref, index) => {
        const roleLabel = ref.role || 'その他';
        const roleDescription = getRoleDescription(roleLabel);
        const imageLabel = index + 1; // 1, 2, 3...
        enhancedPrompt += `\n参照画像${imageLabel}（${roleLabel}）：${roleDescription}`;
    });
    
    return enhancedPrompt;
}

function getRoleDescription(role) {
    const descriptions = {
        '構図': 'この画像のレイアウト、カメラアングル、構図を参考にする',
        'スタイル': 'この画像のアートスタイル、色調、レンダリング手法を完全に再現する',
        '色調': 'この画像の色彩パレット、明暗、トーンを正確に反映する',
        '質感': 'この画像の質感、マテリアル、表面の質感を再現する',
        'ディテール': 'この画像の細部の表現、ディテールの描き方を参考にする',
        '人物': 'この画像の人物の特徴、顔立ち、服装、ポーズを参考にする',
        'その他': 'この画像の全体的な特徴を参考にする'
    };
    return descriptions[role] || descriptions['その他'];
}
```

### 4. 品質設定の固定化

```javascript
const QUALITY_PRESETS = {
    standard: {
        model: 'stable-diffusion-xl-1024-v1-0',
        steps: 30,
        cfg_scale: 7,
        width: 1024,
        height: 1024,
        image_strength: 0.35, // img2img用（0.0-1.0）
        samples: 1
    },
    high: {
        model: 'stable-diffusion-xl-1024-v1-0',
        steps: 50,
        cfg_scale: 7,
        width: 1024,
        height: 1024,
        image_strength: 0.35,
        samples: 1
    }
};

// デフォルトは標準品質
const DEFAULT_QUALITY = 'standard';
```

### 5. エラーハンドリング

```javascript
class GenerationError extends Error {
    constructor(message, stage, details, retryAfter) {
        super(message);
        this.stage = stage; // 'save_reference', 'api_call', 'save_output', 'db_record'
        this.details = details;
        this.retryAfter = retryAfter; // 秒
    }
}

async function handleGenerate(request, env, user) {
    const corsHeaders = getCorsHeaders(request);
    let body;
    
    try {
        body = await request.json();
    } catch (error) {
        return new Response(
            JSON.stringify({ error: 'リクエストボディの解析に失敗しました' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
    
    const { prompt, referenceImages, generationOptions } = body;
    
    try {
        // 1. 参照画像の取得とエンコード
        let processedReferenceImages = [];
        if (referenceImages && referenceImages.length > 0) {
            for (const refImage of referenceImages) {
                try {
                    const base64 = await getReferenceImageAsBase64(env, refImage.r2_object_key);
                    processedReferenceImages.push({
                        ...refImage,
                        base64: base64
                    });
                } catch (error) {
                    throw new GenerationError(
                        '参照画像の取得に失敗しました',
                        'save_reference',
                        error.message
                    );
                }
            }
        }
        
        // 2. プロンプトの生成
        const enhancedPrompt = enhancePromptWithRoles(prompt, processedReferenceImages);
        
        // 3. 品質設定の適用
        const qualityPreset = QUALITY_PRESETS[DEFAULT_QUALITY];
        
        // 4. API呼び出し
        let generatedImageBase64;
        try {
            if (processedReferenceImages.length > 0) {
                // img2img
                generatedImageBase64 = await generateImageToImage(
                    enhancedPrompt,
                    processedReferenceImages[0].base64,
                    qualityPreset
                );
            } else {
                // text-to-image
                generatedImageBase64 = await generateTextToImage(
                    enhancedPrompt,
                    qualityPreset
                );
            }
        } catch (error) {
            // レート制限エラーの処理
            if (error.message.includes('rate limit')) {
                const retryAfter = error.retryAfter || 60;
                throw new GenerationError(
                    'APIのレート制限に達しました',
                    'api_call',
                    error.message,
                    retryAfter
                );
            }
            throw new GenerationError(
                '画像生成に失敗しました',
                'api_call',
                error.message
            );
        }
        
        // 5. 出力画像の保存
        let r2ImageUrl;
        try {
            const imageBuffer = Uint8Array.from(atob(generatedImageBase64), c => c.charCodeAt(0));
            const fileName = `generated-images/${Date.now()}-${Math.random().toString(36).substring(7)}.png`;
            
            await env.R2_BUCKET.put(fileName, imageBuffer, {
                httpMetadata: {
                    contentType: 'image/png',
                },
            });
            
            r2ImageUrl = `/api/image/${fileName}`;
        } catch (error) {
            throw new GenerationError(
                '生成画像の保存に失敗しました',
                'save_output',
                error.message
            );
        }
        
        // 6. DB記録
        let generationId = null;
        try {
            if (env.DB) {
                const generationSettingsJson = JSON.stringify(qualityPreset);
                const result = await env.DB.prepare(
                    'INSERT INTO generations (user_id, final_prompt, generation_settings, output_image_r2_key) VALUES (?, ?, ?, ?)'
                ).bind(user.id, enhancedPrompt, generationSettingsJson, fileName).run();
                
                generationId = result.meta.last_row_id;
                
                // 参照画像との紐づけ
                if (processedReferenceImages.length > 0) {
                    for (let i = 0; i < processedReferenceImages.length; i++) {
                        const refImage = processedReferenceImages[i];
                        await env.DB.prepare(
                            'INSERT INTO generation_reference_images (generation_id, reference_image_id, role_label, r2_object_key, image_hash, display_order) VALUES (?, ?, ?, ?, ?, ?)'
                        ).bind(
                            generationId,
                            refImage.reference_image_id,
                            refImage.role_label,
                            refImage.r2_object_key,
                            refImage.image_hash,
                            i
                        ).run();
                    }
                }
            }
        } catch (error) {
            throw new GenerationError(
                'データベースへの記録に失敗しました',
                'db_record',
                error.message
            );
        }
        
        // 成功レスポンス
        return new Response(
            JSON.stringify({
                success: true,
                prompt: enhancedPrompt,
                original_prompt: prompt,
                image_url: r2ImageUrl,
                generation_id: generationId
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
        
    } catch (error) {
        // エラーレスポンス
        const errorResponse = {
            error: error.message || '画像生成に失敗しました',
            stage: error.stage || 'unknown',
            details: error.details || error.message
        };
        
        if (error.retryAfter) {
            errorResponse.retry_after = error.retryAfter;
        }
        
        const statusCode = error.stage === 'api_call' ? 503 : 500;
        
        return new Response(
            JSON.stringify(errorResponse),
            {
                status: statusCode,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        );
    }
}
```

## データベーススキーマ

### generationsテーブル（imagesからリネーム）

```sql
CREATE TABLE IF NOT EXISTS generations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    final_prompt TEXT NOT NULL,
    generation_settings TEXT NOT NULL,
    output_image_r2_key TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_generations_user_id ON generations(user_id);
CREATE INDEX IF NOT EXISTS idx_generations_created_at ON generations(created_at DESC);
```

### generation_reference_imagesテーブル（拡張）

```sql
ALTER TABLE generation_reference_images ADD COLUMN r2_object_key TEXT;
ALTER TABLE generation_reference_images ADD COLUMN image_hash TEXT;
ALTER TABLE generation_reference_images ADD COLUMN weight REAL DEFAULT 1.0;
```

## 環境変数

### Workers Secrets

```bash
# Stability AI APIキー
wrangler secret put STABILITY_AI_API_KEY
```

### wrangler.toml

```toml
[env.production]
vars = {
    STABILITY_AI_API_KEY = "your-api-key-here" # 開発環境用（本番はSecretsを使用）
}
```

## パッケージ依存関係

### package.json

```json
{
  "dependencies": {
    "openai": "^4.0.0", // 既存（後で削除可能）
    "@stability-ai/sdk": "^1.0.0" // 追加（オプション、fetch APIでも可）
  }
}
```

注意: Stability AI SDKはオプションです。fetch APIを使用する場合は追加不要です。

## メモリ制限の考慮

### Workersのメモリ制限
- **制限**: 128MB
- **対策**: 
  - 参照画像のサイズ上限: 10MB
  - 参照画像の枚数上限: 5枚
  - base64エンコード後のサイズチェック

### フロントエンド側のバリデーション

```javascript
// ファイルサイズチェック（既存実装を維持）
const maxSize = 10 * 1024 * 1024; // 10MB
if (file.size > maxSize) {
    alert('画像ファイルのサイズが大きすぎます（最大10MB）');
    return;
}

// 参照画像数の上限チェック（既存実装を維持）
const MAX_REFERENCE_IMAGES = 5;
if (referenceImages.length > MAX_REFERENCE_IMAGES) {
    alert(`参照画像は最大${MAX_REFERENCE_IMAGES}枚まで追加できます`);
    return;
}
```

## エラーメッセージの構造

### 成功レスポンス

```json
{
    "success": true,
    "prompt": "最終プロンプト（役割情報を含む）",
    "original_prompt": "ユーザーが入力したプロンプト",
    "image_url": "/api/image/generated-images/xxx.png",
    "generation_id": 123
}
```

### エラーレスポンス

```json
{
    "error": "画像生成に失敗しました",
    "stage": "api_call",
    "details": "Stability AI APIのレート制限に達しました",
    "retry_after": 60
}
```

## テストケース

### 1. text-to-image（参照画像なし）

```javascript
// リクエスト
{
    "prompt": "美しい夕日の風景",
    "referenceImages": [],
    "generationOptions": {}
}

// 期待される動作
// - text-to-image APIを呼び出す
// - 生成画像をR2に保存
// - DBに記録
```

### 2. image-to-image（参照画像1枚）

```javascript
// リクエスト
{
    "prompt": "人物だけを抽出してください",
    "referenceImages": [
        {
            "id": 1,
            "role": "スタイル",
            "r2_object_key": "reference-images/xxx.png"
        }
    ],
    "generationOptions": {}
}

// 期待される動作
// - R2から参照画像を取得
// - base64エンコード
// - image-to-image APIを呼び出す
// - 生成画像をR2に保存
// - DBに記録（参照画像との紐づけも含む）
```

### 3. エラーハンドリング

```javascript
// レート制限エラー
// 期待される動作
// - stage: "api_call"
// - retry_after: 60（秒）
// - 適切なエラーメッセージ

// 参照画像取得エラー
// 期待される動作
// - stage: "save_reference"
// - 詳細なエラーメッセージ
```
