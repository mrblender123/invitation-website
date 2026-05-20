import Stripe from 'stripe';
import { Resend } from 'resend';
import { createDownloadToken } from '@/lib/download-token';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const resend = new Resend(process.env.RESEND_API_KEY!);

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

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const email = session.customer_details?.email;
    const templateId = session.metadata?.templateId;
    const fieldValues: Record<string, string> = JSON.parse(session.metadata?.fieldValues ?? '{}');

    if (!email || !templateId) return new Response('OK');

    const token = createDownloadToken(templateId);
    const restoreParam = encodeURIComponent(Buffer.from(JSON.stringify(fieldValues)).toString('base64'));
    const downloadUrl = `${process.env.NEXT_PUBLIC_APP_URL}/templates?template=${encodeURIComponent(templateId)}&token=${token}&restore=${restoreParam}`;

    await resend.emails.send({
      from: process.env.RESEND_FROM ?? 'Joy Send <noreply@joy-send.com>',
      to: email,
      subject: 'Your Joy Send invitation is ready to download 🎉',
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 520px; margin: 0 auto; padding: 40px 24px; color: #1a1a1a;">
          <p style="font-size: 26px; font-weight: 700; margin: 0 0 8px;">Joy Send</p>
          <p style="font-size: 15px; color: #555; margin: 0 0 32px;">Beautiful invitations for every simcha</p>

          <p style="font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
            Thank you for your purchase! Your customized invitation is ready to download.
          </p>

          <a href="${downloadUrl}"
             style="display: inline-block; background: #0f172a; color: #fff; text-decoration: none; padding: 14px 28px; border-radius: 9999px; font-size: 15px; font-weight: 600; margin-bottom: 32px;">
            Download my invitation →
          </a>

          <p style="font-size: 13px; color: #888; margin: 0 0 8px;">
            This link is valid for <strong>7 days</strong>. After that, reply to this email and we'll send you a new one.
          </p>
          <p style="font-size: 13px; color: #bbb; margin: 0;">
            © ${new Date().getFullYear()} Joy Send
          </p>
        </div>
      `,
    });
  }

  return new Response('OK');
}
