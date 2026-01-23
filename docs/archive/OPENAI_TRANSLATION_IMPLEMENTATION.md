# OpenAI翻訳レイヤー実装計画

## 概要

Stability AI APIが英語のみをサポートしているため、OpenAIテキストモデルを使用して日本語プロンプトを英語に翻訳するレイヤーを実装する。

## 実装方針

### 1. アーキテクチャ

```
フロントエンド（日本語プロンプト）
    ↓
Cloudflare Workers（翻訳レイヤー）
    ├─ 参照画像の役割ラベル → 英語テンプレート変換
    ├─ 学生の自由記述部分 → OpenAI APIで翻訳
    └─ 最終プロンプト組み立て
    ↓
Stability AI API（英語プロンプト）
```

### 2. データベーススキーマ変更

`generations`テーブルに以下のカラムを追加：

```sql
ALTER TABLE generations ADD COLUMN original_prompt_ja TEXT;
ALTER TABLE generations ADD COLUMN translated_prompt_en TEXT;
-- final_prompt は既に存在（英語の最終プロンプト）
```

**フィールド説明:**
- `original_prompt_ja`: フロントエンドから受信した日本語プロンプト（学生の自由記述部分）
- `translated_prompt_en`: OpenAI APIで翻訳された英語プロンプト（学生の自由記述部分のみ）
- `final_prompt`: 参照画像の役割指示を含む最終的な英語プロンプト（Stability AI APIに送信）

### 3. 翻訳処理の実装

#### 3.1 翻訳関数の設計

```javascript
/**
 * OpenAI APIを使用して日本語プロンプトを英語に翻訳
 * @param {string} originalJaText - 日本語プロンプト（学生の自由記述部分）
 * @param {object} env - 環境変数（OPENAI_API_KEYを含む）
 * @returns {Promise<string>} - 翻訳された英語プロンプト
 */
async function translatePromptWithOpenAI(originalJaText, env)
```

**実装要件:**
- システム指示を固定: 「次の日本語テキストを、画像生成モデル向けの簡潔で命令形の英語プロンプトに翻訳せよ。説明文や注釈は含めず、視覚的特徴、構図、質感、光源、スタイルが明確になるように変換せよ。」
- `temperature`: 0.0〜0.3（低めに固定、創作的な意訳を防ぐ）
- `max_tokens`: 合理的な最大値（例: 500）
- エラーハンドリング: 翻訳失敗時は例外をスロー

#### 3.2 翻訳キャッシュ機能

翻訳結果をD1にキャッシュして、同じプロンプトの再生成時にOpenAI APIを呼び出さない。

**キャッシュキー:**
- `original_prompt_ja`のハッシュ値またはテキストそのもの

**キャッシュテーブル（新規作成）:**
```sql
CREATE TABLE IF NOT EXISTS prompt_translations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_prompt_ja TEXT NOT NULL,
    translated_prompt_en TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(original_prompt_ja)
);
CREATE INDEX IF NOT EXISTS idx_prompt_translations_original ON prompt_translations(original_prompt_ja);
```

### 4. プロンプト組み立て処理

1. **参照画像の役割ラベルを英語テンプレートに変換**
   - 既存の`enhancePromptWithRolesEnglish`関数を使用

2. **学生の自由記述部分を翻訳**
   - `translatePromptWithOpenAI`関数を使用
   - キャッシュを確認してから翻訳

3. **最終プロンプトを組み立て**
   - 翻訳された学生の自由記述部分 + 参照画像の役割指示（英語テンプレート）

### 5. エラーハンドリング

**段階別エラーハンドリング:**

1. **翻訳フェーズのエラー**
   - エラーステージ: `translation`
   - エラーメッセージ: 「翻訳サービスに接続できないため生成を実行できません」
   - 生成処理を中断

2. **画像生成フェーズのエラー**
   - エラーステージ: `api_call`
   - エラーメッセージ: 「生成エンジン側でエラーが発生しました」
   - 翻訳は成功しているが、Stability AI API側で失敗

### 6. セキュリティと運用

- **OpenAI APIキー**: Workersの環境変数として保持（既に設定済み）
- **ログ管理**: 原文と翻訳文をログに記録（個人情報や不適切表現に注意）
- **管理画面**: 教員ロールのみが翻訳履歴を閲覧可能（将来的な拡張）

## 実装タスク

### タスク1: データベーススキーマ変更 ✅
- [x] `generations`テーブルに`original_prompt_ja`と`translated_prompt_en`カラムを追加
- [x] `prompt_translations`テーブルを作成（翻訳キャッシュ用）
- [x] マイグレーションファイル作成: `migrations/0007_add_translation_fields.sql`

### タスク2: 翻訳関数の実装 ✅
- [x] `translatePromptWithOpenAI`関数を実装
- [x] システム指示を固定（画像生成向けの簡潔な命令形英語）
- [x] temperature: 0.2、max_tokens: 500を設定
- [x] エラーハンドリングを実装（GenerationErrorを使用）

### タスク3: 翻訳キャッシュ機能の実装 ✅
- [x] `getTranslationFromCache`関数を実装（キャッシュ確認）
- [x] `saveTranslationToCache`関数を実装（キャッシュ保存）
- [x] 翻訳前にキャッシュを確認、翻訳後にキャッシュに保存

### タスク4: プロンプト組み立て処理の変更 ✅
- [x] `handleGenerate`関数を修正
- [x] 参照画像の役割ラベルを英語テンプレートに変換（`enhancePromptWithRolesEnglish`を使用）
- [x] 学生の自由記述部分を翻訳（`translatePromptWithOpenAI`を使用）
- [x] 最終プロンプトを組み立て（翻訳された学生記述 + 参照画像の役割指示）
- [x] データベースに保存（original_prompt_ja、translated_prompt_en、final_prompt）

### タスク5: エラーハンドリングの改善 ✅
- [x] 翻訳フェーズのエラーハンドリングを実装（ステージ: `translation`）
- [x] 画像生成フェーズのエラーハンドリングを実装（ステージ: `api_call`）
- [x] 段階別エラーメッセージを返却

### タスク6: 履歴表示の更新 ✅
- [x] `handleHistory`関数を更新（翻訳情報を含める）
- [x] `handleAllImages`関数を更新（翻訳情報を含める）
- [x] レスポンスに`original_prompt`と`translated_prompt`を追加

### タスク7: テスト ⏭️
- [ ] 翻訳機能のテスト
- [ ] キャッシュ機能のテスト
- [ ] エラーハンドリングのテスト
- [ ] 統合テスト

## 注意事項

1. **課金管理**: OpenAI APIの使用量を監視（翻訳APIのコスト）
2. **レイテンシ**: 翻訳処理が追加されるため、レスポンス時間が増加する可能性
3. **キャッシュ効果**: 同じプロンプトの再生成時はキャッシュを使用してコストとレイテンシを削減
4. **翻訳品質**: システム指示を適切に設定して、画像生成に適した英語プロンプトを生成

## 参考情報

- OpenAI API: https://platform.openai.com/docs/api-reference/chat
- システム指示の設計: 画像生成モデル向けの簡潔で命令形の英語プロンプト
