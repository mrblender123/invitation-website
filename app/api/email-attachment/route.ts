import Stripe from 'stripe';
import { Resend } from 'resend';
import { PDFDocument } from 'pdf-lib';
import { createDownloadToken } from '@/lib/download-token';
import { initEditRecord, markEmailSent } from '@/lib/edit-tracking';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const resend = new Resend(process.env.RESEND_API_KEY!);
const EMAIL_LOGO_SRC = 'https://i.imgur.com/sInuEHF.png';

export async function POST(req: Request) {
  const piId = req.headers.get('x-pi-id') ?? '';
  if (!piId.startsWith('pi_')) {
    return new Response('Invalid ID', { status: 400 });
  }

  // Verify payment actually succeeded
  const pi = await stripe.paymentIntents.retrieve(piId);
  if (pi.status !== 'succeeded') {
    return new Response('Payment not confirmed', { status: 402 });
  }

  const email = pi.metadata?.email || pi.receipt_email;
  const templateId = pi.metadata?.templateId;
  if (!email || !templateId) {
    return new Response('Missing metadata', { status: 400 });
  }

  const pngBuf = Buffer.from(await req.arrayBuffer());
  if (!pngBuf.length) return new Response('Empty body', { status: 400 });

  // Wrap PNG in a PDF (fast — just embeds the image, no re-rendering)
  const pdfDoc = await PDFDocument.create();
  const pngImage = await pdfDoc.embedPng(pngBuf);
  const page = pdfDoc.addPage([pngImage.width, pngImage.height]);
  page.drawImage(pngImage, { x: 0, y: 0, width: pngImage.width, height: pngImage.height });
  const pdfBuf = Buffer.from(await pdfDoc.save());

  try { await initEditRecord(piId, templateId); } catch (e) { console.error('initEditRecord failed:', e); }

  // Dedup guard — if email already sent for this payment, skip to avoid duplicates
  const canSend = await markEmailSent(piId);
  if (!canSend) {
    console.log('[email-attachment] Already sent for pi=%s, skipping', piId);
    return new Response('OK');
  }

  const token = createDownloadToken(templateId);

  // fieldValues may be truncated at 500 chars in Stripe metadata — parse defensively
  let fieldValues: Record<string, string> = {};
  try { fieldValues = JSON.parse(pi.metadata?.fieldValues ?? '{}'); } catch { /* restore link will be empty */ }

  const restoreParam = encodeURIComponent(
    Buffer.from(JSON.stringify(fieldValues)).toString('base64'),
  );
  const downloadUrl = `${process.env.NEXT_PUBLIC_APP_URL}/templates?template=${encodeURIComponent(templateId)}&token=${token}&restore=${restoreParam}&pi=${encodeURIComponent(piId)}`;

  const logoSrc = EMAIL_LOGO_SRC;

  try {
    const { error: sendError } = await resend.emails.send({
      from: process.env.RESEND_FROM ?? 'Share Your Simcha <info@shareyoursimcha.com>',
      to: email,
      subject: 'Your invitation is ready',
      headers: {
        'X-Entity-Ref-ID': piId,
      },
      attachments: [
        { filename: 'invitation.png', content: pngBuf },
        { filename: 'invitation.pdf', content: pdfBuf },
      ],
      text: `Your invitation files are attached to this email (PNG and PDF).\n\nYou can edit and re-download up to 3 times within 7 days:\n${downloadUrl}\n\n— Share Your Simcha`,
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 520px; margin: 0 auto; padding: 40px 24px; color: #1a1a1a;">
          <img src="${logoSrc}" alt="Share Your Simcha" style="height: 70px; width: auto; margin-bottom: 24px; display: block;" />
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
    });
    if (sendError) {
      console.error('[email-attachment] Resend error for pi=%s: %s', piId, sendError.message);
      return new Response(JSON.stringify({ error: 'email_failed', piId }), { status: 500 });
    }
  } catch (e) {
    console.error('[email-attachment] Unexpected send error for pi=%s:', piId, e);
    return new Response(JSON.stringify({ error: 'email_failed', piId }), { status: 500 });
  }

  return new Response('OK');
}
