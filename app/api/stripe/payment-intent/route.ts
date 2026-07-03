import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  try {
    const { templateId, templateName, fieldValues, email } = await req.json();

    const paymentIntent = await stripe.paymentIntents.create({
      amount: 2599,
      currency: 'usd',
      payment_method_types: ['card'],
      description: `Share Your Simcha – ${templateName}`,
      metadata: (() => {
        const chunks: Record<string, string> = { templateId, email: email || '' };
        // Stripe limits: 500 chars/value, 50 keys, 8KB total. Cap each field value and
        // the chunk count so extreme input can never make PaymentIntent creation fail.
        const capped: Record<string, string> = {};
        for (const [k, v] of Object.entries((fieldValues ?? {}) as Record<string, string>)) {
          capped[k.slice(0, 60)] = String(v).slice(0, 300);
        }
        const json = JSON.stringify(capped);
        const MAX_CHUNKS = 13; // 13 × 500 = 6.5KB, leaves room for templateId/email
        if (json.length <= MAX_CHUNKS * 500) {
          for (let i = 0; i * 500 < json.length; i++) {
            chunks[`fv${i}`] = json.slice(i * 500, (i + 1) * 500);
          }
        }
        // else: skip field values — payment still works, restore link is just empty
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
