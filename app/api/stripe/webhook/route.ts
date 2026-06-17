import Stripe from 'stripe';
import { Resend } from 'resend';
import { initEditRecord, markEmailSent } from '@/lib/edit-tracking';
import { createDownloadToken } from '@/lib/download-token';
import { createServiceClient } from '@/lib/supabase';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const resend = new Resend(process.env.RESEND_API_KEY!);
const EMAIL_LOGO_SRC = 'https://i.imgur.com/t8uy4eg.png';

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

      // Reassemble chunked fv0, fv1, ... keys (fallback: legacy fieldValues key)
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

      // Record order
      try {
        await createServiceClient()
          .from('orders')
          .upsert(
            { type: 'purchase', email: email ?? 'unknown', template_id: templateId, template_name: templateName, field_values: fieldValues, payment_intent_id: pi.id, amount_cents: pi.amount },
            { onConflict: 'payment_intent_id', ignoreDuplicates: true },
          );
      } catch (e) { console.error('[orders] record purchase failed:', e); }

      // Send email with download link — server-side, no client upload needed
      if (email) {
        const canSend = await markEmailSent(pi.id);
        if (canSend) {
          try {
            const token = createDownloadToken(templateId);
            const restoreParam = encodeURIComponent(
              Buffer.from(JSON.stringify(fieldValues)).toString('base64'),
            );
            const downloadUrl = `${process.env.NEXT_PUBLIC_APP_URL}/templates?template=${encodeURIComponent(templateId)}&token=${token}&restore=${restoreParam}&pi=${encodeURIComponent(pi.id)}`;

            const { error } = await resend.emails.send({
              from: process.env.RESEND_FROM ?? 'Share Your Simcha <info@shareyoursimcha.com>',
              to: email,
              subject: 'Your invitation is ready — download now',
              headers: { 'X-Entity-Ref-ID': pi.id },
              html: `
                <div style="font-family: system-ui, sans-serif; max-width: 520px; margin: 0 auto; padding: 40px 24px; color: #1a1a1a;">
                  <img src="${EMAIL_LOGO_SRC}" alt="Share Your Simcha" style="height: 140px; width: auto; margin-bottom: 24px; display: block;" />
                  <p style="font-size: 15px; color: #555; margin: 0 0 32px;">Beautiful invitations for every simcha</p>
                  <p style="font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                    Your invitation is ready! Use the link below to download your PNG and PDF files.
                  </p>
                  <p style="font-size: 14px; color: #555; margin: 0 0 24px;">
                    The link lets you edit and re-download up to 3 times within 7 days.
                  </p>
                  <a href="${downloadUrl}"
                     style="display: inline-block; background: #0f172a; color: #fff; text-decoration: none; padding: 14px 28px; border-radius: 9999px; font-size: 15px; font-weight: 600; margin-bottom: 32px;">
                    Download your invitation →
                  </a>
                  <p style="font-size: 13px; color: #bbb; margin: 0;">© ${new Date().getFullYear()} Share Your Simcha</p>
                </div>
              `,
            });
            if (error) console.error('[webhook] Resend error for pi=%s: %s', pi.id, error.message);
          } catch (e) {
            console.error('[webhook] Email send failed for pi=%s:', pi.id, e);
          }
        }
      }
    }
  }

  return new Response('OK');
}
