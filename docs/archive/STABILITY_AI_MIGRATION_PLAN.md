# Stability AI API移行計画

## 概要

OpenAI Images APIからStability AI APIへの移行により、参照画像を直接入力として扱えるようになり、スタイル維持や画像編集の精度が向上します。

## 移行の目的

1. **技術的な制限の解消**
   - 参照画像を直接APIに送信可能
   - img2img、inpaintingなどの画像編集機能の利用
   - より正確なスタイル転送の実現

2. **教育用途での利点**
   - 同一条件での比較演習が容易
   - 参照画像を使った生成過程の可視化
   - 履歴分析による学習効果の検証

## 現在の実装状況

### 既存機能
- ✅ 参照画像のアップロード・保存（R2）
- ✅ 参照画像と生成履歴の紐づけ（DB）
- ✅ 役割ラベルの指定（構図、スタイル、色調、質感、ディテール）
- ✅ プロンプトへの役割情報埋め込み（テキストベース）

### 制限事項
- ❌ 参照画像をAPIに直接送信していない（テキスト埋め込みのみ）
- ❌ DALL-E 3は画像を直接入力として受け取れない
- ❌ 画像編集機能（img2img、inpainting）が利用できない

## 設計変更の要点

### 1. アーキテクチャの変更点

#### 1.1 外部APIの置き換え
- **変更前**: OpenAI Images API（テキストプロンプトのみ）
- **変更後**: Stability AI API（テキスト + 画像入力）

#### 1.2 責務分離の維持
- フロントエンド: プロンプト入力 + 参照画像指定
- Cloudflare Workers: リクエスト集約 + API呼び出し + 永続化
- D1: メタデータ管理
- R2: 画像バイナリ保管

### 2. フロントエンド設計の変更

#### 2.1 現在の実装状況
- ✅ 複数参照画像スロットUI（最大5枚）
- ✅ 役割ラベル選択（構図、スタイル、色調、質感、ディテール、その他）
- ✅ 既存画像選択モーダル

#### 2.2 必要な変更
- **変更なし**: 基本的なUI構造は維持可能
- **拡張**: 将来的にマスク指定、領域指定などのUIを追加可能な構造

### 3. バックエンド設計の変更

#### 3.1 APIリクエスト構造の変更

**変更前（現在）:**
```javascript
{
  prompt: "string",
  referenceImages: [
    { id: "string", role: "string" }
  ],
  generationOptions: { size, quality, style }
}
```

**変更後（Stability AI）:**
```javascript
{
  prompt: "string",
  referenceImages: [
    {
      id: "string",
      role: "string",
      image_data: "base64 or multipart", // R2から取得してエンコード
      weight: number, // 将来的な拡張
      mask_key: "string" // 将来的な拡張（inpainting用）
    }
  ],
  generationOptions: {
    // Workers側で固定化（学生は変更不可）
    model: "stable-diffusion-xl-1024-v1-0",
    steps: 30,
    cfg_scale: 7,
    width: 1024,
    height: 1024
  }
}
```

#### 3.2 Workers側の処理フロー

1. **参照画像の取得**
   - R2から参照画像を取得
   - base64またはmultipart形式にエンコード
   - メモリ制限を考慮したサイズチェック

2. **Stability AI APIリクエスト生成**
   - テキストプロンプト + 画像データを組み合わせ
   - img2imgまたはtext-to-imageを選択（参照画像の有無で判定）

3. **レスポンス処理**
   - 生成画像をR2に保存
   - DBにメタデータを保存

#### 3.3 プロンプト生成ロジック

**変更前:**
```javascript
// テキストのみで役割情報を埋め込む
enhancedPrompt = basePrompt + "\n参照画像A（構図）：この画像のレイアウトとカメラアングルを維持する"
```

**変更後:**
```javascript
// 画像は直接APIに送信、プロンプトには役割情報を補足として埋め込む
enhancedPrompt = basePrompt + "\n参照画像1（構図）：この画像のレイアウトとカメラアングルを維持する\n参照画像2（スタイル）：この画像の色調と質感を反映する"
// 実際の画像データはAPIリクエストの別フィールドで送信
```

