# スタイルガイド 2026

## デザイン哲学

このアプリケーションは、2026年の最新のWebデザイントレンドに基づいた、モダンで洗練されたUI/UXを提供することを目指しています。デザインは以下の原則に基づいています：

- **一貫性**: すべての要素が統一されたデザインシステムに従う
- **階層性**: 情報の重要度が視覚的に明確に伝わる
- **アクセシビリティ**: WCAG 2.1 AA基準を満たし、多様なユーザーに対応
- **パフォーマンス**: 軽量で高速なレンダリング
- **感情的な共鳴**: 機能的でありながら感情的なつながりを生む
- **プライバシー重視**: ユーザーデータの透明性と制御
- **ミニマリズム**: 目的を持った最小限のデザイン

---

## 1. タイポグラフィ

### フォントファミリー

**システムフォントファーストアプローチ**（パフォーマンス最適化）

```css
/* 日本語 + 英語の組み合わせ */
font-family: 
  -apple-system,           /* macOS/iOS システムフォント */
  BlinkMacSystemFont,      /* Chrome macOS */
  'Segoe UI',              /* Windows */
  'Hiragino Kaku Gothic ProN',  /* macOS 日本語 */
  'Hiragino Sans',         /* macOS 日本語 */
  'Noto Sans JP',          /* Google Fonts 日本語（必要時のみ） */
  'Yu Gothic',             /* Windows 日本語 */
  'Meiryo',                /* Windows 日本語 */
  sans-serif;
```

**Variable Fontsの活用**（将来的な拡張性）
- パフォーマンスを維持しながら柔軟性を提供
- 必要に応じて `font-weight` や `font-stretch` を動的に調整可能

### タイポグラフィスケール（Modular Scale: 1.25 - Major Third）

| 要素 | フォントサイズ | 行間 | フォントウェイト | レタースペーシング | 使用例 |
|------|---------------|------|----------------|------------------|--------|
| Display | 3.052rem (48.8px) | 1.1 | 700 | -0.03em | ヒーローセクション |
| H1 | 2.441rem (39px) | 1.2 | 700 | -0.02em | ページタイトル |
| H2 | 1.953rem (31px) | 1.3 | 600 | -0.01em | セクションタイトル |
| H3 | 1.563rem (25px) | 1.4 | 600 | 0 | サブセクション |
| H4 | 1.25rem (20px) | 1.5 | 600 | 0 | カードタイトル |
| Body Large | 1.125rem (18px) | 1.7 | 400 | 0 | 重要な本文 |
| Body | 1rem (16px) | 1.7 | 400 | 0 | 標準本文 |
| Body Small | 0.875rem (14px) | 1.6 | 400 | 0 | 補足テキスト |
| Caption | 0.75rem (12px) | 1.5 | 400 | 0.01em | キャプション、メタ情報 |
| Label | 0.875rem (14px) | 1.4 | 500 | 0.01em | フォームラベル |

### 表現力のあるタイポグラフィ（2026トレンド）

**Kinetic Typography（動的タイポグラフィ）**
- スクロール連動アニメーション
- インタラクション時の微細な動き
- パフォーマンスを考慮した実装

**使用ガイドライン**:
- 見出しや重要なCTAに限定
- モバイルでは控えめに
- `prefers-reduced-motion` を尊重

### タイポグラフィの実装

```css
/* Display - ヒーローセクション用 */
.display {
  font-size: 3.052rem;
  line-height: 1.1;
  font-weight: 700;
  letter-spacing: -0.03em;
  color: var(--gray-900);
}

/* 見出し */
h1 {
  font-size: 2.441rem;
  line-height: 1.2;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--gray-900);
}

h2 {
  font-size: 1.953rem;
  line-height: 1.3;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--gray-900);
}

h3 {
  font-size: 1.563rem;
  line-height: 1.4;
  font-weight: 600;
  color: var(--gray-800);
}

h4 {
  font-size: 1.25rem;
  line-height: 1.5;
  font-weight: 600;
  color: var(--gray-800);
}

/* 本文 */
body {
  font-size: 1rem;
  line-height: 1.7;
  font-weight: 400;
  color: var(--gray-800);
}

/* 小さいテキスト */
small, .text-small {
  font-size: 0.875rem;
  line-height: 1.6;
  color: var(--gray-600);
}

/* ラベル */
label, .label {
  font-size: 0.875rem;
  line-height: 1.4;
  font-weight: 500;
  letter-spacing: 0.01em;
  color: var(--gray-700);
}
```

