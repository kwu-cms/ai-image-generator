# Cursor向け実装指示書

本ドキュメントは、現行のCloudflare Workers + Pages + D1 + R2構成を維持したまま、OpenAI APIによる「参照画像付き画像生成・編集」機能を正式に組み込むための設計変更点および実装要件を整理したものである。Stability AI APIは将来的に併用可能なオプションとして残し、編集系処理はOpenAI APIを主経路とする。

---

## 1. 全体方針

本システムでは、意味理解を伴う編集処理（同一人物保持、ポーズ変更、表情変更、部分的な構造編集）をOpenAI APIに委譲し、スタイル生成や参照画像を伴わない純生成については将来的にStability AI APIへルーティング可能なハイブリッド構成を前提とする。現段階の実装では、参照画像が存在する場合は必ずOpenAI APIの画像編集フローを通過させる。

設計上の目的は、学生が日本語で自然言語的に指示した内容が、構造的な編集であっても高い再現性で反映される体験を保証することにある。パラメータ調整やプロンプト工夫に依存した挙動ではなく、APIレベルで「編集」という意味論的処理を提供しているモデルを前提に設計を行う。

---

## 2. アーキテクチャ変更概要

### 現行構成

- 翻訳: OpenAI API
- 生成: Stability AI API（text-to-image / image-to-image）

### 新構成

- 翻訳: OpenAI API
- 編集・参照画像付き生成: OpenAI Images API（Edit / Variation系）
- 純生成（参照画像なし）: OpenAI Images API（Generate）
- Stability AI API: 将来的なスタイル生成・大量生成用途として保持

### ルーティング方針

Workers側で以下の条件分岐を実装する。

- `referenceImages.length > 0` の場合
  - OpenAI Images API（編集モード）を使用
- `referenceImages.length === 0` の場合
  - OpenAI Images API（生成モード）を使用

将来的に、コスト最適化や用途別切替を行う場合は、この分岐点にStability AIへのフォールバックまたは選択ロジックを追加する。

---

## 3. OpenAI API機能マッピング

### 使用エンドポイント

OpenAI公式Images APIを使用する。

- Generate（参照画像なし）
- Edit（参照画像あり + マスク任意）
- Variation（同一画像の派生生成）

### 基本動作

参照画像付き編集では、OpenAI側に「ベース画像」と「編集指示」を同時に送信する。必要に応じてマスク画像を併用し、編集対象領域を限定する。

---

## 4. Workers実装要件

### 新規モジュール

`src/openai-image.js` を新設し、以下の責務を集約する。

- OpenAI APIクライアント初期化
- Generate / Edit / Variation のリクエストラッパー
- レート制限・エラーハンドリングの正規化

### 関数構成

```
async function generateImage(promptEn, options)
async function editImage(promptEn, baseImageBuffer, maskBuffer, options)
async function variationImage(baseImageBuffer, options)
```

Workersの `/api/generate` エンドポイントでは、ルーティング判定後、上記関数のいずれかを呼び出す。

---

## 5. プロンプト処理フロー（OpenAI向け）

### 翻訳

既存の `prompt_translations` テーブルと翻訳キャッシュ機構は維持する。翻訳時のシステムプロンプトは「Stable Diffusion最適化」前提の文言を削除し、「画像編集向け意味指示最適化」に変更する。

### 翻訳システムプロンプト案

```
You are a professional translator for AI image editing systems.
Translate the following Japanese instruction into a clear, imperative English command
that describes what should be visually changed in the image.

Rules:
1. Focus on what to modify, not on style tags
2. Be explicit about actions, poses, facial expressions, and objects
3. Preserve identity-related instructions
4. Keep it concise and direct
```

---

## 6. 人物同一性保持の扱い

OpenAI APIでは、Stable Diffusionと異なり、明示的なidentityプロンプトよりも「参照画像＋編集指示」という構成そのものが同一性保持の主機構となる。そのため、既存の

"Maintain the exact same person from the reference image"

といった定型文は、必須ではなく補助的な意味付けとしてのみ残す。

設計上は以下を前提とする。

- 顔や年齢感を強く保持したい場合
  - マスクで顔領域を除外し、身体側のみ編集する
