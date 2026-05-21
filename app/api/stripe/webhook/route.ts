import Stripe from 'stripe';
import { Resend } from 'resend';
import { createDownloadToken } from '@/lib/download-token';
import { pngToPdf } from '@/lib/server-render';

export const maxDuration = 60;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const resend = new Resend(process.env.RESEND_API_KEY!);

// Poll R2 for the client-uploaded render for up to `maxWaitMs` milliseconds
async function fetchRender(piId: string, maxWaitMs = 20000): Promise<Buffer | null> {
  const url = `${process.env.R2_PUBLIC_URL}/renders/${piId}.png`;
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return Buffer.from(await res.arrayBuffer());
    } catch { /* not ready yet */ }
    await new Promise(r => setTimeout(r, 2000));
  }
  return null;
}

async function sendDownloadEmail(
  email: string,
  templateId: string,
  fieldValues: Record<string, string>,
  piId: string,
) {
  const token = createDownloadToken(templateId);
  const restoreParam = encodeURIComponent(
    Buffer.from(JSON.stringify(fieldValues)).toString('base64'),
  );
  const downloadUrl = `${process.env.NEXT_PUBLIC_APP_URL}/templates?template=${encodeURIComponent(templateId)}&token=${token}&restore=${restoreParam}`;

  // Wait for client-side render to appear in R2
  let attachments: Array<{ filename: string; content: Buffer }> = [];
  const pngBuf = await fetchRender(piId);
  if (pngBuf) {
    try {
      const pdfBuf = await pngToPdf(pngBuf);
      attachments = [
        { filename: 'invitation.png', content: pngBuf },
        { filename: 'invitation.pdf', content: pdfBuf },
      ];
    } catch (e) {
      console.error('[webhook] pdf generation failed:', e);
      attachments = [{ filename: 'invitation.png', content: pngBuf }];
    }
  }

  const hasAttachments = attachments.length > 0;

  await resend.emails.send({
    from: process.env.RESEND_FROM ?? 'Joy Send <noreply@joy-send.com>',
    to: email,
    subject: 'Your Joy Send invitation is ready 🎉',
    attachments,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 520px; margin: 0 auto; padding: 40px 24px; color: #1a1a1a;">
        <p style="font-size: 26px; font-weight: 700; margin: 0 0 8px;">Joy Send</p>
        <p style="font-size: 15px; color: #555; margin: 0 0 32px;">Beautiful invitations for every simcha</p>
        <p style="font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
          Thank you for your purchase! ${hasAttachments ? 'Your customized invitation is attached as a PNG and PDF.' : 'Your customized invitation is ready to download.'}
        </p>
        <a href="${downloadUrl}"
           style="display: inline-block; background: #0f172a; color: #fff; text-decoration: none; padding: 14px 28px; border-radius: 9999px; font-size: 15px; font-weight: 600; margin-bottom: 32px;">
          ${hasAttachments ? 'Re-download my invitation →' : 'Download my invitation →'}
        </a>
        <p style="font-size: 13px; color: #888; margin: 0 0 8px;">This link is valid for <strong>7 days</strong>.</p>
        <p style="font-size: 13px; color: #bbb; margin: 0;">© ${new Date().getFullYear()} Joy Send</p>
      </div>
    `,
  });
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
    const email = pi.metadata?.email || pi.receipt_email;
    const templateId = pi.metadata?.templateId;
    const fieldValues: Record<string, string> = JSON.parse(pi.metadata?.fieldValues ?? '{}');

    if (email && templateId) {
      await sendDownloadEmail(email, templateId, fieldValues, pi.id);
    }
  }

  return new Response('OK');
}
