/**
 * Coinos API関連の型定義
 */

export interface CoinosPayment {
  id: string;
  iid: string;
  hash: string;
  amount: number;
  uid: string;
  rate: number;
  currency: string;
  memo: string;
  payment_hash: string;
  ref: string; // preimage
  tip: number;
  type: string;
  confirmed: boolean;
  created: number;
}

export interface CoinosIncoming {
  [currency: string]: {
    tips: number;
    fiatTips: string;
    sats: number;
    fiat: string;
  };
}

export interface CoinosPaymentResponse {
  payments: CoinosPayment[];
  count: number;
  incoming: CoinosIncoming;
  outgoing: Record<string, any>;
}

export interface CoinosApiError {
  error: string;
  message: string;
  status?: number;
}

export interface CoinosVerificationResult {
  verified: boolean;
  error?: string;
  matchedPayment?: CoinosPayment;
}
