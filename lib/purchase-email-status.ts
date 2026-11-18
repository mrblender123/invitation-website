import Stripe from 'stripe';
// Record acceptance separately from the existing send claim. Failure to record
// tracking must never turn a successfully sent customer email into a send failure.
export async function recordPurchaseEmail(piId: string, emailId: string, kind: string) {
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { timeout: 5000, maxNetworkRetries: 0 });
    await stripe.paymentIntents.update(piId, { metadata: {
      purchase_email_id: emailId, purchase_email_sent_at: new Date().toISOString(), purchase_email_kind: kind,
    } });
    return true;
  } catch {
    console.error('[email-status] Could not record provider acceptance for', piId);
    return false;
  }
}
