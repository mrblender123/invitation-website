import Stripe from 'stripe';
import { Resend } from 'resend';

const OWNER_EMAIL = 'bycheshin@gmail.com';

/** Called only after the webhook signature has been verified. */
export async function notifyOwnerOfPurchase(payment: Stripe.PaymentIntent): Promise<void> {
  // Test payments, incomplete payments, and unrelated Stripe payments are not sales alerts.
  if (!payment.livemode || payment.status !== 'succeeded' || payment.amount_received <= 0 || !payment.metadata.templateId) return;

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { timeout: 10000, maxNetworkRetries: 1 });
  // A webhook retry contains the original metadata snapshot, so read the durable
  // marker from Stripe rather than trusting the event's copy.
  const current = await stripe.paymentIntents.retrieve(payment.id);
  if (current.metadata.owner_purchase_email_id) return;

  const amount = new Intl.NumberFormat('en-US', {
    style: 'currency', currency: payment.currency,
  }).format(payment.amount_received / 100);
  const purchasedAt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short',
  }).format(new Date(payment.created * 1000));
  const customer = payment.metadata.email || payment.receipt_email || 'Email not recorded';
  const resend = new Resend(process.env.RESEND_API_KEY!);
  const { data, error } = await resend.emails.send({
    from: process.env.RESEND_FROM ?? 'Share Your Simcha <info@shareyoursimcha.com>',
    to: OWNER_EMAIL,
    subject: `New Share Your Simcha purchase — ${amount}`,
    text: [
      'Someone purchased an invitation from Share Your Simcha.',
      '',
      `Amount paid: ${amount} ${payment.currency.toUpperCase()}`,
      `Customer: ${customer}`,
      `Template: ${payment.metadata.templateId}`,
      `Payment created: ${purchasedAt} (New York time)`,
      `Payment ID: ${payment.id}`,
      '',
      `View payment: https://dashboard.stripe.com/payments/${encodeURIComponent(payment.id)}`,
      'Manage orders: https://www.shareyoursimcha.com/admin/orders',
    ].join('\n'),
  }, {
    // Concurrent webhook deliveries and retries use the same deterministic body
    // and key. The Stripe marker below also suppresses replays after this key expires.
    idempotencyKey: `owner-purchase/${payment.id}`,
  });
  if (error || !data?.id) throw new Error('Purchase notification was not accepted by the email service.');

  // Do not share the customer's delivery tracking keys or edit allowance.
  // Failures propagate to the webhook so Stripe retries, using the same email key.
  await stripe.paymentIntents.update(payment.id, {
    metadata: { owner_purchase_email_id: data.id },
  });
}
