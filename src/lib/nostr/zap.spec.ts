import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { getZapInvoiceFromEndpoint, validateZapReceipt, subscribeToZapReceipts } from './zap.js';
import type { NostrEvent } from './types.js';
import { SimplePool } from 'nostr-tools';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock nostr-tools
vi.mock('nostr-tools', () => ({
  SimplePool: vi.fn(),
}));

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

  it('should handle missing invoice in response', async () => {
    const responseWithoutPr = {
      status: 'OK',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(responseWithoutPr),
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

describe('validateZapReceipt', () => {
  const createMockZapRequest = (id: string = 'zap-request-id'): NostrEvent => ({
    id,
    pubkey: 'zap-pubkey',
    created_at: Math.floor(Date.now() / 1000),
    kind: 9734,
    tags: [],
    content: '',
    sig: 'zap-sig',
  });

  const createMockZapReceipt = (
    targetEventId: string = 'target-event-id',
    zapRequestId: string = 'zap-request-id',
  ): NostrEvent => ({
    id: 'zap-receipt-id',
    pubkey: 'lightning-service-pubkey',
    created_at: Math.floor(Date.now() / 1000),
    kind: 9735,
    tags: [
      ['bolt11', 'lnbc1000n1...'],
      ['description', JSON.stringify({ id: zapRequestId })],
      ['e', targetEventId],
    ],
    content: '',
    sig: 'receipt-sig',
  });

  it('should validate correct zap receipt', () => {
    const targetEventId = 'target-event-id';
    const zapRequest = createMockZapRequest();
    const zapReceipt = createMockZapReceipt(targetEventId, zapRequest.id);

    const result = validateZapReceipt(zapReceipt, targetEventId, zapRequest);

    expect(result).toBe(true);
  });

  it('should reject incorrect kind', () => {
    const targetEventId = 'target-event-id';
    const zapRequest = createMockZapRequest();
    const zapReceipt = { ...createMockZapReceipt(targetEventId, zapRequest.id), kind: 1 };

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = validateZapReceipt(zapReceipt, targetEventId, zapRequest);

    expect(result).toBe(false);
    expect(consoleSpy).toHaveBeenCalledWith('Invalid zap receipt kind:', 1);

    consoleSpy.mockRestore();
  });

  it('should reject missing bolt11 tag', () => {
    const targetEventId = 'target-event-id';
    const zapRequest = createMockZapRequest();
    const zapReceipt = createMockZapReceipt(targetEventId, zapRequest.id);
    zapReceipt.tags = zapReceipt.tags.filter((tag) => tag[0] !== 'bolt11');

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = validateZapReceipt(zapReceipt, targetEventId, zapRequest);

    expect(result).toBe(false);
    expect(consoleSpy).toHaveBeenCalledWith('Missing required tags in zap receipt');

    consoleSpy.mockRestore();
  });

  it('should reject mismatched event ID', () => {
    const targetEventId = 'target-event-id';
    const zapRequest = createMockZapRequest();
    const zapReceipt = createMockZapReceipt('wrong-event-id', zapRequest.id);

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = validateZapReceipt(zapReceipt, targetEventId, zapRequest);

    expect(result).toBe(false);
    expect(consoleSpy).toHaveBeenCalledWith(
      'Zap receipt event ID mismatch:',
      'wrong-event-id',
      'expected:',
      targetEventId,
    );

    consoleSpy.mockRestore();
  });

  it('should reject mismatched zap request ID', () => {
    const targetEventId = 'target-event-id';
    const zapRequest = createMockZapRequest();
    const zapReceipt = createMockZapReceipt(targetEventId, 'wrong-zap-request-id');

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = validateZapReceipt(zapReceipt, targetEventId, zapRequest);

    expect(result).toBe(false);
    expect(consoleSpy).toHaveBeenCalledWith('Zap receipt description ID mismatch');

    consoleSpy.mockRestore();
  });
});

describe('subscribeToZapReceipts', () => {
  let mockPoolInstance: any;

  beforeEach(() => {
    mockPoolInstance = {
      subscribeMany: vi.fn(),
      close: vi.fn(),
    };
    vi.mocked(SimplePool).mockImplementation(() => mockPoolInstance);
    vi.clearAllTimers();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should create subscription with correct parameters', () => {
    const targetEventId = 'target-event-id';
    const zapRequest: NostrEvent = {
      id: 'zap-request-id',
      pubkey: 'zap-pubkey',
      created_at: Math.floor(Date.now() / 1000),
      kind: 9734,
      tags: [],
      content: '',
      sig: 'zap-sig',
    };
    const onZapReceived = vi.fn();

    const mockSubscription = {
      close: vi.fn(),
    };
    mockPoolInstance.subscribeMany.mockReturnValue(mockSubscription);

    const subscription = subscribeToZapReceipts(targetEventId, zapRequest, onZapReceived);

    expect(mockPoolInstance.subscribeMany).toHaveBeenCalledWith(
      expect.any(Array), // relays
      expect.objectContaining({
        kinds: [9735],
        '#e': [targetEventId],
        since: expect.any(Number),
      }),
      expect.objectContaining({
        onevent: expect.any(Function),
        oneose: expect.any(Function),
        onclose: expect.any(Function),
      }),
    );

    expect(subscription.eventId).toBe(targetEventId);
    expect(subscription.onZapReceived).toBe(onZapReceived);
    expect(typeof subscription.stop).toBe('function');
  });

  it('should handle timeout correctly', () => {
    const targetEventId = 'target-event-id';
    const zapRequest: NostrEvent = {
      id: 'zap-request-id',
      pubkey: 'zap-pubkey',
      created_at: Math.floor(Date.now() / 1000),
      kind: 9734,
      tags: [],
      content: '',
      sig: 'zap-sig',
    };
    const onZapReceived = vi.fn();

    const mockSubscription = {
      close: vi.fn(),
    };
    mockPoolInstance.subscribeMany.mockReturnValue(mockSubscription);

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    subscribeToZapReceipts(targetEventId, zapRequest, onZapReceived, 5000);

    // Fast forward time to trigger timeout
    vi.advanceTimersByTime(5000);

    expect(consoleSpy).toHaveBeenCalledWith(`[Zap Monitor] Subscription timeout for event: ${targetEventId}`);
    expect(mockSubscription.close).toHaveBeenCalled();
    expect(mockPoolInstance.close).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('should stop subscription correctly', () => {
    const targetEventId = 'target-event-id';
    const zapRequest: NostrEvent = {
      id: 'zap-request-id',
      pubkey: 'zap-pubkey',
      created_at: Math.floor(Date.now() / 1000),
      kind: 9734,
      tags: [],
      content: '',
      sig: 'zap-sig',
    };
    const onZapReceived = vi.fn();

    const mockSubscription = {
      close: vi.fn(),
    };
    mockPoolInstance.subscribeMany.mockReturnValue(mockSubscription);

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const subscription = subscribeToZapReceipts(targetEventId, zapRequest, onZapReceived);

    subscription.stop();

    expect(consoleSpy).toHaveBeenCalledWith(`[Zap Monitor] Stopping subscription for event: ${targetEventId}`);
    expect(mockSubscription.close).toHaveBeenCalled();

    // Fast forward time to check pool cleanup
    vi.advanceTimersByTime(1000);
    expect(mockPoolInstance.close).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
