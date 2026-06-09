import Stripe from 'stripe';
import twilio from 'twilio';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL?.replace(/\/$/, '') ?? '';

function normalizeUsPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

export async function POST(req: Request) {
  const piId = req.headers.get('x-pi-id') ?? '';
  const rawPhone = req.headers.get('x-phone') ?? '';

  if (!piId.startsWith('pi_')) {
    return new Response('Invalid payment ID', { status: 400 });
  }

  const phone = normalizeUsPhone(rawPhone);
  if (!phone) {
    return new Response('Invalid US phone number', { status: 400 });
  }

  // Verify payment actually succeeded
  const pi = await stripe.paymentIntents.retrieve(piId);
  if (pi.status !== 'succeeded') {
    return new Response('Payment not confirmed', { status: 402 });
  }

  const pngBuf = Buffer.from(await req.arrayBuffer());
  if (!pngBuf.length) return new Response('Empty body', { status: 400 });

  // Upload PNG to R2 so Twilio can fetch it via public URL
  const key = `mms/${piId}.png`;
  await r2.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET!,
    Key: key,
    Body: pngBuf,
    ContentType: 'image/png',
  }));

  const mediaUrl = `${R2_PUBLIC_URL}/${key}`;

  const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
  await client.messages.create({
    from: process.env.TWILIO_PHONE_NUMBER!,
    to: phone,
    body: 'Here is your Share Your Simcha invitation!',
    mediaUrl: [mediaUrl],
  });

  return new Response('OK');
}
