import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_RELAYS, RELAYS, getRelays } from './relay.js';

// node 環境では `localStorage` がグローバルに存在しないため、最小限のモックを差し込む。
// `getRelays()` は `typeof localStorage === 'undefined'` を見ているので、ここで定義したら
// その分岐は通らず、保存値ベースの挙動を検証できる。
beforeAll(() => {
  if (typeof globalThis.localStorage === 'undefined') {
    const store = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => (store.has(key) ? (store.get(key) ?? null) : null),
        setItem: (key: string, value: string) => store.set(key, value),
        removeItem: (key: string) => store.delete(key),
        clear: () => store.clear(),
      },
    });
  }
});

describe('getRelays', () => {
  beforeEach(() => {
    localStorage.removeItem('relays');
  });

  afterEach(() => {
    localStorage.removeItem('relays');
  });

  it('returns DEFAULT_RELAYS when localStorage has no value', () => {
    expect(getRelays()).toEqual(DEFAULT_RELAYS);
  });

  it('returns DEFAULT_RELAYS when stored value is empty', () => {
    localStorage.setItem('relays', '');
    expect(getRelays()).toEqual(DEFAULT_RELAYS);
  });

  it('returns the stored list when all entries are valid', () => {
    localStorage.setItem('relays', 'wss://relay.damus.io/\nwss://yabu.me');
    expect(getRelays()).toEqual(['wss://relay.damus.io/', 'wss://yabu.me']);
  });

  it('keeps only the valid entries when the stored value is mixed', () => {
    localStorage.setItem('relays', 'wss://relay.damus.io/\nnot-a-url\nws://localhost:1234');
    expect(getRelays()).toEqual(['wss://relay.damus.io/', 'ws://localhost:1234']);
  });

  it('falls back to DEFAULT_RELAYS when every entry is invalid', () => {
    localStorage.setItem('relays', 'http://relay.damus.io/\nnot-a-url');
    expect(getRelays()).toEqual(DEFAULT_RELAYS);
  });

  it('strips whitespace and blank lines', () => {
    localStorage.setItem('relays', '  wss://relay.damus.io/  \n\n  ');
    expect(getRelays()).toEqual(['wss://relay.damus.io/']);
  });

  it('exports RELAYS as an alias of DEFAULT_RELAYS for backwards compatibility', () => {
    expect(RELAYS).toBe(DEFAULT_RELAYS);
  });
});
