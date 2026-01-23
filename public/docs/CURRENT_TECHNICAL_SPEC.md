# 現状技術仕様書・開発の要点

## プロジェクト概要

### 目的
教育用途（授業）でのAI画像生成ツール。学生が日本語プロンプトで画像を生成し、参照画像を使用した画像編集・スタイル転送を学習できる。

### 主要機能
1. **画像生成**: テキストプロンプトから画像を生成
2. **参照画像機能**: 最大5枚の参照画像を使用した画像編集・スタイル転送
3. **履歴管理**: 生成履歴の保存・閲覧
4. **ユーザー認証**: 大学メールアドレス（@konan-wu.ac.jp）による認証
5. **日本語プロンプト対応**: OpenAI APIを使用した自動翻訳

---

## 技術スタック

### フロントエンド
- **言語**: HTML5, CSS3, JavaScript (ES6+)
- **フレームワーク**: Bootstrap 5.3.2
- **ホスティング**: Cloudflare Pages（静的ファイル配信）
- **主要ライブラリ**:
  - Bootstrap 5（UIコンポーネント）
  - Canvas API（画像リサイズ）

### バックエンド
- **プラットフォーム**: Cloudflare Workers（サーバーレス関数）
- **言語**: JavaScript (ES6+)
- **API**: RESTful API

### データストレージ
- **データベース**: Cloudflare D1（SQLite互換）
- **オブジェクトストレージ**: Cloudflare R2（画像ファイル保存）
- **セッション管理**: Cloudflare Workers KV

### 外部API
- **画像生成**: Stability AI API（Stable Diffusion XL）
- **翻訳**: OpenAI API（GPT-4o-mini）

### 開発ツール
- **ビルドツール**: Wrangler CLI
- **パッケージマネージャー**: npm
- **バージョン管理**: Git

---

## アーキテクチャ

### システム構成図

```
┌─────────────────┐
│  フロントエンド  │
│ (Cloudflare     │
│  Pages)         │
│  - HTML/CSS/JS  │
└────────┬────────┘
         │ HTTPS
         │ (CORS)
         ▼
┌─────────────────┐
│ Cloudflare      │
│ Workers         │
│ (API Gateway)   │
│                 │
│  ┌──────────┐   │
│  │ 認証処理  │   │
│  └──────────┘   │
│  ┌──────────┐   │
│  │ 翻訳処理  │   │───► OpenAI API
│  └──────────┘   │
│  ┌──────────┐   │
│  │画像生成   │   │───► Stability AI API
│  └──────────┘   │
└─────┬─────┬─────┘
      │     │
      ▼     ▼
┌─────────┐ ┌─────────┐
│ D1 DB   │ │ R2      │
│ (SQLite)│ │ (Storage)│
└─────────┘ └─────────┘
```

### データフロー

#### 画像生成フロー（参照画像あり）

1. **フロントエンド**: ユーザーがプロンプトと参照画像を入力
2. **Workers**: 
   - 参照画像をR2から取得
   - 日本語プロンプトをOpenAI APIで英語に翻訳
   - 参照画像の役割情報をプロンプトに追加
   - プロンプトを最適化（汎用的な強化）
3. **Stability AI API**: image-to-image生成を実行
4. **Workers**: 
   - 生成画像をR2に保存
   - メタデータをD1に保存
5. **フロントエンド**: 結果を表示

#### 画像生成フロー（参照画像なし）

1. **フロントエンド**: ユーザーがプロンプトを入力
2. **Workers**: 
   - 日本語プロンプトをOpenAI APIで英語に翻訳
   - プロンプトを最適化
3. **Stability AI API**: text-to-image生成を実行
4. **Workers**: 
   - 生成画像をR2に保存
   - メタデータをD1に保存
5. **フロントエンド**: 結果を表示

---

## データベーススキーマ

### テーブル構成

