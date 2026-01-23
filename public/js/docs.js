/**
 * ドキュメントビューアーのJavaScript
 * Markdownファイルを読み込んでHTMLに変換して表示
 */

// Marked.jsの設定
marked.setOptions({
    breaks: true,
    gfm: true,
    highlight: function(code, lang) {
        if (lang && hljs.getLanguage(lang)) {
            try {
                return hljs.highlight(code, { language: lang }).value;
            } catch (err) {}
        }
        return hljs.highlightAuto(code).value;
    }
});

// ドキュメント一覧（docsディレクトリ内のファイル）
const DOCUMENTS = [
    // 基本
    { file: 'README.md', title: 'README', category: '基本' },
    { file: 'QUICK_START.md', title: 'クイックスタート', category: '基本' },
    { file: 'SETUP.md', title: 'セットアップガイド', category: '基本' },
    
    // 運用
    { file: 'DEPLOYMENT.md', title: 'デプロイメント', category: '運用' },
    { file: 'DEPLOYMENT_STEP_BY_STEP.md', title: 'デプロイ手順（ステップバイステップ）', category: '運用' },
    { file: 'OPERATIONS.md', title: '運用ガイド', category: '運用' },
    { file: 'MIGRATION_CHECK.md', title: 'マイグレーション確認', category: '運用' },
    { file: 'MIGRATION_REMOTE_EXECUTION.md', title: 'リモートマイグレーション実行', category: '運用' },
    { file: 'MIGRATION_VERIFICATION.md', title: 'マイグレーション検証', category: '運用' },
    { file: 'MIGRATION_STATUS_CHECK.md', title: 'マイグレーション実行状況確認', category: '運用' },
    { file: 'NEXT_DEPLOYMENT_STEPS.md', title: '次のステップ：デプロイと動作確認', category: '運用' },
    { file: 'LOCAL_TEST_GUIDE.md', title: 'ローカル動作テストガイド', category: '運用' },
    
    // 使い方
    { file: 'PROMPT_GUIDE.md', title: 'プロンプトガイド', category: '使い方' },
    
    // API設定
    { file: 'API_KEY_SETUP.md', title: 'APIキー設定', category: 'API設定' },
    
    // 技術仕様・アーキテクチャ
    { file: 'CURRENT_TECHNICAL_SPEC.md', title: '技術仕様書', category: '技術仕様' },
    { file: 'cursor指示書_open_ai参照画像生成アーキテクチャ.md', title: 'OpenAI参照画像生成アーキテクチャ', category: '技術仕様' },
    { file: 'QUALITY_ANALYSIS.md', title: '品質分析', category: '技術仕様' },
    { file: 'OPENAI_IMPLEMENTATION_SUMMARY.md', title: 'OpenAI実装サマリー', category: '技術仕様' },
    
    // 開発
    { file: 'STYLE_GUIDE.md', title: 'スタイルガイド', category: '開発' },
    { file: 'DOCS_VIEWER_README.md', title: 'ドキュメントビューアー使い方', category: '開発' },
    { file: 'DOCS_VIEWER_SETUP.md', title: 'ドキュメントビューアーセットアップ', category: '開発' }
];

// カテゴリごとにグループ化
const DOCUMENTS_BY_CATEGORY = DOCUMENTS.reduce((acc, doc) => {
    if (!acc[doc.category]) {
        acc[doc.category] = [];
    }
    acc[doc.category].push(doc);
    return acc;
}, {});

/**
 * ページ読み込み時の初期化
 */
document.addEventListener('DOMContentLoaded', () => {
    // サイドバーにドキュメント一覧を表示
    renderSidebar();
    
    // URLパラメータからファイル名を取得
    const urlParams = new URLSearchParams(window.location.search);
    const file = urlParams.get('file') || 'README.md';
    
    // ドキュメントを読み込んで表示
    loadDocument(file);
});

/**
 * サイドバーをレンダリング
 */
function renderSidebar() {
    const nav = document.getElementById('docsNav');
    let html = '';
    
    // カテゴリごとに表示
    const categories = Object.keys(DOCUMENTS_BY_CATEGORY).sort();
    
    categories.forEach(category => {
        html += `<h6 class="mt-4 mb-2">${category}</h6>`;
        DOCUMENTS_BY_CATEGORY[category].forEach(doc => {
            const urlParams = new URLSearchParams(window.location.search);
            const currentFile = urlParams.get('file') || 'README.md';
            const isActive = currentFile === doc.file;
            html += `
                <a class="nav-link ${isActive ? 'active' : ''}" 
                   href="docs.html?file=${encodeURIComponent(doc.file)}"
                   onclick="event.preventDefault(); loadDocument('${doc.file}'); return false;">
                    ${doc.title}
                </a>
            `;
        });
    });
    
    nav.innerHTML = html;
}

/**
 * ドキュメントを読み込んで表示
 */
async function loadDocument(filename) {
    const loading = document.getElementById('loading');
    const error = document.getElementById('error');
    const content = document.getElementById('content');
    
    // UIのリセット
    loading.style.display = 'block';
    error.style.display = 'none';
    content.style.display = 'none';
    
    // URLを更新（履歴に追加）
    window.history.pushState({}, '', `docs.html?file=${encodeURIComponent(filename)}`);
    
    // サイドバーのアクティブ状態を更新
    updateActiveNav(filename);
    
    try {
        // public/docs/ディレクトリから直接読み込む
        // npm run copy-docs でdocs/がpublic/docs/にコピーされている前提
        const response = await fetch(`docs/${filename}`);
        
        if (!response.ok) {
            // 直接読み込めない場合、API経由で読み込む
            const apiBaseUrl = window.API_BASE_URL || window.location.origin;
            const apiResponse = await fetch(`${apiBaseUrl}/api/docs/${filename}`);
            if (!apiResponse.ok) {
                throw new Error(`ドキュメントが見つかりません: ${filename}`);
            }
            const markdown = await apiResponse.text();
            renderMarkdown(markdown, filename);
            return;
        }
        
        const markdown = await response.text();
        renderMarkdown(markdown, filename);
        
    } catch (err) {
        console.error('Error loading document:', err);
        error.textContent = `ドキュメントの読み込みに失敗しました: ${err.message}`;
        error.style.display = 'block';
        loading.style.display = 'none';
    }
}

/**
 * MarkdownをHTMLに変換して表示
 */
function renderMarkdown(markdown, filename) {
    const loading = document.getElementById('loading');
    const content = document.getElementById('content');
    
    // MarkdownをHTMLに変換
    const html = marked.parse(markdown);
    
    // コンテンツを表示
    content.innerHTML = html;
    
    // コードブロックのシンタックスハイライト
    content.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightElement(block);
    });
    
    // 内部リンクを処理（相対パスを修正）
    content.querySelectorAll('a[href^="../"]').forEach(link => {
        const href = link.getAttribute('href');
        // ../docs/xxx.md のようなリンクを処理
        if (href.includes('/docs/')) {
            const docFile = href.split('/docs/')[1];
            link.href = `docs.html?file=${encodeURIComponent(docFile)}`;
            link.onclick = (e) => {
                e.preventDefault();
                loadDocument(docFile);
            };
        }
    });
    
    // 表示
    loading.style.display = 'none';
    content.style.display = 'block';
    
    // ページトップにスクロール
    window.scrollTo(0, 0);
}

/**
 * サイドバーのアクティブ状態を更新
 */
function updateActiveNav(filename) {
    document.querySelectorAll('#docsNav .nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.href.includes(`file=${encodeURIComponent(filename)}`)) {
            link.classList.add('active');
        }
    });
}
