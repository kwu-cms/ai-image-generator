/**
 * Cloudflare Workers API
 * OpenAI DALL-E APIを使用した画像生成と履歴管理
 */

import OpenAI from 'openai';

// CORS設定
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/**
 * リクエストハンドラー
 */
export default {
  async fetch(request, env) {
    // OPTIONSリクエスト（CORSプリフライト）の処理
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // 画像生成API
      if (path === '/api/generate' && request.method === 'POST') {
        return await handleGenerate(request, env);
      }

      // 履歴取得API
      if (path === '/api/history' && request.method === 'GET') {
        return await handleHistory(env);
      }

      // 画像配信API（R2から画像を取得）
      if (path.startsWith('/api/image/') && request.method === 'GET') {
        return await handleImage(path, env);
      }

      // 404エラー（静的ファイルはwrangler.tomlの[site]設定で配信）
      return new Response('Not Found', { 
        status: 404,
        headers: corsHeaders 
      });
    } catch (error) {
      console.error('Error:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
  },
};

/**
 * 画像生成処理
 */
async function handleGenerate(request, env) {
  // リクエストボディの取得
  let body;
  try {
    body = await request.json();
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'リクエストボディの解析に失敗しました' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
  
  const { prompt } = body;

  if (!prompt || prompt.trim() === '') {
    return new Response(
      JSON.stringify({ error: 'プロンプトが入力されていません' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  // OpenAI APIキーの確認
  if (!env.OPENAI_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'OpenAI APIキーが設定されていません' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  // OpenAI APIクライアントの初期化
  const openai = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
  });

  try {
    // 生成開始時間を記録
    const startTime = Date.now();
    
    // DALL-E APIで画像生成
    const response = await openai.images.generate({
    model: 'dall-e-3',
    prompt: prompt,
    n: 1,
    size: '1024x1024',
    quality: 'standard',
  });

    const imageUrl = response.data[0].url;
    
    // 画像ダウンロード開始時間
    const downloadStartTime = Date.now();

    // 生成された画像をダウンロード
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error('画像のダウンロードに失敗しました');
    }
    const imageBuffer = await imageResponse.arrayBuffer();
    
    // ダウンロード完了時間
    const downloadEndTime = Date.now();

    // R2に画像をアップロード
    const uploadStartTime = Date.now();
    const fileName = `images/${Date.now()}-${Math.random().toString(36).substring(7)}.png`;
    await env.R2_BUCKET.put(fileName, imageBuffer, {
      httpMetadata: {
        contentType: 'image/png',
      },
    });
    const uploadEndTime = Date.now();

    // R2の公開URLを生成（Workers経由で配信するURL）
    const r2ImageUrl = `/api/image/${fileName}`;

    // データベースに保存
    if (env.DB) {
      await env.DB.prepare(
        'INSERT INTO images (prompt, image_url) VALUES (?, ?)'
      ).bind(prompt, r2ImageUrl).run();
    }
    
    // 処理時間を計算（秒単位）
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    const generationTime = ((downloadStartTime - startTime) / 1000).toFixed(1);
    const downloadTime = ((downloadEndTime - downloadStartTime) / 1000).toFixed(1);
    const uploadTime = ((uploadEndTime - uploadStartTime) / 1000).toFixed(1);

    // レスポンスを返す
    return new Response(
      JSON.stringify({
        success: true,
        prompt: prompt,
        image_url: r2ImageUrl,
        timing: {
          total: totalTime,
          generation: generationTime,
          download: downloadTime,
          upload: uploadTime
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('OpenAI API Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || '画像の生成に失敗しました',
        details: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}

/**
 * 履歴取得処理
 */
async function handleHistory(env) {
  if (!env.DB) {
    return new Response(
      JSON.stringify({ error: 'データベースが設定されていません' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  // データベースから履歴を取得（新しい順）
  const result = await env.DB.prepare(
    'SELECT id, prompt, image_url, created_at FROM images ORDER BY created_at DESC'
  ).all();

  return new Response(
    JSON.stringify({
      success: true,
      history: result.results || [],
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
}

/**
 * 画像配信処理（R2から画像を取得）
 */
async function handleImage(path, env) {
  // パスからファイル名を抽出（/api/image/images/xxx.png → images/xxx.png）
  const fileName = path.replace('/api/image/', '');

  try {
    // R2から画像を取得
    const object = await env.R2_BUCKET.get(fileName);

    if (!object) {
      return new Response('Image not found', {
        status: 404,
        headers: corsHeaders
      });
    }

    // 画像データを取得
    const imageData = await object.arrayBuffer();

    // 画像を返す
    return new Response(imageData, {
      headers: {
        ...corsHeaders,
        'Content-Type': object.httpMetadata?.contentType || 'image/png',
        'Cache-Control': 'public, max-age=31536000', // 1年間キャッシュ
      }
    });
  } catch (error) {
    console.error('Error fetching image:', error);
    return new Response('Error fetching image', {
      status: 500,
      headers: corsHeaders
    });
  }
}

