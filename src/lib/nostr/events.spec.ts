import { describe, expect, it, vi } from 'vitest';
import { createTextEvent, createZapRequest, createMetadataEvent } from './events.js';
import type { NostrEvent } from './types.js';
import { nip57, finalizeEvent } from 'nostr-tools';

// Mock nostr-tools
vi.mock('nostr-tools', () => ({
  nip57: {
    makeZapRequest: vi.fn(),
  },
  finalizeEvent: vi.fn(),
}));

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

  it('should build profile zap request (pubkey:) when recipientPubkey is provided', () => {
    const privateKey = new Uint8Array(32);
    const kind0Event: NostrEvent = {
      id: 'kind0-id',
      pubkey: 'recipient-pubkey',
      created_at: Math.floor(Date.now() / 1000),
      kind: 0,
      tags: [],
      content: '{}',
      sig: 'kind0-sig',
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

    createZapRequest(privateKey, kind0Event, 5000, 'profile zap', 'recipient-pubkey');

    // recipientPubkey 指定時は { pubkey, ... } で呼ばれる (event は含めない)。
    // event を含めると nostr-tools が kind 0 への e/k/a タグを付加してしまい、
    // 他クライアントが kind 0 zap として認識できなくなる。
    expect(nip57.makeZapRequest).toHaveBeenCalledWith({
      pubkey: 'recipient-pubkey',
      amount: 5000,
      comment: 'profile zap',
      relays: expect.any(Array),
    });
    const callArg = vi.mocked(nip57.makeZapRequest).mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(callArg).not.toHaveProperty('event');
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
