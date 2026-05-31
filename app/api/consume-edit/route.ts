import Stripe from 'stripe';
import { consumeEdit } from '@/lib/edit-tracking';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  const piId = req.headers.get('x-pi-id') ?? '';
  if (!piId.startsWith('pi_')) {
    return Response.json({ allowed: false, error: 'Invalid ID' }, { status: 400 });
  }

  // Verify the payment actually succeeded before allowing a download
  try {
    const pi = await stripe.paymentIntents.retrieve(piId);
    if (pi.status !== 'succeeded') {
      return Response.json({ allowed: false, error: 'Payment not confirmed' }, { status: 402 });
    }
  } catch {
    return Response.json({ allowed: false, error: 'Could not verify payment' }, { status: 500 });
  }

  try {
    const { allowed, editsRemaining, notFound } = await consumeEdit(piId);
    if (notFound) return Response.json({ allowed: true, editsRemaining: null });
    return Response.json({ allowed, editsRemaining });
  } catch {
    // Supabase down — allow the download so the user isn't blocked
    return Response.json({ allowed: true, editsRemaining: null });
  }
}
