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
        
        // 参照画像追加ボタンのイベントリスナー
        const addRefBtn = document.getElementById('addReferenceImageBtn');
        if (addRefBtn) {
            addRefBtn.addEventListener('click', addReferenceImageSlot);
        }
    }
    
    // 画像一覧を読み込み（ログイン状態に関わらず表示）
    loadAllImages();
});

// 参照画像スロットの管理
let referenceImageSlots = [];
const MAX_REFERENCE_IMAGES = 5;
const ROLE_OPTIONS = ['構図', 'スタイル', '色調', '質感', 'ディテール', 'その他'];

/**
 * 参照画像スロットを追加
 */
function addReferenceImageSlot() {
    if (referenceImageSlots.length >= MAX_REFERENCE_IMAGES) {
        alert(`参照画像は最大${MAX_REFERENCE_IMAGES}枚まで追加できます`);
        return;
    }

    const slotId = `ref-image-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const container = document.getElementById('referenceImagesContainer');
    
    const slotHtml = `
        <div class="card mb-3 reference-image-slot" data-slot-id="${slotId}">
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-start mb-3">
                    <h6 class="mb-0">参照画像 ${referenceImageSlots.length + 1}</h6>
                    <button type="button" class="btn btn-sm btn-outline-danger remove-slot-btn">
                        <svg class="icon icon-only" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
                
                <div class="row g-3">
                    <div class="col-md-6">
                        <label class="form-label small">画像を選択</label>
                        <div class="d-flex gap-2">
                            <input type="file" class="form-control form-control-sm ref-image-file" accept="image/png,image/jpeg,image/jpg,image/webp" style="display: none;">
                            <button type="button" class="btn btn-sm btn-outline-secondary upload-ref-btn">ファイルを選択</button>
                            <button type="button" class="btn btn-sm btn-outline-primary select-existing-btn">既存から選択</button>
                        </div>
                        <div class="ref-image-preview mt-2" style="display: none;">
                            <img src="" alt="プレビュー" class="img-thumbnail" style="max-width: 200px; max-height: 200px;">
                        </div>
                        <input type="hidden" class="ref-image-id">
                    </div>
                    <div class="col-md-6">
                        <label class="form-label small">役割ラベル</label>
                        <select class="form-select form-select-sm ref-role-select">
                            ${ROLE_OPTIONS.map(role => `<option value="${role}">${role}</option>`).join('')}
                        </select>
                        <input type="text" class="form-control form-control-sm mt-2 ref-role-custom" placeholder="カスタム役割（その他を選択時）" style="display: none;">
                    </div>
                </div>
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', slotHtml);
    
    const slotElement = container.querySelector(`[data-slot-id="${slotId}"]`);
    const slot = {
        id: slotId,
        element: slotElement,
        referenceImageId: null,
        file: null,
        role: ROLE_OPTIONS[0]
    };
    
    referenceImageSlots.push(slot);
    
    // イベントリスナーの設定
    setupSlotEventListeners(slot);
    
    // 追加ボタンの状態を更新
    updateAddButtonState();
}

/**
 * スロットのイベントリスナーを設定
 */
function setupSlotEventListeners(slot) {
    const element = slot.element;
    
    // 削除ボタン
    const removeBtn = element.querySelector('.remove-slot-btn');
    removeBtn.addEventListener('click', () => removeReferenceImageSlot(slot.id));
    
    // ファイル選択ボタン
    const uploadBtn = element.querySelector('.upload-ref-btn');
    const fileInput = element.querySelector('.ref-image-file');
    uploadBtn.addEventListener('click', () => fileInput.click());
    
    // ファイル選択
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            await handleFileUpload(slot, file);
        }
    });
    
    // 既存画像選択ボタン
    const selectExistingBtn = element.querySelector('.select-existing-btn');
    selectExistingBtn.addEventListener('click', () => {
        window.currentSelectingSlot = slot;
        showExistingImageModal(slot);
    });
    
    // 役割選択
    const roleSelect = element.querySelector('.ref-role-select');
    roleSelect.addEventListener('change', (e) => {
        slot.role = e.target.value;
        const customInput = element.querySelector('.ref-role-custom');
        if (e.target.value === 'その他') {
            customInput.style.display = 'block';
        } else {
            customInput.style.display = 'none';
        }
    });
    
    // カスタム役割入力
    const customRoleInput = element.querySelector('.ref-role-custom');
    customRoleInput.addEventListener('input', (e) => {
        if (slot.role === 'その他') {
            slot.role = e.target.value || 'その他';
        }
    });
}

/**
 * ファイルアップロード処理
 */
