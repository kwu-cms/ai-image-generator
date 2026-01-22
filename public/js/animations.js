/**
 * 2026年トレンド: スクロール連動アニメーションとマイクロインタラクション
 */

/**
 * スクロール連動アニメーション（Intersection Observer使用）
 */
function initScrollAnimations() {
    // モーション削減設定を尊重
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
        return;
    }

    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.animationPlayState = 'running';
                entry.target.classList.add('animate-in');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // アニメーション対象要素を監視
    document.querySelectorAll('.fade-in-up, .card, .history-card').forEach(el => {
        el.style.animationPlayState = 'paused';
        observer.observe(el);
    });
}

/**
 * ナビゲーションバーのスクロールエフェクト
 */
function initNavbarScroll() {
    const navbar = document.querySelector('.navbar');
    if (!navbar) return;

    let lastScroll = 0;
    const scrollThreshold = 10;

    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;

        if (currentScroll > scrollThreshold) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }

        lastScroll = currentScroll;
    }, { passive: true });
}

/**
 * ボタンのリップルエフェクト強化
 */
function initButtonRipples() {
    document.querySelectorAll('.btn').forEach(button => {
        button.addEventListener('click', function(e) {
            const ripple = document.createElement('span');
            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;

            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = x + 'px';
            ripple.style.top = y + 'px';
            ripple.classList.add('ripple');

            this.appendChild(ripple);

            setTimeout(() => {
                ripple.remove();
            }, 600);
        });
    });
}

/**
 * フォーム入力のマイクロインタラクション
 */
function initFormInteractions() {
    document.querySelectorAll('.form-control').forEach(input => {
        // フォーカス時のアニメーション
        input.addEventListener('focus', function() {
            this.parentElement.classList.add('focused');
        });

        input.addEventListener('blur', function() {
            this.parentElement.classList.remove('focused');
            if (this.value) {
                this.parentElement.classList.add('has-value');
            } else {
                this.parentElement.classList.remove('has-value');
            }
        });

        // 入力値があるかチェック
        if (input.value) {
            input.parentElement.classList.add('has-value');
        }
    });
}

/**
 * カードのホバーエフェクト強化
 */
function initCardInteractions() {
    document.querySelectorAll('.card').forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transition = 'all 200ms cubic-bezier(0, 0, 0.2, 1)';
        });

        card.addEventListener('mouseleave', function() {
            this.style.transition = 'all 200ms cubic-bezier(0, 0, 0.2, 1)';
        });
    });
}

/**
 * 画像の遅延読み込みアニメーション
 */
function initImageAnimations() {
    const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.style.opacity = '0';
                img.style.transform = 'scale(0.98)';
                img.style.transition = 'opacity 300ms ease-out, transform 300ms ease-out';

                // 画像が読み込まれたらアニメーション
                if (img.complete) {
                    setTimeout(() => {
                        img.style.opacity = '1';
                        img.style.transform = 'scale(1)';
                    }, 50);
                } else {
                    img.addEventListener('load', function() {
                        setTimeout(() => {
                            img.style.opacity = '1';
                            img.style.transform = 'scale(1)';
                        }, 50);
                    });
                }

                imageObserver.unobserve(img);
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('img[loading="lazy"]').forEach(img => {
        imageObserver.observe(img);
    });
}

/**
 * ページ読み込み時の初期化
 */
document.addEventListener('DOMContentLoaded', () => {
    initNavbarScroll();
    initScrollAnimations();
    initButtonRipples();
    initFormInteractions();
    initCardInteractions();
    initImageAnimations();
});
