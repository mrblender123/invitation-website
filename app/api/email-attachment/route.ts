import Stripe from 'stripe';
import { Resend } from 'resend';
import { createDownloadToken } from '@/lib/download-token';
import { pngToPdf } from '@/lib/pdf';
import { initEditRecord } from '@/lib/edit-tracking';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const resend = new Resend(process.env.RESEND_API_KEY!);

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

  const pdfBuf = await pngToPdf(pngBuf);

  await initEditRecord(piId, templateId);

  const token = createDownloadToken(templateId);
  const fieldValues: Record<string, string> = JSON.parse(pi.metadata?.fieldValues ?? '{}');
  const restoreParam = encodeURIComponent(
    Buffer.from(JSON.stringify(fieldValues)).toString('base64'),
  );
  const downloadUrl = `${process.env.NEXT_PUBLIC_APP_URL}/templates?template=${encodeURIComponent(templateId)}&token=${token}&restore=${restoreParam}&pi=${encodeURIComponent(piId)}`;

  await resend.emails.send({
    from: process.env.RESEND_FROM ?? 'Joy Send <noreply@joy-send.com>',
    to: email,
    subject: 'Your Joy Send invitation files 🎉',
    attachments: [
      { filename: 'invitation.png', content: pngBuf },
      { filename: 'invitation.pdf', content: pdfBuf },
    ],
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 520px; margin: 0 auto; padding: 40px 24px; color: #1a1a1a;">
        <p style="font-size: 26px; font-weight: 700; margin: 0 0 8px;">Joy Send</p>
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
        <p style="font-size: 13px; color: #bbb; margin: 0;">© ${new Date().getFullYear()} Joy Send</p>
      </div>
    `,
  });

  return new Response('OK');
}
