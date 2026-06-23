import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  try {
    const { templateId, templateName, fieldValues, email } = await req.json();

    const paymentIntent = await stripe.paymentIntents.create({
      amount: 899,
      currency: 'usd',
      payment_method_types: ['card'],
      description: `Share Your Simcha – ${templateName}`,
      metadata: (() => {
        const json = JSON.stringify(fieldValues);
        const chunks: Record<string, string> = { templateId, email: email || '' };
        // Stripe: 500 chars max per value — split across fv0, fv1, fv2, ...
        for (let i = 0; i * 500 < json.length; i++) {
          chunks[`fv${i}`] = json.slice(i * 500, (i + 1) * 500);
        }
        return chunks;
      })(),
    });

    return Response.json({ clientSecret: paymentIntent.client_secret });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('PaymentIntent error:', message);
    return Response.json({ error: message }, { status: 500 });
  }
}
