import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  getZapInvoiceFromEndpoint,
  validateZapReceipt,
  validateZapReceiptWithCoinos,
  subscribeToZapReceipts,
} from './zap.js';
import type { NostrEvent } from './types.js';
import { SimplePool } from 'nostr-tools';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock nostr-tools
vi.mock('nostr-tools', () => ({
  SimplePool: vi.fn(),
}));

// Mock coinos module
vi.mock('../coinos/index.js', () => ({
  verifyCoinosPayment: vi.fn(),
}));

import { verifyCoinosPayment } from '../coinos/index.js';
const mockVerifyCoinosPayment = vi.mocked(verifyCoinosPayment);

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

  it('should validate zap receipt when allowDirectNostrZap is true (default)', () => {
    const targetEventId = 'target-event-id';
    const zapRequest = createMockZapRequest('zap-request-id');
    // description内のIDが異なる場合でもtrueを返すべき
    const zapReceipt = createMockZapReceipt(targetEventId, 'different-zap-request-id');

    const result = validateZapReceipt(zapReceipt, targetEventId, zapRequest, true);

    expect(result).toBe(true);
  });

  it('should validate description when allowDirectNostrZap is false', () => {
    const targetEventId = 'target-event-id';
    const zapRequest = createMockZapRequest('zap-request-id');
    const zapReceipt = createMockZapReceipt(targetEventId, zapRequest.id);

    const result = validateZapReceipt(zapReceipt, targetEventId, zapRequest, false);

    expect(result).toBe(true);
  });

  it('should reject mismatched description ID when allowDirectNostrZap is false', () => {
    const targetEventId = 'target-event-id';
    const zapRequest = createMockZapRequest('zap-request-id');
    const zapReceipt = createMockZapReceipt(targetEventId, 'different-zap-request-id');

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = validateZapReceipt(zapReceipt, targetEventId, zapRequest, false);

    expect(result).toBe(false);
    expect(consoleSpy).toHaveBeenCalledWith('Zap receipt description ID mismatch');

    consoleSpy.mockRestore();
  });

  it('should reject invalid description JSON when allowDirectNostrZap is false', () => {
    const targetEventId = 'target-event-id';
    const zapRequest = createMockZapRequest('zap-request-id');
    const zapReceipt = createMockZapReceipt(targetEventId, zapRequest.id);
    // description タグを無効なJSONに置き換え
    zapReceipt.tags = zapReceipt.tags.map((tag) => (tag[0] === 'description' ? ['description', 'invalid json'] : tag));

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = validateZapReceipt(zapReceipt, targetEventId, zapRequest, false);

    expect(result).toBe(false);
    expect(consoleSpy).toHaveBeenCalledWith('Invalid zap receipt description JSON:', expect.any(Error));

    consoleSpy.mockRestore();
  });
});

