import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { requireAdmin, privateHeaders } from '@/lib/admin/auth';
import { inspectOrder, supportLink, SupportError } from '@/lib/admin/order-support';
import { normalizeCheckoutEmail } from '@/lib/checkout-email';
import { createServiceClient } from '@/lib/supabase';
import { recordPurchaseEmail } from '@/lib/purchase-email-status';
export const maxDuration = 60;
type Context = { params: Promise<{ id: string }> };
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: privateHeaders });
function failure(error: unknown) {
  if (error instanceof SupportError) return json({ error: error.message }, error.status);
  console.error('[admin/order-support] Request failed');
  return json({ error: 'The request could not be completed. Please retry.' }, 503);
}
export async function GET(req: NextRequest, context: Context) {
  try {
    if (!await requireAdmin(req)) return json({ error: 'Admin sign-in required.' }, 403);
    const { detail } = await inspectOrder((await context.params).id);
    return json(detail);
  } catch (error) { return failure(error); }
}
export async function POST(req: NextRequest, context: Context) {
  try {
    if (!await requireAdmin(req)) return json({ error: 'Admin sign-in required.' }, 403);
    const body = await req.json().catch(() => null);
    if (!body || !['link', 'resend'].includes(body.action)) return json({ error: 'Invalid support action.' }, 400);
    const { detail, pi } = await inspectOrder((await context.params).id, false);
    if (!detail.canRecover || !pi) return json({ error: detail.recoveryReason ?? 'Payment could not be verified.' }, 409);
    // Stable payload + key within a five-minute window prevents duplicate sends
    // on double clicks/retries, including when recording metadata fails afterward.
    const bucket = Math.floor(Date.now() / 300000);
    const expiresAt = (body.action === 'resend' ? bucket * 300000 : Date.now()) + 7 * 86400000;
    const url = supportLink(detail.order, expiresAt);
    if (body.action === 'link') return json({ url, expiresAt: new Date(expiresAt).toISOString() });
    const recipient = normalizeCheckoutEmail(pi.metadata.email || pi.receipt_email || '');
    if (!recipient) return json({ error: 'The verified payment does not have a valid customer email.' }, 409);
    const result = await new Resend(process.env.RESEND_API_KEY!).emails.send({
      from: process.env.RESEND_FROM ?? 'Share Your Simcha <info@shareyoursimcha.com>', to: recipient,
      subject: 'Your invitation download link',
      text: `Here is your invitation link:\n\n${url}\n\nThis link is valid for seven days. Your existing edit allowance still applies. You can download a PNG or PDF from the invitation page.\n\nShare Your Simcha`,
    }, { idempotencyKey: `admin-order-link/${pi.id}/${bucket}` });
    if (result.error || !result.data) return json({ error: 'The email service did not accept the message. Please retry.' }, 502);
    const tracked = await recordPurchaseEmail(pi.id, result.data.id, 'support_link');
    // Update the send claim only after provider acceptance, without changing edits.
    let claimUpdated = false;
    try {
      const claim = await createServiceClient().from('invitation_edits').update({ email_sent: true })
        .eq('payment_intent_id', pi.id).select('payment_intent_id');
      claimUpdated = !claim.error && !!claim.data?.length;
    } catch { /* The accepted email must not be reported as a failed send. */ }
    return json({ ok: true, recipient, message: 'Download-link email accepted by the email service.', warning: tracked && claimUpdated ? null : 'The email was accepted, but its tracking record could not be updated.' });
  } catch (error) { return failure(error); }
}
