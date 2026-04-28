import { describe, expect, it, vi, beforeEach } from 'vitest';
import { decodeNpub, fetchMetadataFromRelays, validateNpub } from './metadata';

// Mock relay module
const mockFetchEvent = vi.fn();
vi.mock('./relay', () => ({
  fetchEventFromRelays: (...args: unknown[]) => mockFetchEvent(...args),
}));

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
  beforeEach(() => {
    mockFetchEvent.mockReset();
  });

  it('kind:0イベントからlud16を取得する', async () => {
    const pubkeyHex = 'a'.repeat(64);
    mockFetchEvent.mockResolvedValue({
      kind: 0,
      pubkey: pubkeyHex,
      content: JSON.stringify({ lud16: 'user@getalby.com', name: 'testuser' }),
    });

    const result = await fetchMetadataFromRelays(pubkeyHex);
    expect(result).not.toBeNull();
    expect(result!.lud16).toBe('user@getalby.com');
    expect(result!.name).toBe('testuser');
  });

  it('イベントが見つからない場合はnullを返す', async () => {
    mockFetchEvent.mockResolvedValue(null);
    const result = await fetchMetadataFromRelays('b'.repeat(64));
    expect(result).toBeNull();
  });

  it('contentのJSONが不正な場合はnullを返す', async () => {
    mockFetchEvent.mockResolvedValue({ kind: 0, content: 'not-json' });
    const result = await fetchMetadataFromRelays('b'.repeat(64));
    expect(result).toBeNull();
  });

  it('lud16がない場合もMetadataContentを返す', async () => {
    mockFetchEvent.mockResolvedValue({
      kind: 0,
      content: JSON.stringify({ name: 'no-lightning' }),
    });

    const result = await fetchMetadataFromRelays('c'.repeat(64));
    expect(result).not.toBeNull();
    expect(result!.lud16).toBeUndefined();
    expect(result!.name).toBe('no-lightning');
  });

  it('fetchEventFromRelaysにkind:0フィルターを渡す', async () => {
    const pubkeyHex = 'd'.repeat(64);
    mockFetchEvent.mockResolvedValue(null);

    await fetchMetadataFromRelays(pubkeyHex);

    expect(mockFetchEvent).toHaveBeenCalledWith(
      expect.objectContaining({ kinds: [0], authors: [pubkeyHex] }),
      expect.any(Number),
    );
  });

  it('タイムアウト値を渡せる', async () => {
    mockFetchEvent.mockResolvedValue(null);
    await fetchMetadataFromRelays('e'.repeat(64), 5000);
    expect(mockFetchEvent).toHaveBeenCalledWith(expect.anything(), 5000);
  });
});
