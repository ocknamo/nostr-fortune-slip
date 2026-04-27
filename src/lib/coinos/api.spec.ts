import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getCoinosPayments, verifyCoinosPayment, extractZapReceiptData, CoinosApiError } from './api.js';
import type { NostrEvent } from '../nostr/types.js';
import type { CoinosPaymentResponse } from './types.js';

// グローバルfetchをモック
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('Coinos API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getCoinosPayments', () => {
    it('正常にAPI呼び出しを行う', async () => {
      const mockResponse: CoinosPaymentResponse = {
        payments: [
          {
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
        ],
        count: 1,
        incoming: {
          JPY: {
            tips: 0,
            fiatTips: '0.00',
            sats: 1000,
            fiat: '1.70',
          },
        },
        outgoing: {},
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await getCoinosPayments('test-token', 10);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://coinos.io/api/payments?limit=10',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
            Accept: 'application/json',
            'Content-Type': 'application/json',
          }),
        }),
      );

      expect(result).toEqual(mockResponse);
    });

    it('空のトークンでエラーを投げる', async () => {
      await expect(getCoinosPayments('')).rejects.toThrow(CoinosApiError);
      await expect(getCoinosPayments('   ')).rejects.toThrow('API token is required');
    });

    it('APIエラーレスポンスでCoinosApiErrorを投げる', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: () => Promise.resolve('Invalid token'),
      });

      await expect(getCoinosPayments('invalid-token')).rejects.toThrow(CoinosApiError);
    });

    it('ネットワークエラーでCoinosApiErrorを投げる', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'));

      await expect(getCoinosPayments('test-token')).rejects.toThrow(CoinosApiError);
    });

    it('タイムアウトエラーでCoinosApiErrorを投げる', async () => {
      const timeoutError = new DOMException('Timeout', 'TimeoutError');
      mockFetch.mockRejectedValueOnce(timeoutError);

      await expect(getCoinosPayments('test-token')).rejects.toThrow(CoinosApiError);
    });
  });

  describe('extractZapReceiptData', () => {
    it('preimageタグを正しく抽出する', () => {
      const zapReceipt: NostrEvent = {
        id: 'test-id',
        pubkey: 'test-pubkey',
        created_at: Math.floor(Date.now() / 1000),
        kind: 9735,
        tags: [
          ['preimage', 'test-preimage-value'],
          ['bolt11', 'test-invoice'],
        ],
        content: '',
        sig: 'test-sig',
      };

      const result = extractZapReceiptData(zapReceipt);

      expect(result).toEqual({
        preimage: 'test-preimage-value',
      });
    });

    it('preimageタグがない場合はnullを返す', () => {
      const zapReceipt: NostrEvent = {
        id: 'test-id',
        pubkey: 'test-pubkey',
        created_at: Math.floor(Date.now() / 1000),
        kind: 9735,
        tags: [['bolt11', 'test-invoice']],
        content: '',
        sig: 'test-sig',
      };

      const result = extractZapReceiptData(zapReceipt);

      expect(result).toBeNull();
    });
  });

  describe('verifyCoinosPayment', () => {
    const mockZapReceipt: NostrEvent = {
      id: 'test-zap-receipt-id',
      pubkey: 'test-pubkey',
      created_at: Math.floor(Date.now() / 1000),
      kind: 9735,
      tags: [
        ['preimage', 'matching-preimage'],
        ['bolt11', 'test-invoice'],
        ['description', '{"id":"test-zap-request-id"}'],
      ],
      content: '',
      sig: 'test-sig',
    };

    it('一致する支払いが見つかった場合、検証成功を返す', async () => {
      const mockPayments: CoinosPaymentResponse = {
        payments: [
          {
            id: 'test-payment-id',
            iid: 'test-iid',
            hash: 'test-hash',
            amount: 1000,
            uid: 'test-uid',
            rate: 17000000,
            currency: 'JPY',
            memo: '{"id":"test-zap-request-id"}',
            payment_hash: 'test-payment-hash',
            ref: 'matching-preimage',
            tip: 0,
            type: 'lightning',
            confirmed: true,
            created: mockZapReceipt.created_at * 1000, // ミリ秒
          },
        ],
        count: 1,
        incoming: { JPY: { tips: 0, fiatTips: '0.00', sats: 1000, fiat: '1.70' } },
        outgoing: {},
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPayments),
      });

      const result = await verifyCoinosPayment(mockZapReceipt, 'test-token');

      expect(result.verified).toBe(true);
      expect(result.matchedPayment).toBeDefined();
      expect(result.matchedPayment?.ref).toBe('matching-preimage');
    });

    it('一致する支払いが見つからない場合、検証失敗を返す', async () => {
      const mockPayments: CoinosPaymentResponse = {
        payments: [
          {
            id: 'test-payment-id',
            iid: 'test-iid',
            hash: 'test-hash',
            amount: 1000,
            uid: 'test-uid',
            rate: 17000000,
            currency: 'JPY',
            memo: '{"id":"different-zap-request-id"}',
            payment_hash: 'test-payment-hash',
            ref: 'different-preimage', // 異なるpreimage
            tip: 0,
            type: 'lightning',
            confirmed: true,
            created: mockZapReceipt.created_at * 1000,
          },
        ],
        count: 1,
        incoming: { JPY: { tips: 0, fiatTips: '0.00', sats: 1000, fiat: '1.70' } },
        outgoing: {},
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPayments),
      });

      const result = await verifyCoinosPayment(mockZapReceipt, 'test-token');

      expect(result.verified).toBe(false);
      expect(result.error).toBe('No matching confirmed payment found in Coinos API');
    });

    it('preimageが抽出できない場合、検証失敗を返す', async () => {
      const zapReceiptWithoutPreimage: NostrEvent = {
        ...mockZapReceipt,
        tags: [
          ['bolt11', 'test-invoice'],
          ['description', '{"id":"test-zap-request-id"}'],
        ],
      };

      const result = await verifyCoinosPayment(zapReceiptWithoutPreimage, 'test-token');

      expect(result.verified).toBe(false);
      expect(result.error).toBe('Unable to extract preimage from zap receipt');
    });

    it('API呼び出しエラーの場合、検証失敗を返す', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await verifyCoinosPayment(mockZapReceipt, 'test-token');

      expect(result.verified).toBe(false);
      expect(result.error).toContain('Network error');
    });
  });
});
