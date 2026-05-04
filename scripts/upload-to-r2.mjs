/**
 * One-time script: upload all template files (PNG, SVG) to Cloudflare R2.
 * Run with: node scripts/upload-to-r2.mjs
 */

import { S3Client, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { readdir, readFile, stat } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET,
} = process.env;

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
  console.error('Missing R2 env vars. Run: source .env.local or set them manually.');
  process.exit(1);
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

function mimeType(filename) {
  if (filename.endsWith('.svg')) return 'image/svg+xml';
  if (filename.endsWith('.png')) return 'image/png';
  if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) return 'image/jpeg';
  return 'application/octet-stream';
}

async function collectFiles(dir, base) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    const rel  = path.join(base, e.name);
    if (e.isDirectory()) {
      files.push(...await collectFiles(full, rel));
    } else if (/\.(png|jpg|jpeg|svg)$/i.test(e.name)) {
      files.push({ full, rel });
    }
  }
  return files;
}

// Fetch already-uploaded keys to skip re-uploading
async function existingKeys() {
  const keys = new Set();
  let token;
  do {
    const res = await s3.send(new ListObjectsV2Command({ Bucket: R2_BUCKET, ContinuationToken: token }));
    for (const obj of res.Contents ?? []) keys.add(obj.Key);
    token = res.NextContinuationToken;
  } while (token);
  return keys;
}

async function main() {
  const templatesDir = path.join(ROOT, 'public', 'templates');
  const files = await collectFiles(templatesDir, 'templates');
  console.log(`Found ${files.length} files to upload.`);

  const already = await existingKeys();
  console.log(`${already.size} files already in R2 — skipping those.\n`);

  let uploaded = 0, skipped = 0, failed = 0;

  for (const { full, rel } of files) {
    const key = rel.replace(/\\/g, '/'); // normalise Windows paths
    if (already.has(key)) { skipped++; continue; }

    try {
      const body = await readFile(full);
      await s3.send(new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: body,
        ContentType: mimeType(full),
        CacheControl: 'public, max-age=31536000, immutable',
      }));
      console.log(`✓ ${key}`);
      uploaded++;
    } catch (err) {
      console.error(`✗ ${key}:`, err.message);
      failed++;
    }
  }

  console.log(`\nDone — uploaded: ${uploaded}, skipped: ${skipped}, failed: ${failed}`);
}

main().catch(err => { console.error(err); process.exit(1); });
