import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  Metadata,
  decodeNsec,
  createTextEvent,
  createZapRequest,
  createMetadataEvent,
  getZapInvoiceFromEndpoint,
  publishEvent,
  type NostrEvent,
  type MetadataContent,
} from './nostr';
import { nip19, nip57, SimplePool } from 'nostr-tools';

// Mock nostr-tools
vi.mock('nostr-tools', () => ({
  nip19: {
    decode: vi.fn(),
  },
  nip57: {
    getZapEndpoint: vi.fn(),
    makeZapRequest: vi.fn(),
  },
  SimplePool: vi.fn(),
  getPublicKey: vi.fn(),
  finalizeEvent: vi.fn(),
}));

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('Metadata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should parse valid metadata content', () => {
    const validContent: MetadataContent = {
      name: 'testuser',
      display_name: 'Test User',
      lud16: 'test@example.com',
    };

    const event: NostrEvent = {
      id: 'test-id',
      pubkey: 'test-pubkey',
      created_at: Math.floor(Date.now() / 1000),
      kind: 0,
      tags: [],
      content: JSON.stringify(validContent),
      sig: 'test-sig',
    };

    const metadata = new Metadata(event);

    expect(metadata.content).toEqual(validContent);
    expect(metadata.canZap).toBe(true);
  });

  it('should handle invalid JSON content', () => {
    const event: NostrEvent = {
      id: 'test-id',
      pubkey: 'test-pubkey',
      created_at: Math.floor(Date.now() / 1000),
      kind: 0,
      tags: [],
      content: 'invalid json',
      sig: 'test-sig',
    };

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const metadata = new Metadata(event);

    expect(metadata.content).toBeUndefined();
    expect(metadata.canZap).toBe(false);
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('should check canZap property correctly', () => {
    const withLud16: MetadataContent = { lud16: 'test@example.com' };
    const withLud06: MetadataContent = { lud06: 'LNURL...' };
    const withoutZap: MetadataContent = { name: 'test' };

    [withLud16, withLud06, withoutZap].forEach((content, index) => {
      const event: NostrEvent = {
        id: `test-id-${index}`,
        pubkey: 'test-pubkey',
        created_at: Math.floor(Date.now() / 1000),
        kind: 0,
        tags: [],
        content: JSON.stringify(content),
        sig: 'test-sig',
      };

      const metadata = new Metadata(event);
      expect(metadata.canZap).toBe(index < 2); // first two should be true
    });
  });

  it('should cache zapUrl result', async () => {
    const event: NostrEvent = {
      id: 'test-id',
      pubkey: 'test-pubkey',
      created_at: Math.floor(Date.now() / 1000),
      kind: 0,
      tags: [],
      content: JSON.stringify({ lud16: 'test@example.com' }),
      sig: 'test-sig',
    };

    vi.mocked(nip57.getZapEndpoint).mockResolvedValue('https://example.com/zap');

    const metadata = new Metadata(event);

    const url1 = await metadata.zapUrl();
    const url2 = await metadata.zapUrl();

    expect(url1).toBe('https://example.com/zap');
    expect(url2).toBe('https://example.com/zap');
    expect(nip57.getZapEndpoint).toHaveBeenCalledTimes(1);
  });
});

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
  it('should create valid text event', async () => {
    const privateKey = new Uint8Array(32);
    const mockEvent = {
      id: 'test-id',
      pubkey: 'test-pubkey',
      created_at: Math.floor(Date.now() / 1000),
      kind: 1,
      tags: [],
      content: 'test content',
      sig: 'test-sig',
      // biome-ignore lint/suspicious/noExplicitAny: test
    } as any;

    const { getPublicKey, finalizeEvent } = await import('nostr-tools');
    vi.mocked(getPublicKey).mockReturnValue('test-pubkey');
    vi.mocked(finalizeEvent).mockReturnValue(mockEvent);

    const result = createTextEvent(privateKey, 'test content');

    expect(result).toEqual(mockEvent);
  });
});

