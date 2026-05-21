import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  const { templateId, templateName, fieldValues } = await req.json();

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: {
          name: `Joy Send – ${templateName}`,
          description: 'Custom invitation — download link sent by email after payment',
        },
        unit_amount: 899,
      },
      quantity: 1,
    }],
    mode: 'payment',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ui_mode: 'embedded' as any,
    metadata: {
      templateId,
      fieldValues: JSON.stringify(fieldValues).slice(0, 500),
    },
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/templates?template=${templateId}&paid=1`,
  });

  return Response.json({ clientSecret: session.client_secret });
}
