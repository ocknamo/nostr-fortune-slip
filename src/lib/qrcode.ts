import QRCode from 'qrcode';
import lightningIconSvg from '$lib/assets/lightning-icon.svg';

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
 * Add lightning icon overlay to QR code
 * @param qrCodeDataURL Base QR code data URL
 * @returns Data URL with lightning icon overlay
 */
async function addLightningIconOverlay(qrCodeDataURL: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Create canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Failed to get canvas context'));
      return;
    }

    // Load QR code image
    const qrImage = new Image();
    qrImage.onload = () => {
      // Set canvas size to match QR code
      canvas.width = qrImage.width;
      canvas.height = qrImage.height;

      // Draw QR code
      ctx.drawImage(qrImage, 0, 0);

      // Calculate center position and icon size
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const iconSize = canvas.width * 0.2; // 20% of QR code size
      const backgroundRadius = iconSize * 0.6; // Slightly larger than icon

      // Draw white circular background
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(centerX, centerY, backgroundRadius, 0, Math.PI * 2);
      ctx.fill();

      // Load and draw lightning icon
      const iconImage = new Image();
      iconImage.onload = () => {
        const iconX = centerX - iconSize / 2;
        const iconY = centerY - iconSize / 2;
        ctx.drawImage(iconImage, iconX, iconY, iconSize, iconSize);

        // Convert to data URL
        resolve(canvas.toDataURL('image/png'));
      };
      iconImage.onerror = () => {
        reject(new Error('Failed to load lightning icon'));
      };
      iconImage.src = lightningIconSvg;
    };
    qrImage.onerror = () => {
      reject(new Error('Failed to load QR code image'));
    };
    qrImage.src = qrCodeDataURL;
  });
}

/**
 * Lightning invoice用のQRコードを生成
 * @param invoice bolt11 invoice string
 * @returns Data URL形式のQRコード画像（中心にライトニングアイコン付き）
 */
export async function generateLightningQRCode(invoice: string): Promise<string> {
  // lightning: プレフィックスを追加
  const lightningUri = `lightning:${invoice}`;
  const qrCodeDataURL = await generateQRCode(lightningUri);

  // Add lightning icon overlay
  return addLightningIconOverlay(qrCodeDataURL);
}

/**
 * 汎用QRコードを生成（プレフィックスなし）
 * @param content QRコードにエンコードする内容
 * @returns Data URL形式のQRコード画像
 */
export async function generateQRCode(content: string): Promise<string> {
  try {
    // QRコードを生成（プレフィックスなし）
    const qrCodeDataURL = await QRCode.toDataURL(content, QR_OPTIONS);

    return qrCodeDataURL;
  } catch (error) {
    console.error('Failed to generate QR code:', error);
    throw new Error('QR code generation failed');
  }
}
