/**
 * Convert *-thumb.png files to WebP at 400px wide and upload to R2.
 * Skips files already converted (by source mtime+size) so a normal run only
 * touches new/changed thumbnails — pass --force to reconvert everything.
 * Run with: node scripts/convert-thumbs-to-webp.mjs [--force]
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { readdir, stat } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const force = process.argv.includes('--force');
const CACHE_PATH = path.join(ROOT, '.thumb-webp-cache.json');

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
  console.error('Missing R2 env vars.');
  process.exit(1);
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

async function collectThumbs(dir, base) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    const rel  = path.join(base, e.name);
    if (e.isDirectory()) {
      files.push(...await collectThumbs(full, rel));
    } else if (/-thumb\.png$/i.test(e.name)) {
      files.push({ full, rel });
    }
  }
  return files;
}

function loadCache() {
  if (!existsSync(CACHE_PATH)) return {};
  try { return JSON.parse(readFileSync(CACHE_PATH, 'utf-8')); } catch { return {}; }
}

async function main() {
  const templatesDir = path.join(ROOT, 'public', 'templates');
  const files = await collectThumbs(templatesDir, 'templates');
  const cache = loadCache();

  let converted = 0, failed = 0, skipped = 0;

  for (const { full, rel } of files) {
    const webpKey = rel.replace(/\\/g, '/').replace(/-thumb\.png$/i, '-thumb.webp');
    const { mtimeMs, size } = await stat(full);

    if (!force && cache[rel] && cache[rel].mtimeMs === mtimeMs && cache[rel].size === size) {
      skipped++;
      continue;
    }

    try {
      const buffer = await sharp(full)
        .flatten({ background: '#ffffff' })
        .resize({ width: 400 })
        .webp({ quality: 82 })
        .toBuffer();

      await s3.send(new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: webpKey,
        Body: buffer,
        ContentType: 'image/webp',
        CacheControl: 'public, max-age=31536000, immutable',
      }));

      const kb = Math.round(buffer.length / 1024);
      console.log(`✓ ${webpKey} (${kb} KB)`);
      cache[rel] = { mtimeMs, size };
      converted++;
    } catch (err) {
      console.error(`✗ ${webpKey}:`, err.message);
      failed++;
    }
  }

  writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
  console.log(`\nFound ${files.length} thumb files — converted & uploaded: ${converted}, skipped (unchanged): ${skipped}, failed: ${failed}`);
}

main().catch(err => { console.error(err); process.exit(1); });
