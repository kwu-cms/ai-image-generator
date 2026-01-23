# Stability AI移行 - 進捗状況

## 工程1: Stability AI APIの調査と準備 ✅

### 完了項目
- [x] Stability AI APIの公式ドキュメントを確認
- [x] APIキーの取得方法を確認
- [x] 課金体系とレート制限を確認（150リクエスト/10秒）
- [x] サポートされているモデルと機能を確認
- [x] img2img、inpaintingの仕様を確認

### 調査結果
- **API調査結果**: `docs/STABILITY_AI_API_RESEARCH.md`にまとめました
- **技術仕様書**: `docs/STABILITY_AI_TECHNICAL_SPEC.md`を更新しました

### 完了項目
- [x] Stability AIアカウントの作成 ✅
- [x] APIキーの取得 ✅
- [x] ローカル環境の設定（.dev.vars） ✅

### 完了項目（追加）
- [x] クレジット残高の確認 ✅ (1000クレジット)
- [x] テスト実行（APIキーの動作確認） ✅
  - `/v1/user/account` エンドポイント: 成功
  - `/v1/user/balance` エンドポイント: 成功（1000クレジット確認）
- [x] 本番環境のWorkers Secretsへの設定 ✅
  - `wrangler secret put STABILITY_AI_API_KEY` 実行完了

### 次のステップ
- [ ] 実装作業の開始（データベースマイグレーション、Workers側の実装変更）

## 工程2: データベーススキーマの変更 🔄

### 完了項目
- [x] `migrations/0005_rename_images_to_generations.sql` を作成
- [x] `migrations/0006_extend_generation_reference_images.sql` を作成

### マイグレーション内容

#### 0005: images → generations
- `images`テーブルを`generations`にリネーム
- `prompt` → `final_prompt`にカラム名変更
- `generation_options` → `generation_settings`にカラム名変更
- `image_url` → `output_image_r2_key`にカラム名変更

#### 0006: generation_reference_images拡張
- `r2_object_key`カラムを追加
- `image_hash`カラムを追加
- `weight`カラムを追加（将来的な拡張用）
- 既存データの移行処理

### 完了項目（追加）
- [x] ローカル環境でのマイグレーション実行とテスト ✅
  - `migrations/0005_rename_images_to_generations.sql` 実行完了
  - `migrations/0006_extend_generation_reference_images.sql` 実行完了
- [x] 既存データの移行確認 ✅
  - `generations`テーブル: 3件のデータ確認
  - `generation_reference_images`テーブル: 1件のデータ移行確認
  - カラム名の変更が正しく反映されていることを確認

### 次のステップ
- [ ] リモート環境への適用

## 工程3: Workers側の実装変更 ✅

### 完了項目
- [x] Stability AI APIクライアントの実装 ✅
  - `generateTextToImage()`関数の実装
  - `generateImageToImage()`関数の実装
- [x] 参照画像の取得とエンコード処理 ✅
  - `getReferenceImageFromR2()`関数の実装
  - base64エンコード処理の実装
- [x] プロンプト生成ロジックの確認 ✅
  - `enhancePromptWithRoles()`関数は既存のまま維持
- [x] 品質設定の固定化 ✅
  - `QUALITY_PRESETS`定数の作成（standard, high）
- [x] エラーハンドリングの強化 ✅
  - `GenerationError`クラスの実装
  - 4段階のエラーハンドリング（reference_image_save, api_call, output_image_save, db_record）
  - レート制限エラー（429）とクレジット不足エラー（402）の処理
- [x] `handleGenerate()`関数の変更 ✅
  - OpenAI API → Stability AI APIへの置き換え
  - 参照画像がある場合はimage-to-image、ない場合はtext-to-image
  - データベーステーブル名・カラム名の更新（`images` → `generations`、`prompt` → `final_prompt`など）
- [x] `handleHistory()`と`handleAllImages()`関数の更新 ✅
  - 新しいテーブル名・カラム名に対応

### 工程4: フロントエンドの調整
- [ ] APIリクエスト構造の確認
- [ ] エラーメッセージの表示

### 工程5: テストと動作確認
- [ ] 単体テスト
- [ ] 統合テスト
- [ ] パフォーマンステスト

## 工程4: OpenAI翻訳レイヤーの実装 ✅

### 完了項目
- [x] データベーススキーマ変更 ✅
  - `generations`テーブルに`original_prompt_ja`と`translated_prompt_en`カラムを追加
  - `prompt_translations`テーブルを作成（翻訳キャッシュ用）
- [x] 翻訳関数の実装 ✅
  - `translatePromptWithOpenAI`関数を実装
  - システム指示を固定（画像生成向けの簡潔な命令形英語）
  - `temperature`: 0.2、`max_tokens`: 500
- [x] 翻訳キャッシュ機能の実装 ✅
  - `getTranslationFromCache`関数を実装
  - `saveTranslationToCache`関数を実装
- [x] プロンプト組み立て処理の変更 ✅
  - 参照画像の役割ラベルを英語テンプレートに変換
  - 学生の自由記述部分をOpenAI APIで翻訳
  - 最終プロンプトを組み立て
  - データベースに保存（original_prompt_ja、translated_prompt_en、final_prompt）
- [x] エラーハンドリングの改善 ✅
  - 翻訳フェーズのエラーハンドリングを実装（ステージ: `translation`）
  - 画像生成フェーズのエラーハンドリングを実装（ステージ: `api_call`）
- [x] 履歴表示の更新 ✅
  - `handleHistory`と`handleAllImages`関数を更新
  - 翻訳情報（original_prompt、translated_prompt）をレスポンスに含める

### 次のステップ
- [ ] ローカル環境での動作確認テスト
- [ ] リモート環境でのマイグレーション実行
- [ ] フロントエンドの調整（必要に応じて）

## 現在の作業

**工程4: OpenAI翻訳レイヤーの実装**が完了しました。

### 次のアクション
1. ローカル環境での動作確認テスト
   - 翻訳機能のテスト
   - キャッシュ機能のテスト
   - エラーハンドリングのテスト
2. リモート環境でのマイグレーション実行
3. フロントエンドの調整（必要に応じて）

## 注意事項

### SQLiteのバージョン確認
`ALTER TABLE RENAME COLUMN`はSQLite 3.25.0以降でサポートされています。
Cloudflare D1が対応しているか確認が必要です。

### 既存データの保護
マイグレーション実行前に、既存データのバックアップを推奨します。