async function handleFileUpload(slot, file) {
    // ファイルサイズチェック（最大10MB）
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
        alert('画像ファイルのサイズが大きすぎます（最大10MB）');
        return;
    }
    
    // ファイル形式チェック
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
        alert('サポートされていない画像形式です（PNG、JPEG、WebPのみ）');
        return;
    }
    
    try {
        // プレビュー表示
        const preview = slot.element.querySelector('.ref-image-preview img');
        const reader = new FileReader();
        reader.onload = (e) => {
            preview.src = e.target.result;
            slot.element.querySelector('.ref-image-preview').style.display = 'block';
        };
        reader.readAsDataURL(file);
        
        // APIにアップロード
        const formData = new FormData();
        formData.append('file', file);
        formData.append('visibility', 'private');
        
        const response = await fetch(`${window.API_BASE_URL}/api/reference-images/upload`, {
            method: 'POST',
            credentials: 'include',
            body: formData
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'アップロードに失敗しました' }));
            throw new Error(errorData.error || 'アップロードに失敗しました');
        }
        
        const data = await response.json();
        slot.referenceImageId = data.reference_image_id;
        slot.element.querySelector('.ref-image-id').value = data.reference_image_id;
        
        // プレビューを更新
        preview.src = `${window.API_BASE_URL}${data.image_url}`;
        
    } catch (error) {
        console.error('File upload error:', error);
        alert(`画像のアップロードに失敗しました: ${error.message}`);
    }
}

/**
 * 既存画像選択モーダルを表示
 */
function showExistingImageModal(slot) {
    const modal = new bootstrap.Modal(document.getElementById('selectExistingImageModal'));
    const currentSlot = slot;
    
    // モーダルが開かれたときに画像一覧を読み込む
    const modalElement = document.getElementById('selectExistingImageModal');
    const loadImages = async () => {
        await loadExistingReferenceImages(currentSlot);
    };
    
    modalElement.addEventListener('shown.bs.modal', loadImages, { once: true });
    modal.show();
}

/**
 * 既存の参照画像一覧を読み込む
 */
