# Nostr Fortune Slip

[![CI](https://github.com/ocknamo/nostr-fortune-slip/actions/workflows/ci.yml/badge.svg)](https://github.com/ocknamo/nostr-fortune-slip/actions/workflows/ci.yml)

Nostr Fortune Slipは、NostrプロトコルとLightning Networkを統合したウェブアプリケーションです。Zapリクエスト対応のQRコード生成機能を提供します。

## 機能

- **デュアルQRコード表示**: Lightning Invoice QRコードとNostr Event Link QRコード（`nostr:nevent1...`形式）を並列表示
- **Lightning QRコード生成**: Zapリクエスト対応のLightning Invoice QRコードを生成
- **Nostr Event QRコード**: 作成されたkind1イベントへの`nostr:nevent1`リンクをQRコード化
- **Nostr統合**: kind 1イベントの作成・署名・送信、Zapリクエスト（kind 9734）の生成
- **Zap検知機能**: リアルタイムでZap Receiptを検知し、おみくじ結果を表示
- **フォーチュンメッセージ**: Zap検知後に送信者へメンション付きでラッキーナンバー（1-100）を送信
- **設定管理**: ライトニングアドレス、Nostr秘密鍵の安全な管理
- **レスポンシブUI**: モバイルファーストなTailwind CSSベースのデザイン
- **セキュリティ**: LocalStorage使用時の適切な警告表示

## 技術スタック

- **フレームワーク**: [SvelteKit](https://kit.svelte.dev/)
- **言語**: TypeScript
- **スタイリング**: [Tailwind CSS](https://tailwindcss.com/)
- **Nostrライブラリ**: [nostr-tools](https://github.com/nbd-wtf/nostr-tools)
- **QRコード**: [qrcode](https://github.com/soldair/node-qrcode)
- **テスト**: [Vitest](https://vitest.dev/) + [Playwright](https://playwright.dev/)
- **コード品質**: [Biome](https://biomejs.dev/)

## 前提条件

- Node.js 20.x 以上
- npm 10.x 以上

## クイックスタート

### 1. プロジェクトのクローン

```bash
git clone https://github.com/ocknamo/nostr-fortune-slip.git
cd nostr-fortune-slip
```

### 2. 依存関係のインストール

```bash
npm install
```

### 3. 開発サーバーの起動

```bash
npm run dev

# または新しいブラウザタブで開く
npm run dev -- --open
```

### 4. ビルド

```bash
npm run build
```

### 5. プロダクション版のプレビュー

```bash
npm run preview
```

## プロジェクト構造

```
src/
├── lib/                    # コアライブラリ
│   ├── lightning.ts        # Lightning Network関連
│   ├── nostr/              # Nostr関連機能（モジュール化）
│   │   ├── index.ts        # 統合エクスポート
│   │   ├── types.ts        # 型定義
│   │   ├── events.ts       # イベント作成機能
│   │   ├── zap.ts          # Zap関連機能
│   │   ├── fortune.ts      # フォーチュンメッセージ機能
│   │   ├── utils.ts        # ユーティリティ機能
│   │   └── *.spec.ts       # 機能別ユニットテスト
│   ├── qrcode.ts          # QRコード生成
│   └── *.spec.ts          # ユニットテスト
├── routes/                # SvelteKitルート
│   ├── +layout.svelte     # 共通レイアウト
│   ├── +page.svelte       # メイン画面（おみくじ機能）
│   └── settings/          # 設定画面
│       └── +page.svelte
├── app.html               # HTMLテンプレート
└── app.css                # グローバルスタイル
docs/                      # ドキュメント
├── design.md              # 設計ドキュメント
├── nips/                  # Nostr仕様
└── luds/                  # Lightning仕様
```

## テスト

### 全テスト実行

```bash
npm test
```

### テスト分類

- **ユニットテスト**: ライブラリ関数のテスト（Node.js環境）
- **コンポーネントテスト**: Svelteコンポーネントのテスト（Browser環境）
- **E2Eテスト**: エンドツーエンドテスト（Playwright）

```bash
npm run test:e2e
```

## 開発

### コードフォーマット

```bash
# フォーマット実行
npm run format

# フォーマットチェック
npm run format-check
```

### リント

```bash
# リント実行（自動修正あり）
npm run lint

# リントチェック
npm run lint-check
```

### 全修正

```bash
npm run fix
```

## 使い方

### 1. 設定

1. アプリを起動後、「設定画面へ」ボタンをクリック
2. 以下の情報を入力：
   - **ライトニングアドレス**: `user@domain.com` 形式
   - **Nostr秘密鍵**: `nsec1...` 形式
   - **Coinos ID**: Coinosアカウント（現在未使用）
   - **Coinosパスワード**: Coinosパスワード（現在未使用）

### 2. フォーチュンおみくじ

1. メイン画面で「QRコードを生成」ボタンをクリック
2. 以下の処理が自動実行：
   - Nostr kind 1イベントの作成・送信
   - Zapリクエスト（kind 9734）の生成
   - Lightning Invoice（1 sat）の取得
   - QRコードの生成・表示
3. Zapが送金されると：
   - Zap Receipt（kind 9735）を検知
   - ラッキーナンバー（1-100）を生成・表示
   - 送金者に`nostr:npub..`形式でメンション付きフォーチュンメッセージを自動送信

### 3. セキュリティ注意事項

- 設定データはブラウザのLocalStorageに保存されます
- 共用端末では使用後にデータ削除を推奨
- 本格運用前にセキュリティ要件を検討してください

## 対応プロトコル

- **Nostr**: [NIP-01](https://nips.nostr.com/1) (Basic protocol), [NIP-57](https://nips.nostr.com/57) (Lightning Zaps)
- **Lightning**: [LUD-06](https://github.com/lnurl/luds/blob/luds/06.md), [LUD-16](https://github.com/lnurl/luds/blob/luds/16.md)

## ドキュメント

- [設計ドキュメント](docs/design.md) - 詳細な実装解説
- [NIP-57](docs/nips/57.md) - Nostr Zapプロトコル
- [LUD-06](docs/luds/06.md) - LNURL-pay仕様
- [LUD-16](docs/luds/16.md) - Lightning Address仕様

## コントリビューション

1. このリポジトリをフォーク
2. フィーチャーブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. Pull Requestを作成

### コード品質

- 全てのテストを通すこと
- Biomeによるフォーマット・リントルールに従うこと
- TypeScript型チェックを通すこと

## ライセンス

このプロジェクトはMITライセンスの下で公開されています。詳細は[LICENSE](LICENSE)ファイルを参照してください。

## 謝辞

- [nostr-tools](https://github.com/nbd-wtf/nostr-tools) - Nostr操作ライブラリ
- [SvelteKit](https://kit.svelte.dev/) - フルスタックWebフレームワーク
- [Tailwind CSS](https://tailwindcss.com/) - ユーティリティファーストCSSフレームワーク
- [nostter](https://github.com/SnowCait/nostter) - Zapの実装を参考にさせていただきました

## サポート

質問やバグ報告は[GitHub Issues](https://github.com/ocknamo/nostr-fortune-slip/issues)をご利用ください。
