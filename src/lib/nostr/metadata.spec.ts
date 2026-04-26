import { describe, expect, it, vi, beforeEach } from 'vitest';
import { decodeNpub, fetchMetadataFromRelays, validateNpub } from './metadata.js';

// Mock nostr-tools
vi.mock('nostr-tools', async () => {
  const actual = await vi.importActual('nostr-tools');
  return {
    ...actual,
    SimplePool: vi.fn(),
  };
});

// Mock relay module
vi.mock('./relay.js', () => ({
  getRelays: () => ['wss://relay1.test/', 'wss://relay2.test/'],
  DEFAULT_RELAYS: ['wss://relay1.test/', 'wss://relay2.test/'],
  parseRelays: (t: string) => t.split('\n').filter(Boolean),
  serializeRelays: (r: string[]) => r.join('\n'),
  validateRelayText: () => null,
}));

import { SimplePool } from 'nostr-tools';

describe('validateNpub', () => {
  it('空文字列はエラーなし（任意フィールド）', () => {
    expect(validateNpub('')).toBeNull();
  });

  it('空白のみはエラーなし', () => {
    expect(validateNpub('  ')).toBeNull();
  });

  it('npub1で始まらない文字列はエラー', () => {
    const error = validateNpub('nsec1abc');
    expect(error).toContain('npub1');
  });

  it('npub1で始まるがデコードできない文字列はエラー', () => {
    const error = validateNpub('npub1invalidkey');
    expect(error).not.toBeNull();
  });

  it('正しいnpub形式はエラーなし', () => {
    // 実際の有効なnpubを使用（32バイトの公開鍵からエンコード）
    const { nip19 } = require('nostr-tools');
    const dummyHex = 'a'.repeat(64);
    const validNpub = nip19.npubEncode(dummyHex);
    expect(validateNpub(validNpub)).toBeNull();
  });
});

describe('decodeNpub', () => {
  it('正しいnpubをhex公開鍵に変換する', () => {
    const { nip19 } = require('nostr-tools');
    const dummyHex = 'a'.repeat(64);
    const npub = nip19.npubEncode(dummyHex);
    expect(decodeNpub(npub)).toBe(dummyHex);
  });

  it('npub1で始まらない場合はエラー', () => {
    expect(() => decodeNpub('nsec1abc')).toThrow('npub1');
  });

  it('不正なnpubはエラー', () => {
    expect(() => decodeNpub('npub1invalid')).toThrow();
  });
});

describe('fetchMetadataFromRelays', () => {
  let mockPoolInstance: {
    get: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockPoolInstance = {
      get: vi.fn(),
      close: vi.fn(),
    };
    vi.mocked(SimplePool).mockImplementation(() => mockPoolInstance as unknown as InstanceType<typeof SimplePool>);
  });

  it('kind:0イベントからlud16を取得する', async () => {
    const pubkeyHex = 'a'.repeat(64);
    mockPoolInstance.get.mockResolvedValue({
      kind: 0,
      pubkey: pubkeyHex,
      content: JSON.stringify({ lud16: 'user@getalby.com', name: 'testuser' }),
      created_at: 1000,
      id: 'event-id',
      sig: 'sig',
      tags: [],
    });

    const result = await fetchMetadataFromRelays(pubkeyHex);
    expect(result).not.toBeNull();
    expect(result!.lud16).toBe('user@getalby.com');
    expect(result!.name).toBe('testuser');
  });

  it('イベントが見つからない場合はnullを返す', async () => {
    mockPoolInstance.get.mockResolvedValue(null);
    const result = await fetchMetadataFromRelays('b'.repeat(64));
    expect(result).toBeNull();
  });

  it('contentのJSONが不正な場合はnullを返す', async () => {
    mockPoolInstance.get.mockResolvedValue({
      kind: 0,
      pubkey: 'b'.repeat(64),
      content: 'not-json',
      created_at: 1000,
      id: 'event-id',
      sig: 'sig',
      tags: [],
    });

    const result = await fetchMetadataFromRelays('b'.repeat(64));
    expect(result).toBeNull();
  });

  it('lud16がない場合もMetadataContentを返す', async () => {
    mockPoolInstance.get.mockResolvedValue({
      kind: 0,
      pubkey: 'c'.repeat(64),
      content: JSON.stringify({ name: 'no-lightning' }),
      created_at: 1000,
      id: 'event-id',
      sig: 'sig',
      tags: [],
    });

    const result = await fetchMetadataFromRelays('c'.repeat(64));
    expect(result).not.toBeNull();
    expect(result!.lud16).toBeUndefined();
    expect(result!.name).toBe('no-lightning');
  });

  it('pool.getにkind:0フィルターを渡す', async () => {
    const pubkeyHex = 'd'.repeat(64);
    mockPoolInstance.get.mockResolvedValue(null);

    await fetchMetadataFromRelays(pubkeyHex);

    expect(mockPoolInstance.get).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        kinds: [0],
        authors: [pubkeyHex],
      }),
    );
  });

  it('タイムアウトした場合はnullを返す', async () => {
    mockPoolInstance.get.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve(null), 20000)));

    const result = await fetchMetadataFromRelays('e'.repeat(64), 100);
    expect(result).toBeNull();
  });
});
