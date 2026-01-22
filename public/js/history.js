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
document.addEventListener('DOMContentLoaded', async () => {
    // 認証チェック
    const user = await requireAuth();
    if (!user) return;

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
        const response = await fetch(`${API_BASE_URL}/api/history`, {
            credentials: 'include',
        });
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
        historyList.innerHTML = data.history.map((item, index) => `
            <div class="col-md-6 col-lg-4">
                <div class="card h-100 shadow-custom history-card fade-in-up" style="animation-delay: ${index * 0.1}s;">
                    <img src="${API_BASE_URL}${item.image_url}" class="card-img-top" alt="生成された画像" loading="lazy" style="object-fit: cover; height: 250px;" />
                    <div class="card-body d-flex flex-column">
                        <h5 class="card-title text-gradient">プロンプト</h5>
                        <p class="card-text flex-grow-1">${escapeHtml(item.prompt)}</p>
                        <div class="mt-auto pt-3 border-top">
                            <small class="text-muted d-block">
                                ${formatDate(item.created_at)}
                            </small>
                            <small class="text-muted">
                                ID: ${item.id}
                            </small>
                        </div>
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
