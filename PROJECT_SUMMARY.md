# Glassine プロジェクトサマリー

## プロジェクト概要

**Glassine**は、Cloudflareのエッジインフラストラクチャ上で動作する、ログイン不要の高速な日程調整ツールです。

## 実装完了機能

### ✅ コア機能

- [x] ログイン不要のイベント作成
- [x] URLベースのアクセス制御（編集用・閲覧用・参加者用）
- [x] 週×時間グリッドでのドラッグ&ペイント操作
- [x] 30分単位のスロット管理
- [x] 参加者の可否入力（○△×）
- [x] 自動集計と最適枠推薦
- [x] 日程確定機能

### ✅ 技術実装

- [x] TypeScript完全対応（strictモード）
- [x] React 18 + Vite（高速ビルド）
- [x] Cloudflare Pages（ホスティング）
- [x] Cloudflare Workers（API）
- [x] Cloudflare D1（データベース）
- [x] Cloudflare KV（将来のキャッシング用）
- [x] oxlint（リンティング）

### ✅ UI/UX

- [x] モバイル・タブレット・PC対応
- [x] タッチ操作サポート
- [x] マウス操作サポート
- [x] レスポンシブデザイン
- [x] 直感的なグリッドインターフェース

### ✅ OGP/SEO

- [x] 動的OG画像生成（SVG）
- [x] イベント毎のカスタムメタデータ
- [x] SNSシェア最適化
- [x] キャッシュバスティング

### ✅ セキュリティ

- [x] 暗号学的に安全なトークン生成（crypto.getRandomValues）
- [x] SQLインジェクション対策（プリペアドステートメント）
- [x] XSS対策（HTMLエスケープ）
- [x] トークンベース認証
- [x] HTTPS強制（Cloudflare自動対応）

### ✅ ドキュメント

- [x] README.md - プロジェクト概要と使い方
- [x] QUICKSTART.md - 5分で始めるガイド
- [x] DEPLOYMENT.md - 本番環境デプロイ手順
- [x] FEATURES.md - 機能詳細説明
- [x] ARCHITECTURE.md - システム設計書
- [x] CONTRIBUTING.md - 開発貢献ガイド

## プロジェクト構成

```
glassine/
├── functions/              # Cloudflare Workers Functions
│   ├── api/[[path]].ts    # REST API
│   ├── og/[[path]].ts     # OG画像生成
│   └── _middleware.ts     # OGPインジェクション
├── src/                   # React フロントエンド
│   ├── components/        # UIコンポーネント
│   │   ├── CreateEvent.tsx
│   │   ├── EditEvent.tsx
│   │   ├── ViewEvent.tsx
│   │   ├── ParticipantResponse.tsx
│   │   └── TimeGrid.tsx
│   ├── types/index.ts     # 型定義
│   ├── App.tsx            # メインアプリ
│   └── main.tsx           # エントリーポイント
├── schema/                # データベース
│   └── schema.sql         # D1スキーマ定義
├── public/                # 静的ファイル
├── docs/                  # ドキュメント
│   ├── README.md
│   ├── QUICKSTART.md
│   ├── DEPLOYMENT.md
│   ├── FEATURES.md
│   ├── ARCHITECTURE.md
│   └── CONTRIBUTING.md
└── package.json           # 依存関係
```

## 技術スタック詳細

### フロントエンド
- **React 18**: 最新のReact機能
- **TypeScript**: 型安全性
- **Vite**: 高速ビルド・HMR

### バックエンド
- **Hono**: 軽量Webフレームワーク
- **Cloudflare Workers**: エッジコンピューティング
- **D1**: SQLiteベースのエッジDB

### インフラ
- **Cloudflare Pages**: 静的ホスティング
- **Cloudflare CDN**: グローバル配信
- **Edge Network**: 200+拠点

## パフォーマンス指標

### ビルドサイズ
- HTML: ~0.5 KB
- CSS: ~0.4 KB
- JavaScript: ~164 KB（gzip: ~51 KB）

### リンティング
- 7 warnings（意図的な未使用変数）
- 0 errors

### ビルド時間
- ~900ms（平均）

## APIエンドポイント

```
POST   /api/events                    # イベント作成
GET    /api/events/:id                # イベント取得
POST   /api/events/:id/responses      # 回答送信
GET    /api/events/:id/aggregation    # 集計取得
POST   /api/events/:id/confirm        # 日程確定
GET    /og/:id.png                    # OG画像生成
```

## データベーススキーマ

```sql
events (イベント情報)
  - id, title, description
  - edit_token, view_token
  - created_at, confirmed_slots, timezone

event_slots (候補スロット)
  - id, event_id, start_time, end_time

responses (参加者回答)
  - id, event_id, participant_name, created_at

response_slots (可否データ)
  - id, response_id, slot_start, slot_end, availability
```

## 使用方法

### 1. ローカル開発

```bash
git clone https://github.com/hirossan4049/glassine.git
cd glassine
npm install
npm run dev
```

### 2. ビルド

```bash
npm run build
```

### 3. デプロイ

```bash
# Cloudflare D1とKVをセットアップ
wrangler d1 create glassine-db
wrangler kv:namespace create KV

# デプロイ
wrangler pages deploy dist
```

## セキュリティ対策

1. **トークン生成**: `crypto.getRandomValues()`で暗号学的に安全
2. **SQL**: プリペアドステートメントで全クエリ実行
3. **XSS**: React自動エスケープ + 手動エスケープ
4. **HTTPS**: Cloudflare自動強制
5. **アクセス制御**: トークンベース認証

## 今後の拡張案

### 短期（次のバージョン）
- [ ] コメント機能
- [ ] リマインダー通知
- [ ] CSV/iCalエクスポート

### 中期
- [ ] 多言語対応（i18n）
- [ ] カスタムテーマ
- [ ] リアルタイム更新（WebSocket）

### 長期
- [ ] カレンダー連携（Google Calendar等）
- [ ] 投票機能の追加
- [ ] 分析ダッシュボード

## ライセンス

MIT License

## 貢献

プルリクエスト、Issue報告を歓迎します。
詳細は [CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。

## サポート

- GitHub Issues: バグ報告・機能要望
- GitHub Discussions: 質問・議論

## リンク

- リポジトリ: https://github.com/hirossan4049/glassine
- デモ: （デプロイ後に追加）
- ドキュメント: [README.md](README.md)

---

**作成日**: 2026-01-31  
**バージョン**: 0.1.0  
**ステータス**: ✅ 実装完了
