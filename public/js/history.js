/**
 * 履歴ページのJavaScript
 * 生成履歴の取得と表示
 */

// APIのベースURL（auth.jsが読み込まれている場合はそれを使用、そうでない場合は定義）
// auth.jsで既にconst API_BASE_URLが定義されているため、window.API_BASE_URLを直接参照
if (typeof window.API_BASE_URL === 'undefined') {
    window.API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:8787'
        : 'https://image-generation-api.tkwshnsk.workers.dev';
}
// auth.jsで既にconst API_BASE_URLが定義されているため、window.API_BASE_URLを直接参照
// history.js内では window.API_BASE_URL を直接使用する（const API_BASE_URLは定義しない）

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
        const response = await fetch(`${window.API_BASE_URL}/api/history`, {
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
                    <img src="${window.API_BASE_URL}${item.image_url}" class="card-img-top" alt="生成された画像" loading="lazy" style="object-fit: cover; height: 250px;" />
                    <div class="card-body d-flex flex-column">
                        <p class="prompt-quote mb-3 flex-grow-1">${escapeHtml(item.prompt)}</p>
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
 * 日付のフォーマット（生成日時を日本時間で表示）
 * Cloudflare WorkersはUTC時間を使用するため、日本時間（JST、UTC+9）に変換
 */
function formatDate(dateString) {
    if (!dateString) return '日時不明';
    // UTC時間として解釈（データベースはUTCで保存されている）
    const date = new Date(dateString + (dateString.includes('Z') ? '' : 'Z'));
    // 日本時間（JST）でフォーマット
    const formatter = new Intl.DateTimeFormat('ja-JP', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
    const parts = formatter.formatToParts(date);
    const year = parts.find(p => p.type === 'year').value;
    const month = parts.find(p => p.type === 'month').value;
    const day = parts.find(p => p.type === 'day').value;
    const hours = parts.find(p => p.type === 'hour').value;
    const minutes = parts.find(p => p.type === 'minute').value;
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
