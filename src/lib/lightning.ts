import { bech32 } from 'bech32';

/**
 * ライトニングアドレスの正規表現
 */
const ADDRESS_REGEXP = /^[A-Za-z0-9][A-Za-z0-9_.-]*@[A-Za-z0-9_.-]+\.[A-Za-z0-9]+$/;

/**
 * LNURL-pay レスポンスの型定義
 */
export interface LNURLPayResponse {
  callback: string;
  maxSendable: number;
  minSendable: number;
  metadata: string;
  tag: 'payRequest';
  allowsNostr?: boolean;
  nostrPubkey?: string;
}

/**
 * インボイスレスポンスの型定義
 */
export interface InvoiceResponse {
  pr: string; // bolt11 invoice
  routes?: any[];
  status?: 'ERROR';
  reason?: string;
}

/**
 * ライトニングアドレス処理クラス
 */
export class LightningAddress {
  private domain: string = '';
  private userName: string = '';
  private lightningAddressStr: string = '';
  public data: LNURLPayResponse | null = null;

  constructor(lightningAddressString: string) {
    if (!ADDRESS_REGEXP.test(lightningAddressString)) {
      throw new Error('Invalid lightning address format');
    }

    this.lightningAddressStr = lightningAddressString;
    const [userName, domain] = lightningAddressString.split('@');
    this.domain = domain;
    this.userName = userName;
  }

  /**
   * LNURL-pay データを取得
   */
  async fetchAddressData(): Promise<void> {
    if (!this.domain || !this.userName) {
      throw new Error('Invalid lightning address');
    }

    // LUD-16: https://github.com/lnurl/luds/blob/luds/16.md
    const url = `https://${this.domain}/.well-known/lnurlp/${this.userName}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Cannot fetch lightning address data');
      }

      const responseData = await response.json();

      // Check for error response
      if (responseData.status === 'ERROR') {
        throw new Error(responseData.reason || 'Lightning address returned error');
      }

      // Validate successful response
      if (!responseData || responseData.tag !== 'payRequest' || !responseData.callback) {
        throw new Error('Invalid lightning address response');
      }

      this.data = responseData;
    } catch (error) {
      console.error('Failed to fetch lightning address data:', error);
      throw new Error('Failed to fetch lightning address data');
    }
  }

  /**
   * 指定した金額のインボイスを取得
   * @param amount ミリサトシ
   */
  async getInvoice(amount: number): Promise<InvoiceResponse> {
    if (!this.data || this.data.tag !== 'payRequest' || !this.data.callback) {
      throw new Error('Lightning address data not loaded. Call fetchAddressData() first');
    }

    // 金額のバリデーション
    if (amount > this.data.maxSendable || amount < (this.data.minSendable ?? 0)) {
      const minSats = (this.data.minSendable ?? 0) / 1000;
      const maxSats = this.data.maxSendable / 1000;
      throw new Error(`Amount must be between ${minSats} and ${maxSats} sats`);
    }

    const callbackUrl = new URL(this.data.callback);
    callbackUrl.searchParams.append('amount', amount.toString());

    try {
      const response = await fetch(callbackUrl.toString());
      if (!response.ok) {
        throw new Error('Cannot get invoice from lightning address');
      }

      const invoice: InvoiceResponse = await response.json();

      if (invoice.status === 'ERROR') {
        throw new Error(invoice.reason || 'Invoice generation failed');
      }

      return invoice;
    } catch (error) {
      console.error('Failed to get invoice:', error);
      throw new Error('Failed to get invoice');
    }
  }

  /**
   * ライトニングアドレスをLNURL形式に変換
   */
  toLnurl(): string {
    if (!this.lightningAddressStr) {
      throw new Error('No lightning address set');
    }

    const url = `https://${this.domain}/.well-known/lnurlp/${this.userName}`;
    // ブラウザ環境ではBufferの代わりにTextEncoderを使用
    const encoder = new TextEncoder();
    const bytes = encoder.encode(url);
    const words = bech32.toWords(bytes);
    return bech32.encode('lnurl', words, 2000);
  }

  /**
   * ライトニングアドレス文字列を取得
   */
  toString(): string {
    return this.lightningAddressStr;
  }

  /**
   * 有効なアドレスかどうかを確認
   */
  hasValidAddress(): boolean {
    return !!this.lightningAddressStr;
  }
}

/**
 * 1 satのインボイスを取得するヘルパー関数
 */
export async function getOneStatInvoice(lightningAddress: string): Promise<string> {
  const address = new LightningAddress(lightningAddress);
  await address.fetchAddressData();

  const invoice = await address.getInvoice(1000); // 1 sat = 1000 millisats
  return invoice.pr;
}
