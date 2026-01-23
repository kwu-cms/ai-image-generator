# 参照画像機能実装計画

## 概要

ユーザーが複数の参照画像を指定し、それぞれに役割（構図、スタイル、質感、ディテールなど）を割り当てたうえで、テキストプロンプトと組み合わせて新しい画像を生成できる機能を実装する。

## 現在の実装状況

### 既存機能
- ✅ 単一プロンプトによる画像生成
- ✅ ユーザー認証・セッション管理
- ✅ 画像のR2ストレージ保存
- ✅ 生成履歴のDB保存（imagesテーブル）
- ✅ 履歴表示機能

### 不足機能
- ❌ 複数参照画像のアップロードUI
- ❌ 役割ラベルの指定機能
  - ❌ 参照画像のR2保存とハッシュ管理
- ❌ 参照画像と生成履歴の紐づけ
- ❌ プロンプトへの役割情報埋め込み
- ❌ OpenAI APIへの複数画像送信
- ❌ 履歴表示での参照画像可視化
- ❌ 権限管理（ユーザー専用、クラス共有、教員固定サンプル）

## 実装工程

### 工程1: データベーススキーマの拡張

#### 1.1 参照画像テーブルの作成
```sql
-- 参照画像を保存するテーブル
CREATE TABLE IF NOT EXISTS reference_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    image_hash TEXT UNIQUE NOT NULL,
    r2_object_key TEXT NOT NULL,
    visibility TEXT NOT NULL DEFAULT 'private', -- 'private', 'class_shared', 'teacher_sample'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_reference_images_hash ON reference_images(image_hash);
CREATE INDEX IF NOT EXISTS idx_reference_images_user_id ON reference_images(user_id);
CREATE INDEX IF NOT EXISTS idx_reference_images_visibility ON reference_images(visibility);
```

#### 1.2 生成履歴テーブルの拡張
```sql
-- imagesテーブルに生成オプションを保存するカラムを追加
ALTER TABLE images ADD COLUMN generation_options TEXT; -- JSON形式で保存

-- 生成履歴と参照画像の紐づけテーブル
CREATE TABLE IF NOT EXISTS generation_reference_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    generation_id INTEGER NOT NULL,
    reference_image_id INTEGER NOT NULL,
    role_label TEXT NOT NULL, -- 役割ラベル（構図、スタイル、色調、質感、ディテール、その他）
    display_order INTEGER NOT NULL DEFAULT 0, -- 参照画像の順序
    FOREIGN KEY (generation_id) REFERENCES images(id),
    FOREIGN KEY (reference_image_id) REFERENCES reference_images(id)
);

CREATE INDEX IF NOT EXISTS idx_gen_ref_gen_id ON generation_reference_images(generation_id);
CREATE INDEX IF NOT EXISTS idx_gen_ref_ref_id ON generation_reference_images(reference_image_id);
```

#### 1.3 マイグレーションファイル作成
- `migrations/0004_add_reference_images.sql` を作成

### 工程2: バックエンドAPIの拡張

#### 2.1 参照画像アップロードAPI
- **エンドポイント**: `POST /api/reference-images/upload`
- **機能**:
  - 画像ファイルを受け取る
  - SHA-256ハッシュを計算
  - 既存のハッシュと重複チェック
  - R2に保存（`reference-images/{hash}.{ext}`形式）
  - DBにメタデータを保存
  - 画像URLを返す

#### 2.2 参照画像一覧取得API
- **エンドポイント**: `GET /api/reference-images`
- **機能**:
  - ユーザー権限に応じてフィルタリング
  - ユーザー専用、クラス共有、教員固定サンプルを取得
  - サムネイルURLとメタデータを返す

#### 2.3 画像生成APIの拡張
- **エンドポイント**: `POST /api/generate`（既存を拡張）
- **リクエスト構造の拡張**:
```json
{
  "prompt": "string",
  "referenceImages": [
    {
      "id": "string (既存画像ID) または null",
      "file": "File (新規アップロード時)",
      "role": "string (役割ラベル)"
    }
  ],
  "generationOptions": {
    "size": "1024x1024",
    "quality": "standard",
    "style": "vivid",
    "seed": "number (optional)"
  }
}
```

- **処理フロー**:
  1. 新規アップロード画像をR2に保存し、ハッシュを計算
  2. 参照画像のR2オブジェクトキーを取得
  3. プロンプトに役割情報を埋め込む
  4. OpenAI APIに複数画像とプロンプトを送信
  5. 生成画像をR2に保存
  6. DBに生成履歴を保存
  7. 参照画像との紐づけを保存

#### 2.4 プロンプト拡張ロジック
```javascript
function enhancePromptWithRoles(basePrompt, referenceImages) {
    let enhancedPrompt = basePrompt;
    
    referenceImages.forEach((ref, index) => {
        const roleLabel = ref.role;
        const roleDescription = getRoleDescription(roleLabel);
        enhancedPrompt += `\n参照画像${String.fromCharCode(65 + index)}（${roleLabel}）：${roleDescription}`;
    });
    
    return enhancedPrompt;
}

function getRoleDescription(role) {
    const descriptions = {
        '構図': 'この画像のレイアウトとカメラアングルを維持する',
        'スタイル': 'この画像の色調とレンダリングスタイルを適用する',
        '色調': 'この画像の色彩とトーンを反映する',
        '質感': 'この画像の質感とマテリアル感を再現する',
        'ディテール': 'この画像の細部の表現方法を参考にする',
        'その他': 'この画像の特徴を参考にする'
    };
    return descriptions[role] || descriptions['その他'];
}
```