---

## 2. カラーパレット

### プライマリカラー（Indigo系 - 2026トレンド）

```css
--primary-50: #eef2ff;
--primary-100: #e0e7ff;
--primary-200: #c7d2fe;
--primary-300: #a5b4fc;
--primary-400: #818cf8;  /* ライトアクセント */
--primary-500: #6366f1;  /* メインカラー */
--primary-600: #4f46e5;  /* ホバー状態 */
--primary-700: #4338ca;  /* アクティブ状態 */
--primary-800: #3730a3;
--primary-900: #312e81;
```

### セカンダリカラー（Purple系）

```css
--secondary-50: #faf5ff;
--secondary-100: #f3e8ff;
--secondary-200: #e9d5ff;
--secondary-300: #d8b4fe;
--secondary-400: #c084fc;
--secondary-500: #a855f7;  /* メインセカンダリ */
--secondary-600: #9333ea;
--secondary-700: #7e22ce;
--secondary-800: #6b21a8;
--secondary-900: #581c87;
```

### グレースケール（Neutral）

```css
--gray-50: #fafafa;   /* 背景の明るい部分 */
--gray-100: #f5f5f5;  /* 背景 */
--gray-200: #e5e5e5;  /* ボーダー */
--gray-300: #d4d4d4;  /* 無効化された要素 */
--gray-400: #a3a3a3;  /* プレースホルダー */
--gray-500: #737373;  /* 補足テキスト */
--gray-600: #525252;  /* セカンダリテキスト */
--gray-700: #404040;  /* 本文テキスト */
--gray-800: #262626;  /* 見出し */
--gray-900: #171717;  /* 最重要テキスト */
```

### セマンティックカラー

```css
/* 成功 */
--success-50: #f0fdf4;
--success-100: #dcfce7;
--success-500: #22c55e;
--success-600: #16a34a;
--success-700: #15803d;

/* エラー */
--error-50: #fef2f2;
--error-100: #fee2e2;
--error-500: #ef4444;
--error-600: #dc2626;
--error-700: #b91c1c;

/* 警告 */
--warning-50: #fffbeb;
--warning-100: #fef3c7;
--warning-500: #f59e0b;
--warning-600: #d97706;
--warning-700: #b45309;

/* 情報 */
--info-50: #eff6ff;
--info-100: #dbeafe;
--info-500: #3b82f6;
--info-600: #2563eb;
--info-700: #1d4ed8;
```

### グラデーション（2026トレンド: 控えめで洗練された）

```css
/* プライマリグラデーション（控えめ） */
--gradient-primary: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

/* セカンダリグラデーション */
--gradient-secondary: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);

/* アクセントグラデーション */
--gradient-accent: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);

/* 背景グラデーション（非常に控えめ） */
--gradient-bg-subtle: linear-gradient(180deg, #fafafa 0%, #f5f5f5 100%);

/* Glassmorphism用グラデーション */
--gradient-glass: linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%);
```

### ダークモード対応（将来の拡張）

```css
@media (prefers-color-scheme: dark) {
  --gray-50: #171717;
  --gray-100: #262626;
  --gray-900: #fafafa;
  /* ... 他のカラーも反転 */
}
```

---

## 3. スペーシングシステム

### 8pxベースのグリッドシステム（厳格に遵守）

すべてのスペーシングは8pxの倍数を使用します：

```css
--space-0: 0;
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.25rem;   /* 20px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */
--space-20: 5rem;     /* 80px */
--space-24: 6rem;     /* 96px */
--space-32: 8rem;     /* 128px */
```

### コンポーネント別スペーシング

