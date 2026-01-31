# Glassine クイックスタート

このガイドに従えば、5分でGlassineのローカル開発環境を起動できます。

## 前提条件

- Node.js 18以上がインストールされていること
- npmまたはyarnがインストールされていること

## ステップ1: プロジェクトのセットアップ

```bash
# リポジトリをクローン
git clone https://github.com/hirossan4049/glassine.git
cd glassine

# 依存関係をインストール
npm install
```

## ステップ2: 開発サーバーの起動

```bash
# Vite開発サーバーを起動
npm run dev
```

ブラウザで `http://localhost:5173` にアクセスしてください。

## ステップ3: 機能を試す

### イベントを作成

1. トップページで「新しいイベントを作成」をクリック
2. イベント名を入力（例: "チーム会議"）
3. グリッド上で候補日時をドラッグして選択
4. 「イベントを作成」をクリック

### URLをコピー

作成後、以下のURLが表示されます：
- **編集用URL**: 主催者専用（回答確認・確定）
- **参加者用URL**: 参加者が回答を入力
- **閲覧用URL**: 誰でも結果を閲覧可能

### 参加者として回答

1. 参加者用URLにアクセス
2. 名前を入力
3. グリッド上で可否を選択
   - クリック/ドラッグで ○→△→×→(未選択) と変化
4. 「回答を送信」をクリック

### 主催者として確定

1. 編集用URLにアクセス
2. 回答状況を確認
3. おすすめ候補から最適な時間を選択
4. 「確定」ボタンをクリック

## 次のステップ

### 本番環境へのデプロイ

詳細は [DEPLOYMENT.md](DEPLOYMENT.md) を参照してください。

基本的な手順：

```bash
# ビルド
npm run build

# Cloudflareにデプロイ（Wrangler設定が必要）
wrangler pages deploy dist
```

### 開発に参加する

[CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。

## よくある質問

### Q: データベースのセットアップが必要ですか？

A: ローカル開発では不要です。`npm run dev` だけで動作します。
   本番環境ではCloudflare D1のセットアップが必要です。

### Q: APIエンドポイントはどこにありますか？

A: `functions/api/[[path]].ts` に定義されています。
   Cloudflare Pages Functionsとして動作します。

### Q: モバイルでテストできますか？

A: はい。開発サーバー起動後、同じネットワーク上のスマホから
   `http://[PCのIPアドレス]:5173` にアクセスできます。

## トラブルシューティング

### ポート5173が使用中

```bash
# 別のポートを使用
npm run dev -- --port 3000
```

### ビルドエラー

```bash
# キャッシュをクリアして再インストール
rm -rf node_modules package-lock.json
npm install
```

### 型エラー

```bash
# 型チェックのみ実行
npx tsc --noEmit
```

## サポート

問題が発生した場合は：
1. [README.md](README.md) を確認
2. GitHubで Issue を作成
3. [ARCHITECTURE.md](ARCHITECTURE.md) でシステム構成を理解

## リソース

- **README**: プロジェクト概要
- **FEATURES**: 機能詳細
- **ARCHITECTURE**: システム設計
- **DEPLOYMENT**: デプロイ手順
- **CONTRIBUTING**: 開発ガイド
