# Nostr Fortune Slip 設計ドキュメント

## プロジェクト概要

Nostr Fortune Slipは、NostrプロトコルとLightning Networkを統合したおみくじアプリケーションです。ユーザーが 100 satを支払うと、クライアント単独で支払いを検知して1-20のラッキーナンバーが表示されます。PaymentID追跡とCoinosポーリングによるフォールバック機能も備えています。このドキュメントでは、設定画面、メイン画面、フォーチュンメッセージ機能、およびモジュール化されたコード構造の設計・実装について説明します。

## 技術スタック

- **フレームワーク**: SvelteKit
- **スタイリング**: Tailwind CSS
- **言語**: TypeScript
- **ストレージ**: ブラウザのLocalStorage

## 要件定義

### 画面構成

1. **メイン画面** (`/`)
   - QRコード生成ボタン
   - 生成されたQRコードの表示エリア
   - 設定画面への遷移ボタン
   
2. **設定画面** (`/settings`)
   - 設定フォーム
   - データの永続化

### 設定項目

- **ライトニングアドレス**: メールアドレス形式でのバリデーション
- **Nostr秘密鍵**: nsec形式での入力
- **Coinos ID**: 必須入力（今回の機能では使用しない）
- **Coinosパスワード**: 必須入力、表示/非表示切り替え機能付き（今回の機能では使用しない）

### 機能要件

#### 設定画面機能
- フォームバリデーション
- LocalStorageへのデータ保存
- 保存成功時の確認メッセージ表示
- 設定画面からメイン画面への戻る機能
- セキュリティ警告の表示
- データ削除機能（確認ダイアログ付き）

#### メイン画面機能
- **QRコード生成機能**: ボタンを押すとQRコードを表示
- **Zapリクエスト生成**:生成したイベントに対するZapリクエスト（kind 9734）を作成
- **ライトニングインボイス取得**: ライトニングアドレスから100 sat（100 * 1000 millisatoshi）のインボイスを取得
- **QRコード表示**: `lightning:` + bolt11インボイス形式のQRコードを表示
- **Zap検知機能**: kind 9735 Zap Receiptをリアルタイム監視
- **ラッキーナンバー表示**: 1-20の範囲でラッキーナンバーを生成・表示
- **エラーハンドリング**: ライトニングアドレス無効やリレー接続失敗時のエラーメッセージ表示

## 実装詳細

### ファイル構成

```
src/
├── lib/                        # コアライブラリ
│   ├── lightning.ts           # Lightning Network関連
│   ├── nostr/                 # Nostr関連機能（モジュール化）
│   │   ├── index.ts          # 統合エクスポート
│   │   ├── types.ts          # 型定義（NostrEvent, MetadataContent等）
│   │   ├── events.ts         # イベント作成機能
│   │   ├── zap.ts            # Zap関連機能（検知・バリデーション）
│   │   ├── fortune.ts        # フォーチュンメッセージ機能
│   │   ├── *.spec.ts         # テスト
│   ├── qrcode.ts              # QRコード生成
│   └── *.spec.ts              # その他のテスト
├── routes/
│   ├── +layout.svelte         # 共通レイアウト
│   ├── +page.svelte           # メイン画面（おみくじ機能）
│   └── settings/
│       └── +page.svelte       # 設定画面
└── app.css                    # Tailwind CSS設定
```

## アーキテクチャ設計

### テスト戦略

- **機能別テスト**: 各モジュールに対応するテストファイル
- **成功率100%**: 全テストがパス

### メイン画面 (`src/routes/+page.svelte`)

#### 主要機能

1. **QRコード生成ボタン**
   - ボタンクリックでメイン処理を実行
   - ローディング状態の表示

2. **Nostr機能**
   - WebSocket接続によるリレーサーバー通信 (`wss://nos.lol/`)
   - kind 1イベント（Fortune Slip Request）の作成
   - nsec形式の秘密鍵のデコード・署名処理

3. **Zapリクエスト処理**
   - 発行したNostrイベントに対するZapリクエスト（kind 9734）作成
   - ライトニングアドレスから LNURL-pay エンドポイントの取得
   - インボイス生成（1 sat = 1000 millisatoshi）

4. **デュアルQRコード生成・表示**
   - **Lightning Invoice QRコード**: `lightning:` + bolt11インボイス形式（常に表示）
   - qrcode ライブラリ（v1.5.4）を使用した2つのQRコード並列表示
   - 各QRコードに明確なラベル付け

#### 技術仕様

