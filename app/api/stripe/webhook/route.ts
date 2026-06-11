import Stripe from 'stripe';
import { initEditRecord } from '@/lib/edit-tracking';
import { createServiceClient } from '@/lib/supabase';

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

      // Record in orders table
      let email: string | null = pi.receipt_email ?? pi.metadata?.email ?? null;
      let templateName: string | null = null;
      let fieldValues: Record<string, string> | null = null;
      try { fieldValues = JSON.parse(pi.metadata?.fieldValues ?? '{}'); } catch { /* ignore */ }
      try {
        const sessions = await stripe.checkout.sessions.list({ payment_intent: pi.id, limit: 1 });
        const session = sessions.data[0];
        if (session) {
          if (!email) email = session.customer_details?.email ?? null;
          templateName = session.line_items?.data?.[0]?.description ?? null;
        }
      } catch { /* ignore — line_items may require expand */ }
      try {
        await createServiceClient()
          .from('orders')
          .upsert(
            { type: 'purchase', email: email ?? 'unknown', template_id: templateId, template_name: templateName, field_values: fieldValues, payment_intent_id: pi.id, amount_cents: pi.amount },
            { onConflict: 'payment_intent_id', ignoreDuplicates: true },
          );
      } catch (e) { console.error('[orders] record purchase failed:', e); }
    }
  }

  return new Response('OK');
}