### 工程3: フロントエンドUIの実装

#### 3.1 参照画像スロットUI
- **場所**: `public/index.html`の画像生成フォーム内
- **機能**:
  - 動的なスロット追加・削除
  - 各スロットに画像アップロード機能
  - 役割ラベルの選択（ドロップダウン + 自由記述）
  - サムネイル表示
  - 既存画像からの選択機能（モーダル）

#### 3.2 役割ラベル選択UI
- **固定選択肢**: 構図、スタイル、色調、質感、ディテール、その他
- **自由記述**: 「その他」選択時にテキスト入力欄を表示

#### 3.3 既存画像選択モーダル
- **機能**:
  - ユーザーの参照画像一覧を表示
  - クラス共有画像を表示（権限に応じて）
  - 教員固定サンプルを表示（権限に応じて）
  - 検索・フィルタリング機能

#### 3.4 フォーム送信処理の拡張
- `public/js/main.js`の`handleSubmit`関数を拡張
- FormDataを使用して画像ファイルを送信
- 参照画像情報をJSONとして送信

### 工程4: 履歴表示の拡張

#### 4.1 履歴取得APIの拡張
- **エンドポイント**: `GET /api/history`（既存を拡張）
- **レスポンス構造の拡張**:
```json
{
  "success": true,
  "history": [
    {
      "id": 1,
      "prompt": "string",
      "image_url": "string",
      "generation_options": {},
      "created_at": "datetime",
      "reference_images": [
        {
          "id": 1,
          "image_url": "string",
          "role_label": "string",
          "display_order": 0
        }
      ]
    }
  ]
}
```

#### 4.2 履歴表示UIの拡張
- **場所**: `public/history.html`と`public/js/history.js`
- **機能**:
  - 生成画像カードに参照画像サムネイルを表示
  - 各参照画像に役割ラベルを表示
  - 参照画像のクリックで拡大表示
  - 生成設定の表示

### 工程5: 権限管理の実装

#### 5.1 可視性フラグの管理
- **private**: ユーザー専用（デフォルト）
- **class_shared**: クラス共有
- **teacher_sample**: 教員固定サンプル

#### 5.2 権限チェックロジック
- ユーザー権限に応じた画像フィルタリング
- 教員固定サンプルは教員のみ編集可能

#### 5.3 UIでの権限表示
- 参照画像選択時に権限情報を表示
- 教員固定サンプルモードの切り替え

### 工程6: エラーハンドリングとバリデーション

#### 6.1 フロントエンドバリデーション
- 画像ファイルサイズチェック（最大10MB）
- 画像形式チェック（PNG, JPEG, WebP）
- 参照画像数の上限チェック（最大5枚）
- 役割ラベルの必須チェック

#### 6.2 バックエンドエラーハンドリング
- アップロード失敗時のエラーメッセージ
- R2保存失敗時のエラーメッセージ
- OpenAI APIエラー時の詳細メッセージ
- 段階的なエラー情報の返却

## 実装順序

1. **工程1**: データベーススキーマの拡張（マイグレーション作成・実行）
2. **工程2.1-2.2**: 参照画像アップロード・一覧取得API
3. **工程3.1-3.2**: フロントエンドUI（基本機能）
4. **工程2.3-2.4**: 画像生成APIの拡張
5. **工程3.3-3.4**: 既存画像選択とフォーム送信
6. **工程4**: 履歴表示の拡張
7. **工程5**: 権限管理
8. **工程6**: エラーハンドリングとバリデーション

## 技術的な注意点

### OpenAI APIの制限
- DALL-E 3は複数画像の入力に対応していない可能性がある
- 代替案: プロンプトに参照画像の説明を詳細に埋め込む
- または: DALL-E 2の使用を検討（ただし品質は劣る）

### 画像ハッシュの計算
- SHA-256を使用
- 同一画像の重複保存を防ぐ
- ハッシュ衝突の可能性は極めて低いが、チェックは必要

### R2ストレージ構造
```
r2-bucket/
  ├── images/              # 生成画像
  │   └── {timestamp}-{random}.png
  └── reference-images/    # 参照画像
      └── {hash}.{ext}
```

### パフォーマンス考慮
- 参照画像のサムネイル生成（必要に応じて）
- 画像一覧のページネーション
- キャッシュ戦略の検討

## テスト項目

1. 参照画像のアップロード・保存
2. 複数参照画像での画像生成
3. 役割ラベルのプロンプト埋め込み
4. 履歴表示での参照画像表示
5. 権限管理の動作確認
6. エラーハンドリングの確認

## 今後の拡張性

- マスク指定機能
- 部分再生成機能
- 領域指定編集機能
- 参照画像の編集・削除機能
- 参照画像のコレクション機能
