/**
 * OpenAI Images API モジュール
 * DALL-E 3 / GPT Image APIを使用した画像生成・編集
 */

// OpenAI Images API設定
const OPENAI_IMAGES_BASE_URL = 'https://api.openai.com/v1/images';

/**
 * カスタムエラークラス（GenerationErrorをインポートする必要があるが、
 * 循環依存を避けるため、ここではErrorを使用し、呼び出し側でGenerationErrorに変換）
 */

/**
 * 画像生成・編集の抽象化インターフェース
 * 将来的にStability AIとOpenAIの両方に対応可能な設計
 */

/**
 * OpenAI Images APIで画像生成（Generate）
 * @param {string} prompt - 英語プロンプト
 * @param {object} options - 生成オプション
 * @param {object} env - 環境変数（OPENAI_API_KEYを含む）
 * @returns {Promise<string>} - base64エンコードされた画像
 */
async function generateImageWithOpenAI(prompt, options, env) {
    if (!env.OPENAI_API_KEY) {
        const error = new Error('OpenAI APIキーが設定されていません');
        error.stage = 'openai_api_call';
        throw error;
    }

    const quality = options.quality || 'standard'; // 'standard' | 'hd'
    const size = options.size || '1024x1024'; // '1024x1024' | '1024x1792' | '1792x1024'
    const style = options.style || 'vivid'; // 'vivid' | 'natural'
    const model = options.model || 'dall-e-3'; // 'dall-e-3' | 'dall-e-2'

    // DALL-E 3のパラメータ
    const requestBody = {
        model: model,
        prompt: prompt,
        n: 1, // DALL-E 3では1のみサポート
        size: size,
        quality: quality,
        style: style,
        response_format: 'b64_json' // base64形式で返す
    };

    try {
        const response = await fetch(`${OPENAI_IMAGES_BASE_URL}/generations`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ 
                message: `HTTP ${response.status}` 
            }));
            
            // レート制限エラー
            if (response.status === 429) {
                const retryAfter = response.headers.get('Retry-After') || '60';
                throw new Error(`APIのレート制限に達しました。再試行まで${retryAfter}秒待機してください。`);
            }
            
            // クレジット不足エラー
            if (response.status === 402) {
                throw new Error('クレジットが不足しています');
            }
            
            // その他のエラー
            throw new Error(errorData.error?.message || errorData.message || `HTTP ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.data || data.data.length === 0 || !data.data[0].b64_json) {
            const error = new Error('画像生成に失敗しました: レスポンスに画像が含まれていません');
            error.stage = 'openai_api_call';
            throw error;
        }

        return data.data[0].b64_json; // base64エンコードされた画像

    } catch (error) {
        if (error instanceof Error && error.stage) {
            throw error; // 既にstageが設定されている場合はそのまま
        }
        const newError = new Error(`画像生成に失敗しました: ${error.message || 'Unknown error'}`);
        newError.stage = 'openai_api_call';
        newError.details = error.message;
        throw newError;
    }
}

/**
 * OpenAI Images APIで画像編集（Edit）
 * 注意: DALL-E 3ではEditがサポートされていないため、GPT Image APIまたはDALL-E 2を使用
 * @param {string} prompt - 英語プロンプト（編集指示）
 * @param {ArrayBuffer} baseImageBuffer - ベース画像のバッファ
 * @param {ArrayBuffer|null} maskBuffer - マスク画像のバッファ（オプション）
 * @param {object} options - 編集オプション
 * @param {object} env - 環境変数（OPENAI_API_KEYを含む）
 * @returns {Promise<string>} - base64エンコードされた画像
 */
async function editImageWithOpenAI(prompt, baseImageBuffer, maskBuffer, options, env) {
    if (!env.OPENAI_API_KEY) {
        const error = new Error('OpenAI APIキーが設定されていません');
        error.stage = 'openai_api_call';
        throw error;
    }

    // DALL-E 2のEdit APIの制限チェック
    // 1. 画像サイズ: 4MB以下
    const MAX_SIZE = 4 * 1024 * 1024; // 4MB
    if (baseImageBuffer.byteLength > MAX_SIZE) {
        const error = new Error(`画像サイズが大きすぎます。4MB以下のPNG画像をアップロードしてください（現在: ${(baseImageBuffer.byteLength / 1024 / 1024).toFixed(2)}MB）`);
        error.stage = 'image_validation';
        throw error;
    }

    // 2. PNG形式の確認（PNG signature: 89 50 4E 47 0D 0A 1A 0A）
    const view = new DataView(baseImageBuffer);
    const isPNG = view.byteLength >= 8 && 
                  view.getUint32(0) === 0x89504E47 && 
                  view.getUint32(4) === 0x0D0A1A0A;
    
    if (!isPNG) {
        const error = new Error('画像はPNG形式である必要があります。PNG形式の画像をアップロードしてください。');
        error.stage = 'image_validation';
        throw error;
    }
    
    // 3. RGBA形式の確認（PNGのカラータイプをチェック）
    // PNGのIHDRチャンク（オフセット16バイト）からカラータイプを取得
    // カラータイプ2（RGB）の場合はエラー、カラータイプ6（RGBA）または0（グレースケール）または4（グレースケール+アルファ）を許可
    if (view.byteLength >= 25) {
        const colorType = view.getUint8(25); // IHDRチャンクの9バイト目（カラータイプ）
        // カラータイプ: 0=グレースケール, 2=RGB, 3=インデックスカラー, 4=グレースケール+アルファ, 6=RGBA
        if (colorType === 2) {
            // RGB形式（アルファチャンネルなし）はエラー
            const error = new Error('画像はRGBA形式（アルファチャンネル付きPNG）である必要があります。既存の画像を削除して、新しい画像をアップロードしてください。');
            error.stage = 'image_validation';
            throw error;
        }
    }

    // DALL-E 3ではEditがサポートされていないため、DALL-E 2またはGPT Image APIを使用
    // 現時点ではDALL-E 2のEdit APIを使用（将来的にGPT Image APIに移行可能）
    const model = options.model || 'dall-e-2'; // EditはDALL-E 2またはGPT Image API
    const size = options.size || '1024x1024'; // DALL-E 2: '256x256' | '512x512' | '1024x1024'
    const n = options.n || 1;

    // FormDataを作成
    const formData = new FormData();
    
    // ベース画像をBlobに変換して追加（PNG形式であることを確認済み）
    const baseImageBlob = new Blob([baseImageBuffer], { type: 'image/png' });
    formData.append('image', baseImageBlob, 'base.png');
    
    // マスク画像がある場合は追加
    if (maskBuffer) {
        const maskBlob = new Blob([maskBuffer], { type: 'image/png' });
        formData.append('mask', maskBlob, 'mask.png');
    }
    
    // プロンプトとサイズを追加
    formData.append('prompt', prompt);
    formData.append('size', size);
    formData.append('n', String(n));
    formData.append('response_format', 'b64_json');

    try {
        const response = await fetch(`${OPENAI_IMAGES_BASE_URL}/edits`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${env.OPENAI_API_KEY}`
                // FormDataを使用する場合、Content-Typeは自動設定されるため指定しない
            },
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ 
                message: `HTTP ${response.status}` 
            }));
            
            // レート制限エラー
            if (response.status === 429) {
                const retryAfter = response.headers.get('Retry-After') || '60';
                throw new Error(`APIのレート制限に達しました。再試行まで${retryAfter}秒待機してください。`);
            }
            
            // クレジット不足エラー
            if (response.status === 402) {
                throw new Error('クレジットが不足しています');
            }
            
            // その他のエラー
            throw new Error(errorData.error?.message || errorData.message || `HTTP ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.data || data.data.length === 0 || !data.data[0].b64_json) {
            const error = new Error('画像編集に失敗しました: レスポンスに画像が含まれていません');
            error.stage = 'openai_api_call';
            throw error;
        }

        return data.data[0].b64_json; // base64エンコードされた画像

    } catch (error) {
        if (error instanceof Error && error.stage) {
            throw error; // 既にstageが設定されている場合はそのまま
        }
        const newError = new Error(`画像編集に失敗しました: ${error.message || 'Unknown error'}`);
        newError.stage = 'openai_api_call';
        newError.details = error.message;
        throw newError;
    }
}

/**
 * OpenAI Images APIで画像バリエーション生成（Variation）
 * 注意: DALL-E 3ではVariationがサポートされていないため、DALL-E 2を使用
 * @param {ArrayBuffer} baseImageBuffer - ベース画像のバッファ
 * @param {object} options - バリエーションオプション
 * @param {object} env - 環境変数（OPENAI_API_KEYを含む）
 * @returns {Promise<string>} - base64エンコードされた画像
 */
async function variationImageWithOpenAI(baseImageBuffer, options, env) {
    if (!env.OPENAI_API_KEY) {
        throw new Error('OpenAI APIキーが設定されていません');
    }

    // VariationはDALL-E 2のみサポート
    const size = options.size || '1024x1024';
    const n = options.n || 1;

    // FormDataを作成
    const formData = new FormData();
    
    // ベース画像をBlobに変換して追加
    const baseImageBlob = new Blob([baseImageBuffer], { type: 'image/png' });
    formData.append('image', baseImageBlob, 'base.png');
    
    formData.append('size', size);
    formData.append('n', String(n));
    formData.append('response_format', 'b64_json');

    try {
        const response = await fetch(`${OPENAI_IMAGES_BASE_URL}/variations`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${env.OPENAI_API_KEY}`
            },
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ 
                message: `HTTP ${response.status}` 
            }));
            
            if (response.status === 429) {
                const retryAfter = response.headers.get('Retry-After') || '60';
                throw new Error(`APIのレート制限に達しました。再試行まで${retryAfter}秒待機してください。`);
            }
            
            if (response.status === 402) {
                throw new Error('クレジットが不足しています');
            }
            
            throw new Error(errorData.error?.message || errorData.message || `HTTP ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.data || data.data.length === 0 || !data.data[0].b64_json) {
            throw new Error('画像バリエーション生成に失敗しました: レスポンスに画像が含まれていません');
        }

        return data.data[0].b64_json;

    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error(`画像バリエーション生成に失敗しました: ${error.message || 'Unknown error'}`);
    }
}

export {
    generateImageWithOpenAI,
    editImageWithOpenAI,
    variationImageWithOpenAI
};