### 4. データベース設計の変更

#### 4.1 現在のスキーマ

```sql
-- imagesテーブル
CREATE TABLE images (
    id INTEGER PRIMARY KEY,
    prompt TEXT NOT NULL,
    image_url TEXT NOT NULL,
    user_id INTEGER,
    generation_options TEXT,
    created_at DATETIME
);

-- generation_reference_imagesテーブル
CREATE TABLE generation_reference_images (
    id INTEGER PRIMARY KEY,
    generation_id INTEGER,
    reference_image_id INTEGER,
    role_label TEXT,
    display_order INTEGER
);
```

#### 4.2 変更後のスキーマ

**変更点:**
- `images` → `generations` にテーブル名変更（より明確な命名）
- 参照画像のR2キーとハッシュ値を保存（履歴分析用）

```sql
-- generationsテーブル（imagesからリネーム）
CREATE TABLE generations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    final_prompt TEXT NOT NULL, -- 役割情報を含む最終プロンプト
    generation_settings TEXT NOT NULL, -- JSON形式（モデル、ステップ数など）
    output_image_r2_key TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- generation_reference_imagesテーブル（拡張）
CREATE TABLE generation_reference_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    generation_id INTEGER NOT NULL,
    reference_image_id INTEGER NOT NULL,
    role_label TEXT NOT NULL,
    r2_object_key TEXT NOT NULL, -- 参照画像のR2キー
    image_hash TEXT NOT NULL, -- 参照画像のハッシュ値
    display_order INTEGER NOT NULL DEFAULT 0,
    weight REAL DEFAULT 1.0, -- 将来的な拡張（画像の影響度）
    FOREIGN KEY (generation_id) REFERENCES generations(id),
    FOREIGN KEY (reference_image_id) REFERENCES reference_images(id)
);
```

#### 4.3 マイグレーション手順

1. `images`テーブルを`generations`にリネーム
2. `final_prompt`カラムを追加（既存の`prompt`から移行）
3. `generation_settings`カラムを追加
4. `generation_reference_images`テーブルに`r2_object_key`と`image_hash`を追加

### 5. ストレージ（R2）設計の変更

#### 5.1 ディレクトリ構造

**変更前:**
```
r2-bucket/
  ├── images/              # 生成画像
  └── reference-images/    # 参照画像
```

**変更後:**
```
r2-bucket/
  ├── generated-images/    # 生成画像（学期単位でアーカイブ可能）
  └── reference-images/    # 参照画像（長期保存）
```

#### 5.2 ライフサイクルポリシー

- **参照画像**: 長期保存（削除しない）
- **生成画像**: 学期単位でアーカイブまたは削除

### 6. 品質設定と課金制御

#### 6.1 設定の固定化

**変更前:**
- フロントエンドから`generationOptions`を送信可能

**変更後:**
- Workers側で品質プリセットを固定化
- 学生は変更不可、教員のみ変更可能（将来的な拡張）

```javascript
// Workers側の設定
const QUALITY_PRESETS = {
    standard: {
        model: "stable-diffusion-xl-1024-v1-0",
        steps: 30,
        cfg_scale: 7,
        width: 1024,
        height: 1024
    },
    high: {
        model: "stable-diffusion-xl-1024-v1-0",
        steps: 50,
        cfg_scale: 7,
        width: 1024,
        height: 1024
    }
};
```

### 7. 権限管理の拡張

#### 7.1 現在の実装
- ✅ `visibility`フィールド（private, class_shared, teacher_sample）

#### 7.2 必要な変更
- **変更なし**: 既存の実装を維持
- **拡張**: 教員権限の判定ロジック追加（将来的な拡張）

### 8. エラーハンドリングの強化

#### 8.1 4段階のエラーハンドリング

1. **参照画像保存段階**
   - R2への保存失敗
   - ファイルサイズ超過
   - 形式エラー

2. **外部API呼び出し段階**
   - Stability AI APIのレート制限
   - クレジット不足
   - ネットワークエラー

3. **出力画像保存段階**
   - R2への保存失敗
   - ストレージ容量不足

4. **DB記録段階**
   - D1への書き込み失敗
   - トランザクションエラー

