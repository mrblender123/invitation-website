import { NextRequest, NextResponse } from 'next/server';
import { readdir, readFile, writeFile } from 'fs/promises';
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

// ── SVG manipulation ──────────────────────────────────────────────────────────

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findMatchingClose(svg: string, start: number): number {
  let depth = 0, i = start;
  while (i < svg.length) {
    const open  = svg.indexOf('<g', i);
    const close = svg.indexOf('</g>', i);
    if (close === -1) return -1;
    if (open !== -1 && open < close) {
      const c = svg[open + 2];
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '>') depth++;
      i = open + 2;
    } else {
      if (--depth === 0) return close + 4;
      i = close + 4;
    }
  }
  return -1;
}

function extractFieldBlocks(svg: string) {
  const blocks: { fullId: string; id: string; required: boolean; start: number; end: number; content: string }[] = [];
  const re = /<g\b[^>]*\bid="([A-Za-z][^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg)) !== null) {
    const fullId = m[1];
    const start  = m.index;
    const end    = findMatchingClose(svg, start);
    if (end === -1) continue;
    blocks.push({ fullId, id: fullId.replace(/\*$/, ''), required: fullId.endsWith('*'), start, end, content: svg.slice(start, end) });
  }
  return blocks;
}

function applyFieldChanges(svg: string, fields: { id: string; required: boolean }[]): string {
  let result = svg;

  // Step 1: apply required changes
  for (const { id, required } of fields) {
    const e = escapeRegex(id);
    if (required) {
      result = result.replace(new RegExp(`\\bid="${e}"`, 'g'), `id="${id}*"`);
    } else {
      result = result.replace(new RegExp(`\\bid="${e}\\*"`, 'g'), `id="${id}"`);
    }
  }

  // Step 2: reorder using updated fullIds
  const desiredFullIds = fields.map(f => f.required ? `${f.id}*` : f.id);
  const blocks = extractFieldBlocks(result);
  if (!blocks.length) return result;

  const contentMap: Record<string, string> = Object.fromEntries(blocks.map(b => [b.fullId, b.content]));
  const inOrder      = new Set(desiredFullIds.filter(id => id in contentMap));
  const orderedBlocks = blocks.filter(b => inOrder.has(b.fullId));
  const filteredOrder = desiredFullIds.filter(id => id in contentMap);
  if (orderedBlocks.length !== filteredOrder.length) return result;

  const replacements = orderedBlocks
    .map((b, i) => ({ start: b.start, end: b.end, newContent: contentMap[filteredOrder[i]] }))
    .sort((a, b) => b.start - a.start);

  for (const { start, end, newContent } of replacements) {
    result = result.slice(0, start) + newContent + result.slice(end);
  }
  return result;
}

// ── GitHub helper (same pattern as update-svg) ────────────────────────────────

async function uploadToR2(relativePath: string, content: string): Promise<void> {
  const r2AccountId = process.env.R2_ACCOUNT_ID;
  const r2AccessKey = process.env.R2_ACCESS_KEY_ID;
  const r2SecretKey = process.env.R2_SECRET_ACCESS_KEY;
  const r2Bucket    = process.env.R2_BUCKET;
  if (!r2AccountId || !r2AccessKey || !r2SecretKey || !r2Bucket) return;

  const r2Key = `templates/${relativePath}`;
  const { createHmac, createHash } = await import('crypto');
  const now = new Date();
  const dateStamp   = now.toISOString().slice(0, 10).replace(/-/g, '');
  const amzDate     = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
  const bodyBytes   = Buffer.from(content, 'utf-8');
  const payloadHash = createHash('sha256').update(bodyBytes).digest('hex');
  const host        = `${r2Bucket}.${r2AccountId}.r2.cloudflarestorage.com`;

  const canonicalHeaders = `content-type:image/svg+xml\nhost:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders    = 'content-type;host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = `PUT\n/${encodeURIComponent(r2Key).replace(/%2F/g, '/')}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const credentialScope  = `${dateStamp}/auto/s3/aws4_request`;
  const stringToSign     = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${createHash('sha256').update(canonicalRequest).digest('hex')}`;
  const sign = (key: Buffer, msg: string) => createHmac('sha256', key).update(msg).digest();
  const signingKey  = sign(sign(sign(sign(Buffer.from(`AWS4${r2SecretKey}`), dateStamp), 'auto'), 's3'), 'aws4_request');
  const signature   = createHmac('sha256', signingKey).update(stringToSign).digest('hex');
  const authorization = `AWS4-HMAC-SHA256 Credential=${r2AccessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const r2Res = await fetch(`https://${host}/${encodeURIComponent(r2Key).replace(/%2F/g, '/')}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/svg+xml', 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate, Authorization: authorization, 'Cache-Control': 'public, max-age=0, must-revalidate' },
    body: bodyBytes,
  });
  if (!r2Res.ok) throw new Error(`R2 upload failed: ${r2Res.status}`);
}

async function writeFileToGitHub(relativePath: string, content: string): Promise<void> {
  const githubToken = process.env.GITHUB_TOKEN!;
  const repo        = process.env.GITHUB_REPO!;
  const branch      = process.env.GITHUB_BRANCH ?? 'main';
  const filePath    = `public/${relativePath}`;
  const apiUrl      = `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(filePath).replace(/%2F/g, '/')}`;
  const headers = {
    Authorization: `Bearer ${githubToken}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };
  const getRes  = await fetch(`${apiUrl}?ref=${branch}`, { headers });
  if (!getRes.ok) throw new Error(`GitHub GET failed: ${getRes.status}`);
  const getJson = await getRes.json();
  const putRes  = await fetch(apiUrl, {
    method: 'PUT', headers,
    body: JSON.stringify({
      message: `Update ${filePath} via field manager`,
      content: Buffer.from(content, 'utf-8').toString('base64'),
      sha: getJson.sha,
      branch,
    }),
  });
  if (!putRes.ok) {
    const body = await putRes.text().catch(() => '');
    throw new Error(`GitHub PUT failed: ${putRes.status} — ${body.slice(0, 200)}`);
  }
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!await verifyAdmin(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { folderPath, fields } = await req.json() as {
    folderPath: string;
    fields: { id: string; required: boolean }[];
  };

  if (!folderPath || !Array.isArray(fields)) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const absFolder   = path.join(process.cwd(), folderPath);
  const allowedBase = path.join(process.cwd(), 'public', 'templates');
  if (!absFolder.startsWith(allowedBase + path.sep)) {
    return NextResponse.json({ error: 'Invalid folder path' }, { status: 400 });
  }

  const entries   = await readdir(absFolder);
  const svgFiles  = entries.filter(f => f.toLowerCase().endsWith('.svg') && !f.startsWith('_'));

  let count = 0;
  for (const file of svgFiles) {
    const absPath = path.join(absFolder, file);
    const orig    = await readFile(absPath, 'utf-8');
    const updated = applyFieldChanges(orig, fields);
    if (updated === orig) continue;

    if (process.env.NODE_ENV === 'development') {
      await writeFile(absPath, updated, 'utf-8');
    } else {
      const relPath = path.relative(path.join(process.cwd(), 'public'), absPath).replace(/\\/g, '/');
      await Promise.all([
        writeFileToGitHub(relPath, updated),
        uploadToR2(relPath, updated),
      ]);
    }
    count++;
  }

  revalidatePath('/api/templates');
  return NextResponse.json({ ok: true, count });
}
