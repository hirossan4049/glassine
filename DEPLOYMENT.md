# Glassine デプロイメントガイド

## Cloudflare Pagesへのデプロイ手順

### 1. Cloudflareアカウントの準備

1. [Cloudflare](https://cloudflare.com)でアカウントを作成
2. Wrangler CLIをインストール
   ```bash
   npm install -g wrangler
   ```
3. Wranglerでログイン
   ```bash
   wrangler login
   ```

### 2. D1データベースのセットアップ

```bash
# D1データベースを作成
wrangler d1 create glassine-db

# 出力されたdatabase_idをメモ
# 例: database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

# wrangler.tomlのdatabase_idを更新
# [[d1_databases]]
# binding = "DB"
# database_name = "glassine-db"
# database_id = "取得したID"

# スキーマを適用
wrangler d1 execute glassine-db --file=./schema/schema.sql

# 本番環境用（--remote フラグを追加）
wrangler d1 execute glassine-db --remote --file=./schema/schema.sql
```

### 3. KVネームスペースのセットアップ

```bash
# KVネームスペースを作成
wrangler kv:namespace create "KV"

# 出力されたIDをメモ
# 例: id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# wrangler.tomlのKV idを更新
# [[kv_namespaces]]
# binding = "KV"
# id = "取得したID"
```

### 4. ビルド

```bash
# 依存関係をインストール
npm install

# プロジェクトをビルド
npm run build

# distディレクトリが生成される
```

### 5. デプロイ

#### 方法1: Wrangler CLIでデプロイ

```bash
# 初回デプロイ
wrangler pages deploy dist --project-name=glassine

# 2回目以降
wrangler pages deploy dist
```

#### 方法2: GitHubと連携（推奨）

1. GitHubにリポジトリをプッシュ
2. Cloudflare Dashboardにログイン
3. Pages > Create a project
4. Connect to Gitを選択
5. リポジトリを選択
6. ビルド設定:
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Deploy command: `npm run deploy` (重要: `wrangler deploy`ではなく`wrangler pages deploy`を使用)
   - Environment variables:
     - なし（D1とKVのbindingはwrangler.tomlから自動取得）
7. Save and Deploy

> **注意**: デプロイコマンドは必ず `npm run deploy` または `wrangler pages deploy dist` を使用してください。
> `wrangler deploy` はWorkersプロジェクト用のコマンドで、Pagesプロジェクトでは動作しません。

### 6. 環境変数の設定（オプション）

Cloudflare Dashboardで以下を設定可能:

- D1データベースのバインディング
- KVネームスペースのバインディング
- カスタム環境変数（必要に応じて）

### 7. カスタムドメインの設定（オプション）

1. Cloudflare Dashboard > Pages > プロジェクト
2. Custom domains タブ
3. Set up a custom domain
4. ドメインを入力（例: glassine.yourdomain.com）
5. DNSレコードが自動設定される

## トラブルシューティング

### D1データベースにアクセスできない

```bash
# データベースの存在確認
wrangler d1 list

# データベースのテーブル確認
wrangler d1 execute glassine-db --command="SELECT name FROM sqlite_master WHERE type='table';"

# リモートDBの確認
wrangler d1 execute glassine-db --remote --command="SELECT name FROM sqlite_master WHERE type='table';"
```

### ビルドエラー

```bash
# node_modulesをクリーンインストール
rm -rf node_modules package-lock.json
npm install

# キャッシュをクリア
npm run build -- --force
```

### デプロイ後に404エラー

- ルーティングが正しく設定されているか確認
- `_middleware.ts`が含まれているか確認
- ビルド出力ディレクトリが`dist`になっているか確認

### API呼び出しエラー

- `functions/api/[[path]].ts`が正しくデプロイされているか確認
- D1バインディングが正しく設定されているか確認
- ブラウザの開発者ツールでネットワークタブを確認

## 本番環境の推奨設定

1. **カスタムドメイン**: 独自ドメインを使用
2. **HTTPSのみ**: 自動的に有効化される
3. **Analyticsの有効化**: Cloudflare Analytics for Pages
4. **プレビューデプロイ**: Pull Requestごとに自動プレビュー
5. **ロールバック**: 必要に応じて以前のデプロイに戻す

## スケーリング

Cloudflare Pagesは自動的にスケールします:

- **無料プラン**: 月間500ビルド、無制限リクエスト
- **Pro/Business**: より多くのビルドとカスタム設定

D1データベースの制限:

- **Free**: 5GB、5M読み取り/日、100K書き込み/日
- **有料プラン**: より大きな制限

## モニタリング

1. Cloudflare Dashboard > Analytics
2. リクエスト数、エラー率、レスポンスタイムを確認
3. Real User Monitoring (RUM) でユーザー体験を把握

## バックアップ

```bash
# D1データベースのバックアップ
wrangler d1 export glassine-db --output=backup.sql --remote

# 復元
wrangler d1 execute glassine-db --remote --file=backup.sql
```
