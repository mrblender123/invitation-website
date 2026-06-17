#!/usr/bin/env node
/**
 * Configures CORS on the R2 bucket so browsers can PUT presigned upload URLs.
 * Run once: node --env-file=.env.local scripts/setup-r2-cors.mjs
 */
import { S3Client, PutBucketCorsCommand, GetBucketCorsCommand } from '@aws-sdk/client-s3';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env.local');
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

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

await s3.send(new PutBucketCorsCommand({
  Bucket: R2_BUCKET,
  CORSConfiguration: {
    CORSRules: [{
      AllowedOrigins: ['https://www.shareyoursimcha.com', 'https://shareyoursimcha.com', 'http://localhost:3000'],
      AllowedMethods: ['PUT'],
      AllowedHeaders: ['content-type'],
      MaxAgeSeconds: 3000,
    }],
  },
}));

const { CORSRules } = await s3.send(new GetBucketCorsCommand({ Bucket: R2_BUCKET }));
console.log('R2 CORS configured:', JSON.stringify(CORSRules, null, 2));
