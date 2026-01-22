# ドキュメント一覧

このディレクトリには、プロジェクトの各種ドキュメントが含まれています。

## セットアップ・開発

- **[QUICK_START.md](./QUICK_START.md)** - サーバー起動のクイックスタートガイド
  - 1つのコマンドで起動する方法（推奨）
  - 2つのターミナルで起動する方法
  - 動作確認とトラブルシューティング

- **[SETUP.md](./SETUP.md)** - プロジェクトのセットアップとローカル開発環境の構築手順
  - 必要なアカウントと情報の取得方法
  - 開発環境のセットアップ
  - ローカル開発・確認方法
  - トラブルシューティング

- **[MIGRATION_CHECK.md](./MIGRATION_CHECK.md)** - データベースマイグレーション確認・実行ガイド
  - データベースの現状確認方法
  - マイグレーションの実行手順
  - エラー対処方法

## デプロイ

- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - GitHub PagesとCloudflare Workersへのデプロイ手順
  - GitHub Pages設定
  - GitHub Actions自動デプロイ設定
  - 手動デプロイ
  - トラブルシューティング

## プロンプト関連

- **[PROMPT_GUIDE.md](./PROMPT_GUIDE.md)** - 画像生成プロンプトガイド
  - CG用語、光学的表現、ポートレイト表現
  - プロンプトの組み合わせ例
  - 実際のプロンプト例集

## 運用

- **[OPERATIONS.md](./OPERATIONS.md)** - 運用ガイド
  - OpenAI APIの課金について
  - 授業運用における課金額の見積もり
  - 履歴管理の仕組み
  - データの保持とプライバシー

## デザイン

- **[STYLE_GUIDE.md](./STYLE_GUIDE.md)** - 2026年の最新Webデザイントレンドに基づいたスタイルガイド
  - Glassmorphism 2.0
  - 表現力豊かなタイポグラフィ
  - マイクロインタラクション
  - アクセシビリティ
  - パフォーマンス最適化

## 参考情報

- **[OAUTH_IMPLEMENTATION.md](./OAUTH_IMPLEMENTATION.md)** - OAuth 2.0実装の参考情報（Gmail/OAuthログインなど）

---

## ドキュメントの構成

### 新規セットアップ時

1. **[SETUP.md](./SETUP.md)** を読んで必要なアカウントと情報を取得
2. 開発環境をセットアップ
3. ローカルで動作確認

### デプロイ時

1. **[DEPLOYMENT.md](./DEPLOYMENT.md)** を参照してデプロイ設定
2. GitHub Actionsで自動デプロイを設定（推奨）

### 運用時

1. **[OPERATIONS.md](./OPERATIONS.md)** でコスト見積もりを確認
2. OpenAI APIの使用量を定期的に監視

### プロンプト作成時

1. **[PROMPT_GUIDE.md](./PROMPT_GUIDE.md)** を参照して効果的なプロンプトを作成

---

## 更新履歴

- 2024年: ドキュメントを整理・統合
  - SETUP.md: セットアップガイドとローカル開発ガイドを統合
  - DEPLOYMENT.md: GitHub PagesとGitHub Actionsの設定を統合
  - OPERATIONS.md: コスト見積もりと履歴管理を統合
  - PROMPT_GUIDE.md: プロンプト例集を追加