#### 8.2 エラーメッセージの構造化

```javascript
{
    error: "画像生成に失敗しました",
    stage: "api_call", // save_reference, api_call, save_output, db_record
    details: "Stability AI APIのレート制限に達しました",
    retry_after: 60 // 秒
}
```

### 9. 拡張性の確保

#### 9.1 将来の機能拡張に対応

- **マスク指定**: `mask_key`属性を追加
- **領域指定編集**: `region`属性を追加
- **画像の重み付け**: `weight`属性を追加

```javascript
referenceImages: [
    {
        id: "string",
        role: "string",
        weight: 1.0, // 将来的な拡張
        mask_key: "string", // inpainting用
        region: { x: 0, y: 0, width: 100, height: 100 } // 領域指定
    }
]
```

## 実装工程

### 工程1: Stability AI APIの調査と準備

1. **API仕様の確認**
   - Stability AI APIのドキュメント確認
   - 認証方法の確認（APIキー）
   - リクエスト/レスポンス形式の確認
   - レート制限とクォータの確認

2. **APIキーの取得と設定**
   - Stability AIアカウントの作成
   - APIキーの取得
   - Workers Secretsへの設定

3. **テスト環境での動作確認**
   - 簡単なtext-to-imageのテスト
   - img2imgのテスト
   - エラーハンドリングのテスト

### 工程2: データベーススキーマの変更

1. **マイグレーションファイルの作成**
   - `images` → `generations`へのリネーム
   - カラムの追加・変更
   - `generation_reference_images`の拡張

2. **マイグレーションの実行**
   - ローカル環境でのテスト
   - リモート環境への適用

3. **既存データの移行**
   - `prompt` → `final_prompt`への移行
   - `generation_options` → `generation_settings`への移行

### 工程3: Workers側の実装変更

1. **Stability AI APIクライアントの実装**
   - API呼び出し関数の実装
   - 認証ヘッダーの設定
   - エラーハンドリングの実装

2. **参照画像の取得とエンコード**
   - R2からの画像取得
   - base64エンコード処理
   - メモリ制限の考慮

3. **プロンプト生成ロジックの変更**
   - 役割情報の埋め込み（既存ロジックを維持）
   - 最終プロンプトの生成

4. **品質設定の固定化**
   - プリセット定義
   - 設定の適用ロジック

5. **エラーハンドリングの強化**
   - 4段階のエラーハンドリング
   - 構造化されたエラーメッセージ

### 工程4: フロントエンドの調整

1. **APIリクエスト構造の確認**
   - 既存のUIは維持可能
   - 必要に応じて微調整

2. **エラーメッセージの表示**
   - 段階別のエラーメッセージ表示
   - リトライ機能の追加（将来的な拡張）

### 工程5: テストと動作確認

1. **単体テスト**
   - API呼び出しのテスト
   - エラーハンドリングのテスト

2. **統合テスト**
   - 参照画像を使った生成のテスト
   - 履歴表示のテスト

3. **パフォーマンステスト**
   - メモリ使用量の確認
   - レスポンス時間の確認

## 注意事項

### 1. メモリ制限

- Cloudflare Workersのメモリ制限（128MB）を考慮
- 参照画像のサイズと枚数に上限を設ける
- フロントエンド側でも事前バリデーション

### 2. 課金管理

- Stability AI APIの課金体系を確認
- 品質設定を固定化して予算を管理
- 使用量の監視とアラート設定

### 3. 後方互換性

- 既存の生成履歴は保持
- マイグレーション時に既存データを移行
- APIエンドポイントの互換性を維持（可能な範囲で）

### 4. 段階的な移行

- まずはStability AI APIへの移行を完了
- その後、機能拡張（マスク指定など）を追加
- 既存機能を壊さないように注意

## 参考資料

- [Stability AI API Documentation](https://platform.stability.ai/docs)
- [Stability AI SDK](https://github.com/Stability-AI/platform-sdk)
- 現在の実装: `docs/REFERENCE_IMAGE_IMPLEMENTATION_PLAN.md`
- 制限事項: `docs/REFERENCE_IMAGE_LIMITATIONS.md`