| コンポーネント | パディング | マージン | ギャップ |
|--------------|----------|---------|---------|
| カード | 24px (1.5rem) | 0 0 16px 0 | - |
| カード（コンパクト） | 16px (1rem) | 0 0 16px 0 | - |
| ボタン | 12px 24px | 0 | - |
| ボタン（小） | 8px 16px | 0 | - |
| フォーム入力 | 12px 16px | 0 0 16px 0 | - |
| セクション | 32px | 0 0 48px 0 | - |
| ナビゲーション | 16px | 0 | 16px |
| グリッドアイテム | - | - | 24px |

---

## 4. シャドウシステム（Material Design 3準拠）

```css
/* エレベーション（2026: より控えめで自然） */
--shadow-xs: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
--shadow-sm: 0 1px 3px 0 rgba(0, 0, 0, 0.08), 0 1px 2px 0 rgba(0, 0, 0, 0.04);
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -1px rgba(0, 0, 0, 0.04);
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.04);
--shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 10px 10px -5px rgba(0, 0, 0, 0.03);
--shadow-2xl: 0 25px 50px -12px rgba(0, 0, 0, 0.15);
```

### 使用例

- **xs**: インライン要素のホバー、微妙な区切り
- **sm**: カード（通常状態）、入力フィールド
- **md**: カード（ホバー状態）、ドロップダウン
- **lg**: モーダル、ナビゲーションバー（スクロール時）
- **xl**: 特別な強調要素、フローティングアクション
- **2xl**: ヒーローセクション、特別なオーバーレイ

---

## 5. ボーダーラディウス

```css
--radius-none: 0;
--radius-sm: 0.25rem;   /* 4px - 小さな要素、バッジ */
--radius-md: 0.5rem;    /* 8px - 標準ボタン、入力 */
--radius-lg: 0.75rem;   /* 12px - カード */
--radius-xl: 1rem;      /* 16px - 大きなカード */
--radius-2xl: 1.5rem;   /* 24px - 特別な要素 */
--radius-full: 9999px;  /* 完全な円、ピル型 */
```

---

## 6. Glassmorphism 2.0（2026トレンド）

**Liquid Glass / Glassmorphism 2.0** - Appleのデザイン言語に影響を受けた

```css
.glass {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 
    0 8px 32px 0 rgba(31, 38, 135, 0.1),
    inset 0 1px 0 0 rgba(255, 255, 255, 0.5);
}

.glass-dark {
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.1);
}
```

**使用ガイドライン**:
- ナビゲーションバー、モーダル、カードに適用
- パフォーマンスを考慮（`will-change` の使用）
- フォールバックを提供（`@supports` で確認）

---

## 7. トランジションとアニメーション

### トランジション時間（2026: より速く、より自然）

```css
--transition-instant: 100ms;   /* 即座のフィードバック */
--transition-fast: 150ms;      /* ホバー、フォーカス */
--transition-base: 200ms;      /* 標準 */
--transition-slow: 300ms;      /* 複雑なアニメーション */
--transition-slower: 500ms;    /* ページトランジション */
```

### イージング関数（2026: より自然な動き）

```css
--ease-in: cubic-bezier(0.4, 0, 1, 1);
--ease-out: cubic-bezier(0, 0, 0.2, 1);
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
--ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);  /* 2026: より弾力的 */
```

### アニメーション（2026: ストーリーテリング重視）

```css
/* フェードイン */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* スライドアップ（スクロール連動） */
@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(24px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* スケールイン */
@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.96);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* 2026: スクロール連動アニメーション */
@keyframes revealOnScroll {
  from {
    opacity: 0;
    transform: translateY(32px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
```

### マイクロインタラクション

**原則**:
- すべてのインタラクションにフィードバックを提供
- 150-200ms以内に反応
- `prefers-reduced-motion` を尊重

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 8. コンポーネントスタイル

### ボタン（2026: より洗練された）

```css
/* プライマリボタン */
.btn-primary {
  padding: 12px 24px;
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.5;
  border-radius: var(--radius-md);
  background: var(--primary-500);
  color: white;
  border: none;
  cursor: pointer;
  transition: all var(--transition-fast) var(--ease-out);
  position: relative;
  overflow: hidden;
}

.btn-primary::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  transform: translate(-50%, -50%);
  transition: width 0.4s, height 0.4s;
}

.btn-primary:hover::before {
  width: 300px;
  height: 300px;
}

.btn-primary:hover {
  background: var(--primary-600);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.btn-primary:active {
  transform: translateY(0);
  box-shadow: var(--shadow-sm);
}

.btn-primary:focus-visible {
  outline: 2px solid var(--primary-500);
  outline-offset: 2px;
}
```

