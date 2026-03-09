/**
 * Generate a composite thumbnail PNG by overlaying an SVG text layer
 * onto the background PNG for a given template.
 *
 * Usage:
 *   node scripts/gen-thumbnail.mjs "It's a boy/Vachnacht-Bris/003"
 *   node scripts/gen-thumbnail.mjs "It's a boy/Vachnacht/004"
 */

import sharp from 'sharp';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.join(__dirname, '..', 'public', 'templates');

const arg = process.argv[2];
if (!arg) {
  console.error('Usage: node scripts/gen-thumbnail.mjs "<category>/<subcategory>/<stem>"');
  process.exit(1);
}

const parts = arg.split('/');
const stem = parts.pop();
const subPath = parts.join('/');
const folder = path.join(TEMPLATES_DIR, subPath);

const pngPath = path.join(folder, `${stem}.png`);
const svgPath = path.join(folder, `${stem}.svg`);

console.log(`Background: ${pngPath}`);
console.log(`Overlay:    ${svgPath}`);

// Get background dimensions
const bg = sharp(pngPath);
const meta = await bg.metadata();
const bgW = meta.width;
const bgH = meta.height;

// Read and patch the SVG to set explicit width/height so librsvg renders at full res
let svgContent = await readFile(svgPath, 'utf-8');

// Parse viewBox to get SVG's own dimensions
const vbMatch = svgContent.match(/viewBox=["']([^"']+)["']/);
let svgW = bgW, svgH = bgH;
if (vbMatch) {
  const p = vbMatch[1].trim().split(/[\s,]+/).map(Number);
  if (p.length >= 4) { svgW = p[2]; svgH = p[3]; }
}

// Inject width/height matching background PNG
svgContent = svgContent.replace(
  /<svg /,
  `<svg width="${bgW}" height="${bgH}" `
);

const svgBuf = Buffer.from(svgContent);

// Composite: background + SVG overlay
const outPath = path.join(folder, `${stem}.png`);

await sharp(pngPath)
  .resize(bgW, bgH)
  .composite([{ input: svgBuf, top: 0, left: 0 }])
  .png({ quality: 95 })
  .toFile(outPath + '.tmp.png');

// Atomic replace
import { rename } from 'fs/promises';
await rename(outPath + '.tmp.png', outPath);

console.log(`✓ Updated: ${outPath}`);