- **支払い金額**: 100 sat（100*1000 millisatoshi）
- **QRコード形式**: 
  - Lightning Invoice: `lightning:lnbc...`
- **フォーチュンメッセージ**: 
  - ラッキーナンバー範囲: 1-20
- **Zap検証**: 厳密な検証、descriptionとzap requestの一致を要求
- **エラー処理**: ユーザーへのエラーメッセージ表示

#### QRコード生成機能詳細

```typescript
// Lightning Invoice QRコード生成
const qrCode = await generateLightningQRCode(invoice.pr);
// → `lightning:lnbc...`形式でQR生成
```

#### 処理フロー

1. ユーザーがQRコード生成ボタンをクリック
2. LocalStorageから設定データ（ライトニングアドレス・秘密鍵）を取得
3. Nostr kind 1イベントを作成・署名
4. 指定リレーにイベントを送信
5. ライトニングアドレスからLNURL-payエンドポイントを取得
6. Zapリクエスト（kind 9734）を作成
7. インボイスを取得（1 sat）
8. **Lightning Invoice QRコード**を生成・表示
11. **QRコードを表示**
12. **Zap Receipt監視開始**（kind 9735イベント検知）
    - descriptionタグ内のzap request IDを厳密に検証
13. **Zap検知時の処理**:
    - Zapした支払いの検証
    - 1-20の範囲でラッキーナンバー生成
    - UIに同じラッキーナンバーを表示

### 設定画面 (`src/routes/settings/+page.svelte`)

#### 主要機能

1. **フォームバリデーション**
   - ライトニングアドレス: 正規表現 `/^[^@\s]+@[^@\s]+\.[^@\s]+$/`
   - 各フィールド必須チェック
   - エラーメッセージ表示

2. **パスワード表示切り替え**
   - `showPassword`状態によるinput type切り替え
   - 目のアイコン（開/閉）による視覚的フィードバック

3. **データ永続化**
   - LocalStorageへの保存
   - ページロード時のデータ復元（`onMount`）

4. **UI/UX**
   - 保存成功時のメッセージ表示（3秒間）
   - データ削除完了時のメッセージ表示（3秒間）
   - バリデーションエラー時の赤いボーダー表示
   - 戻るボタン（×アイコン）

5. **セキュリティ**
   - LocalStorage使用に関する警告メッセージ表示
   - データ削除機能（確認ダイアログ付き）
   - 全データの一括削除とフォームクリア

#### バリデーション仕様

```typescript
// ライトニングアドレス
if (!lightningAddress.trim()) {
  errors.lightningAddress = 'ライトニングアドレスは必須です';
} else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(lightningAddress)) {
  errors.lightningAddress = '正しいメールアドレス形式で入力してください（例：user@domain.com）';
}

// 必須フィールドチェック
if (!coinosId.trim()) {
  errors.coinosId = 'Coinos IDは必須です';
}
if (!coinosPassword.trim()) {
  errors.coinosPassword = 'Coinosパスワードは必須です';
}
```

## テスト結果

### ✅ 成功項目

1. **画面遷移**: メイン画面 ↔ 設定画面の遷移が正常動作
2. **バリデーション**: 必須チェック、形式チェックが正常動作
3. **パスワード切り替え**: 表示/非表示機能が正常動作
4. **保存機能**: データがLocalStorageに保存される
5. **成功メッセージ**: 保存後のフィードバックが正常表示
6. **セキュリティ警告**: LocalStorage使用に関する適切な警告表示
7. **データ削除機能**: 確認ダイアログと削除完了メッセージが正常動作

## 今後の改善点

### 長期改善

1. **セキュリティ強化**
   - パスワードの暗号化保存
   - LocalStorageからより安全なストレージへの移行
   - セッション管理機能の実装
   - データの自動削除機能（有効期限設定）

2. **機能拡張**
   - 設定のエクスポート/インポート機能
   - 設定の検証・テスト機能

## スタイルガイド

### レスポンシブ対応

- モバイルファースト設計
- 最大幅: `max-w-md` (28rem, 448px)
- パディング: `px-4 sm:px-6 lg:px-8`

## 実行方法

```bash
# 開発サーバー起動
npm run dev

# ビルド
npm run build

# プレビュー
npm run preview
```

## 関連リンク

- [SvelteKit Documentation](https://kit.svelte.dev/)
- [Tailwind CSS Documentation](https://tailwindcss.com/)
- [LocalStorage API](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)

---

**作成日**: 2025/11/26  
**作成者**: Ocknamo  
**バージョン**: 2.0
