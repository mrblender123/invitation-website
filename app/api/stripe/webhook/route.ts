import Stripe from 'stripe';
import { initEditRecord } from '@/lib/edit-tracking';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

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
    }
  }

  return new Response('OK');
}
