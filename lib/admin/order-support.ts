import Stripe from 'stripe';
import { Resend } from 'resend';
import { createServiceClient } from '@/lib/supabase';
import { createDownloadToken } from '@/lib/download-token';
import { addTracking, ORDER_COLUMNS } from './order-data';
import { paymentState, recoveryReason, type Order, type OrderDetail } from './orders';
export class SupportError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export async function inspectOrder(id: string, includeDelivery = true) {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) throw new SupportError('Invalid order ID.');
  const { data, error } = await createServiceClient().from('orders').select(`${ORDER_COLUMNS},field_values`).eq('id', id).maybeSingle();
  if (error) throw new SupportError('This order could not be loaded. Please retry.', 503);
  if (!data) throw new SupportError('Order not found.', 404);
  const tracked = await addTracking([data as Order]);
  const order = tracked.orders[0];
  const warnings = tracked.warning ? [tracked.warning] : [];
  let pi: Stripe.PaymentIntent | null = null;
  let payment = order.type === 'draft' ? 'not_applicable' : 'unknown';
  let refunded = 0;
  if (order.type === 'purchase' && order.payment_intent_id) {
    try {
      pi = await new Stripe(process.env.STRIPE_SECRET_KEY!, { timeout: 10000, maxNetworkRetries: 1 })
        .paymentIntents.retrieve(order.payment_intent_id, { expand: ['latest_charge'] });
      const charge = typeof pi.latest_charge === 'object' ? pi.latest_charge : null;
      payment = paymentState(pi, charge); refunded = charge?.amount_refunded ?? 0;
      if (pi.metadata.templateId !== order.template_id) {
        warnings.push('The payment and order template do not match. Support actions are disabled.'); payment = 'unknown';
      }
    } catch { warnings.push('Stripe could not be reached. Payment status is unavailable.'); }
  }
  let emailStatus = order.type === 'draft' ? 'untracked' : order.email_claimed === true ? 'claim_recorded' : order.email_claimed === false ? 'no_send_record' : 'unknown';
  if (pi?.metadata.purchase_email_id && includeDelivery) {
    try {
      const result = await new Resend(process.env.RESEND_API_KEY!).emails.get(pi.metadata.purchase_email_id);
      if (result.error || !result.data) throw new Error('Provider unavailable');
      emailStatus = result.data.last_event;
    } catch { emailStatus = 'accepted'; warnings.push('The latest delivery event is unavailable. The email service previously accepted this message.'); }
  }
  const fields = order.field_values;
  const hasFields = !!fields && Object.keys(fields).length > 0 && Object.values(fields).every(v => typeof v === 'string');
  const reason = order.type === 'draft' ? 'Drafts have not been purchased.' : recoveryReason(payment, order.edits_remaining ?? null, hasFields);
  const detail: OrderDetail = { order, payment, currency: pi?.currency ?? 'usd', amount: pi?.amount_received ?? order.amount_cents ?? 0,
    refunded, stripeUrl: pi ? `https://dashboard.stripe.com/${pi.livemode ? '' : 'test/'}payments/${pi.id}` : null,
    emailStatus, emailSentAt: pi?.metadata.purchase_email_sent_at || null,
    recipient: pi?.metadata.email || pi?.receipt_email || null, canRecover: !reason, recoveryReason: reason, warnings };
  return { detail, pi };
}
export function supportLink(order: Order, expiresAt: number) {
  const url = new URL('/templates', process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.shareyoursimcha.com');
  url.searchParams.set('template', order.template_id);
  url.searchParams.set('token', createDownloadToken(order.template_id, expiresAt));
  url.searchParams.set('restore', Buffer.from(JSON.stringify(order.field_values)).toString('base64'));
  url.searchParams.set('pi', order.payment_intent_id!);
  return url.toString();
}
