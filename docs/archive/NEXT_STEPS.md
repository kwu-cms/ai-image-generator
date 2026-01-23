# 次のステップ - 参照画像機能のデプロイと動作確認

## 🎯 優先度順の作業リスト

### 1. ⚠️ **最重要: データベースマイグレーションの実行**

参照画像機能を動作させるには、新しいテーブルを作成する必要があります。

#### 1.1 現在のデータベース状態を確認

```bash
# リモートデータベースのテーブル一覧を確認
wrangler d1 execute image-generation-db --remote --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
```

**期待される結果:**
- `images` テーブル
- `users` テーブル
- `reference_images` テーブル（まだ存在しない）
- `generation_reference_images` テーブル（まだ存在しない）

#### 1.2 マイグレーション0004の実行

```bash
# 参照画像機能のテーブルを作成
wrangler d1 execute image-generation-db --remote --file=./migrations/0004_add_reference_images.sql
```

#### 1.3 実行後の確認

```bash
# テーブルが作成されたか確認
wrangler d1 execute image-generation-db --remote --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"

# reference_imagesテーブルの構造確認
wrangler d1 execute image-generation-db --remote --command "PRAGMA table_info(reference_images)"

# generation_reference_imagesテーブルの構造確認
wrangler d1 execute image-generation-db --remote --command "PRAGMA table_info(generation_reference_images)"

# imagesテーブルにgeneration_optionsカラムが追加されたか確認
wrangler d1 execute image-generation-db --remote --command "PRAGMA table_info(images)"
```

**期待される結果:**
- `reference_images` テーブルが存在する
- `generation_reference_images` テーブルが存在する
- `images` テーブルに `generation_options` カラムが追加されている

---

### 2. 🧪 **動作確認とテスト**

マイグレーション実行後、以下の機能をテストしてください。

#### 2.1 参照画像のアップロード

1. ブラウザでアプリケーションを開く
2. ログインする
3. 「参照画像を追加」ボタンをクリック
4. 「ファイルを選択」で画像をアップロード
5. 役割ラベルを選択（例: 「構図」）
6. プレビューが表示されることを確認

**確認ポイント:**
- ✅ 画像がアップロードできる
- ✅ プレビューが表示される
- ✅ エラーメッセージが適切に表示される（ファイルサイズ超過など）

#### 2.2 参照画像を使った画像生成

1. 参照画像を1〜5枚追加
2. 各画像に役割ラベルを設定
3. プロンプトを入力（例: 「美しい夕日の風景」）
4. 「画像を生成」ボタンをクリック

**確認ポイント:**
- ✅ 生成が成功する
- ✅ 結果に参照画像が表示される
- ✅ プロンプトに役割情報が埋め込まれている（開発者ツールで確認）

#### 2.3 既存画像からの選択

1. 「既存から選択」ボタンをクリック
2. モーダルが表示される
3. 表示範囲を選択（全て、自分の画像、クラス共有、教員固定サンプル）
4. 画像をクリックして選択

**確認ポイント:**
- ✅ モーダルが表示される
- ✅ 画像一覧が表示される
- ✅ 画像を選択できる
- ✅ 選択後、スロットに反映される

#### 2.4 履歴表示での参照画像確認

1. 履歴ページに移動
2. 参照画像を使用した生成履歴を確認
3. 参照画像のサムネイルが表示されることを確認
4. 参照画像をクリックして拡大表示

**確認ポイント:**
- ✅ 参照画像のサムネイルが表示される
- ✅ 役割ラベルが表示される
- ✅ クリックで拡大表示できる

---

### 3. 🐛 **バグ修正と改善**

動作確認中に問題が見つかった場合、以下を確認してください。

#### 3.1 よくある問題と対処法

**問題: 参照画像のアップロードが失敗する**
- 確認: R2バケットの設定が正しいか
- 確認: ファイルサイズが10MB以下か
- 確認: ファイル形式がPNG/JPEG/WebPか

**問題: 画像生成時にエラーが発生する**
- 確認: ブラウザの開発者ツールでエラーメッセージを確認
- 確認: Workersのログを確認（`wrangler tail`）
- 確認: データベースに参照画像が保存されているか

**問題: 履歴に参照画像が表示されない**
- 確認: データベースの `generation_reference_images` テーブルにデータがあるか
- 確認: APIレスポンスに `reference_images` が含まれているか

#### 3.2 デバッグ方法

```bash
# Workersのログをリアルタイムで確認
wrangler tail

# データベースの参照画像を確認
wrangler d1 execute image-generation-db --remote --command "SELECT * FROM reference_images LIMIT 10"

# 生成履歴と参照画像の紐づけを確認
wrangler d1 execute image-generation-db --remote --command "SELECT * FROM generation_reference_images LIMIT 10"
```

---

### 4. 📚 **ドキュメントの更新**

動作確認が完了したら、以下のドキュメントを更新してください。

#### 4.1 READMEの更新
- 参照画像機能の説明を追加
- 使用方法の追加

#### 4.2 セットアップガイドの更新
- マイグレーション0004の実行手順を追加

---

### 5. 🚀 **本番環境へのデプロイ**

ローカルでの動作確認が完了したら、本番環境にデプロイします。

#### 5.1 Workersのデプロイ

```bash
# Workersをデプロイ
wrangler deploy
```

#### 5.2 Pagesのデプロイ

GitHub Pagesを使用している場合、通常のgit pushで自動デプロイされます。

```bash
git add .
git commit -m "参照画像機能を追加"
git push origin main
```

---

## 📋 チェックリスト

### マイグレーション実行前
- [ ] 現在のデータベース状態を確認
- [ ] バックアップを取得（必要に応じて）

### マイグレーション実行
- [ ] マイグレーション0004を実行
- [ ] テーブルが正しく作成されたか確認
- [ ] カラムが正しく追加されたか確認

### 動作確認
- [ ] 参照画像のアップロード
- [ ] 参照画像を使った画像生成
- [ ] 既存画像からの選択
- [ ] 履歴表示での参照画像確認

### デプロイ
- [ ] Workersのデプロイ
- [ ] Pagesのデプロイ（必要に応じて）
- [ ] 本番環境での動作確認

---

## 🔍 トラブルシューティング

### エラー: "table already exists"
- このエラーは無視して問題ありません（`CREATE TABLE IF NOT EXISTS` を使用しているため）

### エラー: "duplicate column name"
- `generation_options` カラムが既に存在する場合、このエラーが発生します
- この場合は、そのカラムは既に追加済みです

### エラー: "no such table: reference_images"
- マイグレーションが実行されていない可能性があります
- マイグレーション0004を実行してください

---

## 📞 サポート

問題が発生した場合:
1. ブラウザの開発者ツールでエラーを確認
2. Workersのログを確認（`wrangler tail`）
3. データベースの状態を確認
4. 必要に応じて、実装計画書（`docs/REFERENCE_IMAGE_IMPLEMENTATION_PLAN.md`）を参照
