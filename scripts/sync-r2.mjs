#!/usr/bin/env node
/**
 * Uploads all template SVGs and PNGs to R2.
 * Usage:
 *   node scripts/sync-r2.mjs              # upload everything
 *   node scripts/sync-r2.mjs "It's a boy" # upload one category folder
 */
import { readFile, readdir } from 'fs/promises';
import { createHmac, createHash } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// Load .env.local
const envPath = path.join(ROOT, '.env.local');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
  console.error('Missing R2 env vars'); process.exit(1);
}

const TEMPLATES_DIR = path.join(ROOT, 'public', 'templates');
const scope = process.argv[2]; // optional: limit to one category folder

async function collect(dir, base = '') {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    const rel  = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...await collect(full, rel));
    else if (/\.(svg|png)$/i.test(e.name) && !e.name.startsWith('_')) out.push(rel);
  }
  return out;
}

// Encode a path for AWS4 canonical requests — encodes everything except unreserved chars and /
function encodePath(p) {
  return p.split('/').map(seg =>
    encodeURIComponent(seg).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())
  ).join('/');
}

async function upload(relPath, content) {
  const r2Key = `templates/${relPath}`;
  const ct    = relPath.endsWith('.svg') ? 'image/svg+xml' : 'image/png';
  const host  = `${R2_BUCKET}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const body  = typeof content === 'string' ? Buffer.from(content, 'utf-8') : content;
  const now   = new Date();
  const ds    = now.toISOString().slice(0,10).replace(/-/g,'');
  const ad    = now.toISOString().replace(/[:-]|\.\d{3}/g,'').slice(0,15)+'Z';
  const ph    = createHash('sha256').update(body).digest('hex');
  const ch    = `content-type:${ct}\nhost:${host}\nx-amz-content-sha256:${ph}\nx-amz-date:${ad}\n`;
  const sh    = 'content-type;host;x-amz-content-sha256;x-amz-date';
  const encodedPath = encodePath(r2Key);
  const cr    = `PUT\n/${encodedPath}\n\n${ch}\n${sh}\n${ph}`;
  const sc    = `${ds}/auto/s3/aws4_request`;
  const sts   = `AWS4-HMAC-SHA256\n${ad}\n${sc}\n${createHash('sha256').update(cr).digest('hex')}`;
  const s     = (k,m) => createHmac('sha256',k).update(m).digest();
  const sk    = s(s(s(s(Buffer.from(`AWS4${R2_SECRET_ACCESS_KEY}`),ds),'auto'),'s3'),'aws4_request');
  const sig   = createHmac('sha256',sk).update(sts).digest('hex');
  const auth  = `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY_ID}/${sc}, SignedHeaders=${sh}, Signature=${sig}`;
  const res   = await fetch(`https://${host}/${encodedPath}`, {
    method: 'PUT',
    headers: { 'Content-Type': ct, 'x-amz-content-sha256': ph, 'x-amz-date': ad, Authorization: auth, 'Cache-Control': 'public, max-age=0, must-revalidate' },
    body,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
}

const scanDir = scope ? path.join(TEMPLATES_DIR, scope) : TEMPLATES_DIR;
const base    = scope ?? '';
const files   = await collect(scanDir, base);
console.log(`Uploading ${files.length} files…`);

let ok = 0, fail = 0;
for (const f of files) {
  const abs = path.join(TEMPLATES_DIR, f);
  let done = false;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const content = f.endsWith('.svg') ? await readFile(abs, 'utf-8') : await readFile(abs);
      await upload(f, content);
      process.stdout.write('.');
      ok++; done = true; break;
    } catch (e) {
      if (attempt < 3) {
        await new Promise(r => setTimeout(r, 1000 * attempt)); // wait 1s, then 2s
      } else {
        console.error(`\nFAIL ${f}: ${e.message}`);
        fail++;
      }
    }
  }
  void done;
}
console.log(`\n✓ ${ok} uploaded, ${fail} failed`);
