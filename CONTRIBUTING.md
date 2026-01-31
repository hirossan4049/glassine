# Glassine 開発ガイド

## 開発環境のセットアップ

### 必要なツール

- Node.js 18以上
- npm または yarn
- Git
- エディタ（VS Code推奨）

### 初期セットアップ

```bash
# リポジトリのクローン
git clone https://github.com/hirossan4049/glassine.git
cd glassine

# 依存関係のインストール
npm install

# 開発サーバーの起動
npm run dev
```

開発サーバーは `http://localhost:5173` で起動します。

### VS Code推奨拡張機能

- ESLint
- Prettier
- TypeScript and JavaScript Language Features
- Tailwind CSS IntelliSense

## プロジェクト構造

```
glassine/
├── functions/           # Cloudflare Workers Functions
│   ├── api/            # API エンドポイント
│   ├── og/             # OG画像生成
│   └── _middleware.ts  # リクエストミドルウェア
├── schema/             # データベーススキーマ
│   └── schema.sql      # D1テーブル定義
├── src/                # フロントエンドソース
│   ├── components/     # Reactコンポーネント
│   ├── types/          # TypeScript型定義
│   ├── App.tsx         # メインアプリ
│   └── main.tsx        # エントリーポイント
├── public/             # 静的ファイル
├── package.json        # 依存関係
├── tsconfig.json       # TypeScript設定
├── vite.config.ts      # Viteビルド設定
└── wrangler.toml       # Cloudflare設定
```

## コーディング規約

### TypeScript

- **Strict mode**: 常に有効
- **型定義**: 明示的な型アノテーション推奨
- **any禁止**: やむを得ない場合のみ使用
- **命名規則**:
  - コンポーネント: PascalCase
  - 関数: camelCase
  - 定数: UPPER_SNAKE_CASE
  - 型/インターフェース: PascalCase

### React

- **関数コンポーネント**: クラスコンポーネントは使用しない
- **Hooks**: 適切に使用（useEffect, useState, useCallback等）
- **Props**: インターフェースで型定義
- **イベントハンドラ**: handle〜 で命名

### CSS/スタイル

- **インラインスタイル**: 小規模な調整のみ
- **CSS Modules**: 大規模なスタイルはCSSファイルに
- **レスポンシブ**: モバイルファーストで設計

### リンティング

```bash
# リントチェック
npm run lint

# 自動修正（将来的に対応予定）
# npm run lint:fix
```

oxlintを使用しているため、未使用変数は `_` プレフィックスを付けます。

## ブランチ戦略

### メインブランチ

- `main`: 本番環境
- `develop`: 開発環境

### フィーチャーブランチ

```bash
# 新機能開発
git checkout -b feature/機能名

# バグ修正
git checkout -b fix/バグ名

# ドキュメント
git checkout -b docs/ドキュメント名
```

### コミットメッセージ

```
タイプ: 簡潔な説明

詳細な説明（任意）
```

**タイプ:**
- `feat`: 新機能
- `fix`: バグ修正
- `docs`: ドキュメント
- `style`: コードフォーマット
- `refactor`: リファクタリング
- `test`: テスト追加
- `chore`: ビルド・設定変更

**例:**
```
feat: 参加者コメント機能を追加

参加者が各候補時間にコメントを残せるようにした。
データベーススキーマにcommentsテーブルを追加。
```

## テスト

### 現在の状態

現在、自動テストは実装されていません。将来的に追加予定です。

### 手動テスト

新機能を追加した際は、以下を確認してください：

1. **ビルドの成功**
   ```bash
   npm run build
   ```

2. **リントエラーなし**
   ```bash
   npm run lint
   ```

3. **機能の動作確認**
   - イベント作成フロー
   - 参加者回答フロー
   - 主催者確定フロー
   - URL共有機能

4. **レスポンシブ確認**
   - スマートフォン（Chrome DevTools）
   - タブレット
   - デスクトップ

5. **ブラウザ互換性**
   - Chrome
   - Firefox
   - Safari
   - Edge

## データベース開発

### ローカルD1

```bash
# ローカルD1データベースの作成
wrangler d1 create glassine-db-local

# スキーマの適用
wrangler d1 execute glassine-db-local --file=./schema/schema.sql

# SQLクエリの実行
wrangler d1 execute glassine-db-local --command="SELECT * FROM events"
```

### マイグレーション

スキーマ変更時は以下の手順で：

1. `schema/migrations/` に新しいマイグレーションファイルを作成
2. `schema/schema.sql` を更新
3. 本番DBに適用前にローカルでテスト
4. ドキュメントを更新

## デバッグ

### フロントエンド

```javascript
// Console.logでデバッグ
console.log('Debug:', data);

// React DevTools使用
// ブラウザ拡張機能をインストール
```

### バックエンド（Workers）

```typescript
// console.logはWranglerコンソールに出力
console.log('API called:', eventId);

// wrangler dev でローカルテスト
// npm run wrangler:dev
```

## パフォーマンス最適化

### フロントエンド

- **遅延読み込み**: React.lazy()でコード分割
- **メモ化**: useMemo, useCallbackを適切に使用
- **バンドルサイズ**: 不要な依存関係を追加しない

### バックエンド

- **データベースクエリ**: インデックスを適切に使用
- **キャッシュ**: KVで頻繁にアクセスするデータをキャッシュ
- **並列処理**: 可能な限り並列でクエリ実行

## セキュリティ

### 新機能追加時のチェックリスト

- [ ] ユーザー入力のバリデーション
- [ ] HTMLエスケープ処理
- [ ] SQLインジェクション対策（プリペアドステートメント使用）
- [ ] XSS対策
- [ ] CSRF対策（必要に応じて）
- [ ] 適切なアクセス制御

### セキュリティレビュー

Pull Request提出前に：

1. コードレビューツールを実行
2. セキュリティガイドラインに準拠
3. 機密情報の漏洩がないか確認

## Pull Request

### PRの作成

1. フィーチャーブランチで開発
2. コミットをプッシュ
3. GitHubでPRを作成
4. テンプレートに従って記入

### PRレビュープロセス

- コードレビュー
- 動作確認
- セキュリティチェック
- ドキュメント更新確認

### マージ条件

- [ ] ビルドが成功
- [ ] リントエラーなし
- [ ] 最低1人のレビュー承認
- [ ] コンフリクト解消済み
- [ ] ドキュメント更新済み

## リリース

### バージョニング

Semantic Versioning (SemVer) を使用:

- `MAJOR.MINOR.PATCH`
- 例: `1.0.0`, `1.1.0`, `1.1.1`

### リリース手順

1. バージョン番号を更新（package.json）
2. CHANGELOGを更新
3. タグを作成
4. GitHubリリースを作成
5. 本番環境にデプロイ

## トラブルシューティング

### ビルドエラー

```bash
# キャッシュをクリア
rm -rf node_modules package-lock.json
npm install
npm run build
```

### 型エラー

```bash
# 型チェックのみ実行
npx tsc --noEmit
```

### Wranglerエラー

```bash
# Wranglerを最新版に更新
npm update wrangler

# ログイン状態を確認
wrangler whoami
```

## サポート

- **Issue**: GitHubでIssueを作成
- **Discussion**: GitHub Discussionsで質問
- **Email**: [プロジェクトメンテナーのメール]

## ライセンス

MITライセンス - 詳細は [LICENSE](LICENSE) を参照