#### `users` テーブル
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    student_id TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    reset_token TEXT,
    reset_token_expires DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
);
```

#### `generations` テーブル
```sql
CREATE TABLE generations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_prompt_ja TEXT NOT NULL,        -- 日本語プロンプト（学生の自由記述）
    translated_prompt_en TEXT,              -- 翻訳された英語プロンプト
    final_prompt TEXT NOT NULL,              -- 最終的な英語プロンプト（役割情報含む）
    output_image_r2_key TEXT NOT NULL,       -- R2のオブジェクトキー
    user_id INTEGER NOT NULL,                -- ユーザーID
    generation_settings TEXT,                -- JSON形式の設定
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

#### `reference_images` テーブル
```sql
CREATE TABLE reference_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    image_hash TEXT UNIQUE NOT NULL,         -- SHA-256ハッシュ（重複チェック用）
    r2_object_key TEXT NOT NULL,             -- R2のオブジェクトキー
    visibility TEXT DEFAULT 'private',       -- 'private', 'class_shared', 'teacher_sample'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

#### `generation_reference_images` テーブル
```sql
CREATE TABLE generation_reference_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    generation_id INTEGER NOT NULL,
    reference_image_id INTEGER NOT NULL,
    role_label TEXT NOT NULL,                -- '構図', 'スタイル', '色調', '質感', 'ディテール', 'その他'
    display_order INTEGER NOT NULL,          -- 表示順序
    r2_object_key TEXT NOT NULL,             -- R2のオブジェクトキー（履歴表示用）
    image_hash TEXT NOT NULL,                -- 画像ハッシュ（履歴表示用）
    weight REAL DEFAULT 1.0,                -- 重み（将来の拡張用）
    FOREIGN KEY (generation_id) REFERENCES generations(id),
    FOREIGN KEY (reference_image_id) REFERENCES reference_images(id)
);
```

#### `prompt_translations` テーブル（翻訳キャッシュ）
```sql
CREATE TABLE prompt_translations (
    original_prompt_ja TEXT PRIMARY KEY,
    translated_prompt_en TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## API仕様

### エンドポイント一覧

#### 認証API

**POST /api/auth/register**
- ユーザー登録
- リクエスト: `{ email, password }`
- レスポンス: `{ success, userId, user }`

**POST /api/auth/login**
- ログイン
- リクエスト: `{ email, password }`
- レスポンス: `{ success, user }`（Cookieにセッショントークン設定）

**POST /api/auth/logout**
- ログアウト
- レスポンス: `{ success }`

**GET /api/auth/me**
- 現在のユーザー情報取得
- レスポンス: `{ success, user }`

**POST /api/auth/reset-request**
- パスワードリセットリクエスト
- リクエスト: `{ email }`

**POST /api/auth/reset-password**
- パスワードリセット実行
- リクエスト: `{ token, newPassword }`

**POST /api/auth/change-password**
- パスワード変更（ログイン済みユーザー）
- リクエスト: `{ currentPassword, newPassword }`

#### 画像生成API

**POST /api/generate**
- 画像生成（認証必須）
- リクエスト:
```json
{
  "prompt": "日本語プロンプト",
  "referenceImages": [
    {
      "id": 123,
      "role": "構図"
    }
  ],
  "generationOptions": {
    "quality": "high",  // "standard", "high", "ultra"
    "size": "1024x1024"
  }
}
```
- レスポンス:
```json
{
  "success": true,
  "prompt": "最終的な英語プロンプト",
  "original_prompt": "日本語プロンプト",
  "translated_prompt": "翻訳された英語プロンプト",
  "image_url": "/api/image/generated-images/xxx.png",
  "generation_id": 456,
  "reference_images": [...],
  "timing": {
    "total": "5.2",
    "generation": "4.5",
    "upload": "0.7"
  }
}
```

#### 履歴API

**GET /api/history**
- ユーザーの生成履歴取得（認証必須）
- レスポンス: `{ success, history: [...] }`

**GET /api/images**
- 全画像一覧取得（認証不要）
- レスポンス: `{ success, images: [...] }`

#### 参照画像API

**POST /api/reference-images/upload**
- 参照画像アップロード（認証必須）
- リクエスト: FormData `{ file, visibility }`
- レスポンス: `{ success, reference_image_id, image_url, image_hash, size_warning? }`

**GET /api/reference-images**
- 参照画像一覧取得（認証必須）
- クエリパラメータ: `?visibility=private|class_shared|teacher_sample`
- レスポンス: `{ success, reference_images: [...] }`

#### 画像配信API

**GET /api/image/{r2_object_key}**
- R2から画像を取得して配信
- レスポンス: 画像バイナリ（Content-Type: image/png等）

---

## Stability AI API設定

### 使用エンジン
- **エンジンID**: `stable-diffusion-xl-1024-v1-0`
- **モデル**: Stable Diffusion XL 1.0
- **解像度**: 1024x1024（デフォルト）

### 許可された画像サイズ
```javascript
[
  { width: 1024, height: 1024 },
  { width: 1152, height: 896 },
  { width: 1216, height: 832 },
  { width: 1344, height: 768 },
  { width: 1536, height: 640 },
  { width: 640, height: 1536 },
  { width: 768, height: 1344 },
  { width: 832, height: 1216 },
  { width: 896, height: 1152 }
]
```

### 品質プリセット

#### Standard（標準）
- CFG Scale: 7
- Steps: 30
- 用途: 高速、基本的な品質

#### High（高品質）- デフォルト
- CFG Scale: 7.5
- Steps: 50
- 用途: 推奨、バランス良好

#### Ultra（最高品質）
- CFG Scale: 8
- Steps: 100
- 用途: 最高品質、詳細重視（処理時間が長い）

### image-to-image設定

#### image_strength（動的調整）
- **ポーズ変更がある場合**: 0.15-0.2（プロンプトの影響を強める）
- **表情変更がある場合**: 0.2-0.25
- **小さな変更の場合**: 0.35（参照画像をより保持）

---

## プロンプト処理フロー

### 1. 日本語プロンプトの翻訳

**翻訳API**: OpenAI GPT-4o-mini
**システムプロンプト**: 
```
You are a professional translator specializing in image generation prompts. 
Translate the following Japanese text into a concise, imperative English prompt 
optimized for AI image generation models (such as Stable Diffusion).

Translation rules:
1. Use imperative mood
2. Focus on visual elements
3. Include technical photography/art terms when relevant
4. Preserve specific details: numbers, colors, materials, expressions, poses, camera angles
5. CRITICAL: Emphasize actions, poses, and movements explicitly
6. CRITICAL: For poses like "banzai", translate explicitly as "raising both arms overhead"
7. Use commas to separate visual elements
8. Place the most important visual elements at the beginning
```

**キャッシュ**: 同じプロンプトは`prompt_translations`テーブルから取得

### 2. プロンプトの強化

**汎用的な強化処理**:
- プロンプトのクリーンアップ（余分な空白を削除）
- アクション・ポーズ・表情などの重要な要素を検出
- 重要な要素を先頭に配置

### 3. 参照画像の役割情報追加

**役割ラベル**:
- `構図`: Maintain the layout and camera angle
- `スタイル`: Apply the color tone and rendering style
- `色調`: Reflect the colors and tones
- `質感`: Reproduce the texture and material feel
- `ディテール`: Reference the detail expression method
- `その他`: Reference the characteristics

**注意**: ポーズ変更がある場合、`構図`の役割情報は追加しない（矛盾を避ける）

### 4. 人物の同一性保持

**明示的な指示を追加**:
```
"Maintain the exact same person from the reference image, 
including facial features, age, and appearance, [元のプロンプト]"
```

---

## 画像処理

### 参照画像のリサイズ

**フロントエンドで実装**:
- Canvas APIを使用
- 許可されていないサイズの画像を自動的にリサイズ
- レターボックス方式（アスペクト比を維持）
- 最も近い許可サイズを自動選択

**処理フロー**:
1. 画像サイズを取得
2. 許可サイズかチェック
3. 許可されていない場合、最も近い許可サイズを選択
4. Canvas APIでリサイズ
5. リサイズ情報をユーザーに表示

### 画像サイズチェック

**サーバー側**:
- 参照画像アップロード時にサイズをチェック
- 許可されていないサイズの場合は警告を返す
- 画像生成時にサイズを再チェック

---

## エラーハンドリング

### GenerationErrorクラス

```javascript
class GenerationError extends Error {
    constructor(message, stage, details = null, retryAfter = null) {
        super(message);
        this.stage = stage; // 'reference_image_save', 'api_call', 'output_image_save', 'db_record'
        this.details = details;
        this.retryAfter = retryAfter; // レート制限時の再試行までの秒数
    }
}
```

### エラーステージ

- `reference_image_save`: 参照画像の保存エラー
- `translation`: 翻訳エラー
- `api_call`: Stability AI API呼び出しエラー
- `output_image_save`: 生成画像の保存エラー
- `db_record`: データベース記録エラー

### レート制限処理

- 429エラー: `Retry-After`ヘッダーを確認し、エラーレスポンスに含める
- 402エラー: クレジット不足エラー

---

## セキュリティ

### 認証・認可

- **セッション管理**: Workers KVを使用
- **パスワード**: bcryptjsでハッシュ化
- **メールアドレス検証**: `@konan-wu.ac.jp`ドメインのみ許可
- **学籍番号**: メールアドレスから自動抽出

### CORS設定

- 許可されたオリジンのみアクセス可能
- ローカルホストは開発環境で自動許可
- credentials: 'include'を使用

### 入力検証

- プロンプト: 空文字チェック
- 参照画像: 最大5枚、ファイルサイズ10MB以下
- 画像形式: PNG, JPEG, WebPのみ

---

## パフォーマンス最適化

### 翻訳キャッシュ

- 同じプロンプトはデータベースから取得
- OpenAI API呼び出しを削減

### 画像の重複チェック

- SHA-256ハッシュで参照画像の重複を検出
- 既存画像の場合は再アップロードをスキップ

### 画像配信

- R2から直接配信
- Cache-Controlヘッダーで1年間キャッシュ

---

## 開発の要点

### 1. 教育用途での考慮事項

- **正確性が最優先**: 学生の学習効果を考えると、指示通りの結果が重要
- **再現性**: 同じ条件で同じ結果が得られることが重要
- **コスト**: 教育用途ではコストも重要な要素

### 2. 現在の制約と課題

#### Stable Diffusion XLの制約
- **image-to-imageの限界**: 入力画像の構造を大きく変更するのが困難
- **ポーズ変更の困難**: 構造的な変更のため、特に難しい
- **人物の同一性保持**: 顔の特徴を保持するための明示的な仕組みが必要

#### 品質の課題
- **DALL-E 3との比較**: 指示追従の精度が低い
- **プロンプトへの忠実度**: 改善の余地がある
- **人物の同一性**: 年齢や特徴が変わってしまう場合がある

### 3. 実装上の注意点

#### image_strengthの調整
- プロンプトの内容に応じて動的に調整
- ポーズ変更などの大きな変更には低い値（0.15-0.2）が必要
- ただし、下げすぎると人物の特徴が失われる

#### プロンプト構造
- 重要な指示を先頭に配置
- 矛盾する指示を避ける（例: ポーズ変更と構図維持）
- 人物の同一性を明示的に指示

#### 参照画像の扱い
- 現在は最初の1枚のみを使用（複数枚の情報が活用されていない）
- 役割ラベルに応じた処理が必要

### 4. 今後の改善方向性

#### 短期改善
- image_strengthの動的調整（実装済み）
- プロンプト構造の改善（実装済み）
- 人物の同一性を明示的に指示（実装済み）

#### 中期改善
- ControlNetの導入（ポーズ制御）
- Inpaintingの活用（顔部分をマスクして保持）
- 複数ステップ生成

#### 長期改善
- DALL-E 3への回帰検討
- ハイブリッドアプローチ（参照画像なしはDALL-E 3、ありはStability AI）
- 複数モデルの選択肢提供

---

## デプロイメント

### 環境変数（Secrets）

```bash
# Stability AI API
STABILITY_AI_API_KEY

# OpenAI API（翻訳用）
OPENAI_API_KEY

# R2（自動設定、通常は不要）
R2_BUCKET_NAME
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
```

### デプロイコマンド

```bash
# Workers APIのデプロイ
npm run deploy

# Pages（フロントエンド）のデプロイ
npm run pages:deploy
```

### ローカル開発

```bash
# Workers API
npm run dev

# 静的ファイル（別ターミナル）
cd public
npx http-server -p 8080 --cors
```

---

## ファイル構成

```
/
├── wrangler.toml              # Cloudflare Workers設定
├── package.json               # 依存関係定義
├── src/
│   ├── worker.js             # Workers API（メイン、約2500行）
│   └── auth.js               # 認証関連関数
├── migrations/               # データベースマイグレーション
│   ├── 0001_create_images.sql
│   ├── 0002_add_users_and_auth.sql
│   ├── 0003_add_password_reset.sql
│   ├── 0004_add_reference_images.sql
│   ├── 0005_rename_images_to_generations.sql
│   ├── 0006_extend_generation_reference_images.sql
│   └── 0007_add_translation_fields.sql
├── public/                   # 静的ファイル（Pages用）
│   ├── index.html            # メインページ（画像生成）
│   ├── history.html          # 履歴表示ページ
│   ├── login.html            # ログインページ
│   ├── register.html         # 登録ページ
│   ├── settings.html         # 設定ページ
│   ├── guide.html            # ガイドページ
│   ├── docs.html             # ドキュメントビューア
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── main.js           # メインページのJavaScript
│       ├── history.js        # 履歴ページのJavaScript
│       ├── auth.js           # 認証関連
│       ├── login.js          # ログイン処理
│       ├── register.js       # 登録処理
│       ├── settings.js       # 設定処理
│       ├── reset-password.js # パスワードリセット
│       ├── navbar.js         # ナビゲーションバー
│       ├── icons.js          # アイコン処理
│       ├── animations.js     # アニメーション
│       ├── docs.js           # ドキュメントビューア
│       ├── email-autocomplete.js # メールアドレス自動補完
│   └── docs/                 # ドキュメント（Markdown）
└── docs/                     # 開発ドキュメント
```

---

## 主要な定数・設定

### API設定
```javascript
const STABILITY_AI_BASE_URL = 'https://api.stability.ai';
const STABILITY_AI_ENGINE = 'stable-diffusion-xl-1024-v1-0';
```

### 品質プリセット
```javascript
const QUALITY_PRESETS = {
    standard: { cfg_scale: 7, steps: 30, width: 1024, height: 1024 },
    high: { cfg_scale: 7.5, steps: 50, width: 1024, height: 1024 },
    ultra: { cfg_scale: 8, steps: 100, width: 1024, height: 1024 }
};
```

### 制限値
- 参照画像の最大数: 5枚
- ファイルサイズの最大: 10MB
- 許可された画像形式: PNG, JPEG, WebP

---

## 参考資料

- [Stability AI API Documentation](https://platform.stability.ai/docs)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)
- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)

---

## 更新履歴

- 2026-01-23: 現状の技術仕様書を作成
- 品質改善の実装（image_strength動的調整、プロンプト構造改善）
- Ultra品質の追加
- 画像リサイズ機能の追加
