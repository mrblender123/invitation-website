import { createServiceClient } from '@/lib/supabase';

const BUCKET = 'temp-invitations';

async function ensureBucket() {
  const sb = createServiceClient();
  const { data: buckets } = await sb.storage.listBuckets();
  if (!buckets?.find(b => b.name === BUCKET)) {
    await sb.storage.createBucket(BUCKET, { public: false, fileSizeLimit: 1024 * 1024 * 10 });
  }
}

export async function POST(req: Request) {
  const { piId } = await req.json();
  if (!piId?.startsWith('pi_')) return new Response('Invalid', { status: 400 });

  await ensureBucket();

  const path = `${piId}.png`;
  const sb = createServiceClient();
  const { data, error } = await sb.storage.from(BUCKET).createSignedUploadUrl(path, { upsert: true });

  if (error || !data) {
    console.error('[storage-upload-url] error:', error);
    return new Response('Failed to create upload URL', { status: 500 });
  }

  return Response.json({ signedUrl: data.signedUrl, path, token: data.token });
}
