import { NextRequest, NextResponse } from 'next/server';
import { readdir, readFile } from 'fs/promises';
import path from 'path';
import { createAuthenticatedClient } from '@/lib/supabase';

const ADMIN_EMAIL   = 'bycheshin@gmail.com';
const TEMPLATES_DIR = path.join(process.cwd(), 'public', 'templates');

async function verifyAdmin(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return false;
  const token = auth.slice(7);
  const { data: { user }, error } = await createAuthenticatedClient(token).auth.getUser();
  return !error && user?.email === ADMIN_EMAIL;
}

async function uploadToR2(relPath: string, content: string | Buffer): Promise<void> {
  const r2AccountId = process.env.R2_ACCOUNT_ID;
  const r2AccessKey = process.env.R2_ACCESS_KEY_ID;
  const r2SecretKey = process.env.R2_SECRET_ACCESS_KEY;
  const r2Bucket    = process.env.R2_BUCKET;
  if (!r2AccountId || !r2AccessKey || !r2SecretKey || !r2Bucket) return;

  const r2Key   = `templates/${relPath}`;
  const isSvg   = relPath.endsWith('.svg');
  const ct      = isSvg ? 'image/svg+xml' : 'image/png';
  const { createHmac, createHash } = await import('crypto');
  const now = new Date();
  const dateStamp   = now.toISOString().slice(0, 10).replace(/-/g, '');
  const amzDate     = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
  const bodyBytes   = typeof content === 'string' ? Buffer.from(content, 'utf-8') : content;
  const payloadHash = createHash('sha256').update(bodyBytes).digest('hex');
  const host        = `${r2Bucket}.${r2AccountId}.r2.cloudflarestorage.com`;
  const canonHeaders = `content-type:${ct}\nhost:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHdrs  = 'content-type;host;x-amz-content-sha256;x-amz-date';
  const canonReq    = `PUT\n/${encodeURIComponent(r2Key).replace(/%2F/g, '/')}\n\n${canonHeaders}\n${signedHdrs}\n${payloadHash}`;
  const scope       = `${dateStamp}/auto/s3/aws4_request`;
  const toSign      = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${createHash('sha256').update(canonReq).digest('hex')}`;
  const sign        = (k: Buffer, m: string) => createHmac('sha256', k).update(m).digest();
  const sigKey      = sign(sign(sign(sign(Buffer.from(`AWS4${r2SecretKey}`), dateStamp), 'auto'), 's3'), 'aws4_request');
  const sig         = createHmac('sha256', sigKey).update(toSign).digest('hex');
  const auth        = `AWS4-HMAC-SHA256 Credential=${r2AccessKey}/${scope}, SignedHeaders=${signedHdrs}, Signature=${sig}`;

  await fetch(`https://${host}/${encodeURIComponent(r2Key).replace(/%2F/g, '/')}`, {
    method: 'PUT',
    headers: { 'Content-Type': ct, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate, Authorization: auth, 'Cache-Control': 'public, max-age=0, must-revalidate' },
    body: bodyBytes as unknown as BodyInit,
  });
}

async function collectFiles(dir: string, base: string): Promise<string[]> {
  const results: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel  = path.join(base, entry.name);
    if (entry.isDirectory()) {
      results.push(...await collectFiles(full, rel));
    } else if (/\.(svg|png)$/i.test(entry.name) && !entry.name.startsWith('_')) {
      results.push(rel);
    }
  }
  return results;
}

export async function POST(req: NextRequest) {
  if (!await verifyAdmin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { folder } = await req.json() as { folder?: string };

  const scanDir  = folder ? path.join(TEMPLATES_DIR, folder) : TEMPLATES_DIR;
  const baseRel  = folder ?? '';
  const files    = await collectFiles(scanDir, baseRel);

  let count = 0;
  const errors: string[] = [];
  for (const relPath of files) {
    try {
      const absPath = path.join(TEMPLATES_DIR, relPath);
      const isSvg  = relPath.endsWith('.svg');
      const content = isSvg ? await readFile(absPath, 'utf-8') : await readFile(absPath);
      await uploadToR2(relPath, content);
      count++;
    } catch (e) {
      errors.push(`${relPath}: ${e}`);
    }
  }

  return NextResponse.json({ ok: true, count, errors });
}