### フォーム入力（2026: より使いやすく）

```css
.form-control {
  padding: 12px 16px;
  font-size: 1rem;
  line-height: 1.5;
  border: 1px solid var(--gray-300);
  border-radius: var(--radius-md);
  background: white;
  color: var(--gray-900);
  transition: all var(--transition-fast);
  width: 100%;
}

.form-control:hover {
  border-color: var(--gray-400);
}

.form-control:focus {
  outline: none;
  border-color: var(--primary-500);
  box-shadow: 0 0 0 3px var(--primary-100);
}

.form-control::placeholder {
  color: var(--gray-400);
}

.form-control:disabled {
  background: var(--gray-50);
  color: var(--gray-500);
  cursor: not-allowed;
}
```

### カード（2026: Glassmorphism対応）

```css
.card {
  padding: 24px;
  background: white;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--gray-200);
  transition: all var(--transition-base) var(--ease-out);
}

.card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
  border-color: var(--gray-300);
}

/* Glassmorphismバリアント */
.card-glass {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 
    0 8px 32px 0 rgba(31, 38, 135, 0.1),
    inset 0 1px 0 0 rgba(255, 255, 255, 0.5);
}
```

---

## 9. アイコンシステム

### アイコンライブラリ

- **Heroicons v2** (推奨): 24x24px, ストローク幅 2px
- **Lucide Icons**: 代替案、より多くのバリアント
- **カスタムSVG**: 必要に応じて

### アイコンサイズ

```css
--icon-xs: 12px;   /* インライン、バッジ内 */
--icon-sm: 16px;   /* ボタン内、リスト */
--icon-md: 20px;   /* 標準 */
--icon-lg: 24px;   /* カードタイトル */
--icon-xl: 32px;   /* セクションタイトル */
--icon-2xl: 48px;  /* ヒーローセクション */
```

### アイコンの使用原則

- **絵文字は使用しない**: すべてSVGアイコンに置き換える
- **一貫性**: 同じライブラリ内で統一
- **アクセシビリティ**: `aria-label` または `aria-hidden="true"` を適切に使用
- **色**: 親要素の色を継承、またはセマンティックカラーを使用

---

## 10. レイアウトシステム

### コンテナ幅

```css
--container-sm: 640px;
--container-md: 768px;
--container-lg: 1024px;
--container-xl: 1280px;
--container-2xl: 1536px;
```

### グリッドシステム（2026: CSS Grid優先）

```css
.grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: var(--space-6);  /* 24px */
}

/* レスポンシブグリッド */
.grid-responsive {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--space-6);
}
```

### ホワイトスペース（2026: より大胆に）

- セクション間: 64px以上
- カード間: 24px
- テキストブロック間: 16-24px
- 要素とボーダーの間: 8-16px

---

## 11. アクセシビリティ（2026: より包括的に）

### コントラスト比（WCAG 2.1 AA）

- **本文テキスト**: 4.5:1以上
- **大きなテキスト（18px以上）**: 3:1以上
- **インタラクティブ要素**: 3:1以上
- **ロゴ、装飾的要素**: 例外可

### フォーカス表示（2026: より明確に）

```css
:focus-visible {
  outline: 2px solid var(--primary-500);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

/* カスタムフォーカスリング */
.focus-ring {
  box-shadow: 0 0 0 3px var(--primary-100);
}
```

### タッチターゲットサイズ

- **最小サイズ**: 44x44px（iOS推奨）または 48x48px（Material Design）
- **推奨サイズ**: 48x48px以上
- **要素間の間隔**: 8px以上

### 認知負荷の軽減（2026トレンド）

- **情報の階層化**: 明確な視覚的階層
- **プログレッシブディスクロージャー**: 一度に表示する情報を制限
- **明確なフィードバック**: すべてのアクションに視覚的/触覚的フィードバック
- **エラーの防止**: バリデーション、確認ダイアログ

