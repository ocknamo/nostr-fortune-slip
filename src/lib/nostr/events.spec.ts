import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  decodeNsec,
  createTextEvent,
  createZapRequest,
  createMetadataEvent,
  createTextEventNip07,
  createZapRequestNip07,
} from './events.js';
import type { NostrEvent } from './types.js';
import { nip19, nip57, finalizeEvent } from 'nostr-tools';

// Mock nostr-tools
vi.mock('nostr-tools', () => ({
  nip19: {
    decode: vi.fn(),
  },
  nip57: {
    makeZapRequest: vi.fn(),
  },
  finalizeEvent: vi.fn(),
}));

describe('decodeNsec', () => {
  it('should decode valid nsec key', () => {
    const mockSecretKey = new Uint8Array(32);
    vi.mocked(nip19.decode).mockReturnValue({
      type: 'nsec',
      data: mockSecretKey,
    });

    const result = decodeNsec('nsec1testkey');

    expect(result).toBe(mockSecretKey);
    expect(nip19.decode).toHaveBeenCalledWith('nsec1testkey');
  });

  it('should throw error for invalid nsec format', () => {
    expect(() => decodeNsec('npub1testkey')).toThrow('Invalid nsec format. Must start with nsec1');
    expect(() => decodeNsec('invalid')).toThrow('Invalid nsec format. Must start with nsec1');
  });

  it('should throw error for invalid decoded type', () => {
    vi.mocked(nip19.decode).mockReturnValue({
      type: 'npub',
      data: 'invalid',
    });

    expect(() => decodeNsec('nsec1testkey')).toThrow('Invalid nsec key');
  });
});

describe('createTextEvent', () => {
  it('should create valid text event', () => {
    const privateKey = new Uint8Array(32);
    const mockEvent = {
      id: 'test-id',
      pubkey: 'test-pubkey',
      created_at: Math.floor(Date.now() / 1000),
      kind: 1,
      tags: [],
      content: 'test content',
      sig: 'test-sig',
    } as any;

    vi.mocked(finalizeEvent).mockReturnValue(mockEvent);

    const result = createTextEvent(privateKey, 'test content');

    expect(result).toEqual(mockEvent);
    expect(finalizeEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 1,
        content: 'test content',
        tags: [],
      }),
      privateKey,
    );
  });
});

describe('createZapRequest', () => {
  it('should create valid zap request event', () => {
    const privateKey = new Uint8Array(32);
    const targetEvent: NostrEvent = {
      id: 'target-id',
      pubkey: 'target-pubkey',
      created_at: Math.floor(Date.now() / 1000),
      kind: 1,
      tags: [],
      content: 'target content',
      sig: 'target-sig',
    };

    const mockZapRequest = {
      kind: 9734,
      tags: [],
      content: '',
      created_at: Math.floor(Date.now() / 1000),
    };

    const mockSignedEvent = {
      ...mockZapRequest,
      id: 'zap-id',
      pubkey: 'zap-pubkey',
      sig: 'zap-sig',
    } as any;

    vi.mocked(nip57.makeZapRequest).mockReturnValue(mockZapRequest);
    vi.mocked(finalizeEvent).mockReturnValue(mockSignedEvent);

    const result = createZapRequest(privateKey, targetEvent, 5000, 'test zap');

    expect(result).toEqual(mockSignedEvent);
    expect(nip57.makeZapRequest).toHaveBeenCalledWith({
      event: targetEvent,
      amount: 5000,
      comment: 'test zap',
      relays: expect.any(Array),
    });
    expect(finalizeEvent).toHaveBeenCalledWith(mockZapRequest, privateKey);
  });

  it('should create zap request with default values', () => {
    const privateKey = new Uint8Array(32);
    const targetEvent: NostrEvent = {
      id: 'target-id',
      pubkey: 'target-pubkey',
      created_at: Math.floor(Date.now() / 1000),
      kind: 1,
      tags: [],
      content: 'target content',
      sig: 'target-sig',
    };

    const mockZapRequest = {
      kind: 9734,
      tags: [],
      content: '',
      created_at: Math.floor(Date.now() / 1000),
    };

    const mockSignedEvent = {
      ...mockZapRequest,
      id: 'zap-id',
      pubkey: 'zap-pubkey',
      sig: 'zap-sig',
    } as any;

    vi.mocked(nip57.makeZapRequest).mockReturnValue(mockZapRequest);
    vi.mocked(finalizeEvent).mockReturnValue(mockSignedEvent);

    const result = createZapRequest(privateKey, targetEvent);

    expect(nip57.makeZapRequest).toHaveBeenCalledWith({
      event: targetEvent,
      amount: 1000, // default amount
      comment: '', // default comment
      relays: expect.any(Array),
    });
  });
});

describe('createTextEventNip07', () => {
  afterEach(() => {
    vi.stubGlobal('window', globalThis.window);
  });

  it('NIP-07でテキストイベントを作成・署名する', async () => {
    const mockSignedEvent = {
      id: 'nip07-text-id',
      pubkey: 'nip07-pubkey',
      created_at: Math.floor(Date.now() / 1000),
      kind: 1,
      tags: [],
      content: 'hello',
      sig: 'nip07-sig',
    };

    vi.stubGlobal('window', {
      nostr: {
        getPublicKey: vi.fn(),
        signEvent: vi.fn().mockResolvedValue(mockSignedEvent),
      },
    });

    const result = await createTextEventNip07('hello');
    expect(result).toEqual(mockSignedEvent);
    expect(window.nostr!.signEvent).toHaveBeenCalledWith(expect.objectContaining({ kind: 1, content: 'hello' }));
  });
});

