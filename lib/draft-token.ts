import crypto, { timingSafeEqual } from 'crypto';

const SECRET = process.env.DRAFT_SECRET ?? 'dev-draft-secret-change-in-prod';
const EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function sign(payload: string): string {
  return crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
}

export function createDraftToken(
  templateId: string,
  fieldValues: Record<string, string>,
  email: string,
): string {
  const exp = Date.now() + EXPIRY_MS;
  const payload = Buffer.from(JSON.stringify({ templateId, fieldValues, email, exp })).toString('base64url');
  const sig = sign(payload);
  return `${payload}.${sig}`;
}

export function verifyDraftToken(token: string): {
  templateId: string;
  fieldValues: Record<string, string>;
  email: string;
} | null {
  const dotIndex = token.lastIndexOf('.');
  if (dotIndex === -1) return null;
  const payload = token.slice(0, dotIndex);
  const sig = token.slice(dotIndex + 1);
  try {
    // timingSafeEqual throws on length mismatch — must stay inside the try
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(sign(payload));
    if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) return null;
    const { templateId, fieldValues, email, exp } = JSON.parse(
      Buffer.from(payload, 'base64url').toString(),
    );
    if (!templateId || Date.now() > exp) return null;
    return { templateId, fieldValues: fieldValues ?? {}, email };
  } catch {
    return null;
  }
}
