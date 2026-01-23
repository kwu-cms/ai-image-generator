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

// Stability AI APIで許可された画像サイズ（stable-diffusion-xl-1024-v1-0）
const ALLOWED_DIMENSIONS = [
    { width: 1024, height: 1024 },
    { width: 1152, height: 896 },
    { width: 1216, height: 832 },
    { width: 1344, height: 768 },
    { width: 1536, height: 640 },
    { width: 640, height: 1536 },
    { width: 768, height: 1344 },
    { width: 832, height: 1216 },
    { width: 896, height: 1152 },
];

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
 * 画像のサイズを取得
 */
function getImageSize(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        
        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve({ width: img.width, height: img.height });
        };
        
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('画像の読み込みに失敗しました'));
        };
        
        img.src = url;
    });
}

/**
 * 許可されたサイズに最も近いサイズを選択（アスペクト比を維持）
 */
function findClosestAllowedSize(width, height) {
    const aspectRatio = width / height;
    let bestMatch = null;
    let minDiff = Infinity;
    
    for (const dim of ALLOWED_DIMENSIONS) {
        const dimAspectRatio = dim.width / dim.height;
        const diff = Math.abs(dimAspectRatio - aspectRatio);
        
        if (diff < minDiff) {
            minDiff = diff;
            bestMatch = dim;
        }
    }
    
    return bestMatch || ALLOWED_DIMENSIONS[0]; // フォールバック
}

/**
 * Canvas APIを使用して画像をリサイズ
 */
function resizeImage(file, targetWidth, targetHeight) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        
        img.onload = () => {
            URL.revokeObjectURL(url);
            
            // Canvasを作成（RGBA形式を保証）
            const canvas = document.createElement('canvas');
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            const ctx = canvas.getContext('2d', { alpha: true }); // アルファチャンネルを有効化
            
            // 高品質なリサイズ（smooth scaling）
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            
            // 画像を描画（レターボックス方式で中央配置）
            const sourceAspect = img.width / img.height;
            const targetAspect = targetWidth / targetHeight;
            
            let drawWidth, drawHeight, drawX, drawY;
            
            if (sourceAspect > targetAspect) {
                // 元画像の方が横長 → 高さを合わせる
                drawHeight = targetHeight;
                drawWidth = drawHeight * sourceAspect;
                drawX = (targetWidth - drawWidth) / 2;
                drawY = 0;
            } else {
                // 元画像の方が縦長 → 幅を合わせる
                drawWidth = targetWidth;
                drawHeight = drawWidth / sourceAspect;
                drawX = 0;
                drawY = (targetHeight - drawHeight) / 2;
            }
            
            // 背景を透明でクリア（RGBA形式を保証）
            ctx.clearRect(0, 0, targetWidth, targetHeight);
            
            // 背景を白で塗りつぶし（RGBA形式を保証）
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, targetWidth, targetHeight);
            
            // 画像を描画（RGBA形式を保証）
            ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
            
            // ImageDataを取得してRGBA形式を確認・強制
            const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
            // RGBA形式であることを確認（4チャンネル）
            if (imageData.data.length === targetWidth * targetHeight * 4) {
                // RGBA形式で正しい
                ctx.putImageData(imageData, 0, 0);
            }
            
            // CanvasをBlobに変換（PNG形式で出力、RGBA形式を保証）
            canvas.toBlob((blob) => {
                if (blob) {
                    // PNG形式で保存（OpenAI DALL-E 2のEdit API要件: RGBA形式）
                    const fileName = file.name.replace(/\.[^/.]+$/, '') + '.png';
                    const resizedFile = new File([blob], fileName, {
                        type: 'image/png',
                        lastModified: Date.now()
                    });
                    resolve(resizedFile);
                } else {
                    reject(new Error('画像のリサイズに失敗しました'));
                }
            }, 'image/png'); // PNG形式（RGBA形式を保証、qualityパラメータはPNGでは無視される）
        };
        
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('画像の読み込みに失敗しました'));
        };
        
        img.src = url;
    });
}

/**
 * 画像をPNG形式に変換し、4MB以下に圧縮
 * OpenAI DALL-E 2のEdit API要件: PNG形式、4MB以下
 */
