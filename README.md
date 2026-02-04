# Glassine

https://github.com/hirossan4049/glassine/blob/main/docs/assets/glassine-demo.webm

ログイン不要の日程調整ツール

## 概要

Glassineは、Cloudflareのエッジインフラストラクチャ上で動作する、モダンで高速な日程調整ツールです。

### 特徴

- **ログイン不要**: アカウント登録なしで即座に利用開始
- **URL共有のみ**: 編集用・閲覧用URLを分離した安全な共有
- **直感的なUI**: スマホ/PC対応、週×時間グリッドでドラッグ&ペイント
- **可否入力**: 参加者は ○（参加可能）△（参加可能かも）×（参加不可）で回答
- **最適枠推薦**: 回答を集計して最適な時間帯を自動推薦
- **動的OGP**: ページ別に最適化されたOG画像とSNSキャッシュ対策
- **モダンスタック**: TypeScript, React, Vite, Cloudflare Pages/Workers/D1/KV

## アーキテクチャ

- **フロントエンド**: React + TypeScript + Vite
- **バックエンド**: Cloudflare Workers (Hono)
- **データベース**: Cloudflare D1 (SQLite)
- **ストレージ**: Cloudflare KV
- **ホスティング**: Cloudflare Pages

## セットアップ

### 前提条件

- Node.js 18以上
- npm または yarn
- Cloudflare アカウント
- Wrangler CLI

### インストール

```bash
# 依存関係のインストール
npm install

# D1データベースの作成
wrangler d1 create glassine-db

# wrangler.tomlのdatabase_idを更新

# データベーススキーマの適用
wrangler d1 execute glassine-db --file=./schema/schema.sql

# KVネームスペースの作成
wrangler kv:namespace create "KV"

# wrangler.tomlのKV idを更新
```

### 開発環境

```bash
# ローカル開発サーバー起動
npm run dev

# ビルド
npm run build

# リント
npm run lint
```

### デプロイ

```bash
# Cloudflare Pagesにデプロイ
npm run build
npm run deploy
```

## 使い方

### イベント作成（主催者）

1. トップページで「新しいイベントを作成」をクリック
2. イベント名と説明を入力
3. グリッド上で候補日時をドラッグして選択（30分単位）
4. 「イベントを作成」をクリック
5. 生成された共有URLを参加者に送信

### 回答（参加者）

1. 主催者から受け取ったURLにアクセス
2. 名前を入力
3. グリッド上で各候補時間の可否を選択
   - クリック/ドラッグで ○ → △ → × → (未選択) の順に変化
4. 「回答を送信」をクリック

### 確定（主催者）

1. 編集用URLで回答状況を確認
2. おすすめ候補日時から最適な時間を選択
3. 「確定」ボタンで決定
4. 閲覧用URLで確定した日時を共有

## 技術詳細

### データモデル

- **Event**: イベント情報（タイトル、説明、トークン）
- **EventSlot**: 候補時間スロット（30分単位）
- **Response**: 参加者の回答
- **ResponseSlot**: 各スロットごとの可否（available/maybe/unavailable）

### セキュリティ

- URLベースのアクセス制御（編集用・閲覧用トークン分離）
- トークンはランダム32文字生成
- SQL injection対策済み
- XSS対策済み

### OGP最適化

- 動的OG画像生成（/og/[eventId].png）
- イベント毎にカスタマイズされたメタデータ
- キャッシュバスティングパラメータでSNS対策

## ライセンス

MIT

## 開発

### コードスタイル

- TypeScript strict mode
- oxlintでリンティング
- 未使用変数は `_` プレフィックス

### E2Eテスト / 録画

- E2Eテスト実行: `npm run test:e2e` (Playwright)
- Docs用デモ録画: `npm run e2e:docs`
  - `BASE_URL` 環境変数で対象URLを指定してください（例: `BASE_URL=http://localhost:4173 npm run e2e:docs`）。自動サーバ起動は行わないため、必要に応じて別途 `npm run preview -- --host --port 4173` などで起動してください。
  - 生成物: `docs/assets/glassine-demo.webm`（READMEから直接再生: [glassine-demo.webm](docs/assets/glassine-demo.webm)）

### 貢献

Issue、Pull Requestを歓迎します。

