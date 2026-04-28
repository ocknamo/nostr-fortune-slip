# Nostr Fortune Slip

[![CI](https://github.com/ocknamo/nostr-fortune-slip/actions/workflows/ci.yml/badge.svg)](https://github.com/ocknamo/nostr-fortune-slip/actions/workflows/ci.yml)

Nostr Fortune Slipは、NostrプロトコルとLightning Networkを統合したウェブアプリケーションです。Zapリクエスト対応のQRコード生成機能を提供します。

[nostr-fortune-slip](https://ocknamo.github.io/nostr-fortune-slip/)

## 機能

- **Lightning QRコード生成**: Zapリクエスト対応のLightning Invoice QRコードを生成
- **Nostr統合**: kind 1イベントの作成・署名、Zapリクエスト（kind 9734）の生成
- **NIP-07対応**: ブラウザ拡張（nos2x, Albyなど）による署名に対応。秘密鍵の入力不要
- **Zap先公開鍵指定**: npub形式で相手の公開鍵を指定し、kind:0からlud16を取得してZap
- **Payment ID追跡**: ランダムな8byte値（base64url形式）をZapコメントに埋め込み、支払い検証に使用
- **Zap検知機能**: リアルタイムでZap Receiptを検知し、おみくじ結果を表示
- **Coinos API検証**: Zapレシート受信後にCoinos APIで入金を追加検証（preimage照合）
- **Coinosポーリング**: Zapサブスクリプションのフォールバックとして、Coinos APIを定期監視
- **並列検知**: Zapサブスクリプションとポーリングを同時実行、いずれかで支払いを検知
- **稲妻演出**: Canvas フラクタル描画による稲妻アニメーション（黄金+紫ボルト）
- **紙吹雪演出**: おみくじ結果に応じて紙吹雪の表示/非表示を切り替え
- **おみくじアニメーション**: Lottie-webを使用した視覚的なおみくじアニメーション表示
- **カスタマイズ可能なくじ**: くじの範囲（最小値・最大値）とテキスト内容を自由に設定可能
- **テストモード**: Zapなしでおみくじを引ける。ライトニングアドレス・秘密鍵未設定でも動作
- **リレー設定**: 管理画面からリレーを編集可能。NIP-65（kind:10002）からの同期にも対応
- **Nostr紹介**: おみくじ結果画面にNostr紹介QRコード（welcome.nostr-jp.org）を表示
- **自動リセット機能**: おみくじ結果表示後、5分で自動的に初期画面に戻る
- **設定管理**: ライトニングアドレス、Nostr秘密鍵/NIP-07、Zap先npub、リレー、Zap金額の管理
- **PIN保護**: 設定画面へのアクセスを4桁のPINコードで保護
- **エラー表示**: Coinos API検証エラーやリレー接続エラーを画面に表示
- **レスポンシブUI**: モバイルファーストなTailwind CSSベースのデザイン
- **セキュリティ**: LocalStorage使用時の適切な警告表示

## 技術スタック

- **フレームワーク**: [SvelteKit](https://kit.svelte.dev/) 2.x (Svelte 5)
- **言語**: TypeScript
- **スタイリング**: [Tailwind CSS](https://tailwindcss.com/) 4.x
- **Nostrライブラリ**: [nostr-tools](https://github.com/nbd-wtf/nostr-tools)
- **QRコード**: [qrcode](https://github.com/soldair/node-qrcode)
- **アニメーション**: [Lottie-web](https://github.com/airbnb/lottie-web), [canvas-confetti](https://github.com/catdad/canvas-confetti)
- **エンコーディング**: [bech32](https://github.com/bitcoinjs/bech32)
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
├── lib/                       # コアライブラリ
│   ├── nostr/                 # Nostr関連機能（モジュール化）
│   │   ├── index.ts           # 統合エクスポート
│   │   ├── types.ts           # 型定義
│   │   ├── events.ts          # イベント作成機能（秘密鍵/NIP-07両対応）
│   │   ├── zap.ts             # Zap関連機能
│   │   ├── fortune.ts         # フォーチュンメッセージ・紙吹雪判定
│   │   ├── random.ts          # ランダムbase64url生成
│   │   ├── relay.ts           # リレー管理機能
│   │   ├── metadata.ts        # kind:0メタデータ取得・npubデコード
│   │   ├── nip07.ts           # NIP-07署名・kind:10002リレー同期
│   │   └── *.spec.ts          # 機能別ユニットテスト
│   ├── coinos/                # Coinos API連携
│   │   ├── index.ts           # 統合エクスポート
│   │   ├── api.ts             # Coinos API機能
│   │   ├── polling.ts         # ポーリング機能
│   │   ├── types.ts           # 型定義
│   │   └── *.spec.ts          # ユニットテスト
│   ├── components/            # Svelteコンポーネント
│   │   ├── OmikujiAnimation.svelte   # おみくじアニメーション
│   │   └── LightningReveal.svelte    # 稲妻＋紙吹雪演出
│   ├── qrcode.ts              # QRコード生成
│   ├── assets/                # 静的アセット
│   │   ├── background.jpg     # 背景画像
│   │   ├── lightning-icon.svg # Lightningアイコン
│   │   ├── settings.svg       # 設定アイコン
│   │   └── omikuji-anime-data.json  # Lottieアニメーションデータ
│   └── *.spec.ts              # ユニットテスト
├── routes/                    # SvelteKitルート
│   ├── +layout.svelte         # 共通レイアウト
│   ├── +layout.ts             # レイアウトロジック
│   ├── +page.svelte           # メイン画面（おみくじ機能）
│   └── settings/              # 設定画面
│       ├── +page.svelte
│       ├── settings.ts        # 設定バリデーション・ヘルパー
│       └── settings.spec.ts   # 設定テスト
├── app.html                   # HTMLテンプレート
└── app.css                    # グローバルスタイル
docs/                          # ドキュメント
├── design.md                  # 設計ドキュメント
├── nips/                      # Nostr仕様
│   └── 57.md
└── luds/                      # Lightning仕様
    ├── 06.md
    └── 16.md
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

1. アプリを起動後、設定アイコン（⚙️）をクリック
2. 初回は4桁のPINコード入力を求められます（デフォルト: `0000`）
3. 以下の情報を入力：

   **Nostr署名（いずれか）**
   - **NIP-07ログイン**: ブラウザ拡張（nos2x, Albyなど）で署名。秘密鍵の入力不要
   - **Nostr秘密鍵**: `nsec1...` 形式（NIP-07が使えない場合）

   **Zap先（いずれか）**
   - **Zap先の公開鍵（npub）**: 相手のkind:0からlud16を取得してZap（デフォルト: OpenSats）
   - **ライトニングアドレス**: `user@domain.com` 形式（npub未設定時に使用、デフォルト: OpenSats）

   **オプション設定**
   - **Coinos Read-Only API Token**: 支払い検証用（⚠️ Read-Onlyトークンのみ使用）
   - **Zap金額**: おみくじを引くために必要なsats数（1〜1000、デフォルト: 100）
   - **リレー設定**: Zap Receipt監視に使用するリレー（NIP-65同期にも対応）
   - **テストモード**: Zapなしでおみくじを引ける

   **おみくじ設定**
   - **紙吹雪を表示する内容**: カンマ区切り（デフォルト: `大吉,中吉,小吉,吉,末吉`）
   - **紙吹雪を表示しない内容**: カンマ区切り（デフォルト: `凶,大凶`）
   - **紙おみくじ番号設定**: 最小値・最大値の範囲（例: 1〜20）

### 2. フォーチュンおみくじ

1. メイン画面で「Pray for XX sats」ボタンをクリック（XXは設定したZap金額）
2. 以下の処理が自動実行：
   - Nostr kind 1イベントの作成
   - Zapリクエスト（kind 9734）の生成（NIP-07またはnsecで署名）
   - Lightning Invoice（設定金額）の取得
   - QRコードの生成・表示
3. QRコードをスキャンして指定金額を送金
4. Zapが検知されると：
   - おみくじアニメーションを表示
   - 稲妻演出（フラクタル雷）を表示
   - 紙吹雪あり内容の場合は紙吹雪も表示
   - 設定範囲内のランダムな数字と対応テキストを表示
   - Nostr紹介QRコードを結果の横に表示
   - 5分後に自動的に初期画面に戻る

### 3. セキュリティ注意事項

- 設定データはブラウザのLocalStorageに保存されます
- 共用端末では使用後にデータ削除を推奨
- 本格運用前にセキュリティ要件を検討してください

## 対応プロトコル

- **Nostr**: [NIP-01](https://nips.nostr.com/1) (Basic protocol), [NIP-07](https://nips.nostr.com/7) (Browser extension signing), [NIP-57](https://nips.nostr.com/57) (Lightning Zaps), [NIP-65](https://nips.nostr.com/65) (Relay List Metadata)
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

## GitHub Pagesへのデプロイ

このプロジェクトはGitHub Pagesへの自動デプロイに対応しています。

### デプロイの設定

1. GitHubリポジトリで「Settings」→「Pages」を開く
2. Source: 「GitHub Actions」を選択
3. mainブランチにプッシュすると自動的にデプロイされます

### デプロイワークフロー

`.github/workflows/deploy.yml`でGitHub Pagesへの自動デプロイが設定されています：

- **トリガー**: mainブランチへのプッシュ
- **ビルド**: SvelteKitで静的サイト生成（`npm run build`）
- **デプロイ**: buildディレクトリの内容をGitHub Pagesに公開

### 手動デプロイ

GitHub Actions画面から「Deploy to GitHub Pages」ワークフローを手動実行することも可能です。

## ライセンス

このプロジェクトはMITライセンスの下で公開されています。詳細は[LICENSE](LICENSE)ファイルを参照してください。

## 謝辞

- [nostr-tools](https://github.com/nbd-wtf/nostr-tools) - Nostr操作ライブラリ
- [SvelteKit](https://kit.svelte.dev/) - フルスタックWebフレームワーク
- [Tailwind CSS](https://tailwindcss.com/) - ユーティリティファーストCSSフレームワーク
- [canvas-confetti](https://github.com/catdad/canvas-confetti) - 紙吹雪ライブラリ
- [nostter](https://github.com/SnowCait/nostter) - Zapの実装を参考にさせていただきました

## サポート

質問やバグ報告は[GitHub Issues](https://github.com/ocknamo/nostr-fortune-slip/issues)をご利用ください。
