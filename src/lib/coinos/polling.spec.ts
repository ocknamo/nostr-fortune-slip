import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startCoinosPolling } from './polling';
import * as coinosModule from './api';

// getCoinosPaymentsをモック
vi.mock('./api', () => ({
  getCoinosPayments: vi.fn(),
}));

describe('startCoinosPolling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should detect payment when memo content matches payment ID', async () => {
    const mockPaymentId = 'test-payment-id-123';
    const mockToken = 'test-token';
    let detectedPayment: any = null;

    const onPaymentDetected = vi.fn((payment) => {
      detectedPayment = payment;
    });

    // モックのペイメントレスポンスを設定
    const mockPaymentResponse = {
      payments: [
        {
          id: 'payment-1',
          iid: 'iid-1',
          hash: 'hash-1',
          amount: 1,
          uid: 'uid-1',
          rate: 1000000,
          currency: 'JPY',
          memo: JSON.stringify({
            content: mockPaymentId,
          }),
          payment_hash: 'payment-hash-1',
          ref: 'ref-1',
          tip: 0,
          type: 'lightning' as const,
          confirmed: true,
          created: Date.now(),
        },
      ],
      count: 1,
      incoming: {
        JPY: {
          tips: 0,
          fiatTips: '0.00',
          sats: 1,
          fiat: '0.01',
        },
      },
      outgoing: {},
    };

    vi.spyOn(coinosModule, 'getCoinosPayments').mockResolvedValue(mockPaymentResponse);

    // ポーリングを開始
    const subscription = startCoinosPolling(
      mockPaymentId,
      mockToken,
      onPaymentDetected,
      1000, // 1秒間隔（テスト用）
      5000, // 5秒タイムアウト（テスト用）
    );

    // 初回ポーリングを実行（即座に実行される）
    await vi.runAllTimersAsync();

    // コールバックが呼ばれたことを確認
    expect(onPaymentDetected).toHaveBeenCalledTimes(1);
    expect(detectedPayment).toBeDefined();
    expect(detectedPayment.id).toBe('payment-1');

    // クリーンアップ
    subscription.stop();
  });
});
