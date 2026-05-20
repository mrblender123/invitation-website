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
    metadata: {
      templateId,
      fieldValues: JSON.stringify(fieldValues).slice(0, 500),
    },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/templates?template=${templateId}&paid=1`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/templates?template=${templateId}`,
  });

  return Response.json({ url: session.url });
}
