export const CHECKOUT_EMAIL_ERROR = 'Please enter a valid email address, such as name@example.com.';

// Validate syntax only; delivery still depends on the recipient's mailbox.
export function normalizeCheckoutEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim();
  if (email.length > 254) return null;
  const parts = email.split('@');
  if (parts.length !== 2) return null;
  const [local, domain] = parts;
  if (!local || local.length > 64 || local.startsWith('.') || local.endsWith('.') || local.includes('..')) return null;
  if (!/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local)) return null;
  const labels = domain.split('.');
  if (labels.length < 2 || labels.some(label => !/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/.test(label))) return null;
  return `${local}@${domain.toLowerCase()}`;
}
