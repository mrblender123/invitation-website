import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  try {
    const { templateId, templateName, fieldValues, email } = await req.json();

    const paymentIntent = await stripe.paymentIntents.create({
      amount: 899,
      currency: 'usd',
      receipt_email: email || undefined,
      description: `Joy Send – ${templateName}`,
      metadata: {
        templateId,
        email: email || '',
        fieldValues: JSON.stringify(fieldValues).slice(0, 500),
      },
    });

    return Response.json({ clientSecret: paymentIntent.client_secret });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('PaymentIntent error:', message);
    return Response.json({ error: message }, { status: 500 });
  }
}
