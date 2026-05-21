import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export async function POST(req: Request) {
  const piId = req.headers.get('x-pi-id') ?? '';
  if (!piId.startsWith('pi_')) {
    return new Response('Invalid ID', { status: 400 });
  }

  const body = Buffer.from(await req.arrayBuffer());
  if (!body.length) return new Response('Empty body', { status: 400 });

  await s3.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET!,
    Key: `renders/${piId}.png`,
    Body: body,
    ContentType: 'image/png',
  }));

  return new Response('OK');
}