describe('createZapRequest', () => {
  it('should create valid zap request event', async () => {
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
      // biome-ignore lint/suspicious/noExplicitAny: test
    } as any;

    vi.mocked(nip57.makeZapRequest).mockReturnValue(mockZapRequest);
    const { finalizeEvent } = await import('nostr-tools');
    vi.mocked(finalizeEvent).mockReturnValue(mockSignedEvent);

    const result = createZapRequest(privateKey, targetEvent, 5000, 'test zap');

    expect(result).toEqual(mockSignedEvent);
    expect(nip57.makeZapRequest).toHaveBeenCalledWith({
      event: targetEvent,
      amount: 5000,
      comment: 'test zap',
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
  });

  it('should create metadata event without lud16', () => {
    const result = createMetadataEvent('test-pubkey');

    expect(result.kind).toBe(0);
    expect(result.pubkey).toBe('test-pubkey');
    expect(JSON.parse(result.content)).toEqual({});
  });
});

describe('getZapInvoiceFromEndpoint', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  it('should get invoice successfully', async () => {
    const mockInvoice = { pr: 'lnbc1000n1...' };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockInvoice),
    });

    const zapRequest: NostrEvent = {
      id: 'zap-id',
      pubkey: 'zap-pubkey',
      created_at: Math.floor(Date.now() / 1000),
      kind: 9734,
      tags: [],
      content: '',
      sig: 'zap-sig',
    };

    const result = await getZapInvoiceFromEndpoint('https://example.com/zap', 5000, zapRequest);

    expect(result).toEqual(mockInvoice);
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('https://example.com/zap?amount=5000&nostr='));
  });

  it('should handle fetch error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const zapRequest: NostrEvent = {
      id: 'zap-id',
      pubkey: 'zap-pubkey',
      created_at: Math.floor(Date.now() / 1000),
      kind: 9734,
      tags: [],
      content: '',
      sig: 'zap-sig',
    };

    await expect(getZapInvoiceFromEndpoint('https://example.com/zap', 5000, zapRequest)).rejects.toThrow(
      'Failed to get Zap invoice from endpoint',
    );
  });

  it('should handle error response', async () => {
    const errorResponse = {
      status: 'ERROR',
      reason: 'Insufficient liquidity',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(errorResponse),
    });

    const zapRequest: NostrEvent = {
      id: 'zap-id',
      pubkey: 'zap-pubkey',
      created_at: Math.floor(Date.now() / 1000),
      kind: 9734,
      tags: [],
      content: '',
      sig: 'zap-sig',
    };

    await expect(getZapInvoiceFromEndpoint('https://example.com/zap', 5000, zapRequest)).rejects.toThrow(
      'Failed to get Zap invoice from endpoint',
    );
  });
});

describe('publishEvent', () => {
  // biome-ignore lint/suspicious/noExplicitAny: test
  let mockPoolInstance: any;

  beforeEach(() => {
    mockPoolInstance = {
      publish: vi.fn(),
      close: vi.fn(),
    };
    vi.mocked(SimplePool).mockImplementation(() => mockPoolInstance);
    vi.clearAllTimers();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should publish event successfully', async () => {
    const mockEvent: NostrEvent = {
      id: 'test-id',
      pubkey: 'test-pubkey',
      created_at: Math.floor(Date.now() / 1000),
      kind: 1,
      tags: [],
      content: 'test content',
      sig: 'test-sig',
    };

    // Mock successful publish
    const mockPromise = Promise.resolve('success');
    mockPoolInstance.publish.mockReturnValue([mockPromise]);

    const publishPromise = publishEvent(mockEvent);

    await publishPromise;

    // Fast forward timers for cleanup
    vi.advanceTimersByTime(1000);

    expect(mockPoolInstance.publish).toHaveBeenCalledWith(expect.any(Array), mockEvent);
    expect(mockPoolInstance.close).toHaveBeenCalled();
  });

  it('should handle all relays failing', async () => {
    const mockEvent: NostrEvent = {
      id: 'test-id',
      pubkey: 'test-pubkey',
      created_at: Math.floor(Date.now() / 1000),
      kind: 1,
      tags: [],
      content: 'test content',
      sig: 'test-sig',
    };

    // Mock all promises failing
    const mockPromise = Promise.reject(new Error('Relay connection failed'));
    mockPoolInstance.publish.mockReturnValue([mockPromise]);

    await expect(publishEvent(mockEvent)).rejects.toThrow('Failed to publish to any relay');
  });
});
