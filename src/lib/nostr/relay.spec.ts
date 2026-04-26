import { describe, expect, it, vi, beforeEach } from 'vitest';
import { DEFAULT_RELAYS, parseRelays, serializeRelays, validateRelayText, getRelays } from './relay.js';

describe('DEFAULT_RELAYS', () => {
  it('デフォルトリレーが定義されている', () => {
    expect(DEFAULT_RELAYS).toBeInstanceOf(Array);
    expect(DEFAULT_RELAYS.length).toBeGreaterThan(0);
  });

  it('すべてwss://で始まる', () => {
    for (const relay of DEFAULT_RELAYS) {
      expect(relay).toMatch(/^wss:\/\//);
    }
  });
});

describe('parseRelays', () => {
  it('改行区切りのテキストをリレー配列に変換する', () => {
    const text = 'wss://relay.damus.io/\nwss://yabu.me';
    expect(parseRelays(text)).toEqual(['wss://relay.damus.io/', 'wss://yabu.me']);
  });

  it('空行を無視する', () => {
    const text = 'wss://relay.damus.io/\n\n\nwss://yabu.me\n';
    expect(parseRelays(text)).toEqual(['wss://relay.damus.io/', 'wss://yabu.me']);
  });

  it('前後の空白をトリムする', () => {
    const text = '  wss://relay.damus.io/  \n  wss://yabu.me  ';
    expect(parseRelays(text)).toEqual(['wss://relay.damus.io/', 'wss://yabu.me']);
  });

  it('空文字列は空配列を返す', () => {
    expect(parseRelays('')).toEqual([]);
  });

  it('空白のみは空配列を返す', () => {
    expect(parseRelays('  \n  \n  ')).toEqual([]);
  });

  it('重複を除去する', () => {
    const text = 'wss://relay.damus.io/\nwss://relay.damus.io/\nwss://yabu.me';
    expect(parseRelays(text)).toEqual(['wss://relay.damus.io/', 'wss://yabu.me']);
  });
});

describe('serializeRelays', () => {
  it('リレー配列を改行区切りのテキストに変換する', () => {
    const relays = ['wss://relay.damus.io/', 'wss://yabu.me'];
    expect(serializeRelays(relays)).toBe('wss://relay.damus.io/\nwss://yabu.me');
  });

  it('空配列は空文字列を返す', () => {
    expect(serializeRelays([])).toBe('');
  });
});

describe('validateRelayText', () => {
  it('正しいwss://リレーはエラーなし', () => {
    expect(validateRelayText('wss://relay.damus.io/\nwss://yabu.me')).toBeNull();
  });

  it('空文字列はエラー', () => {
    expect(validateRelayText('')).toBe('リレーを1つ以上入力してください');
  });

  it('空行のみはエラー', () => {
    expect(validateRelayText('\n\n')).toBe('リレーを1つ以上入力してください');
  });

  it('wss://で始まらないURLはエラー', () => {
    const error = validateRelayText('https://relay.damus.io/');
    expect(error).toContain('wss://');
  });

  it('ws://はエラー', () => {
    const error = validateRelayText('ws://relay.damus.io/');
    expect(error).toContain('wss://');
  });

  it('混在している場合、不正な行のみエラー', () => {
    const error = validateRelayText('wss://relay.damus.io/\nhttps://bad.relay');
    expect(error).toContain('https://bad.relay');
  });
});

describe('getRelays', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
  });

  it('localStorageに値がない場合、デフォルトを返す', () => {
    vi.mocked(localStorage.getItem).mockReturnValue(null);
    expect(getRelays()).toEqual(DEFAULT_RELAYS);
  });

  it('localStorageに空文字列がある場合、デフォルトを返す', () => {
    vi.mocked(localStorage.getItem).mockReturnValue('');
    expect(getRelays()).toEqual(DEFAULT_RELAYS);
  });

  it('localStorageに値がある場合、パースして返す', () => {
    vi.mocked(localStorage.getItem).mockReturnValue('wss://custom.relay/\nwss://another.relay');
    expect(getRelays()).toEqual(['wss://custom.relay/', 'wss://another.relay']);
  });

  it('localStorageのキーはrelaysを使う', () => {
    vi.mocked(localStorage.getItem).mockReturnValue(null);
    getRelays();
    expect(localStorage.getItem).toHaveBeenCalledWith('relays');
  });
});
