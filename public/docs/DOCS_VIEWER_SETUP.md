# ドキュメントビューアーのセットアップ

## 実装内容

MarkdownファイルをWiki風に表示できるドキュメントビューアーを実装しました。

## 作成したファイル

1. **`public/docs.html`**: ドキュメントビューアーページ
2. **`public/js/docs.js`**: Markdown読み込み・レンダリング処理
3. **`scripts/copy-docs.js`**: docs/をpublic/docs/にコピーするスクリプト

## 機能

- ✅ サイドバーにドキュメント一覧を表示（カテゴリ別）
- ✅ MarkdownをHTMLに変換して表示
- ✅ コードブロックのシンタックスハイライト
- ✅ レスポンシブデザイン（モバイル対応）
- ✅ 内部リンクの自動処理

## 使い方

### 1. ドキュメントのコピー

初回または`docs/`ディレクトリに変更があった場合：

```bash
npm run copy-docs
```

### 2. 開発サーバーの起動

```bash
npm run dev
```

`npm run dev`を実行すると、自動的に`copy-docs`が実行されます（`predev`フック）。

### 3. ブラウザでアクセス

```
http://localhost:8080/docs.html
```

または、ナビゲーションバーの「ドキュメント」リンクをクリック。

## ドキュメントの追加方法

1. `docs/`ディレクトリにMarkdownファイルを追加
2. `public/js/docs.js`の`DOCUMENTS`配列に追加：

```javascript
const DOCUMENTS = [
    // ... 既存のドキュメント
    { file: '新しいファイル.md', title: 'タイトル', category: 'カテゴリ' }
];
```

3. `npm run copy-docs`を実行（または`npm run dev`で自動実行）

## カテゴリ

現在のカテゴリ：
- **基本**: README、クイックスタート、セットアップガイド
- **運用**: デプロイメント、運用ガイド、マイグレーション関連
- **使い方**: プロンプトガイド
- **開発**: 実装計画、技術仕様、スタイルガイド

## 技術スタック

- **Marked.js**: Markdownパーサー
- **Highlight.js**: コードシンタックスハイライト
- **Bootstrap 5**: UIフレームワーク（既存）

## 注意事項

- `public/docs/`ディレクトリは自動生成されるため、直接編集しないでください
- 元のMarkdownファイルは`docs/`ディレクトリで編集してください
- `public/docs/`はgitignoreに追加していません（デプロイ時に必要）

## トラブルシューティング

### ドキュメントが表示されない

1. `npm run copy-docs`を実行して、`public/docs/`にファイルがコピーされているか確認
2. ブラウザの開発者ツール（F12）でエラーを確認
3. `public/js/docs.js`の`DOCUMENTS`配列にファイルが追加されているか確認

### スタイルが適用されない

- Bootstrap 5とHighlight.jsのCDNが読み込まれているか確認
- ブラウザのキャッシュをクリア
