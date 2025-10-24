import QRCode from 'qrcode';

/**
 * QRコード生成オプション
 */
const QR_OPTIONS: QRCode.QRCodeToDataURLOptions = {
  type: 'image/png',
  margin: 1,
  color: {
    dark: '#000000',
    light: '#FFFFFF',
  },
  width: 256,
};

/**
 * Lightning invoice用のQRコードを生成
 * @param invoice bolt11 invoice string
 * @returns Data URL形式のQRコード画像
 */
export async function generateLightningQRCode(invoice: string): Promise<string> {
  try {
    // lightning: プレフィックスを追加
    const lightningUri = `lightning:${invoice}`;

    // QRコードを生成
    const qrCodeDataURL = await QRCode.toDataURL(lightningUri, QR_OPTIONS);

    return qrCodeDataURL;
  } catch (error) {
    console.error('Failed to generate QR code:', error);
    throw new Error('QR code generation failed');
  }
}
