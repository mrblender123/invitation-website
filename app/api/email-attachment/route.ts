import Stripe from 'stripe';
import { Resend } from 'resend';
import { PDFDocument } from 'pdf-lib';
import { createServiceClient } from '@/lib/supabase';
import { createDownloadToken } from '@/lib/download-token';
import { initEditRecord, markEmailSent, resetEmailSent } from '@/lib/edit-tracking';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const resend = new Resend(process.env.RESEND_API_KEY!);
const EMAIL_LOGO_SRC = 'https://i.imgur.com/t8uy4eg.png';
const BUCKET = 'temp-invitations';

export async function POST(req: Request) {
  const piId = req.headers.get('x-pi-id') ?? '';
  const storagePath = req.headers.get('x-storage-path') ?? '';

  if (!piId.startsWith('pi_')) return new Response('Invalid ID', { status: 400 });
  if (!storagePath.endsWith('.png')) return new Response('Invalid path', { status: 400 });

  // Verify payment actually succeeded
  const pi = await stripe.paymentIntents.retrieve(piId);
  if (pi.status !== 'succeeded') return new Response('Payment not confirmed', { status: 402 });

  const email = pi.metadata?.email || pi.receipt_email;
  const templateId = pi.metadata?.templateId;
  if (!email || !templateId) return new Response('Missing metadata', { status: 400 });

  // Download PNG from Supabase Storage (fast — server-to-server)
  const sb = createServiceClient();
  const { data: pngData, error: dlError } = await sb.storage.from(BUCKET).download(storagePath);
  if (dlError || !pngData) {
    console.error('[email-attachment] storage download failed:', dlError);
    return new Response('PNG not found in storage', { status: 404 });
  }
  const pngBuf = Buffer.from(await pngData.arrayBuffer());

  // Wrap PNG in a PDF
  const pdfDoc = await PDFDocument.create();
  const pngImage = await pdfDoc.embedPng(pngBuf);
  const page = pdfDoc.addPage([pngImage.width, pngImage.height]);
  page.drawImage(pngImage, { x: 0, y: 0, width: pngImage.width, height: pngImage.height });
  const pdfBuf = Buffer.from(await pdfDoc.save());

  try { await initEditRecord(piId, templateId); } catch (e) { console.error('initEditRecord failed:', e); }

  const canSend = await markEmailSent(piId);
  if (!canSend) {
    await sb.storage.from(BUCKET).remove([storagePath]).catch(() => {});
    console.log('[email-attachment] Already sent for pi=%s, skipping', piId);
    return new Response('OK');
  }

  const token = createDownloadToken(templateId);

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
  } catch { /* restore link will be empty */ }

  const restoreParam = encodeURIComponent(
    Buffer.from(JSON.stringify(fieldValues)).toString('base64'),
  );
  const downloadUrl = `${process.env.NEXT_PUBLIC_APP_URL}/templates?template=${encodeURIComponent(templateId)}&token=${token}&restore=${restoreParam}&pi=${encodeURIComponent(piId)}`;

  const emailPayload = {
    from: process.env.RESEND_FROM ?? 'Share Your Simcha <info@shareyoursimcha.com>',
    to: email,
    subject: 'Your invitation is ready',
    headers: { 'X-Entity-Ref-ID': piId },
    attachments: [
      { filename: 'invitation.png', content: pngBuf },
      { filename: 'invitation.pdf', content: pdfBuf },
    ],
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 520px; margin: 0 auto; padding: 40px 24px; color: #1a1a1a;">
        <img src="${EMAIL_LOGO_SRC}" alt="Share Your Simcha" style="height: 140px; width: auto; margin-bottom: 24px; display: block;" />
        <p style="font-size: 15px; color: #555; margin: 0 0 32px;">Beautiful invitations for every simcha</p>
        <p style="font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
          Your customized invitation is attached to this email as a PNG and PDF.
        </p>
        <p style="font-size: 14px; color: #555; margin: 0 0 24px;">
          You can also edit and re-download using the link below — up to 3 times within 7 days:
        </p>
        <a href="${downloadUrl}"
           style="display: inline-block; background: #0f172a; color: #fff; text-decoration: none; padding: 14px 28px; border-radius: 9999px; font-size: 15px; font-weight: 600; margin-bottom: 32px;">
          Edit &amp; re-download →
        </a>
        <p style="font-size: 13px; color: #bbb; margin: 0;">© ${new Date().getFullYear()} Share Your Simcha</p>
      </div>
    `,
  };

  let lastError = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 1000 * attempt));
    try {
      const { error: sendError } = await resend.emails.send(emailPayload);
      if (!sendError) {
        await sb.storage.from(BUCKET).remove([storagePath]).catch(() => {});
        return new Response('OK');
      }
      lastError = sendError.message;
      console.error('[email-attachment] Resend attempt %d failed for pi=%s: %s', attempt + 1, piId, lastError);
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      console.error('[email-attachment] Unexpected error attempt %d for pi=%s:', attempt + 1, piId, e);
    }
  }

  await resetEmailSent(piId);
  return new Response(JSON.stringify({ error: 'email_failed', piId }), { status: 500 });
}
