import { describe, expect, it, vi, beforeEach } from 'vitest';
import { generateLightningQRCode } from './qrcode';
import QRCode from 'qrcode';

// Mock QRCode library
vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn(),
  },
}));

describe('generateLightningQRCode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate QR code for valid invoice', async () => {
    const mockInvoice = 'lnbc1000n1pjkhxhkpp5testinvoicedata';
    const expectedDataURL = 'data:image/png;base64,iVBORw0KGgoAAAANSU...';
    
    vi.mocked(QRCode.toDataURL).mockResolvedValue(expectedDataURL as any);

    const result = await generateLightningQRCode(mockInvoice);

    expect(result).toBe(expectedDataURL);
    expect(QRCode.toDataURL).toHaveBeenCalledWith(
      `lightning:${mockInvoice}`,
      {
        type: 'image/png',
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
        width: 256,
      }
    );
  });

  it('should handle QRCode generation error', async () => {
    const mockInvoice = 'lnbc1000n1pjkhxhkpp5testinvoicedata';
    const mockError = new Error('QRCode generation failed');
    
    vi.mocked(QRCode.toDataURL).mockRejectedValue(mockError as any);

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(generateLightningQRCode(mockInvoice)).rejects.toThrow(
      'QR code generation failed'
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to generate QR code:',
      mockError
    );

    consoleErrorSpy.mockRestore();
  });

  it('should handle empty invoice string', async () => {
    const mockInvoice = '';
    const expectedDataURL = 'data:image/png;base64,empty...';
    
    vi.mocked(QRCode.toDataURL).mockResolvedValue(expectedDataURL as any);

    const result = await generateLightningQRCode(mockInvoice);

    expect(result).toBe(expectedDataURL);
    expect(QRCode.toDataURL).toHaveBeenCalledWith(
      'lightning:',
      expect.any(Object)
    );
  });

  it('should handle very long invoice', async () => {
    // Test with a typical long Lightning invoice
    const longInvoice = 'lnbc1000n1pjkhxhkpp5testinvoicedatawithverylongstringthatmightcauseproblemsinqrcodegenerationbutshouldbethandledcorrectly';
    const expectedDataURL = 'data:image/png;base64,long...';
    
    vi.mocked(QRCode.toDataURL).mockResolvedValue(expectedDataURL as any);

    const result = await generateLightningQRCode(longInvoice);

    expect(result).toBe(expectedDataURL);
    expect(QRCode.toDataURL).toHaveBeenCalledWith(
      `lightning:${longInvoice}`,
      expect.any(Object)
    );
  });

  it('should use correct QR code options', async () => {
    const mockInvoice = 'lnbc1000n1pjkhxhkpp5testinvoicedata';
    const expectedDataURL = 'data:image/png;base64,test...';
    
    vi.mocked(QRCode.toDataURL).mockResolvedValue(expectedDataURL as any);

    await generateLightningQRCode(mockInvoice);

    const [, options] = vi.mocked(QRCode.toDataURL).mock.calls[0];
    
    expect(options).toEqual({
      type: 'image/png',
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
      width: 256,
    });
  });
});