describe('validateZapReceiptWithCoinos', () => {
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
    preimage: string = 'test-preimage',
  ): NostrEvent => ({
    id: 'zap-receipt-id',
    pubkey: 'lightning-service-pubkey',
    created_at: Math.floor(Date.now() / 1000),
    kind: 9735,
    tags: [
      ['bolt11', 'lnbc1000n1...'],
      ['description', JSON.stringify({ id: zapRequestId })],
      ['e', targetEventId],
      ['preimage', preimage],
    ],
    content: '',
    sig: 'receipt-sig',
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should pass validation when both Nostr and Coinos verification succeed', async () => {
    const targetEventId = 'target-event-id';
    const zapRequest = createMockZapRequest();
    const zapReceipt = createMockZapReceipt(targetEventId, zapRequest.id);

    mockVerifyCoinosPayment.mockResolvedValueOnce({
      verified: true,
      matchedPayment: {
        id: 'test-payment-id',
        iid: 'test-iid',
        hash: 'test-hash',
        amount: 1000,
        uid: 'test-uid',
        rate: 17000000,
        currency: 'JPY',
        memo: '{"id":"test-zap-request-id"}',
        payment_hash: 'test-payment-hash',
        ref: 'test-preimage',
        tip: 0,
        type: 'lightning',
        confirmed: true,
        created: Date.now(),
      },
    });

    const result = await validateZapReceiptWithCoinos(zapReceipt, targetEventId, zapRequest, true, 'test-api-token');

    expect(result.valid).toBe(true);
    expect(result.coinosVerified).toBe(true);
    expect(mockVerifyCoinosPayment).toHaveBeenCalledWith(zapReceipt, 'test-api-token');
  });

  it('should pass validation without Coinos verification when no API token provided', async () => {
    const targetEventId = 'target-event-id';
    const zapRequest = createMockZapRequest();
    const zapReceipt = createMockZapReceipt(targetEventId, zapRequest.id);

    const result = await validateZapReceiptWithCoinos(
      zapReceipt,
      targetEventId,
      zapRequest,
      true,
      undefined, // No API token
    );

    expect(result.valid).toBe(true);
    expect(result.coinosVerified).toBe(false);
    expect(mockVerifyCoinosPayment).not.toHaveBeenCalled();
  });

  it('should pass validation without Coinos verification when empty API token provided', async () => {
    const targetEventId = 'target-event-id';
    const zapRequest = createMockZapRequest();
    const zapReceipt = createMockZapReceipt(targetEventId, zapRequest.id);

    const result = await validateZapReceiptWithCoinos(
      zapReceipt,
      targetEventId,
      zapRequest,
      true,
      '   ', // Empty/whitespace API token
    );

    expect(result.valid).toBe(true);
    expect(result.coinosVerified).toBe(false);
    expect(mockVerifyCoinosPayment).not.toHaveBeenCalled();
  });

  it('should fail validation when basic Nostr validation fails', async () => {
    const targetEventId = 'target-event-id';
    const zapRequest = createMockZapRequest();
    const zapReceipt = { ...createMockZapReceipt(targetEventId, zapRequest.id), kind: 1 }; // Invalid kind

    const result = await validateZapReceiptWithCoinos(zapReceipt, targetEventId, zapRequest, true, 'test-api-token');

    expect(result.valid).toBe(false);
    expect(result.error).toBe('Basic zap receipt validation failed');
    expect(mockVerifyCoinosPayment).not.toHaveBeenCalled();
  });

  it('should fail validation when Coinos verification fails', async () => {
    const targetEventId = 'target-event-id';
    const zapRequest = createMockZapRequest();
    const zapReceipt = createMockZapReceipt(targetEventId, zapRequest.id);

    mockVerifyCoinosPayment.mockResolvedValueOnce({
      verified: false,
      error: 'No matching payment found in Coinos API',
    });

    const result = await validateZapReceiptWithCoinos(zapReceipt, targetEventId, zapRequest, true, 'test-api-token');

    expect(result.valid).toBe(false);
    expect(result.coinosVerified).toBe(false);
    expect(result.error).toBe('Coinos verification failed: No matching payment found in Coinos API');
    expect(mockVerifyCoinosPayment).toHaveBeenCalledWith(zapReceipt, 'test-api-token');
  });

  it('should handle unexpected errors during verification', async () => {
    const targetEventId = 'target-event-id';
    const zapRequest = createMockZapRequest();
    const zapReceipt = createMockZapReceipt(targetEventId, zapRequest.id);

    mockVerifyCoinosPayment.mockRejectedValueOnce(new Error('Network error'));

    const result = await validateZapReceiptWithCoinos(zapReceipt, targetEventId, zapRequest, true, 'test-api-token');

    expect(result.valid).toBe(false);
    expect(result.error).toContain('Verification error: Network error');
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

  it('should pass allowDirectNostrZap parameter to validateZapReceipt', async () => {
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

    // allowDirectNostrZap = false でサブスクリプションを作成
    subscribeToZapReceipts(targetEventId, zapRequest, onZapReceived, 5000, false);

    // oneventコールバックを取得
    const subscribeArgs = mockPoolInstance.subscribeMany.mock.calls[0];
    const handlers = subscribeArgs[2];
    const oneventHandler = handlers.onevent;

    // テスト用のzap receiptイベント
    const zapReceipt: NostrEvent = {
      id: 'zap-receipt-id',
      pubkey: 'lightning-service-pubkey',
      created_at: Math.floor(Date.now() / 1000),
      kind: 9735,
      tags: [
        ['bolt11', 'lnbc1000n1...'],
        ['description', JSON.stringify({ id: 'different-id' })], // 異なるIDを設定
        ['e', targetEventId],
      ],
      content: '',
      sig: 'receipt-sig',
    };

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // oneventを呼び出し（非同期処理を待つ）
    await oneventHandler(zapReceipt);

    // allowDirectNostrZap = false の場合、description検証が実行され、onZapReceivedは呼ばれないはず
    expect(onZapReceived).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      `[Zap Monitor] Invalid zap receipt for event: ${targetEventId}`,
      expect.any(String),
    );

    consoleSpy.mockRestore();
  });
});
