import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  isNip07Available,
  nip07GetPublicKey,
  nip07SignEvent,
  fetchRelayListFromRelays,
  syncRelaysFromNip65,
} from './nip07.js';

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
  getRelays: () => ['wss://relay1.test/'],
  DEFAULT_RELAYS: ['wss://relay1.test/'],
  parseRelays: (t: string) => t.split('\n').filter(Boolean),
  serializeRelays: (r: string[]) => r.join('\n'),
  validateRelayText: () => null,
}));

import { SimplePool } from 'nostr-tools';

describe('isNip07Available', () => {
  afterEach(() => {
    // window.nostr をクリーンアップ
    vi.stubGlobal('window', globalThis.window);
  });

  it('window.nostrが存在する場合trueを返す', () => {
    vi.stubGlobal('window', { nostr: { getPublicKey: vi.fn(), signEvent: vi.fn() } });
    expect(isNip07Available()).toBe(true);
  });

  it('window.nostrが存在しない場合falseを返す', () => {
    vi.stubGlobal('window', {});
    expect(isNip07Available()).toBe(false);
  });

  it('windowが未定義の場合falseを返す', () => {
    vi.stubGlobal('window', undefined);
    expect(isNip07Available()).toBe(false);
  });
});

describe('nip07GetPublicKey', () => {
  afterEach(() => {
    vi.stubGlobal('window', globalThis.window);
  });

  it('window.nostr.getPublicKey()を呼び出して公開鍵を返す', async () => {
    const mockPubkey = 'a'.repeat(64);
    vi.stubGlobal('window', {
      nostr: { getPublicKey: vi.fn().mockResolvedValue(mockPubkey), signEvent: vi.fn() },
    });

    const result = await nip07GetPublicKey();
    expect(result).toBe(mockPubkey);
  });

  it('NIP-07が利用できない場合エラーを投げる', async () => {
    vi.stubGlobal('window', {});
    await expect(nip07GetPublicKey()).rejects.toThrow();
  });
});

describe('nip07SignEvent', () => {
  afterEach(() => {
    vi.stubGlobal('window', globalThis.window);
  });

  it('window.nostr.signEvent()を呼び出して署名済みイベントを返す', async () => {
    const template = {
      kind: 1,
      created_at: 1000,
      tags: [],
      content: 'test',
    };
    const signedEvent = {
      ...template,
      id: 'event-id',
      pubkey: 'a'.repeat(64),
      sig: 'sig-value',
    };

    vi.stubGlobal('window', {
      nostr: { getPublicKey: vi.fn(), signEvent: vi.fn().mockResolvedValue(signedEvent) },
    });

    const result = await nip07SignEvent(template);
    expect(result).toEqual(signedEvent);
    expect(window.nostr!.signEvent).toHaveBeenCalledWith(template);
  });

  it('NIP-07が利用できない場合エラーを投げる', async () => {
    vi.stubGlobal('window', {});
    await expect(nip07SignEvent({ kind: 1, created_at: 1000, tags: [], content: '' })).rejects.toThrow();
  });
});

describe('fetchRelayListFromRelays', () => {
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

  it('kind:10002イベントからリレー一覧を取得する', async () => {
    const pubkeyHex = 'a'.repeat(64);
    mockPoolInstance.get.mockResolvedValue({
      kind: 10002,
      pubkey: pubkeyHex,
      content: '',
      created_at: 1000,
      id: 'event-id',
      sig: 'sig',
      tags: [
        ['r', 'wss://relay.damus.io/'],
        ['r', 'wss://yabu.me', 'read'],
        ['r', 'wss://nos.lol', 'write'],
      ],
    });

    const result = await fetchRelayListFromRelays(pubkeyHex);
    expect(result).toEqual(['wss://relay.damus.io/', 'wss://yabu.me', 'wss://nos.lol']);
  });

  it('kind:10002イベントが見つからない場合nullを返す', async () => {
    mockPoolInstance.get.mockResolvedValue(null);
    const result = await fetchRelayListFromRelays('b'.repeat(64));
    expect(result).toBeNull();
  });

  it('rタグがない場合nullを返す', async () => {
    mockPoolInstance.get.mockResolvedValue({
      kind: 10002,
      pubkey: 'c'.repeat(64),
      content: '',
      created_at: 1000,
      id: 'event-id',
      sig: 'sig',
      tags: [],
    });

    const result = await fetchRelayListFromRelays('c'.repeat(64));
    expect(result).toBeNull();
  });

  it('pool.getにkind:10002フィルターを渡す', async () => {
    const pubkeyHex = 'd'.repeat(64);
    mockPoolInstance.get.mockResolvedValue(null);

    await fetchRelayListFromRelays(pubkeyHex);

    expect(mockPoolInstance.get).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        kinds: [10002],
        authors: [pubkeyHex],
      }),
    );
  });

  it('タイムアウトした場合nullを返す', async () => {
    mockPoolInstance.get.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve(null), 20000)));
    const result = await fetchRelayListFromRelays('e'.repeat(64), 100);
    expect(result).toBeNull();
  });
});

describe('syncRelaysFromNip65', () => {
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

  it('kind:10002からリレーを取得して改行区切り文字列を返す', async () => {
    const pubkeyHex = 'a'.repeat(64);
    mockPoolInstance.get.mockResolvedValue({
      kind: 10002,
      pubkey: pubkeyHex,
      content: '',
      created_at: 1000,
      id: 'event-id',
      sig: 'sig',
      tags: [
        ['r', 'wss://relay.damus.io/'],
        ['r', 'wss://yabu.me', 'read'],
        ['r', 'wss://nos.lol', 'write'],
      ],
    });

    const result = await syncRelaysFromNip65(pubkeyHex);
    expect(result).toBe('wss://relay.damus.io/\nwss://yabu.me\nwss://nos.lol');
  });

  it('kind:10002が見つからない場合nullを返す', async () => {
    mockPoolInstance.get.mockResolvedValue(null);
    const result = await syncRelaysFromNip65('b'.repeat(64));
    expect(result).toBeNull();
  });

  it('rタグが空の場合nullを返す', async () => {
    mockPoolInstance.get.mockResolvedValue({
      kind: 10002,
      pubkey: 'c'.repeat(64),
      content: '',
      created_at: 1000,
      id: 'event-id',
      sig: 'sig',
      tags: [],
    });

    const result = await syncRelaysFromNip65('c'.repeat(64));
    expect(result).toBeNull();
  });
});
