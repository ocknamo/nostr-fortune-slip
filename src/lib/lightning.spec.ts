import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { LightningAddress, type LNURLPayResponse, type InvoiceResponse } from './lightning';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('LightningAddress', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create LightningAddress with valid address', () => {
      const address = 'user@example.com';
      const lightningAddress = new LightningAddress(address);

      expect(lightningAddress).toBeInstanceOf(LightningAddress);
      expect(lightningAddress.data).toBeNull();
    });

    it('should throw error for invalid address format', () => {
      const invalidAddresses = ['invalid-address', '@example.com', 'user@', '', 'user@@example.com', 'user@example'];

      invalidAddresses.forEach((address) => {
        expect(() => new LightningAddress(address)).toThrow('Invalid lightning address format');
      });
    });

    it('should handle edge case addresses', () => {
      const edgeCases = [
        'a@b.co', // minimal valid
        'user123@sub.domain.com', // subdomain
        'user_name@example-domain.org', // underscores and hyphens
      ];

      edgeCases.forEach((address) => {
        expect(() => new LightningAddress(address)).not.toThrow();
      });
    });
  });

  describe('fetchAddressData', () => {
    const validAddress = 'user@example.com';

    it('should fetch and set address data successfully', async () => {
      const mockResponse: LNURLPayResponse = {
        callback: 'https://example.com/callback',
        maxSendable: 1000000,
        minSendable: 1000,
        metadata: '[]',
        tag: 'payRequest',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const lightningAddress = new LightningAddress(validAddress);
      await lightningAddress.fetchAddressData();

      expect(mockFetch).toHaveBeenCalledWith('https://example.com/.well-known/lnurlp/user');
      expect(lightningAddress.data).toEqual(mockResponse);
    });

    it('should throw error when fetch fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const lightningAddress = new LightningAddress(validAddress);

      await expect(lightningAddress.fetchAddressData()).rejects.toThrow('Failed to fetch lightning address data');
    });

    it('should handle error response from server', async () => {
      const errorResponse = {
        status: 'ERROR',
        reason: 'Address not found',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(errorResponse),
      });

      const lightningAddress = new LightningAddress(validAddress);

      await expect(lightningAddress.fetchAddressData()).rejects.toThrow('Failed to fetch lightning address data');
    });
  });

  describe('getInvoice', () => {
    const validAddress = 'user@example.com';
    let lightningAddress: LightningAddress;

    beforeEach(async () => {
      const mockResponse: LNURLPayResponse = {
        callback: 'https://example.com/callback',
        maxSendable: 1000000,
        minSendable: 1000,
        metadata: '[]',
        tag: 'payRequest',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      lightningAddress = new LightningAddress(validAddress);
      await lightningAddress.fetchAddressData();
      mockFetch.mockClear();
    });

    it('should get invoice for valid amount', async () => {
      const mockInvoice: InvoiceResponse = {
        pr: 'lnbc1000n1pjkhxhkpp5...',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockInvoice),
      });

      const amount = 5000; // within min/max range
      const invoice = await lightningAddress.getInvoice(amount);

      expect(mockFetch).toHaveBeenCalledWith('https://example.com/callback?amount=5000');
      expect(invoice).toEqual(mockInvoice);
    });

    it('should throw error for amount too high', async () => {
      const amount = 2000000; // exceeds maxSendable

      await expect(lightningAddress.getInvoice(amount)).rejects.toThrow('Amount must be between 1 and 1000 sats');
    });

    it('should throw error for amount too low', async () => {
      const amount = 500; // below minSendable

      await expect(lightningAddress.getInvoice(amount)).rejects.toThrow('Amount must be between 1 and 1000 sats');
    });

    it('should throw error when data not loaded', async () => {
      const newAddress = new LightningAddress('test@example.com');

      await expect(newAddress.getInvoice(5000)).rejects.toThrow(
        'Lightning address data not loaded. Call fetchAddressData() first',
      );
    });

    it('should handle invoice generation error', async () => {
      const errorResponse: InvoiceResponse = {
        pr: '',
        status: 'ERROR',
        reason: 'Insufficient liquidity',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(errorResponse),
      });

      await expect(lightningAddress.getInvoice(5000)).rejects.toThrow('Failed to get invoice');
    });
  });
});
