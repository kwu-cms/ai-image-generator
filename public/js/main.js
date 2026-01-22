/**
 * メインページのJavaScript
 * 画像生成フォームの処理
 */

console.log('main.js loaded');

// APIのベースURL（auth.jsが読み込まれている場合はそれを使用、そうでない場合は定義）
// auth.jsで既にconst API_BASE_URLが定義されているため、window.API_BASE_URLを直接参照
if (typeof window.API_BASE_URL === 'undefined') {
    window.API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:8787'
        : 'https://image-generation-api.tkwshnsk.workers.dev';
    console.log('window.API_BASE_URL defined in main.js:', window.API_BASE_URL);
} else {
    console.log('window.API_BASE_URL already defined:', window.API_BASE_URL);
}
// auth.jsで既にconst API_BASE_URLが定義されているため、window.API_BASE_URLを直接参照
// main.js内では window.API_BASE_URL を直接使用する（const API_BASE_URLは定義しない）

/**
 * ページ読み込み時の初期化
 */
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOMContentLoaded fired in main.js');
    console.log('window.API_BASE_URL:', window.API_BASE_URL);
    
    // 認証チェック（getCurrentUserはauth.jsで定義されている）
    let user = null;
    try {
        console.log('Checking auth, getCurrentUser function:', typeof getCurrentUser);
        if (typeof getCurrentUser === 'function') {
            user = await getCurrentUser();
            console.log('Current user:', user);
        } else {
            console.warn('getCurrentUser function not available');
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
        const response = await fetch(`${window.API_BASE_URL}/api/generate`, {
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
        console.log('Image generation response:', data);
        const startTime = performance.now();

        // 結果セクションを先に表示（非表示から表示に変更）
        resultSection.style.display = 'block';
        
        // 画像URLの確認
        const imageUrl = `${window.API_BASE_URL}${data.image_url}`;
        console.log('Image URL:', imageUrl);
        console.log('resultImageContainer:', resultImageContainer);
        console.log('data.image_url:', data.image_url);
        
        // 結果の表示
        resultImageContainer.innerHTML = `
            <div class="fade-in-up animate-in">
                <img src="${imageUrl}" class="img-fluid rounded-3 shadow-custom" alt="生成された画像" 
                     onload="
                        console.log('Image loaded successfully:', this.src);
                        const timingInfo = document.getElementById('timingInfo');
                        if (timingInfo) timingInfo.style.display='block';
                        // フェードインアニメーションを適用（既に追加されているが、念のため）
                        const fadeInElement = this.closest('.fade-in-up');
                        if (fadeInElement) {
                            fadeInElement.classList.add('animate-in');
                        }
                     "
                     onerror="
                        console.error('画像の読み込みに失敗しました:', this.src);
                        const fadeInElement = this.closest('.fade-in-up');
                        if (fadeInElement) {
                            fadeInElement.innerHTML = '<div class=\"alert alert-danger\">画像の読み込みに失敗しました。画像URLを確認してください。</div>';
                        }
                     " />
            </div>
        `;
        
        // 即座にアニメーションクラスを追加（HTMLに既に含まれているが、念のため）
        const fadeInElement = resultImageContainer.querySelector('.fade-in-up');
        if (fadeInElement) {
            fadeInElement.classList.add('animate-in');
        }
        
        // 画像が既に読み込まれている場合のフォールバック（キャッシュされている場合など）
        // また、アニメーションが確実に実行されるように強制的にanimate-inクラスを追加
        setTimeout(() => {
            const fadeInElement = resultImageContainer.querySelector('.fade-in-up');
            const img = fadeInElement?.querySelector('img');
            console.log('Checking image load status:', {
                fadeInElement: fadeInElement,
                img: img,
                imgComplete: img?.complete,
                imgSrc: img?.src
            });
            
            if (fadeInElement) {
                // アニメーションクラスを強制的に追加
                fadeInElement.classList.add('animate-in');
                console.log('Added animate-in class to fadeInElement');
            }
            
            if (img && img.complete) {
                const timingInfo = document.getElementById('timingInfo');
                if (timingInfo) timingInfo.style.display = 'block';
            }
        }, 200);

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

        console.log('Setting resultPrompt.innerHTML');
        console.log('resultPrompt element:', resultPrompt);
        console.log('data.prompt:', data.prompt);
        console.log('timingHtml:', timingHtml);
        
        resultPrompt.innerHTML = `
            <div class="fade-in-up">
                <p class="mb-2">
                    <strong class="text-gradient">プロンプト:</strong>
                </p>
                <p class="prompt-quote mb-0">${escapeHtml(data.prompt)}</p>
            </div>
            ${timingHtml}
        `;
        
        console.log('resultPrompt.innerHTML set successfully');
        
        // プロンプトセクションのフェードインアニメーションを適用
        setTimeout(() => {
            const promptFadeIn = resultPrompt.querySelector('.fade-in-up');
            if (promptFadeIn) {
                promptFadeIn.classList.add('animate-in');
            }
            const timingFadeIn = resultPrompt.querySelector('#timingInfo');
            if (timingFadeIn) {
                timingFadeIn.classList.add('animate-in');
            }
        }, 50);

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
    console.log('loadAllImages called');
    const loading = document.getElementById('imagesLoading');
    const imagesContainer = document.getElementById('imagesContainer');
    const imagesList = document.getElementById('imagesList');
    const emptyMessage = document.getElementById('emptyImagesMessage');
    const errorSection = document.getElementById('imagesErrorSection');
    const errorMessage = document.getElementById('imagesErrorMessage');

    console.log('DOM elements:', {
        loading: loading,
        imagesContainer: imagesContainer,
        imagesList: imagesList,
        emptyMessage: emptyMessage,
        errorSection: errorSection,
        errorMessage: errorMessage
    });

    if (!loading || !imagesContainer || !imagesList) {
        console.error('Required DOM elements not found');
        return; // 要素が存在しない場合は何もしない
    }

    loading.style.display = 'block';
    imagesContainer.style.display = 'none';
    errorSection.style.display = 'none';

    try {
        const apiUrl = `${window.API_BASE_URL}/api/images`;
        console.log('Fetching images from:', apiUrl);
        console.log('window.API_BASE_URL:', window.API_BASE_URL);
        
        const response = await fetch(apiUrl);
        console.log('Response status:', response.status);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}: ${response.statusText}` }));
            throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('Images API response:', data);
        console.log('Number of images:', data.images?.length || 0);
        
        loading.style.display = 'none';

        if (!data.images || data.images.length === 0) {
            console.log('No images found, showing empty message');
            emptyMessage.style.display = 'block';
            imagesContainer.style.display = 'block';
            return;
        }

        console.log('Rendering images:', data.images.length);
        // 画像一覧の表示
        imagesList.innerHTML = data.images.map((item, index) => {
            const imageUrl = `${window.API_BASE_URL}${item.image_url}`;
            console.log(`Image ${index}:`, imageUrl);
            return `
            <div class="col-md-6 col-lg-4">
                <div class="card h-100 shadow-custom history-card fade-in-up animate-in" style="animation-delay: ${index * 0.05}s;">
                    <img src="${imageUrl}" class="card-img-top" alt="生成された画像" loading="lazy" style="object-fit: cover; height: 250px;" />
                    <div class="card-body d-flex flex-column">
                        <p class="prompt-quote mb-3 flex-grow-1">${escapeHtml(item.prompt)}</p>
                        <div class="mt-auto pt-3 border-top">
                            <small class="text-muted d-block">
                                ${formatDate(item.created_at)}
                            </small>
                        </div>
                    </div>
                </div>
            </div>
        `;
        }).join('');

        console.log('Images HTML generated, displaying container');
        imagesContainer.style.display = 'block';

    } catch (error) {
        console.error('Error loading images:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        loading.style.display = 'none';
        errorMessage.textContent = `画像一覧の読み込みに失敗しました: ${error.message}`;
        errorSection.style.display = 'block';
        imagesContainer.style.display = 'block';
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