### 神経多様性への配慮

- **モーションの制御**: `prefers-reduced-motion` の尊重
- **コントラストの調整**: 高コントラストモードのサポート
- **フォントサイズの調整**: ユーザーの設定を尊重
- **シンプルな言語**: 明確で簡潔なコピー

---

## 12. レスポンシブブレークポイント

```css
--breakpoint-sm: 640px;   /* スマートフォン（横向き） */
--breakpoint-md: 768px;   /* タブレット */
--breakpoint-lg: 1024px;  /* デスクトップ */
--breakpoint-xl: 1280px;  /* 大型デスクトップ */
--breakpoint-2xl: 1536px; /* 超大型デスクトップ */
```

### モバイルファーストアプローチ

```css
/* モバイル（デフォルト） */
.component {
  padding: var(--space-4);
}

/* タブレット以上 */
@media (min-width: 768px) {
  .component {
    padding: var(--space-6);
  }
}

/* デスクトップ以上 */
@media (min-width: 1024px) {
  .component {
    padding: var(--space-8);
  }
}
```

---

## 13. Z-index階層

```css
--z-base: 0;
--z-dropdown: 1000;
--z-sticky: 1020;
--z-fixed: 1030;
--z-modal-backdrop: 1040;
--z-modal: 1050;
--z-popover: 1060;
--z-tooltip: 1070;
--z-toast: 1080;  /* 2026: 通知システム */
```

---

## 14. パフォーマンス最適化（2026必須）

### 画像最適化

- **WebP/AVIF形式**: モダンブラウザで優先使用
- **遅延読み込み**: `loading="lazy"` の使用
- **レスポンシブ画像**: `srcset` と `sizes` の使用
- **適切なサイズ**: 表示サイズに合わせた画像

### CSS最適化

- **Critical CSS**: ファーストビューのCSSをインライン化
- **未使用CSSの削除**: PurgeCSS等の使用
- **CSS変数の活用**: ランタイムでの変更を可能に

### JavaScript最適化

- **コード分割**: 必要な部分のみ読み込み
- **遅延読み込み**: 非クリティカルなJSを遅延
- **Tree shaking**: 未使用コードの削除

---

## 15. プライバシーとエシカルデザイン（2026重要）

### データ使用の透明性

- **明確な同意**: オプトイン方式
- **データ使用の可視化**: 何が使われているかを明確に表示
- **簡単なオプトアウト**: 1クリックで無効化可能

### ダークパターンの回避

- **強制的な選択肢**: ユーザーを操作しない
- **隠れたコスト**: すべてを明確に表示
- **誤解を招くUI**: 明確で正直なデザイン

---

## 実装チェックリスト

### デザインシステム
- [ ] タイポグラフィスケールが一貫している
- [ ] スペーシングが8pxグリッドに従っている
- [ ] カラーパレットが統一されている
- [ ] コントラスト比がWCAG 2.1 AA基準を満たしている

### インタラクション
- [ ] アニメーションが適切な速度で動作している
- [ ] `prefers-reduced-motion` が尊重されている
- [ ] すべてのインタラクションにフィードバックがある
- [ ] マイクロインタラクションが実装されている

### アクセシビリティ
- [ ] アイコンが統一されている（絵文字を使用していない）
- [ ] フォーカス表示が明確である
- [ ] タッチターゲットが適切なサイズである
- [ ] スクリーンリーダー対応が適切である

### パフォーマンス
- [ ] 画像が最適化されている
- [ ] CSS/JSが最適化されている
- [ ] 遅延読み込みが実装されている
- [ ] パフォーマンススコアが90以上

### レスポンシブ
- [ ] モバイルファーストで実装されている
- [ ] すべてのブレークポイントで適切に表示される
- [ ] タッチ操作が最適化されている

### 2026トレンド
- [ ] Glassmorphismが適切に使用されている
- [ ] スクロール連動アニメーションが実装されている
- [ ] プライバシー配慮が実装されている
- [ ] 感情的な共鳴を生むデザインになっている