describe('createZapRequest with recipientPubkey', () => {
  it('recipientPubkey指定時はProfileZapモード(pubkey)でmakeZapRequestを呼ぶ', () => {
    vi.mocked(nip57.makeZapRequest).mockClear();
    const privateKey = new Uint8Array(32);
    const targetEvent: NostrEvent = {
      id: 'target-id',
      pubkey: 'my-pubkey',
      created_at: Math.floor(Date.now() / 1000),
      kind: 1,
      tags: [],
      content: '',
      sig: 'target-sig',
    };

    const mockZapRequest = { kind: 9734, tags: [], content: '', created_at: Math.floor(Date.now() / 1000) };
    const mockSignedEvent = { ...mockZapRequest, id: 'zap-id', pubkey: 'my-pubkey', sig: 'sig' } as any;

    vi.mocked(nip57.makeZapRequest).mockReturnValue(mockZapRequest);
    vi.mocked(finalizeEvent).mockReturnValue(mockSignedEvent);

    createZapRequest(privateKey, targetEvent, 1000, 'pay', 'recipient-hex-pubkey');

    const callArgs = vi.mocked(nip57.makeZapRequest).mock.calls[0][0];
    expect(callArgs).toHaveProperty('pubkey', 'recipient-hex-pubkey');
    expect(callArgs).toHaveProperty('amount', 1000);
    expect(callArgs).toHaveProperty('comment', 'pay');
    expect(callArgs).not.toHaveProperty('event');
  });

  it('recipientPubkey未指定時は従来のEventZapモード(event)で呼ぶ', () => {
    const privateKey = new Uint8Array(32);
    const targetEvent: NostrEvent = {
      id: 'target-id',
      pubkey: 'my-pubkey',
      created_at: Math.floor(Date.now() / 1000),
      kind: 1,
      tags: [],
      content: '',
      sig: 'target-sig',
    };

    const mockZapRequest = { kind: 9734, tags: [], content: '', created_at: Math.floor(Date.now() / 1000) };
    const mockSignedEvent = { ...mockZapRequest, id: 'zap-id', pubkey: 'my-pubkey', sig: 'sig' } as any;

    vi.mocked(nip57.makeZapRequest).mockReturnValue(mockZapRequest);
    vi.mocked(finalizeEvent).mockReturnValue(mockSignedEvent);

    createZapRequest(privateKey, targetEvent, 1000, 'pay');

    expect(nip57.makeZapRequest).toHaveBeenCalledWith(
      expect.objectContaining({ event: targetEvent, amount: 1000, comment: 'pay' }),
    );
  });
});

describe('createZapRequestNip07', () => {
  afterEach(() => {
    vi.stubGlobal('window', globalThis.window);
  });

  it('NIP-07でZapリクエストを作成・署名する', async () => {
    const targetEvent: NostrEvent = {
      id: 'target-id',
      pubkey: 'target-pubkey',
      created_at: Math.floor(Date.now() / 1000),
      kind: 1,
      tags: [],
      content: '',
      sig: 'target-sig',
    };

    const mockZapRequest = { kind: 9734, tags: [], content: 'test-payment', created_at: Math.floor(Date.now() / 1000) };
    const mockSignedEvent = { ...mockZapRequest, id: 'nip07-zap-id', pubkey: 'nip07-pubkey', sig: 'nip07-sig' };

    vi.mocked(nip57.makeZapRequest).mockReturnValue(mockZapRequest);
    vi.stubGlobal('window', {
      nostr: { getPublicKey: vi.fn(), signEvent: vi.fn().mockResolvedValue(mockSignedEvent) },
    });

    const result = await createZapRequestNip07(targetEvent, 3000, 'test-payment');
    expect(result).toEqual(mockSignedEvent);
    expect(nip57.makeZapRequest).toHaveBeenCalledWith(
      expect.objectContaining({ event: targetEvent, amount: 3000, comment: 'test-payment' }),
    );
  });

  it('recipientPubkey指定時はProfileZapモードで呼ぶ', async () => {
    const targetEvent: NostrEvent = {
      id: 'target-id',
      pubkey: 'my-pubkey',
      created_at: Math.floor(Date.now() / 1000),
      kind: 1,
      tags: [],
      content: '',
      sig: 'target-sig',
    };

    const mockZapRequest = { kind: 9734, tags: [], content: '', created_at: Math.floor(Date.now() / 1000) };
    const mockSignedEvent = { ...mockZapRequest, id: 'nip07-zap-id', pubkey: 'nip07-pubkey', sig: 'nip07-sig' };

    vi.mocked(nip57.makeZapRequest).mockReturnValue(mockZapRequest);
    vi.stubGlobal('window', {
      nostr: { getPublicKey: vi.fn(), signEvent: vi.fn().mockResolvedValue(mockSignedEvent) },
    });

    await createZapRequestNip07(targetEvent, 2000, 'tip', 'recipient-hex');

    expect(nip57.makeZapRequest).toHaveBeenCalledWith(
      expect.objectContaining({ pubkey: 'recipient-hex', amount: 2000, comment: 'tip' }),
    );
  });
});

describe('createMetadataEvent', () => {
  it('should create metadata event with lud16', () => {
    const result = createMetadataEvent('test-pubkey', 'test@example.com');

    expect(result.kind).toBe(0);
    expect(result.pubkey).toBe('test-pubkey');
    expect(JSON.parse(result.content)).toEqual({ lud16: 'test@example.com' });
    expect(result.tags).toEqual([]);
    expect(result.id).toBe('temp-id');
    expect(result.sig).toBe('temp-sig');
  });

  it('should create metadata event without lud16', () => {
    const result = createMetadataEvent('test-pubkey');

    expect(result.kind).toBe(0);
    expect(result.pubkey).toBe('test-pubkey');
    expect(JSON.parse(result.content)).toEqual({});
  });
});
