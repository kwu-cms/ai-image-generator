# 履歴管理の仕組み

## 概要

生成された画像とプロンプトは、以下の2つの場所で管理されています：

1. **画像ファイル**: Cloudflare R2ストレージ
2. **メタデータ**: Cloudflare D1データベース

## データフロー

```
ユーザーがプロンプトを入力
  ↓
Workers APIがOpenAI DALL-E APIを呼び出し
  ↓
生成された画像をダウンロード
  ↓
R2ストレージに画像をアップロード
  ↓
D1データベースにメタデータを保存
  ↓
履歴ページで一覧表示
```

## データベーススキーマ

### images テーブル

```sql
CREATE TABLE images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prompt TEXT NOT NULL,
    image_url TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

- `id`: 自動採番の一意ID
- `prompt`: 画像生成に使用したプロンプト
- `image_url`: R2ストレージ上の画像パス（`/api/image/images/xxx.png`形式）
- `created_at`: 作成日時（自動設定）

## ストレージ構造

### R2バケット構造

```
image-generation-storage/
  └── images/
      ├── 1705123456789-abc123.png
      ├── 1705123457890-def456.png
      └── ...
```

ファイル名の形式: `{タイムスタンプ}-{ランダム文字列}.png`

## APIエンドポイント

### 画像生成

```
POST /api/generate
```

リクエスト:
```json
{
  "prompt": "美しい夕日の風景"
}
```

レスポンス:
```json
{
  "success": true,
  "prompt": "美しい夕日の風景",
  "image_url": "/api/image/images/1705123456789-abc123.png",
  "timing": {
    "total": "25.3",
    "generation": "20.1",
    "download": "2.5",
    "upload": "2.7"
  }
}
```

### 履歴取得

```
GET /api/history
```

レスポンス:
```json
{
  "success": true,
  "history": [
    {
      "id": 1,
      "prompt": "美しい夕日の風景",
      "image_url": "/api/image/images/1705123456789-abc123.png",
      "created_at": "2024-01-15T10:30:00Z"
    },
    ...
  ]
}
```

### 画像配信

```
GET /api/image/{ファイルパス}
```

例: `GET /api/image/images/1705123456789-abc123.png`

## データの保持

- **現在**: データは無期限に保存されます
- **将来の予定**: ログイン機能実装後、ユーザーごとの履歴管理と削除機能を追加予定

## プライバシー

現在のバージョンでは、すべてのユーザーが同じ履歴を共有します。ログイン機能の実装により、ユーザーごとの履歴管理が可能になります。

## パフォーマンス

- **履歴取得**: D1データベースから取得（通常100ms未満）
- **画像表示**: R2ストレージから配信（CDN経由で高速）
- **履歴の並び順**: 作成日時の降順（新しいものから）

## 制限事項

- 現在の実装では削除機能がありません
- ユーザー認証がないため、すべてのユーザーが同じ履歴を見ることができます
- ページネーションは実装されていません（全履歴を一度に取得）

## 今後の改善予定

1. ログイン機能の実装
2. ユーザーごとの履歴管理
3. 画像削除機能
4. ページネーションの実装
5. 検索・フィルタ機能
