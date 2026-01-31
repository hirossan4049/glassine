# Glassine アーキテクチャ

## システム概要

Glassineは、Cloudflareのエッジインフラストラクチャ上で動作する、完全サーバーレスな日程調整アプリケーションです。

## アーキテクチャ図

```
┌─────────────────────────────────────────────────────────────┐
│                        クライアント                          │
│                   (Browser: React SPA)                      │
└────────────┬────────────────────────────────────────────────┘
             │
             │ HTTPS
             ↓
┌─────────────────────────────────────────────────────────────┐
│                  Cloudflare Pages (Edge)                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Static Assets (HTML, CSS, JS)                       │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Middleware (_middleware.ts)                         │  │
│  │  - OGP Injection                                     │  │
│  │  - Dynamic Metadata                                  │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────┬────────────────────────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────────────────────────┐
│              Cloudflare Workers Functions                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  API Routes (functions/api/[[path]].ts)              │  │
│  │  - Event CRUD                                        │  │
│  │  - Response Management                               │  │
│  │  - Aggregation Logic                                 │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  OG Image Generator (functions/og/[[path]].ts)       │  │
│  │  - Dynamic SVG Generation                            │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────┬────────────────────────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────────────────────────┐
│                    Data Layer (Edge)                        │
│  ┌────────────────────┐      ┌─────────────────────────┐   │
│  │  Cloudflare D1     │      │  Cloudflare KV          │   │
│  │  (SQLite)          │      │  (Key-Value Store)      │   │
│  │  - events          │      │  - Cache (future)       │   │
│  │  - event_slots     │      │                         │   │
│  │  - responses       │      │                         │   │
│  │  - response_slots  │      │                         │   │
│  └────────────────────┘      └─────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## コンポーネント詳細

### 1. フロントエンド (React SPA)

**技術スタック:**
- React 18
- TypeScript
- Vite (ビルドツール)

**主要コンポーネント:**

```
App.tsx
├── CreateEvent.tsx          # イベント作成
│   └── TimeGrid.tsx        # 時間グリッド
├── EditEvent.tsx           # 主催者画面
├── ViewEvent.tsx           # 閲覧画面
└── ParticipantResponse.tsx # 参加者回答
    └── TimeGrid.tsx        # 時間グリッド
```

**ルーティング:**
- `/` - ホーム
- `/create` - イベント作成
- `/e/{id}?token={editToken}` - 編集画面
- `/v/{id}?token={viewToken}` - 閲覧画面
- `/r/{id}?token={viewToken}` - 回答画面

### 2. ミドルウェア層

**Cloudflare Pages Functions Middleware:**

```typescript
functions/_middleware.ts
```

**役割:**
- HTMLレスポンスのインターセプト
- 動的OGPメタデータの注入
- イベント情報に基づいたページカスタマイズ

**処理フロー:**
1. リクエストを受信
2. URLからイベントIDとトークンを抽出
3. D1から イベント情報を取得
4. OGPタグを生成
5. HTMLに注入してレスポンス

### 3. API層 (Workers Functions)

**エンドポイント設計:**

```
POST   /api/events                    # イベント作成
GET    /api/events/:id?token=xxx      # イベント取得
POST   /api/events/:id/responses      # 回答送信
GET    /api/events/:id/aggregation    # 集計取得
POST   /api/events/:id/confirm        # 日程確定
```

**認証フロー:**
```
1. クライアント → token付きでリクエスト
2. API → D1でトークン検証
3. 検証OK → データ返却
4. 検証NG → 401/403エラー
```

### 4. データベース層 (D1)

**スキーマ設計:**

```sql
events
├── id (TEXT, PK)
├── title (TEXT)
├── description (TEXT)
├── edit_token (TEXT)
├── view_token (TEXT)
├── created_at (INTEGER)
├── confirmed_slots (TEXT, JSON)
└── timezone (TEXT)

event_slots
├── id (INTEGER, PK, AUTO)
├── event_id (TEXT, FK)
├── start_time (INTEGER)
└── end_time (INTEGER)

responses
├── id (INTEGER, PK, AUTO)
├── event_id (TEXT, FK)
├── participant_name (TEXT)
└── created_at (INTEGER)

response_slots
├── id (INTEGER, PK, AUTO)
├── response_id (INTEGER, FK)
├── slot_start (INTEGER)
├── slot_end (INTEGER)
└── availability (TEXT: available|maybe|unavailable)
```

**インデックス:**
- `idx_event_slots_event_id`
- `idx_responses_event_id`
- `idx_response_slots_response_id`

### 5. OG画像生成

**エンドポイント:**
```
GET /og/{eventId}.png?token={token}
```

**生成フロー:**
1. イベント情報を取得
2. SVGテンプレートに情報を埋め込み
3. SVGをレスポンス（ブラウザが自動レンダリング）

## データフロー

### イベント作成フロー

```
1. ユーザー → CreateEvent.tsx
   - タイトル、説明入力
   - TimeGridで候補選択

