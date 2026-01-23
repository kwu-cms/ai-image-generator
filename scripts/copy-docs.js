/**
 * docs/ディレクトリをpublic/docs/にコピーするスクリプト
 */

const fs = require('fs');
const path = require('path');

const docsDir = path.join(__dirname, '..', 'docs');
const publicDocsDir = path.join(__dirname, '..', 'public', 'docs');

// public/docs/ディレクトリを作成（存在しない場合）
if (!fs.existsSync(publicDocsDir)) {
    fs.mkdirSync(publicDocsDir, { recursive: true });
}

// docs/ディレクトリ内のファイルをコピー
function copyDocs() {
    const files = fs.readdirSync(docsDir);
    let copiedCount = 0;
    
    files.forEach(file => {
        const sourcePath = path.join(docsDir, file);
        const stat = fs.statSync(sourcePath);
        
        // ディレクトリ（archiveなど）はスキップ
        if (stat.isDirectory()) {
            return;
        }
        
        // .mdファイルのみをコピー
        if (file.endsWith('.md')) {
            const destPath = path.join(publicDocsDir, file);
            fs.copyFileSync(sourcePath, destPath);
            console.log(`Copied: ${file}`);
            copiedCount++;
        }
    });
    
    console.log(`\n✅ ${copiedCount} documents copied to public/docs/`);
}

try {
    copyDocs();
} catch (error) {
    console.error('Error copying docs:', error);
    process.exit(1);
}
