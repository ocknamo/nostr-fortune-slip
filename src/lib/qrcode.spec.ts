import { describe, expect, it, vi, beforeEach } from 'vitest';
import { generateLightningQRCode } from './qrcode';
import QRCode from 'qrcode';

// Mock QRCode library
vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn(),
  },
}));

// Mock canvas API for browser environment
class MockCanvasContext {
  drawImage = vi.fn();
  clearRect = vi.fn();
  beginPath = vi.fn();
  arc = vi.fn();
  fill = vi.fn();
  save = vi.fn();
  restore = vi.fn();
  clip = vi.fn();
}

class MockCanvas {
  width = 0;
  height = 0;
  private context = new MockCanvasContext();

  getContext() {
    return this.context;
  }

  toDataURL() {
    return 'data:image/png;base64,mockedWithIcon';
  }
}

class MockImage {
  onload: (() => void) | null = null;
  onerror: ((error: Error) => void) | null = null;
  src = '';

  constructor() {
    // Simulate successful image load after a microtask
    Promise.resolve().then(() => {
      if (this.onload) {
        this.onload();
      }
    });
  }
}

// Setup global mocks for DOM APIs
global.document = {
  createElement: (tag: string) => {
    if (tag === 'canvas') {
      return new MockCanvas() as any;
    }
    return {} as any;
  },
} as any;

global.Image = MockImage as any;

describe('generateLightningQRCode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate QR code with lightning icon overlay', async () => {
    const mockInvoice = 'lnbc1000n1pjkhxhkpp5testinvoicedata';
    const mockQRDataURL = 'data:image/png;base64,mockQRCode';

    // biome-ignore lint/suspicious/noExplicitAny: test
    vi.mocked(QRCode.toDataURL).mockResolvedValue(mockQRDataURL as any);

    const result = await generateLightningQRCode(mockInvoice);

    // Should return a data URL with the icon overlay applied
    expect(result).toBe('data:image/png;base64,mockedWithIcon');
    expect(QRCode.toDataURL).toHaveBeenCalledWith(`lightning:${mockInvoice}`, {
      type: 'image/png',
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
      width: 256,
    });
  });

  it('should generate QR code for valid invoice', async () => {
    const mockInvoice = 'lnbc1000n1pjkhxhkpp5testinvoicedata';
    const expectedDataURL = 'data:image/png;base64,iVBORw0KGgoAAAANSU...';

    // biome-ignore lint/suspicious/noExplicitAny: test
    vi.mocked(QRCode.toDataURL).mockResolvedValue(expectedDataURL as any);

    const result = await generateLightningQRCode(mockInvoice);

    expect(result).toBeDefined();
    expect(result).toMatch(/^data:image\/png;base64,/);
    expect(QRCode.toDataURL).toHaveBeenCalledWith(`lightning:${mockInvoice}`, {
      type: 'image/png',
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
      width: 256,
    });
  });

  it('should handle QRCode generation error', async () => {
    const mockInvoice = 'lnbc1000n1pjkhxhkpp5testinvoicedata';
    const mockError = new Error('QRCode generation failed');

    // biome-ignore lint/suspicious/noExplicitAny: test
    vi.mocked(QRCode.toDataURL).mockRejectedValue(mockError as any);

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(generateLightningQRCode(mockInvoice)).rejects.toThrow('QR code generation failed');

    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to generate QR code:', mockError);

    consoleErrorSpy.mockRestore();
  });

  it('should handle empty invoice string', async () => {
    const mockInvoice = '';
    const mockQRDataURL = 'data:image/png;base64,empty...';

    // biome-ignore lint/suspicious/noExplicitAny: test
    vi.mocked(QRCode.toDataURL).mockResolvedValue(mockQRDataURL as any);

    const result = await generateLightningQRCode(mockInvoice);

    // Should return data URL with icon overlay
    expect(result).toBe('data:image/png;base64,mockedWithIcon');
    expect(QRCode.toDataURL).toHaveBeenCalledWith('lightning:', expect.any(Object));
  });

  it('should handle very long invoice', async () => {
    // Test with a typical long Lightning invoice
    const longInvoice =
      'lnbc1000n1pjkhxhkpp5testinvoicedatawithverylongstringthatmightcauseproblemsinqrcodegenerationbutshouldbethandledcorrectly';
    const mockQRDataURL = 'data:image/png;base64,long...';

    // biome-ignore lint/suspicious/noExplicitAny: test
    vi.mocked(QRCode.toDataURL).mockResolvedValue(mockQRDataURL as any);

    const result = await generateLightningQRCode(longInvoice);

    // Should return data URL with icon overlay
    expect(result).toBe('data:image/png;base64,mockedWithIcon');
    expect(QRCode.toDataURL).toHaveBeenCalledWith(`lightning:${longInvoice}`, expect.any(Object));
  });

  it('should use correct QR code options', async () => {
    const mockInvoice = 'lnbc1000n1pjkhxhkpp5testinvoicedata';
    const expectedDataURL = 'data:image/png;base64,test...';

    // biome-ignore lint/suspicious/noExplicitAny: test
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