2. CreateEvent → POST /api/events
   - Event情報送信
   - Slots情報送信

3. API → D1
   - eventテーブルにINSERT
   - event_slotsテーブルにINSERT
   - editToken, viewToken生成

4. API → クライアント
   - eventId返却
   - URL生成（editUrl, viewUrl）

5. クライアント → 編集画面へリダイレクト
```

### 参加者回答フロー

```
1. ユーザー → ParticipantResponse.tsx
   - 名前入力
   - TimeGridで可否選択

2. ParticipantResponse → POST /api/events/:id/responses
   - 参加者名送信
   - ResponseSlots送信

3. API → D1
   - responsesテーブルにINSERT
   - response_slotsテーブルにINSERT

4. API → クライアント
   - 成功メッセージ
```

### 集計・確定フロー

```
1. 主催者 → EditEvent.tsx
   - GET /api/events/:id?token=editToken
   - GET /api/events/:id/aggregation?token=editToken

2. API → D1
   - events, slots, responses取得
   - 各slotごとに可否を集計
   - スコア計算（○×2 + △×1）

3. API → クライアント
   - 集計結果返却
   - 上位候補表示

4. 主催者 → 確定ボタンクリック
   - POST /api/events/:id/confirm?token=editToken
   - confirmedSlots送信

5. API → D1
   - eventsテーブルのconfirmed_slotsを更新
```

## セキュリティ

### 認証・認可

**トークンベース認証:**
- 編集用トークン（editToken）: 主催者のみ
- 閲覧用トークン（viewToken）: 全員

**トークン生成:**
```typescript
crypto.getRandomValues(new Uint8Array(32))
// → 暗号学的に安全な乱数
```

### データ保護

**SQLインジェクション対策:**
```typescript
// ✓ Good: プリペアドステートメント
db.prepare('SELECT * FROM events WHERE id = ?').bind(eventId)

// ✗ Bad: 文字列結合
db.prepare(`SELECT * FROM events WHERE id = '${eventId}'`)
```

**XSS対策:**
```typescript
// React: 自動エスケープ
<div>{userInput}</div>

// SVG: 手動エスケープ
const escapeHtml = (text) => text.replace(/[<>&"']/g, ...)
```

## パフォーマンス

### エッジコンピューティング

**メリット:**
- グローバルなエッジロケーションから配信
- レイテンシー最小化
- 自動スケーリング

**Cloudflareネットワーク:**
- 200+ データセンター
- 自動負荷分散
- DDoS保護

### キャッシング戦略

**現在:**
- 静的アセット: Cloudflare CDN
- API: キャッシュなし（動的データ）

**将来的な改善:**
- KVでイベント情報をキャッシュ
- TTL設定で適切に更新
- Stale-While-Revalidate パターン

### データベース最適化

**インデックス:**
- 外部キーにインデックス
- 頻繁なクエリの最適化

**クエリ最適化:**
- N+1問題の回避
- 必要なカラムのみSELECT

## スケーラビリティ

### 水平スケーリング

Cloudflare Pagesは自動的にスケール:
- トラフィック増加に自動対応
- 追加設定不要
- 無制限のリクエスト処理（プランによる）

### データベーススケーリング

**D1の制限（無料プラン）:**
- 5GB ストレージ
- 5M 読み取り/日
- 100K 書き込み/日

**スケーリング戦略:**
1. KVでキャッシング
2. 古いイベントのアーカイブ
3. 有料プランへの移行

## モニタリング

### Cloudflare Analytics

**メトリクス:**
- リクエスト数
- エラー率
- レスポンスタイム
- 帯域幅使用量

### ログ

**Workers Logs:**
- console.log() → Wranglerコンソール
- エラートラッキング
- パフォーマンス分析

## 拡張性

### プラグインアーキテクチャ（将来）

```
plugins/
├── comments/        # コメント機能
├── notifications/   # 通知機能
└── analytics/       # 分析機能
```

### API拡張

```
POST /api/events/:id/comments     # コメント追加
GET  /api/events/:id/stats        # 統計情報
POST /api/events/:id/export       # データエクスポート
```

## デプロイメント

### CI/CD

```
GitHub Push
    ↓
GitHub Actions (future)
    ↓
npm run build
    ↓
wrangler pages deploy
    ↓
Cloudflare Edge Network
```

### 環境分離

- **Development**: ローカルWrangler dev
- **Staging**: Cloudflare Pages preview
- **Production**: Cloudflare Pages main

## 制約と今後の課題

### 現在の制約

1. **D1の制限**: 大規模データには不向き
2. **リアルタイム性**: WebSocket未対応
3. **ファイルアップロード**: 画像アップロードなし

### 今後の改善

1. **パフォーマンス**: KVキャッシング
2. **機能**: コメント、通知、分析
3. **UX**: アニメーション、ローディング
4. **テスト**: 自動テストの追加
