// デフォルトのリレー一覧。ユーザーが設定画面で上書きしない限りこちらが使われる。
export const DEFAULT_RELAYS = [
  'wss://relay.damus.io/',
  'wss://r.kojira.io/',
  'wss://yabu.me',
  'wss://relay.snort.social',
  'wss://nostr.bitcoiner.social',
];

// 既存の import / テストモック (`profile.spec.ts` など) との後方互換のためエイリアスを残す。
// 新規コードは `getRelays()` を使うこと。
export const RELAYS = DEFAULT_RELAYS;

// 設定画面で保存されたリレー一覧を読み込む。
// 未設定・全行不正の場合は DEFAULT_RELAYS にフォールバックする。
export function getRelays(): string[] {
  if (typeof localStorage === 'undefined') return DEFAULT_RELAYS;
  const raw = localStorage.getItem('relays');
  if (!raw) return DEFAULT_RELAYS;
  const parsed = raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const valid = parsed.filter((u) => /^wss?:\/\/.+/.test(u));
  return valid.length > 0 ? valid : DEFAULT_RELAYS;
}
