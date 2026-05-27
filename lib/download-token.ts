import { createHmac, timingSafeEqual } from 'crypto';

const SECRET = process.env.DOWNLOAD_TOKEN_SECRET!;
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function createDownloadToken(templateId: string): string {
  const exp = Date.now() + TTL_MS;
  const payload = Buffer.from(JSON.stringify({ templateId, exp })).toString('base64url');
  const sig = createHmac('sha256', SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyDownloadToken(token: string, templateId: string): boolean {
  try {
    const [payload, sig] = token.split('.');
    if (!payload || !sig) return false;
    const expected = createHmac('sha256', SECRET).update(payload).digest('base64url');
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
    const { templateId: tid, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return tid === templateId && Date.now() < exp;
  } catch {
    return false;
  }
}
