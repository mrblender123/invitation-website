import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';
import { revalidatePath } from 'next/cache';
import { createAuthenticatedClient } from '@/lib/supabase';

const ADMIN_EMAIL = 'bycheshin@gmail.com';

async function verifyAdmin(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return false;
  const token = auth.slice(7);
  const { data: { user }, error } = await createAuthenticatedClient(token).auth.getUser();
  return !error && user?.email === ADMIN_EMAIL;
}

export async function POST(req: NextRequest) {
  if (!await verifyAdmin(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { svgPublicPath, svgContent } = await req.json();

  if (typeof svgPublicPath !== 'string' || !svgPublicPath.toLowerCase().endsWith('.svg')) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  // Accept both "/templates/..." local paths and full R2 URLs
  let relativePath: string; // e.g. "/templates/It's a boy/PH-01.svg"
  const r2PublicUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, '') ?? '';
  if (r2PublicUrl && svgPublicPath.startsWith(r2PublicUrl)) {
    // Strip R2 base URL and decode percent-encoding
    relativePath = decodeURIComponent(svgPublicPath.slice(r2PublicUrl.length));
  } else if (svgPublicPath.startsWith('/templates/')) {
    relativePath = svgPublicPath;
  } else {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  if (relativePath.includes('..')) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  // In development: write directly to local filesystem (fast, immediate)
  if (process.env.NODE_ENV === 'development') {
    const localPath = path.join(process.cwd(), 'public', relativePath);
    await writeFile(localPath, svgContent, 'utf-8');
    revalidatePath('/api/templates');
    return NextResponse.json({ ok: true });
  }

  const githubToken = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH ?? 'main';

  if (!githubToken || !repo) {
    return NextResponse.json({ error: 'GitHub not configured' }, { status: 500 });
  }

  // File path in the repo (public/templates/...)
  const filePath = `public${relativePath}`;
  const apiUrl = `https://api.github.com/repos/${repo}/contents/${filePath}`;
  const headers = {
    Authorization: `Bearer ${githubToken}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };

  // Get current file SHA (required for updates)
  const getRes = await fetch(`${apiUrl}?ref=${branch}`, { headers });
  if (!getRes.ok) {
    return NextResponse.json({ error: `GitHub GET failed: ${getRes.status}` }, { status: 500 });
  }
  const getJson = await getRes.json();
  const sha: string = getJson.sha;

  // Commit updated content
  const content = Buffer.from(svgContent, 'utf-8').toString('base64');
  const putRes = await fetch(apiUrl, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      message: `Update ${svgPublicPath} via template editor`,
      content,
      sha,
      branch,
    }),
  });

  if (!putRes.ok) {
    const err = await putRes.text();
    return NextResponse.json({ error: `GitHub PUT failed: ${err}` }, { status: 500 });
  }

  // Also upload directly to R2 so the website shows the change immediately
  // (GitHub commit alone won't update R2 — the site serves SVGs from R2 in production)
  const r2AccountId  = process.env.R2_ACCOUNT_ID;
  const r2AccessKey  = process.env.R2_ACCESS_KEY_ID;
  const r2SecretKey  = process.env.R2_SECRET_ACCESS_KEY;
  const r2Bucket     = process.env.R2_BUCKET;

  if (r2AccountId && r2AccessKey && r2SecretKey && r2Bucket) {
    const r2Key = `templates${relativePath}`;
    const r2Endpoint = `https://${r2AccountId}.r2.cloudflarestorage.com`;

    // Build AWS Signature v4 for the PUT request
    const { createHmac, createHash } = await import('crypto');
    const now = new Date();
    const dateStamp  = now.toISOString().slice(0, 10).replace(/-/g, '');
    const amzDate    = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
    const region     = 'auto';
    const service    = 's3';
    const bodyBytes  = Buffer.from(svgContent, 'utf-8');
    const payloadHash = createHash('sha256').update(bodyBytes).digest('hex');

    const canonicalHeaders = `content-type:image/svg+xml\nhost:${r2Bucket}.${r2AccountId}.r2.cloudflarestorage.com\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
    const signedHeaders    = 'content-type;host;x-amz-content-sha256;x-amz-date';
    const canonicalRequest = `PUT\n/${encodeURIComponent(r2Key).replace(/%2F/g, '/')}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

    const credentialScope  = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign     = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${createHash('sha256').update(canonicalRequest).digest('hex')}`;

    const sign = (key: Buffer, msg: string) => createHmac('sha256', key).update(msg).digest();
    const signingKey = sign(sign(sign(sign(Buffer.from(`AWS4${r2SecretKey}`), dateStamp), region), service), 'aws4_request');
    const signature  = createHmac('sha256', signingKey).update(stringToSign).digest('hex');

    const authorization = `AWS4-HMAC-SHA256 Credential=${r2AccessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    await fetch(`${r2Endpoint}/${r2Bucket}/${encodeURIComponent(r2Key).replace(/%2F/g, '/')}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'image/svg+xml',
        'x-amz-content-sha256': payloadHash,
        'x-amz-date': amzDate,
        Authorization: authorization,
        'Cache-Control': 'public, max-age=0, must-revalidate',
      },
      body: bodyBytes,
    });
  }

  revalidatePath('/api/templates');
  return NextResponse.json({ ok: true });
}
