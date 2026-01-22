/**
 * 履歴ページのJavaScript
 * 生成履歴の取得と表示
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
    loadHistory();
});

/**
 * 履歴の読み込み
 */
async function loadHistory() {
    const loading = document.getElementById('loading');
    const historyContainer = document.getElementById('historyContainer');
    const historyList = document.getElementById('historyList');
    const emptyMessage = document.getElementById('emptyMessage');
    const errorSection = document.getElementById('errorSection');
    const errorMessage = document.getElementById('errorMessage');

    loading.style.display = 'block';
    historyContainer.style.display = 'none';
    errorSection.style.display = 'none';

    try {
        const response = await fetch(`${API_BASE_URL}/api/history`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || '履歴の取得に失敗しました');
        }

        loading.style.display = 'none';

        if (!data.history || data.history.length === 0) {
            emptyMessage.style.display = 'block';
            historyContainer.style.display = 'block';
            return;
        }

        // 履歴の表示
        historyList.innerHTML = data.history.map(item => `
            <div class="history-item">
                <div class="history-item-image">
                    <img src="${API_BASE_URL}${item.image_url}" alt="生成された画像" loading="lazy" />
                </div>
                <div class="history-item-content">
                    <div class="history-item-prompt">
                        <strong>プロンプト:</strong>
                        <p>${escapeHtml(item.prompt)}</p>
                    </div>
                    <div class="history-item-meta">
                        <div class="history-item-date">${formatDate(item.created_at)}</div>
                        <div class="history-item-id">ID: ${item.id}</div>
                    </div>
                </div>
            </div>
        `).join('');

        historyContainer.style.display = 'block';

    } catch (error) {
        console.error('Error:', error);
        loading.style.display = 'none';
        errorMessage.textContent = error.message || 'エラーが発生しました';
        errorSection.style.display = 'block';
    }
}

/**
 * 日付のフォーマット
 */
function formatDate(dateString) {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}/${month}/${day} ${hours}:${minutes}`;
}

/**
 * HTMLエスケープ
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
