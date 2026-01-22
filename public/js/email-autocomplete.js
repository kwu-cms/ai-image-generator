/**
 * メールアドレス自動補完機能
 * 8文字（k + 学籍番号部分）入力時に@konan-wu.ac.jpを自動補完
 */

/**
 * メールアドレス入力フィールドに自動補完機能を追加
 */
function initEmailAutocomplete(inputId) {
    const emailInput = document.getElementById(inputId);
    if (!emailInput) return;

    // 入力中の文字数を表示するヒント要素を作成
    const hintElement = document.createElement('small');
    hintElement.className = 'form-text email-hint';
    hintElement.style.display = 'none';
    emailInput.parentElement.appendChild(hintElement);

    emailInput.addEventListener('input', function(e) {
        const value = this.value.trim();
        const domain = '@konan-wu.ac.jp';
        
        // 既にドメインが含まれている場合は処理しない
        if (value.includes('@')) {
            hintElement.style.display = 'none';
            return;
        }

        // 有効な文字列かチェック（英数字、アンダースコア、ハイフン、ドット）
        const isValidChars = /^[a-zA-Z0-9._-]*$/.test(value);
        
        if (!isValidChars) {
            hintElement.textContent = '使用できない文字が含まれています（英数字、アンダースコア、ハイフン、ドットのみ）';
            hintElement.style.color = 'var(--error-600)';
            hintElement.style.display = 'block';
            return;
        }

        // kで始まる8文字の形式（既存形式）のチェック
        if (value.startsWith('k') && value.length === 8) {
            const studentPart = value.substring(1); // kを除いた部分
            const isValidFormat = /^(a\d{6}|\d{7})$/.test(studentPart);
            
            if (isValidFormat) {
                hintElement.textContent = '自動補完中...';
                hintElement.style.color = 'var(--success-600)';
                
                // 少し遅延してから自動補完（UX向上）
                setTimeout(() => {
                    // カーソル位置を保存
                    const cursorPosition = this.selectionStart;
                    
                    // 自動補完
                    this.value = value + domain;
                    
                    // カーソル位置をドメインの前に設定
                    this.setSelectionRange(cursorPosition, cursorPosition);
                    
                    // 視覚的フィードバック
                    this.classList.add('autocomplete-applied');
                    setTimeout(() => {
                        this.classList.remove('autocomplete-applied');
                    }, 300);
                    
                    hintElement.textContent = '✓ 自動補完されました';
                    hintElement.style.color = 'var(--success-600)';
                    
                    setTimeout(() => {
                        hintElement.style.display = 'none';
                    }, 2000);
                }, 200);
                return;
            }
        }

        // kで始まる8文字未満の場合
        if (value.startsWith('k') && value.length > 0 && value.length < 8) {
            hintElement.textContent = `${value.length}/8文字（あと${8 - value.length}文字で自動補完）`;
            hintElement.style.display = 'block';
            hintElement.style.color = 'var(--gray-500)';
            return;
        }

        // その他の文字列の場合（フォーカスアウト時に自動補完）
        if (value.length > 0) {
            hintElement.textContent = 'フォーカスを外すと自動的に@konan-wu.ac.jpが追加されます';
            hintElement.style.display = 'block';
            hintElement.style.color = 'var(--gray-500)';
        } else {
            hintElement.style.display = 'none';
        }
    });

    // フォーカスアウト時に不完全な入力を補完
    emailInput.addEventListener('blur', function() {
        const value = this.value.trim();
        const domain = '@konan-wu.ac.jp';
        
        // 既にドメインが含まれている場合は処理しない
        if (value.includes('@')) {
            hintElement.style.display = 'none';
            return;
        }

        // 有効な文字列の場合、自動補完
        if (value.length > 0 && /^[a-zA-Z0-9._-]+$/.test(value)) {
            this.value = value + domain;
            hintElement.style.display = 'none';
        }
    });

    // フォーカス時にヒントを表示
    emailInput.addEventListener('focus', function() {
        const value = this.value.trim();
        if (!value.includes('@') && value.length > 0) {
            if (value.startsWith('k') && value.length < 8) {
                hintElement.textContent = `${value.length}/8文字（あと${8 - value.length}文字で自動補完）`;
            } else {
                hintElement.textContent = 'フォーカスを外すと自動的に@konan-wu.ac.jpが追加されます';
            }
            hintElement.style.display = 'block';
            hintElement.style.color = 'var(--gray-500)';
        }
    });
}

/**
 * ページ読み込み時に初期化
 */
document.addEventListener('DOMContentLoaded', () => {
    initEmailAutocomplete('email');
});
