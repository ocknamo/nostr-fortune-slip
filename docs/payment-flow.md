# Nostr Fortune Slip 支払いフロー

このドキュメントでは、Nostr Fortune Slipアプリケーションにおける、QRコード表示から支払い受取、おみくじ表示までの処理フローをシーケンス図で示します。

## 概要

このアプリケーションは以下の特徴を持ちます：

- **デュアル検知システム**: Nostrリレーでのリアルタイム監視とCoinos APIポーリングによるフォールバック
- **支払い検証**: Zap Receipt（kind 9735）の厳密な検証とCoinos API検証
- **ランダムID追跡**: 支払いを一意に識別するためのランダムIDを生成・追跡

## シーケンス図

```mermaid
sequenceDiagram
    actor User as ユーザー
    participant App as ブラウザアプリ
    participant Storage as LocalStorage
    participant Nostr as Nostrリレー
    participant LN as Lightning Network<br/>(LNURL-pay)
    participant Coinos as Coinos API

    Note over App: アプリケーション初期化
    User->>App: "Pray for XX sats" ボタン押下
    App->>Storage: 設定データ読み込み
    Storage-->>App: lightningAddress, nostrPrivateKey, coinosApiToken
    
    rect rgb(240, 240, 240)
        Note over App, LN: QRコード生成フェーズ
        App->>App: 1. Nostr秘密鍵をデコード
        App->>App: 2. kind 1イベント作成（Fortune Slip Request）
        App->>Nostr: 3. イベント送信
        Nostr-->>App: 送信完了
        
        App->>App: 4. ランダムID生成（支払い識別用）
        App->>App: 5. Zapリクエスト作成 (kind 9734)<br/>commentにランダムID埋め込み
        App->>LN: 6. ライトニングアドレス -> LNURL-pay取得
        LN-->>App: LNURL-payエンドポイント
        App->>LN: 7. Zapリクエスト送信 (XX sats)
        LN-->>App: Lightning Invoice (bolt11)
        
        App->>App: 8. QRコード生成 (lightning:bolt11)
        App->>User: QRコード表示
    end
    
    rect rgb(240, 255, 240)
        Note over App, Coinos: 支払い監視フェーズ（並行処理）
        par Nostrリレー監視（メイン）
            App->>Nostr: Zap Receipt (kind 9735) 購読開始
            Note over App, Nostr: WebSocket接続で<br/>リアルタイム監視
        and Coinosポーリング（フォールバック）
            opt coinosApiToken設定済み
                App->>Coinos: 支払い履歴ポーリング開始
                Note over App, Coinos: 10秒間隔で<br/>ランダムID検索
            end
        end
    end
    
    User->>User: QRコードをスキャン
    User->>LN: Lightning支払い実行
    
    alt Nostrリレー経由で検知（通常ケース）
        LN->>Nostr: Zap Receipt送信 (kind 9735)
        Nostr->>App: Zap Receipt受信
        
        rect rgb(255, 240, 240)
            Note over App: Zap Receipt検証
            App->>App: 1. kind 9735かチェック
            App->>App: 2. 対象eventIdと一致確認
            App->>App: 3. descriptionのzapRequest ID確認
            opt coinosApiToken設定済み
                App->>Coinos: 4. Coinos API検証
                Coinos-->>App: 支払い情報確認
            end
            
            alt 検証成功
                App->>App: 支払い検知フラグセット
                App->>App: Coinosポーリング停止
            else 検証失敗
                App->>User: エラーメッセージ表示
                Note over App: 監視継続
            end
        end
        
    else Coinos API経由で検知（フォールバック）
        Coinos->>App: ポーリングでランダムID一致検知
        
        rect rgb(255, 240, 240)
            Note over App: Coinos支払い検証
            App->>App: 1. 支払い確認済みかチェック
            App->>App: 2. 時間窓内の支払いかチェック
            App->>App: 3. memoのランダムID完全一致確認
            
            alt 検証成功
                App->>App: 支払い検知フラグセット
                App->>App: Nostr監視停止
            else 検証失敗
                Note over App: ポーリング継続
            end
        end
    end
    
    rect rgb(240, 255, 255)
        Note over App: おみくじ表示フェーズ
        App->>App: 1. QRコード非表示
        App->>App: 2. ラッキーナンバー生成（1-20）
        App->>App: 3. フォーチュンテキスト取得
        App->>App: 4. アニメーション開始
        App->>User: おみくじアニメーション表示
        
        Note over App: アニメーション完了後
        App->>User: ラッキーナンバー表示
        App->>User: フォーチュンテキスト表示
        App->>App: 20秒後自動リセット設定
    end
    
    Note over App: タイムアウト処理（5分）
    opt タイムアウト発生
        App->>App: 全監視停止
        App->>User: タイムアウトメッセージ
    end
```

## 主要コンポーネント

### 1. QRコード生成プロセス

1. **Nostrイベント作成**: kind 1（テキストノート）としてFortune Slip Requestを作成
2. **Zapリクエスト生成**: kind 9734イベントとして支払い要求を作成
3. **Lightning Invoice取得**: LNURL-payプロトコルでインボイスを取得
4. **QRコード表示**: `lightning:` プレフィックス付きでQRコード生成

### 2. デュアル監視システム

#### Nostrリレー監視（メイン）
- **WebSocket接続**: リアルタイムでZap Receipt（kind 9735）を監視
- **厳密な検証**: 対象eventId、zapRequest IDの完全一致確認
- **Coinos API連携**: 追加の支払い検証（オプション）

#### Coinos APIポーリング（フォールバック）
- **定期ポーリング**: 10秒間隔で支払い履歴をチェック
- **ランダムID追跡**: memoフィールド内のランダムIDで支払いを特定
- **時間窓制御**: ポーリング開始前後10分の範囲で支払いを検索

### 3. 支払い検証プロセス

#### Zap Receipt検証（NIP-57準拠）
```typescript
// 主要な検証項目
- kind === 9735
- bolt11タグ存在
- descriptionタグ存在
- eタグが対象eventIdと一致
- descriptionのzapRequest IDが一致
```

#### Coinos API検証
```typescript
// 主要な検証項目  
- payment.confirmed === true
- 時間窓内の支払い（前後10分）
- memo内のランダムID完全一致
```

### 4. エラーハンドリング

- **ネットワークエラー**: リレー接続失敗、API通信エラー
- **検証エラー**: Zap Receipt不正、Coinos支払い検証失敗
- **タイムアウト**: 5分経過での自動停止
- **設定エラー**: 必須設定項目の不備

## 技術仕様

- **支払い金額**: デフォルト100 sats（設定可能）
- **ランダムID**: Base64エンコード済み8バイト値
- **監視タイムアウト**: 5分間
- **ポーリング間隔**: 10秒
- **自動リセット**: おみくじ表示後20秒
- **ラッキーナンバー範囲**: 1-20（設定可能）

## セキュリティ考慮事項

1. **支払い検証の二重化**: NostrとCoinos両方での検証
2. **ランダムID**: 支払いの一意性確保
3. **時間窓制御**: 古い支払いの誤検知防止
4. **厳密なマッチング**: 完全一致による検証

## 参考リンク

- [NIP-57: Lightning Zaps](../docs/nips/57.md)
- [LUD-06: payRequest base spec](../docs/luds/06.md) 
- [LUD-16: Internet Identifier](../docs/luds/16.md)
- [設計ドキュメント](./design.md)
