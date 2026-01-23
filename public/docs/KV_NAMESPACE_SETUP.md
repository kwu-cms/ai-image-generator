# KV Namespace設定手順

## エラー内容

```
KV namespace '00000000000000000000000000000000' not found. [code: 10041]
```

このエラーは、`wrangler.toml`に設定されているKV namespaceのIDがダミー値のため、実際のKV namespaceが見つからないことを示しています。

## 解決手順

### ステップ1: KV Namespaceを作成

ターミナルで以下を実行：

```bash
cd "/Users/takawo/Library/CloudStorage/Dropbox/260122AIを使った画像生成のウェブページ"
wrangler kv namespace create "SESSIONS"
```

**注意**: コロン（`:`）ではなく、スペースを使用してください。`wrangler kv:namespace`ではなく`wrangler kv namespace`です。

**実行結果の例:**
```
🌀  Creating namespace with title "image-generation-api-SESSIONS"
✨  Success!
Add the following to your configuration file in your kv_namespaces array:
{ binding = "SESSIONS", id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" }
```

### ステップ2: Preview Namespaceを作成（オプション）

開発環境用のpreview namespaceも作成します：

```bash
wrangler kv namespace create "SESSIONS" --preview
```

**注意**: コロン（`:`）ではなく、スペースを使用してください。

**実行結果の例:**
```
🌀  Creating namespace with title "image-generation-api-SESSIONS_preview"
✨  Success!
Add the following to your configuration file in your kv_namespaces array:
{ binding = "SESSIONS", preview_id = "yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy" }
```

### ステップ3: wrangler.tomlを更新

取得したIDを`wrangler.toml`に設定します：

```toml
[[kv_namespaces]]
binding = "SESSIONS"
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"  # ステップ1で取得したID
preview_id = "yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy"  # ステップ2で取得したID（オプション）
```

### ステップ4: 再度デプロイ

```bash
npm run deploy
```

または：

```bash
wrangler deploy
```

## 確認方法

デプロイが成功すると、以下のようなメッセージが表示されます：

```
✨  Successfully published your Worker to the following routes:
  - https://image-generation-api.xxxxx.workers.dev
```

## 注意事項

- KV namespaceは一度作成すると削除できません（データは削除可能）
- 同じ名前のnamespaceは複数作成できません
- 既存のnamespaceがある場合は、そのIDを使用してください

## 既存のKV Namespaceを確認する方法

```bash
wrangler kv namespace list
```

既存のnamespaceがある場合は、そのIDを`wrangler.toml`に設定してください。
