#!/usr/bin/env node
/**
 * match-template.mjs
 *
 * Automatically assigns field IDs to a new SVG template by matching it
 * against an already-processed template in the same folder.
 *
 * How it works:
 *   1. Finds the best reference SVG in the same folder (most fields, already processed)
 *   2. Extracts text elements from both SVGs, sorted by Y position (top → bottom)
 *   3. Matches them by index — same visual position = same field purpose
 *   4. Wraps each new element in <g id="..."> using the reference's field ID
 *
 * Usage:
 *   node scripts/match-template.mjs "public/templates/Bar mitzva/Bar Mitzvah/BM-09.svg"
 *   node scripts/match-template.mjs "public/templates/Bar mitzva/Bar Mitzvah/BM-09.svg" --dry
 */

import { readFile, writeFile, readdir, stat } from 'fs/promises';
import path from 'path';

const args     = process.argv.slice(2);
const filePath = args.find(a => !a.startsWith('--'));
const isDry    = args.includes('--dry');

if (!filePath) {
  console.error('Usage: node scripts/match-template.mjs <file.svg> [--dry]');
  process.exit(1);
}

const absPath = path.resolve(filePath);
const folder  = path.dirname(absPath);

// ── SVG parsing ───────────────────────────────────────────────────────────────

/**
 * Extract all <text> elements from an SVG.
 * Returns them sorted by Y position (visual top-to-bottom order).
 * Each entry includes: y, placeholder text, field id (if already wrapped), raw block.
 */
function extractTexts(svg) {
  const results = [];
  const textRe  = /<text\b([^>]*)>([\s\S]*?)<\/text>/g;
  let m;

  while ((m = textRe.exec(svg)) !== null) {
    const attrs = m[1];
    const inner = m[2];
    const start = m.index;
    const end   = start + m[0].length;

    // Y position from transform="translate(x y)"
    const txMatch = attrs.match(/transform="translate\(\s*[+-]?[\d.]+[\s,]+([+-]?[\d.]+)\s*\)"/);
    const y = txMatch ? parseFloat(txMatch[1]) : 0;

    // Placeholder: first non-empty tspan content
    const tspan = inner.match(/<tspan[^>]*>([^<]+)</);
    const placeholder = tspan ? tspan[1].trim() : '';
    if (!placeholder) continue; // skip empty/whitespace tspans

    // Field id: check nearest preceding <g id="..."> that hasn't been closed yet
    const before    = svg.slice(0, start);
    const lastOpen  = before.lastIndexOf('<g');
    const lastClose = before.lastIndexOf('</g>');
    let fieldId = null;
    if (lastOpen !== -1 && (lastClose === -1 || lastOpen > lastClose)) {
      const tagSnippet = svg.slice(lastOpen, svg.indexOf('>', lastOpen) + 1);
      const idMatch    = tagSnippet.match(/\bid="([A-Za-z][^"]*)"/);
      if (idMatch) fieldId = idMatch[1];
    }

    results.push({ y, placeholder, fieldId, start, end, raw: m[0] });
  }

  return results.sort((a, b) => a.y - b.y);
}

/**
 * Check if an SVG is "processed" — has at least some valid field wrappers.
 */
function isProcessed(svg) {
  const re = /<g\b[^>]*\bid="([A-Za-z][^"]*)"/g;
  let m, count = 0;
  while ((m = re.exec(svg)) !== null) {
    const id = m[1].replace(/\*$/, '');
    if (!/^(layer|line_\d+$|static_text|background)/i.test(id)) count++;
  }
  return count >= 2;
}

// ── Find reference SVG ────────────────────────────────────────────────────────

async function findReference(folder, skipFile) {
  const entries = await readdir(folder);
  const svgFiles = entries
    .filter(f => f.toLowerCase().endsWith('.svg') && !f.startsWith('_') && path.join(folder, f) !== skipFile)
    .map(f => path.join(folder, f));

  // Prefer the most recently modified processed template — most likely to have
  // the current naming convention rather than older field names.
  const candidates = [];
  for (const f of svgFiles) {
    const content = await readFile(f, 'utf-8');
    if (!isProcessed(content)) continue;
    const s = await stat(f);
    candidates.push({ path: f, content, mtime: s.mtimeMs });
  }

  if (!candidates.length) return null;
  candidates.sort((a, b) => b.mtime - a.mtime); // newest first

  const best = candidates[0];
  return { path: best.path, content: best.content, texts: extractTexts(best.content) };
}

// ── Apply field IDs ───────────────────────────────────────────────────────────

function applyIds(svg, newTexts, refTexts) {
  // Build a map: position index (by Y order) → reference field id
  // Only match if counts align within ±2
  const countDiff = Math.abs(newTexts.length - refTexts.length);
  if (countDiff > 2) {
    console.warn(`\n⚠  Text element count mismatch: new=${newTexts.length}, ref=${refTexts.length}`);
    console.warn('   Matching what we can — review the result carefully.\n');
  }

  // Process replacements in reverse order (to preserve string positions)
  const sorted = [...newTexts].sort((a, b) => b.start - a.start);
  let result = svg;

  for (const t of sorted) {
    // Find this element's position in the Y-sorted list
    const idx    = newTexts.indexOf(t);
    const refEl  = refTexts[idx];
    if (!refEl) continue; // no reference for this position

    const refId  = refEl.fieldId;
    if (!refId) continue; // reference element is bare static text

    // Check if already properly wrapped
    if (t.fieldId && /^[A-Za-z]/.test(t.fieldId) && !/^_/.test(t.fieldId)) {
      // Already has a valid id — rename it to match reference
      if (t.fieldId !== refId) {
        const gStart = result.lastIndexOf('<g', t.start);
        const gEnd   = result.indexOf('>', gStart);
        const oldTag = result.slice(gStart, gEnd + 1);
        const newTag = oldTag.replace(/\bid="[^"]*"/, `id="${refId}"`);
        result = result.slice(0, gStart) + newTag + result.slice(gEnd + 1);
        console.log(`  rename  "${t.fieldId}" → "${refId}"  (${t.placeholder})`);
      }
      continue;
    }

    // Wrap bare or Illustrator-ID'd text in <g id="...">
    const lineStart = result.lastIndexOf('\n', t.start) + 1;
    const indent    = result.slice(lineStart, t.start).match(/^\s*/)?.[0] ?? '  ';
    const wrapped   = `<g id="${refId}">\n${indent}  ${t.raw.trimStart()}\n${indent}</g>`;
    result = result.slice(0, t.start) + wrapped + result.slice(t.end);
    console.log(`  wrap    "${refId}"  (${t.placeholder})`);
  }

  return result;
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log(`\nmatching: ${filePath}`);

const newSvg  = await readFile(absPath, 'utf-8');
const newTexts = extractTexts(newSvg);

const ref = await findReference(folder, absPath);
if (!ref) {
  console.error('\n✗ No processed reference template found in this folder.');
  console.error('  Process one template manually first, then run this script for the rest.');
  process.exit(1);
}

console.log(`reference: ${path.relative(process.cwd(), ref.path)}`);
console.log(`  ref fields: ${ref.texts.length}  new fields: ${newTexts.length}\n`);

const result = applyIds(newSvg, newTexts, ref.texts);

if (isDry) {
  process.stdout.write(result);
} else {
  await writeFile(absPath, result, 'utf-8');
  console.log(`\n✓ Saved — now run: npm run validate-templates`);
}
