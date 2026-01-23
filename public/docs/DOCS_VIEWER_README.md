# ドキュメントビューアーの使い方

## 概要

`docs.html`ページで、`docs/`ディレクトリ内のMarkdownファイルをWiki風に閲覧できます。

## 機能

- **サイドバー**: ドキュメント一覧をカテゴリ別に表示
- **Markdownレンダリング**: Marked.jsを使用してMarkdownをHTMLに変換
- **シンタックスハイライト**: Highlight.jsでコードブロックをハイライト
- **レスポンシブデザイン**: モバイルでも見やすいレイアウト

## 使い方

1. ブラウザで `docs.html` を開く
2. サイドバーからドキュメントを選択
3. メインエリアにMarkdownがHTMLとして表示される

## ドキュメントの追加

1. `docs/`ディレクトリにMarkdownファイルを追加
2. `public/js/docs.js`の`DOCUMENTS`配列に追加
3. `npm run copy-docs`を実行（または`npm run dev`で自動実行）

## 自動コピー

`npm run dev`または`npm run deploy`を実行すると、自動的に`docs/`が`public/docs/`にコピーされます。

## 手動コピー

```bash
npm run copy-docs
```

## 注意事項

- `public/docs/`ディレクトリは自動生成されるため、直接編集しないでください
- 元のMarkdownファイルは`docs/`ディレクトリで編集してください
