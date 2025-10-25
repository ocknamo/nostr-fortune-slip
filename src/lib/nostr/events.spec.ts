import { describe, expect, it, vi } from 'vitest';
import { decodeNsec, createTextEvent, createZapRequest, createMetadataEvent } from './events.js';
import type { NostrEvent } from './types.js';
import { nip19, nip57, getPublicKey, finalizeEvent } from 'nostr-tools';

// Mock nostr-tools
vi.mock('nostr-tools', () => ({
  nip19: {
    decode: vi.fn(),
  },
  nip57: {
    makeZapRequest: vi.fn(),
  },
  getPublicKey: vi.fn(),
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

    vi.mocked(getPublicKey).mockReturnValue('test-pubkey');
    vi.mocked(finalizeEvent).mockReturnValue(mockEvent);

    const result = createTextEvent(privateKey, 'test content');

    expect(result).toEqual(mockEvent);
    expect(getPublicKey).toHaveBeenCalledWith(privateKey);
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