async function loadExistingReferenceImages(targetSlot) {
    const loading = document.getElementById('existingImagesLoading');
    const list = document.getElementById('existingImagesList');
    const empty = document.getElementById('existingImagesEmpty');
    const visibilityFilter = document.getElementById('visibilityFilter');
    
    loading.style.display = 'block';
    list.innerHTML = '';
    empty.style.display = 'none';
    
    try {
        const visibility = visibilityFilter.value || '';
        const url = `${window.API_BASE_URL}/api/reference-images${visibility ? `?visibility=${visibility}` : ''}`;
        
        const response = await fetch(url, {
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('参照画像一覧の取得に失敗しました');
        }
        
        const data = await response.json();
        loading.style.display = 'none';
        
        if (!data.reference_images || data.reference_images.length === 0) {
            empty.style.display = 'block';
            return;
        }
        
        list.innerHTML = data.reference_images.map(img => `
            <div class="col-md-3 col-sm-4 col-6">
                <div class="card h-100 existing-ref-image-card" style="cursor: pointer;" 
                     data-image-id="${img.id}" 
                     data-image-url="${img.image_url}">
                    <img src="${window.API_BASE_URL}${img.image_url}" 
                         class="card-img-top" 
                         alt="参照画像" 
                         style="height: 120px; object-fit: cover;">
                    <div class="card-body p-2">
                        <small class="text-muted d-block text-truncate" title="${img.visibility}">
                            ${img.visibility === 'private' ? '自分の画像' : 
                              img.visibility === 'class_shared' ? 'クラス共有' : 
                              img.visibility === 'teacher_sample' ? '教員固定サンプル' : img.visibility}
                        </small>
                    </div>
                </div>
            </div>
        `).join('');
        
        // 画像カードのクリックイベント
        list.querySelectorAll('.existing-ref-image-card').forEach(card => {
            card.addEventListener('click', () => {
                const imageId = card.dataset.imageId;
                const imageUrl = card.dataset.imageUrl;
                selectExistingImage(targetSlot, imageId, imageUrl);
                
                // モーダルを閉じる
                const modal = bootstrap.Modal.getInstance(document.getElementById('selectExistingImageModal'));
                modal.hide();
            });
        });
        
    } catch (error) {
        console.error('Error loading existing images:', error);
        loading.style.display = 'none';
        list.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
    }
}

/**
 * 既存画像を選択
 */
function selectExistingImage(slot, imageId, imageUrl) {
    slot.referenceImageId = imageId;
    slot.element.querySelector('.ref-image-id').value = imageId;
    
    // プレビューを更新
    const preview = slot.element.querySelector('.ref-image-preview img');
    preview.src = `${window.API_BASE_URL}${imageUrl}`;
    slot.element.querySelector('.ref-image-preview').style.display = 'block';
}

// 表示範囲フィルターの変更イベント
document.addEventListener('DOMContentLoaded', () => {
    const visibilityFilter = document.getElementById('visibilityFilter');
    if (visibilityFilter) {
        visibilityFilter.addEventListener('change', () => {
            const modal = bootstrap.Modal.getInstance(document.getElementById('selectExistingImageModal'));
            if (modal && modal._isShown) {
                // モーダルが開いている場合のみ再読み込み
                const targetSlot = window.currentSelectingSlot;
                if (targetSlot) {
                    loadExistingReferenceImages(targetSlot);
                }
            }
        });
    }
});

/**
 * 参照画像スロットを削除
 */
function removeReferenceImageSlot(slotId) {
    const index = referenceImageSlots.findIndex(s => s.id === slotId);
    if (index === -1) return;
    
    referenceImageSlots[index].element.remove();
    referenceImageSlots.splice(index, 1);
    
    // スロット番号を更新
    updateSlotNumbers();
    updateAddButtonState();
}

/**
 * スロット番号を更新
 */
function updateSlotNumbers() {
    referenceImageSlots.forEach((slot, index) => {
        const title = slot.element.querySelector('h6');
        if (title) {
            title.textContent = `参照画像 ${index + 1}`;
        }
    });
}

/**
 * 追加ボタンの状態を更新
 */
function updateAddButtonState() {
    const addBtn = document.getElementById('addReferenceImageBtn');
    if (addBtn) {
        addBtn.disabled = referenceImageSlots.length >= MAX_REFERENCE_IMAGES;
    }
}

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

    // 参照画像のバリデーション
    const invalidSlots = referenceImageSlots.filter(slot => {
        const roleSelect = slot.element.querySelector('.ref-role-select');
        const customRoleInput = slot.element.querySelector('.ref-role-custom');
        const role = roleSelect.value === 'その他' ? (customRoleInput.value || 'その他') : roleSelect.value;
        return !slot.referenceImageId || !role;
    });

    if (invalidSlots.length > 0) {
        showError('参照画像が選択されていないか、役割ラベルが設定されていないスロットがあります');
        return;
    }

    // UIのリセット
    errorSection.style.display = 'none';
    resultSection.style.display = 'none';
    generateBtn.disabled = true;
    generateBtn.textContent = '生成中...';

    try {
        // 参照画像情報を収集
        const referenceImages = referenceImageSlots
            .filter(slot => slot.referenceImageId)
            .map(slot => {
                const roleSelect = slot.element.querySelector('.ref-role-select');
                const customRoleInput = slot.element.querySelector('.ref-role-custom');
                const role = roleSelect.value === 'その他' ? (customRoleInput.value || 'その他') : roleSelect.value;
                return {
                    id: slot.referenceImageId,
                    role: role
                };
            });

        // APIリクエスト
        const requestBody = {
            prompt: prompt,
            referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
            generationOptions: {
                size: '1024x1024',
                quality: 'standard',
                style: 'vivid'
            }
        };

        const response = await fetch(`${window.API_BASE_URL}/api/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(requestBody),
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
                <img src="${escapeHtml(imageUrl)}" class="img-fluid rounded-3 shadow-custom" alt="生成された画像" />
            </div>
        `;
        
        // 画像要素を取得
        const fadeInElement = resultImageContainer.querySelector('.fade-in-up');
        const img = fadeInElement?.querySelector('img');
        
        if (img) {
            // 画像読み込み成功時の処理
            img.addEventListener('load', () => {
                console.log('Image loaded successfully:', img.src);
                const timingInfo = document.getElementById('timingInfo');
                if (timingInfo) {
                    timingInfo.style.display = 'block';
                }
                // フェードインアニメーションを適用
                if (fadeInElement) {
                    fadeInElement.classList.add('animate-in');
                }
            });
            
            // 画像読み込み失敗時の処理
            img.addEventListener('error', () => {
                console.error('画像の読み込みに失敗しました:', img.src);
                if (fadeInElement) {
                    fadeInElement.innerHTML = '<div class="alert alert-danger">画像の読み込みに失敗しました。画像URLを確認してください。</div>';
                }
            });
            
            // 既に読み込まれている場合（キャッシュされている場合など）
            if (img.complete && img.naturalHeight !== 0) {
                const timingInfo = document.getElementById('timingInfo');
                if (timingInfo) {
                    timingInfo.style.display = 'block';
                }
                if (fadeInElement) {
                    fadeInElement.classList.add('animate-in');
                }
            }
        }
        
        // アニメーションクラスを追加
        if (fadeInElement) {
            fadeInElement.classList.add('animate-in');
        }

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
        
        // 参照画像情報の表示
        let referenceImagesHtml = '';
        if (data.reference_images && data.reference_images.length > 0) {
            referenceImagesHtml = `
                <div class="mt-3 fade-in-up">
                    <p class="mb-2">
                        <strong class="text-gradient">参照画像:</strong>
                    </p>
                    <div class="d-flex flex-wrap gap-2">
                        ${data.reference_images.map(ref => `
                            <div class="border rounded p-2" style="max-width: 150px;">
                                <img src="${window.API_BASE_URL}${ref.image_url}" alt="${ref.role_label}" 
                                     class="img-thumbnail mb-1" style="width: 100%; height: 100px; object-fit: cover;">
                                <small class="d-block text-center">${escapeHtml(ref.role_label)}</small>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        resultPrompt.innerHTML = `
            <div class="fade-in-up">
                <p class="mb-2">
                    <strong class="text-gradient">プロンプト:</strong>
                </p>
                <p class="prompt-quote mb-0">${escapeHtml(data.original_prompt || data.prompt)}</p>
            </div>
            ${referenceImagesHtml}
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
        
        // 参照画像スロットをクリア
        referenceImageSlots.forEach(slot => slot.element.remove());
        referenceImageSlots = [];
        updateAddButtonState();

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