- 全体編集の場合
  - マスクなしで編集APIを呼び出す

---

## 7. マスク機構の実装

### フロントエンド

将来的な拡張として、Canvasベースの簡易マスクUIを追加可能な構造にしておく。現段階では、以下の二段階運用を前提とする。

- デフォルト: マスクなし（全体編集）
- 教員モード / 高度編集モード: 顔固定用マスクを自動生成または手動指定

### バックエンド

`editImage()` 関数は、`maskBuffer` が存在する場合のみ `image[]` と `mask` を同時送信する設計とする。

---

## 8. APIリクエスト仕様（OpenAI）

### Generate

```
POST /v1/images/generations

{
  "model": "gpt-image-1",
  "prompt": "...",
  "size": "1024x1024"
}
```

### Edit

```
POST /v1/images/edits

FormData:
- image: base image
- mask: optional mask image
- prompt: English instruction
- size: 1024x1024
```

---

## 9. データベース拡張

### generationsテーブル拡張

以下のカラムを追加する。

```
ALTER TABLE generations ADD COLUMN model_provider TEXT DEFAULT 'openai';
ALTER TABLE generations ADD COLUMN model_name TEXT;
ALTER TABLE generations ADD COLUMN edit_mode TEXT; -- generate | edit | variation
```

これにより、将来的にStability / OpenAIの混在履歴を区別可能にする。

---

## 10. エラーハンドリング方針

### OpenAI固有エラー分類

- 401: APIキー不正
- 429: レート制限
- 400: 入力形式エラー（画像形式・サイズ・マスク不整合）
- 500系: OpenAI側障害

既存の `GenerationError` クラスに以下の `stage` を追加する。

- `openai_api_call`
- `mask_processing`

---

## 11. パフォーマンス設計

OpenAI APIはStability AIよりもレイテンシが安定しているが、画像アップロードを伴うEditリクエストでは、R2 → Workers → OpenAI というデータ転送コストが支配的になる。

以下を必須対応とする。

- R2取得画像は必ずメモリ上でバッファ化し、ディスク書き込みを行わない
- マスク未使用時は `mask` フィールドを送信しない
- size指定は常に1024系に正規化する

---

## 12. フロントエンドUI変更点

### モード表示

生成画面に以下の表示を追加する。

- 「編集モード（OpenAI）」: 参照画像あり
- 「生成モード（OpenAI）」: 参照画像なし

学生に対して、処理系が変わることを明示することで、結果の安定性とコスト意識を教育的に可視化する。

---

## 13. 将来拡張フック

Workersのルーティング層は、以下のような構造にしておく。

```
if (referenceImages.length > 0) {
  return openaiEdit(...)
} else if (options.forceStability) {
  return stabilityGenerate(...)
} else {
  return openaiGenerate(...)
}
```

これにより、管理者設定や授業単位でモデル選択を切り替える設計が可能になる。

---

## 14. 実装優先順位

### フェーズ1

- OpenAI Images API Generate実装
- OpenAI Images API Edit実装
- DB拡張
- Workersルーティング分岐

### フェーズ2

- マスク対応
- UIモード表示
- 教員向け詳細設定

---

## 15. 成功基準

本改修の成功は、以下の条件を満たすことで判定する。

- 日本語指示でポーズ変更・表情変更が高確率で反映される
- 同一人物性（顔・年齢感・雰囲気）が大きく崩れない
- Ultra品質設定時でも、平均応答時間が現行Stability構成以下に収まる
- 生成履歴で使用モデルと編集モードが明示的に追跡可能

---

## 16. Cursorへの作業指示要約

このドキュメントを前提として、以下を実装すること。

- Stability API呼び出しロジックを抽象化し、OpenAI Images APIを第一選択に変更
- `/api/generate` にモデルルーティング層を追加
- OpenAI用の画像生成・編集ラッパーモジュールを新設
- generationsテーブルにモデル識別用カラムを追加
- 翻訳システムプロンプトを「画像編集向け」に変更
- フロントエンドに編集モード表示を追加

---

本ドキュメントは、現行技術仕様書を前提とした差分設計として扱うこと。実装後は、教育現場での再現性と操作性を最優先に、ログおよび履歴データをもとに継続的な調整を行う。