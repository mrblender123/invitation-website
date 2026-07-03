import Stripe from 'stripe';
import { waitUntil } from '@vercel/functions';
import { Resend } from 'resend';
import { initEditRecord, wasEmailSent, markEmailSent, resetEmailSent } from '@/lib/edit-tracking';
import { createDownloadToken } from '@/lib/download-token';
import { createServiceClient } from '@/lib/supabase';

// Response returns immediately; maxDuration covers the delayed backup-email task below
export const maxDuration = 180;

const BACKUP_EMAIL_DELAY_MS = 120_000; // give the browser's attachment email 2 minutes to land

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const resend = new Resend(process.env.RESEND_API_KEY!);
const EMAIL_LOGO_SRC = 'https://i.imgur.com/t8uy4eg.png';

// Safety net: if the buyer's browser died before uploading the rendered PNG
// (tab closed, phone locked, network drop), no attachment email ever goes out.
// After a delay, check the email_sent flag and send a download-link email instead.
async function sendBackupLinkEmail(piId: string, templateId: string, email: string, fieldValues: Record<string, string>) {
  await new Promise(r => setTimeout(r, BACKUP_EMAIL_DELAY_MS));
  if (await wasEmailSent(piId)) return;      // attachment email made it — nothing to do
  if (!await markEmailSent(piId)) return;    // raced with a late client send — it won
  try {
    const token = createDownloadToken(templateId);
    const restoreParam = encodeURIComponent(Buffer.from(JSON.stringify(fieldValues)).toString('base64'));
    const downloadUrl = `${process.env.NEXT_PUBLIC_APP_URL}/templates?template=${encodeURIComponent(templateId)}&token=${token}&restore=${restoreParam}&pi=${encodeURIComponent(piId)}`;
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM ?? 'Share Your Simcha <info@shareyoursimcha.com>',
      to: email,
      subject: 'Your invitation is ready',
      headers: { 'X-Entity-Ref-ID': piId },
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 520px; margin: 0 auto; padding: 40px 24px; color: #1a1a1a;">
          <img src="${EMAIL_LOGO_SRC}" alt="Share Your Simcha" style="height: 140px; width: auto; margin-bottom: 24px; display: block;" />
          <p style="font-size: 15px; color: #555; margin: 0 0 32px;">Beautiful invitations for every simcha</p>
          <p style="font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
            Thank you for your purchase! Click the button below to open your invitation,
            then download it as a PNG or PDF. You can also edit it — up to 3 times within 7 days.
          </p>
          <a href="${downloadUrl}"
             style="display: inline-block; background: #0f172a; color: #fff; text-decoration: none; padding: 14px 28px; border-radius: 9999px; font-size: 15px; font-weight: 600; margin-bottom: 32px;">
            Open &amp; download →
          </a>
          <p style="font-size: 13px; color: #bbb; margin: 0;">© ${new Date().getFullYear()} Share Your Simcha</p>
        </div>
      `,
    });
    if (error) {
      console.error('[webhook] backup email failed for pi=%s: %s', piId, error.message);
      await resetEmailSent(piId);
    } else {
      console.log('[webhook] backup link email sent for pi=%s', piId);
    }
  } catch (e) {
    console.error('[webhook] backup email error for pi=%s:', piId, e);
    await resetEmailSent(piId);
  }
}

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');
  if (!sig) return new Response('Missing signature', { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return new Response('Webhook signature invalid', { status: 400 });
  }

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object as Stripe.PaymentIntent;
    const templateId = pi.metadata?.templateId;
    if (templateId) {
      try { await initEditRecord(pi.id, templateId); } catch (e) { console.error('initEditRecord failed:', e); }

      let email: string | null = pi.receipt_email ?? pi.metadata?.email ?? null;
      let templateName: string | null = null;
      let fieldValues: Record<string, string> = {};

      try {
        const meta = pi.metadata ?? {};
        let json = '';
        if (meta.fv0 !== undefined) {
          let i = 0;
          while (meta[`fv${i}`] !== undefined) { json += meta[`fv${i}`]; i++; }
        } else {
          json = meta.fieldValues ?? '{}';
        }
        fieldValues = JSON.parse(json);
      } catch { /* ignore */ }

      try {
        const sessions = await stripe.checkout.sessions.list({ payment_intent: pi.id, limit: 1 });
        const session = sessions.data[0];
        if (session) {
          if (!email) email = session.customer_details?.email ?? null;
          templateName = session.line_items?.data?.[0]?.description ?? null;
        }
      } catch { /* ignore */ }

      // Record order in admin panel
      try {
        await createServiceClient()
          .from('orders')
          .upsert(
            { type: 'purchase', email: email ?? 'unknown', template_id: templateId, template_name: templateName, field_values: fieldValues, payment_intent_id: pi.id, amount_cents: pi.amount },
            { onConflict: 'payment_intent_id', ignoreDuplicates: true },
          );
      } catch (e) { console.error('[orders] record purchase failed:', e); }

      // Backup delivery — runs after the response is returned (see sendBackupLinkEmail)
      if (email) {
        waitUntil(sendBackupLinkEmail(pi.id, templateId, email, fieldValues));
      }
    }
  }

  return new Response('OK');
}