function convertToPNGAndCompress(file, maxSizeMB = 4) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        
        img.onload = () => {
            URL.revokeObjectURL(url);
            
            // Canvasを作成（RGBA形式を保証、元のサイズを維持）
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d', { alpha: true }); // アルファチャンネルを有効化
            
            // 背景を透明でクリア（RGBA形式を保証）
            ctx.clearRect(0, 0, img.width, img.height);
            
            // 画像を描画（RGBA形式を保証）
            ctx.drawImage(img, 0, 0);
            
            // ImageDataを取得してRGBA形式を確認・強制
            const imageData = ctx.getImageData(0, 0, img.width, img.height);
            // RGBA形式であることを確認（4チャンネル）
            if (imageData.data.length === img.width * img.height * 4) {
                // RGBA形式で正しい
                ctx.putImageData(imageData, 0, 0);
            }
            
            // PNG形式では品質パラメータは無視されるため、リサイズでサイズを調整
            // 4MB以下になるまで画像サイズを縮小
            const maxSize = maxSizeMB * 1024 * 1024;
            let currentWidth = img.width;
            let currentHeight = img.height;
            let scaleFactor = 1.0;
            
            // 初期サイズをチェック
            const estimateSize = (width, height) => {
                // PNG形式のサイズを概算（RGBA形式、4バイト/ピクセル）
                return width * height * 4;
            };
            
            // 4MB以下になるまでスケールを調整
            while (estimateSize(currentWidth, currentHeight) > maxSize && scaleFactor > 0.1) {
                scaleFactor -= 0.1;
                currentWidth = Math.floor(img.width * scaleFactor);
                currentHeight = Math.floor(img.height * scaleFactor);
            }
            
            // リサイズが必要な場合
            if (scaleFactor < 1.0) {
                canvas.width = currentWidth;
                canvas.height = currentHeight;
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.clearRect(0, 0, currentWidth, currentHeight);
                ctx.drawImage(img, 0, 0, currentWidth, currentHeight);
                
                // リサイズ後もRGBA形式を確認
                const resizedImageData = ctx.getImageData(0, 0, currentWidth, currentHeight);
                if (resizedImageData.data.length === currentWidth * currentHeight * 4) {
                    ctx.putImageData(resizedImageData, 0, 0);
                }
            }
            
            // CanvasをBlobに変換（PNG形式で出力、RGBA形式を保証）
            canvas.toBlob((blob) => {
                if (!blob) {
                    reject(new Error('画像の変換に失敗しました'));
                    return;
                }
                
                const fileName = file.name.replace(/\.[^/.]+$/, '') + '.png';
                const convertedFile = new File([blob], fileName, {
                    type: 'image/png',
                    lastModified: Date.now()
                });
                resolve(convertedFile);
            }, 'image/png'); // PNG形式（RGBA形式を保証）
        };
        
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('画像の読み込みに失敗しました'));
        };
        
        img.src = url;
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
        // 画像サイズをチェック
        const imageSize = await getImageSize(file);
        const isAllowedSize = ALLOWED_DIMENSIONS.some(
            dim => dim.width === imageSize.width && dim.height === imageSize.height
        );
        
        let fileToUpload = file;
        let resizeInfo = null;
        
        // 許可されていないサイズの場合はリサイズ
        if (!isAllowedSize) {
            const closestSize = findClosestAllowedSize(imageSize.width, imageSize.height);
            console.log('Resizing image:', {
                original: `${imageSize.width}x${imageSize.height}`,
                target: `${closestSize.width}x${closestSize.height}`
            });
            
            // リサイズ処理（PNG形式で出力）
            fileToUpload = await resizeImage(file, closestSize.width, closestSize.height);
            resizeInfo = {
                original: `${imageSize.width}x${imageSize.height}`,
                resized: `${closestSize.width}x${closestSize.height}`
            };
        }
        
        // OpenAI DALL-E 2のEdit API要件: PNG形式、4MB以下
        // JPEGやWebPの場合はPNGに変換し、4MB以下に圧縮
        if (fileToUpload.type !== 'image/png' || fileToUpload.size > 4 * 1024 * 1024) {
            console.log('Converting to PNG and compressing:', {
                originalType: fileToUpload.type,
                originalSize: `${(fileToUpload.size / 1024 / 1024).toFixed(2)}MB`
            });
            
            try {
                fileToUpload = await convertToPNGAndCompress(fileToUpload, 4);
                console.log('Converted to PNG:', {
                    newSize: `${(fileToUpload.size / 1024 / 1024).toFixed(2)}MB`
                });
            } catch (error) {
                console.error('PNG conversion error:', error);
                alert('画像の変換に失敗しました。PNG形式の画像をアップロードしてください。');
                return;
            }
        }
        
        // プレビュー表示
        const preview = slot.element.querySelector('.ref-image-preview img');
        const reader = new FileReader();
        reader.onload = (e) => {
            preview.src = e.target.result;
            slot.element.querySelector('.ref-image-preview').style.display = 'block';
        };
        reader.readAsDataURL(fileToUpload);
        
        // APIにアップロード
        const formData = new FormData();
        formData.append('file', fileToUpload);
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
        
        // リサイズ情報がある場合は表示
        if (resizeInfo) {
            const infoHtml = `
                <div class="alert alert-info alert-dismissible fade show mt-2" role="alert">
                    <strong>情報:</strong> 画像を ${resizeInfo.original} から ${resizeInfo.resized} にリサイズしました。
                    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                </div>
            `;
            const previewContainer = slot.element.querySelector('.ref-image-preview');
            previewContainer.insertAdjacentHTML('afterend', infoHtml);
        }
        
        // サイズ警告がある場合は表示（サーバー側からの警告）
        if (data.size_warning) {
            const warningHtml = `
                <div class="alert alert-warning alert-dismissible fade show mt-2" role="alert">
                    <strong>警告:</strong> ${data.size_warning.message}
                    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                </div>
            `;
            const previewContainer = slot.element.querySelector('.ref-image-preview');
            previewContainer.insertAdjacentHTML('afterend', warningHtml);
        }
        
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
            const errorData = await response.json().catch(() => ({ error: '参照画像一覧の取得に失敗しました' }));
            throw new Error(errorData.error || '参照画像一覧の取得に失敗しました');
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

        // 品質設定を取得
        const qualitySelect = document.getElementById('qualitySelect');
        const selectedQuality = qualitySelect ? qualitySelect.value : 'high';

        // APIリクエスト
        const requestBody = {
            prompt: prompt,
            referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
            generationOptions: {
                size: '1024x1024',
                quality: selectedQuality,  // UIから選択された品質を使用
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
            console.error('Image generation error:', errorData);
            const errorMessage = errorData.error || `HTTP ${response.status}: ${response.statusText}`;
            const errorDetails = errorData.details ? ` (詳細: ${errorData.details})` : '';
            throw new Error(errorMessage + errorDetails);
        }

        const data = await response.json();
        console.log('Image generation response:', data);
        const startTime = performance.now();

        // 結果セクションを先に表示（非表示から表示に変更）
        resultSection.style.display = 'block';
        
        // 編集モード表示を追加
        let modeInfoHtml = '';
        if (data.model_provider && data.edit_mode) {
            const modeLabels = {
                'generate': '生成モード（OpenAI）',
                'edit': '編集モード（OpenAI）',
                'variation': 'バリエーションモード（OpenAI）',
                'text-to-image': '生成モード（Stability AI）',
                'image-to-image': '編集モード（Stability AI）'
            };
            const providerLabels = {
                'openai': 'OpenAI',
                'stability': 'Stability AI'
            };
            const modeLabel = modeLabels[data.edit_mode] || `${data.edit_mode}（${providerLabels[data.model_provider] || data.model_provider}）`;
            modeInfoHtml = `
                <div class="alert alert-info mb-3">
                    <small><strong>処理モード:</strong> ${escapeHtml(modeLabel)}</small>
                </div>
            `;
        }
        
        // 画像URLの確認
        const imageUrl = `${window.API_BASE_URL}${data.image_url}`;
        console.log('Image URL:', imageUrl);
        console.log('resultImageContainer:', resultImageContainer);
        console.log('data.image_url:', data.image_url);
        
        // 参照画像がある場合は比較UI、ない場合は通常表示
        if (data.reference_images && data.reference_images.length > 0) {
            // 参照画像がある場合: 比較UIを表示（参照画像セクションで表示）
            resultImageContainer.innerHTML = `
                <div class="fade-in-up animate-in">
                    <p class="text-muted mb-3">生成された画像は下の「参照画像との比較」セクションで確認できます。</p>
                </div>
            `;
        } else {
            // 参照画像がない場合: 通常表示
            resultImageContainer.innerHTML = `
                <div class="fade-in-up animate-in">
                    <img src="${escapeHtml(imageUrl)}" class="img-fluid rounded-3 shadow-custom" alt="生成された画像" 
                         style="cursor: pointer;"
                         onclick="showImageModal('${escapeHtml(imageUrl)}', '生成された画像')" />
                </div>
            `;
        }
        
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
        
        // モード情報と参照画像情報の表示（比較用に大きく表示）
        let referenceImagesHtml = '';
        if (data.reference_images && data.reference_images.length > 0) {
            // 参照画像がある場合: 比較UIを表示（imageUrlは既に定義済み）
            referenceImagesHtml = `
                <div class="mt-4 fade-in-up">
                    <h5 class="mb-3">
                        <strong class="text-gradient">参照画像との比較</strong>
                    </h5>
                    <div class="row g-3">
                        ${data.reference_images.map((ref, index) => `
                            <div class="col-md-${data.reference_images.length === 1 ? '6' : '4'}">
                                <div class="card h-100">
                                    <div class="card-header bg-light">
                                        <strong>参照画像 ${index + 1}</strong>
                                        <span class="badge bg-primary ms-2">${escapeHtml(ref.role_label)}</span>
                                    </div>
                                    <div class="card-body p-2 text-center">
                                        <img src="${window.API_BASE_URL}${ref.image_url}" 
                                             alt="${ref.role_label}" 
                                             class="img-fluid rounded"
                                             style="max-height: 400px; width: 100%; object-fit: contain; cursor: pointer;"
                                             onclick="showImageModal('${window.API_BASE_URL}${ref.image_url}', '参照画像 ${index + 1} (${escapeHtml(ref.role_label)})')">
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                        <div class="col-md-${data.reference_images.length === 1 ? '6' : '4'}">
                            <div class="card h-100 border-success border-2">
                                <div class="card-header bg-success text-white">
                                    <strong>生成された画像</strong>
                                </div>
                                <div class="card-body p-2 text-center">
                                    <img src="${escapeHtml(imageUrl)}" 
                                         alt="生成された画像" 
                                         class="img-fluid rounded"
                                         style="max-height: 400px; width: 100%; object-fit: contain; cursor: pointer;"
                                         onclick="showImageModal('${escapeHtml(imageUrl)}', '生成された画像')">
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        // プロンプト表示（日本語と英語の両方）
        let promptHtml = '';
        if (data.original_prompt && data.translated_prompt) {
            // 日本語と英語の両方がある場合
            promptHtml = `
                <div class="fade-in-up">
                    <p class="mb-2">
                        <strong class="text-gradient">プロンプト（日本語）:</strong>
                    </p>
                    <p class="prompt-quote mb-3">${escapeHtml(data.original_prompt)}</p>
                    <p class="mb-2">
                        <strong class="text-gradient">プロンプト（英語）:</strong>
                    </p>
                    <p class="prompt-quote mb-0" style="font-style: italic; color: #666;">${escapeHtml(data.translated_prompt)}</p>
                </div>
            `;
        } else if (data.original_prompt) {
            // 日本語のみの場合
            promptHtml = `
                <div class="fade-in-up">
                    <p class="mb-2">
                        <strong class="text-gradient">プロンプト:</strong>
                    </p>
                    <p class="prompt-quote mb-0">${escapeHtml(data.original_prompt)}</p>
                </div>
            `;
        } else {
            // フォールバック
            promptHtml = `
                <div class="fade-in-up">
                    <p class="mb-2">
                        <strong class="text-gradient">プロンプト:</strong>
                    </p>
                    <p class="prompt-quote mb-0">${escapeHtml(data.prompt)}</p>
                </div>
            `;
        }

        resultPrompt.innerHTML = `
            ${modeInfoHtml}
            ${promptHtml}
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

/**
 * 画像モーダルを表示
 */
function showImageModal(imageUrl, title) {
    // シンプルなモーダルを作成
    const modalHtml = `
        <div class="modal fade" id="imageModal" tabindex="-1" aria-labelledby="imageModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-lg modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="imageModalLabel">${escapeHtml(title)}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body text-center">
                        <img src="${imageUrl}" class="img-fluid" alt="${escapeHtml(title)}" style="max-height: 70vh;">
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // 既存のモーダルを削除
    const existingModal = document.getElementById('imageModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // 新しいモーダルを追加
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // モーダルを表示
    const modal = new bootstrap.Modal(document.getElementById('imageModal'));
    modal.show();
    
    // モーダルが閉じられたら削除
    document.getElementById('imageModal').addEventListener('hidden.bs.modal', function () {
        this.remove();
    });
}
