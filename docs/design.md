# Nostr Fortune Slip 設計ドキュメント

## プロジェクト概要

Nostr Fortune Slipは、ライトニングネットワークとCoinosサービスを利用したアプリケーションです。このドキュメントでは、設定画面とメイン画面の設計・実装について説明します。

## 技術スタック

- **フレームワーク**: SvelteKit
- **スタイリング**: Tailwind CSS
- **言語**: TypeScript
- **ストレージ**: ブラウザのLocalStorage

## 要件定義

### 画面構成

1. **メイン画面** (`/`)
   - 仮実装（設定画面への遷移ボタンのみ）
   
2. **設定画面** (`/settings`)
   - 設定フォーム
   - データの永続化

### 設定項目

- **ライトニングアドレス**: メールアドレス形式でのバリデーション
- **Coinos ID**: 必須入力
- **Coinosパスワード**: 必須入力、表示/非表示切り替え機能付き

### 機能要件

- フォームバリデーション
- LocalStorageへのデータ保存
- 保存成功時の確認メッセージ表示
- 設定画面からメイン画面への戻る機能
- セキュリティ警告の表示
- データ削除機能（確認ダイアログ付き）

## 実装詳細

### ファイル構成

```
src/
├── routes/
│   ├── +layout.svelte          # 共通レイアウト
│   ├── +page.svelte            # メイン画面
│   └── settings/
│       └── +page.svelte        # 設定画面
└── app.css                     # Tailwind CSS設定
```

### メイン画面 (`src/routes/+page.svelte`)

- シンプルなランディングページ
- 設定画面への遷移ボタン
- `goto('/settings')`による画面遷移

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

### ✅ 解決済みの問題

1. **データ復元機能の不具合**（解決済み）
   - SessionStorageからLocalStorageに変更することで、ブラウザ再起動後もデータが永続化される
   - LocalStorageは明示的に削除されるまでデータが保持される

## 今後の改善点

### 短期改善

1. **LocalStorage実装の改善**（一部完了）
   - ✅ データクリア機能の追加
   - ✅ セキュリティ警告の表示
   - エラーハンドリングの強化

2. **UX向上**
   - フォーム送信時のローディング表示
   - 自動保存機能の検討

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

### カラーパレット

- **Primary**: Blue 600/700 (`bg-blue-600 hover:bg-blue-700`)
- **Success**: Green 100/300/700
- **Error**: Red 500/600
- **Gray**: Gray 50/300/500/600/700/900

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

**作成日**: 2025/10/24  
**作成者**: AI Assistant  
**バージョン**: 1.0
