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
document.addEventListener('DOMContentLoaded', async () => {
    // 認証チェック（getCurrentUserはauth.jsで定義されている）
    let user = null;
    try {
        if (typeof getCurrentUser === 'function') {
            user = await getCurrentUser();
        }
    } catch (error) {
        console.error('Error checking auth:', error);
    }
    
    if (!user) {
        // ログインしていない場合：フォームを非表示にしてログインを促す
        const generateSection = document.querySelector('section.card.shadow-custom.mb-4.fade-in-up');
        if (generateSection) {
            generateSection.innerHTML = `
                <div class="card-body">
                    <h2 class="card-title mb-4">
                        <span class="text-gradient">画像を生成</span>
                    </h2>
                    <div class="alert alert-info mb-0">
                        <h5 class="alert-heading">ログインが必要です</h5>
                        <p class="mb-3">画像を生成するには、大学のメールアドレス（@konan-wu.ac.jp）でログインしてください。</p>
                        <a href="login.html" class="btn btn-primary">ログインページへ</a>
                    </div>
                </div>
            `;
        }
    } else {
        // ログインしている場合：フォームを有効化
        const form = document.getElementById('generateForm');
        if (form) {
            form.addEventListener('submit', handleSubmit);
        }
    }
    
    // 画像一覧を読み込み（ログイン状態に関わらず表示）
    loadAllImages();
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
            credentials: 'include',
            body: JSON.stringify({ prompt }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}: ${response.statusText}` }));
            throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        const startTime = performance.now();

        // 結果の表示
        resultImageContainer.innerHTML = `
            <div class="fade-in-up">
                <img src="${API_BASE_URL}${data.image_url}" class="img-fluid rounded-3 shadow-custom" alt="生成された画像" 
                     onload="document.getElementById('timingInfo').style.display='block';" />
            </div>
        `;

        let timingHtml = '';
        if (data.timing) {
            timingHtml = `
                <div class="timing-info mt-3 fade-in-up" id="timingInfo" style="display: none;">
                    <p class="mb-2 fw-bold">
                        <span class="text-gradient">処理時間:</span> ${data.timing.total}秒
                    </p>
                    <details>
                        <summary class="fw-semibold">詳細を見る</summary>
                        <ul class="mt-3">
                            <li>画像生成: ${data.timing.generation}秒</li>
                            <li>画像ダウンロード: ${data.timing.download}秒</li>
                            <li>ストレージ保存: ${data.timing.upload}秒</li>
                        </ul>
                    </details>
                </div>
            `;
        }

        resultPrompt.innerHTML = `
            <div class="fade-in-up">
                <p class="mb-2">
                    <strong class="text-gradient">プロンプト:</strong>
                </p>
                <p class="mb-0">${escapeHtml(data.prompt)}</p>
            </div>
            ${timingHtml}
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
        const btnIcon = document.getElementById('generateBtnIcon');
        if (btnIcon && window.insertIcon) {
            generateBtn.innerHTML = insertIcon('sparkles', 'icon-only') + ' 画像を生成';
        } else {
            generateBtn.textContent = '画像を生成';
        }
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

/**
 * 全画像一覧の読み込み
 */
async function loadAllImages() {
    const loading = document.getElementById('imagesLoading');
    const imagesContainer = document.getElementById('imagesContainer');
    const imagesList = document.getElementById('imagesList');
    const emptyMessage = document.getElementById('emptyImagesMessage');
    const errorSection = document.getElementById('imagesErrorSection');
    const errorMessage = document.getElementById('imagesErrorMessage');

    if (!loading || !imagesContainer || !imagesList) {
        return; // 要素が存在しない場合は何もしない
    }

    loading.style.display = 'block';
    imagesContainer.style.display = 'none';
    errorSection.style.display = 'none';

    try {
        const response = await fetch(`${API_BASE_URL}/api/images`);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}: ${response.statusText}` }));
            throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        loading.style.display = 'none';

        if (!data.images || data.images.length === 0) {
            emptyMessage.style.display = 'block';
            imagesContainer.style.display = 'block';
            return;
        }

        // 画像一覧の表示
        imagesList.innerHTML = data.images.map((item, index) => `
            <div class="col-md-6 col-lg-4">
                <div class="card h-100 shadow-custom history-card fade-in-up" style="animation-delay: ${index * 0.05}s;">
                    <img src="${API_BASE_URL}${item.image_url}" class="card-img-top" alt="生成された画像" loading="lazy" style="object-fit: cover; height: 250px;" />
                    <div class="card-body d-flex flex-column">
                        <h5 class="card-title text-gradient">プロンプト</h5>
                        <p class="card-text flex-grow-1">${escapeHtml(item.prompt)}</p>
                        <div class="mt-auto pt-3 border-top">
                            <small class="text-muted d-block">
                                ${formatDate(item.created_at)}
                            </small>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');

        imagesContainer.style.display = 'block';

    } catch (error) {
        console.error('Error loading images:', error);
        loading.style.display = 'none';
        errorMessage.textContent = '画像一覧の読み込みに失敗しました。しばらくしてから再度お試しください。';
        errorSection.style.display = 'block';
        imagesContainer.style.display = 'block';
    }
}

/**
 * 日付のフォーマット
 */
function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
        return 'たった今';
    } else if (diffMins < 60) {
        return `${diffMins}分前`;
    } else if (diffHours < 24) {
        return `${diffHours}時間前`;
    } else if (diffDays < 7) {
        return `${diffDays}日前`;
    } else {
        return date.toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}
