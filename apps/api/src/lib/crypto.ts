import crypto from 'crypto';

const SIGNING_SECRET = process.env.CONTENT_SIGNING_SECRET || 'vuka_default_content_signing_secret_998811';

export interface SignedContentTokenData {
  userId: string;
  editionId: string;
  contentAssetId: string;
  exp: number; // Unix timestamp in seconds
}

export function createSignedContentToken(userId: string, editionId: string, contentAssetId: string, expiresInSeconds = 300): string {
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const data: SignedContentTokenData = { userId, editionId, contentAssetId, exp };
  const encodedData = Buffer.from(JSON.stringify(data)).toString('base64url');
  
  const hmac = crypto.createHmac('sha256', SIGNING_SECRET);
  hmac.update(encodedData);
  const signature = hmac.digest('base64url');

  return `${encodedData}.${signature}`;
}

export function verifySignedContentToken(token: string): SignedContentTokenData | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [encodedData, signature] = parts;
    const hmac = crypto.createHmac('sha256', SIGNING_SECRET);
    hmac.update(encodedData);
    const expectedSignature = hmac.digest('base64url');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null;
    }

    const jsonStr = Buffer.from(encodedData, 'base64url').toString('utf8');
    const data: SignedContentTokenData = JSON.parse(jsonStr);

    const now = Math.floor(Date.now() / 1000);
    if (data.exp < now) {
      return null; // Expired
    }

    return data;
  } catch {
    return null;
  }
}
