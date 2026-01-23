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

## API設定

- **[API_KEY_SETUP.md](./API_KEY_SETUP.md)** - APIキーの設定方法
  - OpenAI APIキーの設定
  - Stability AI APIキーの設定
  - 環境変数の設定方法

## 技術仕様・アーキテクチャ

- **[CURRENT_TECHNICAL_SPEC.md](./CURRENT_TECHNICAL_SPEC.md)** - 最新の技術仕様書
  - システムアーキテクチャ
  - データベーススキーマ
  - API仕様
  - 実装詳細

- **[cursor指示書_open_ai参照画像生成アーキテクチャ.md](./cursor指示書_open_ai参照画像生成アーキテクチャ.md)** - OpenAI参照画像生成のアーキテクチャ計画
  - システム設計
  - 実装方針
  - 移行計画

- **[QUALITY_ANALYSIS.md](./QUALITY_ANALYSIS.md)** - 画像生成品質の分析
  - DALL-E 3とStability AIの比較
  - 品質向上のための推奨事項

- **[OPENAI_IMPLEMENTATION_SUMMARY.md](./OPENAI_IMPLEMENTATION_SUMMARY.md)** - OpenAI API実装のサマリー

## マイグレーション

- **[MIGRATION_REMOTE_EXECUTION.md](./MIGRATION_REMOTE_EXECUTION.md)** - リモートデータベースでのマイグレーション実行ガイド
- **[MIGRATION_VERIFICATION.md](./MIGRATION_VERIFICATION.md)** - マイグレーション検証手順

## テスト・開発

- **[LOCAL_TEST_GUIDE.md](./LOCAL_TEST_GUIDE.md)** - ローカル環境でのテストガイド

## ドキュメントビューア

- **[DOCS_VIEWER_README.md](./DOCS_VIEWER_README.md)** - ドキュメントビューアの説明
- **[DOCS_VIEWER_SETUP.md](./DOCS_VIEWER_SETUP.md)** - ドキュメントビューアのセットアップ

## アーカイブ

完了済みまたは古くなったドキュメントは **[archive/](./archive/)** ディレクトリに移動されています。

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

- 2026年1月: ドキュメントを整理・アーカイブ化
  - 完了済み・古いドキュメントを `archive/` ディレクトリに移動
  - 現在有効なドキュメントのみをルートに保持
  - README.mdを最新の構成に更新

- 2024年: ドキュメントを整理・統合
  - SETUP.md: セットアップガイドとローカル開発ガイドを統合
  - DEPLOYMENT.md: GitHub PagesとGitHub Actionsの設定を統合
  - OPERATIONS.md: コスト見積もりと履歴管理を統合
  - PROMPT_GUIDE.md: プロンプト例集を追加
