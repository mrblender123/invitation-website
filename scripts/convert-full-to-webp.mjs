/**
 * Convert all full-size template PNGs to WebP and upload to R2.
 * Keeps full 1500px resolution but compresses with WebP (quality 90).
 * Run with: node scripts/convert-full-to-webp.mjs
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { readdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
  console.error('Missing R2 env vars.');
  process.exit(1);
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

async function collectFullPngs(dir, base) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    const rel  = path.join(base, e.name);
    if (e.isDirectory()) {
      files.push(...await collectFullPngs(full, rel));
    } else if (/\.png$/i.test(e.name) && !/-thumb\.png$/i.test(e.name)) {
      files.push({ full, rel });
    }
  }
  return files;
}

async function main() {
  const templatesDir = path.join(ROOT, 'public', 'templates');
  const files = await collectFullPngs(templatesDir, 'templates');
  console.log(`Found ${files.length} full PNG files to convert.\n`);

  let converted = 0, failed = 0;

  for (const { full, rel } of files) {
    const webpKey = rel.replace(/\\/g, '/').replace(/\.png$/i, '.webp');

    try {
      const buffer = await sharp(full)
        .webp({ quality: 90 })
        .toBuffer();

      await s3.send(new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: webpKey,
        Body: buffer,
        ContentType: 'image/webp',
        CacheControl: 'public, max-age=31536000, immutable',
      }));

      const origKb = Math.round((await import('fs')).statSync(full).size / 1024);
      const newKb  = Math.round(buffer.length / 1024);
      console.log(`✓ ${webpKey.split('/').pop()} — ${origKb}KB → ${newKb}KB`);
      converted++;
    } catch (err) {
      console.error(`✗ ${rel}:`, err.message);
      failed++;
    }
  }

  console.log(`\nDone — converted & uploaded: ${converted}, failed: ${failed}`);
}

main().catch(err => { console.error(err); process.exit(1); });
