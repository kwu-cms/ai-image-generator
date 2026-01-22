/**
 * メインページのJavaScript
 * 画像生成フォームの処理
 */

// APIのベースURL
// ローカル開発時: http://localhost:8787
// 本番環境: Cloudflare WorkersのURL
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:8787'
  : 'https://image-generation-api.tkwshnsk.workers.dev';

/**
 * ページ読み込み時の初期化
 */
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('generateForm');
    form.addEventListener('submit', handleSubmit);
});

/**
 * フォーム送信処理
 */
async function handleSubmit(event) {
    event.preventDefault();

    const prompt = document.getElementById('prompt').value.trim();
    const generateBtn = document.getElementById('generateBtn');
    const resultSection = document.getElementById('resultSection');
    const errorSection = document.getElementById('errorSection');
    const loading = document.getElementById('loading');
    const resultImageContainer = document.getElementById('resultImageContainer');
    const resultPrompt = document.getElementById('resultPrompt');

    // バリデーション
    if (!prompt) {
        showError('プロンプトを入力してください');
        return;
    }

    // UIのリセット
    errorSection.style.display = 'none';
    resultSection.style.display = 'none';
    generateBtn.disabled = true;
    generateBtn.textContent = '生成中...';

    try {
        // APIリクエスト
        const response = await fetch(`${API_BASE_URL}/api/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompt }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}: ${response.statusText}` }));
            throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        // 結果の表示
        resultImageContainer.innerHTML = `
            <img src="${API_BASE_URL}${data.image_url}" alt="生成された画像" />
        `;
        resultPrompt.innerHTML = `
            <p><strong>プロンプト:</strong> ${escapeHtml(data.prompt)}</p>
        `;
        resultSection.style.display = 'block';

        // フォームをリセット
        document.getElementById('prompt').value = '';

    } catch (error) {
        console.error('Error:', error);
        let errorMessage = 'エラーが発生しました';
        
        if (error.message) {
            errorMessage = error.message;
        } else if (error instanceof TypeError && error.message.includes('fetch')) {
            errorMessage = 'APIサーバーに接続できません。Workersが起動しているか確認してください。';
        }
        
        showError(errorMessage);
    } finally {
        generateBtn.disabled = false;
        generateBtn.textContent = '画像を生成';
    }
}

/**
 * エラー表示
 */
function showError(message) {
    const errorSection = document.getElementById('errorSection');
    const errorMessage = document.getElementById('errorMessage');
    errorMessage.textContent = message;
    errorSection.style.display = 'block';
}

/**
 * HTMLエスケープ
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
