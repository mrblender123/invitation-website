#!/usr/bin/env node
/**
 * normalize-fields.mjs
 *
 * Within a template folder, makes required/optional marking consistent:
 * - For each field name (e.g. "time", "greeting"), counts how many templates
 *   have it required (time*) vs optional (time).
 * - Majority wins: if most templates mark it required, all get *.
 * - Fields that only appear in one template (extra/unique fields) are left alone.
 * - Unknown/custom extra fields (not shared across templates) are never touched.
 *
 * Usage:
 *   node scripts/normalize-fields.mjs "It's a girl"
 *   node scripts/normalize-fields.mjs "It's a boy/Bris"
 *   node scripts/normalize-fields.mjs "It's a girl" --dry
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const TEMPLATES = path.join(ROOT, 'public', 'templates');

const args = process.argv.slice(2);
const folderArg = args.find(a => !a.startsWith('--'));
const DRY = args.includes('--dry');

if (!folderArg) {
  console.error('Usage: node scripts/normalize-fields.mjs "Category[/Sub]" [--dry]');
  process.exit(1);
}

const folderAbs = path.join(TEMPLATES, folderArg);
const svgFiles = readdirSync(folderAbs)
  .filter(f => /\.svg$/i.test(f) && !/-thumb\.svg$/i.test(f))
  .map(f => path.join(folderAbs, f));

if (!svgFiles.length) {
  console.error(`No SVG files found in ${folderAbs}`);
  process.exit(1);
}

const SKIP = new Set(['static_text', 'layer_1', 'layer 1', 'background']);

// Parse all field IDs from an SVG, returning { baseName, required, rawId }
function parseFields(content) {
  const fields = [];
  const re = /<g\b[^>]*\bid="([^"]+)"/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const rawId = m[1];
    const base = rawId.replace(/\*+$/g, '').trim();
    if (!base || !/^[A-Za-z]/.test(base)) continue;
    if (SKIP.has(base.toLowerCase())) continue;
    if (/^layer/i.test(base)) continue;
    if (/^line_\d/.test(base)) continue;
    fields.push({ base, required: rawId.endsWith('*'), rawId });
  }
  return fields;
}

// ── Survey all templates ──────────────────────────────────────────────────────
// For each base field name, tally required vs optional counts across all files.
const tally = new Map(); // base → { req: number, opt: number, files: Set }
const fileFields = new Map(); // filePath → fields[]

for (const f of svgFiles) {
  const content = readFileSync(f, 'utf-8');
  const fields = parseFields(content);
  fileFields.set(f, fields);
  for (const { base, required } of fields) {
    if (!tally.has(base)) tally.set(base, { req: 0, opt: 0, files: new Set() });
    const t = tally.get(base);
    if (required) t.req++; else t.opt++;
    t.files.add(f);
  }
}

// ── Decide canonical required/optional per field ──────────────────────────────
// Fields that appear in only one template → skip (template-specific, leave alone).
// Fields that appear in multiple templates → majority wins; tie → keep required.
const canonical = new Map(); // base → boolean (true = required)
let decisions = 0;

for (const [base, { req, opt, files }] of tally) {
  if (files.size < 2) continue; // unique to one template — skip
  const shouldBeRequired = req >= opt; // tie goes to required
  canonical.set(base, shouldBeRequired);
  if (req > 0 && opt > 0) {
    // There's actual disagreement — log it
    const verdict = shouldBeRequired ? 'required (*)' : 'optional';
    console.log(`  ${base}: ${req} required, ${opt} optional → normalize to ${verdict}`);
    decisions++;
  }
}

if (!decisions) {
  console.log('  All shared fields are already consistent — nothing to do.');
  process.exit(0);
}

// ── Apply corrections ─────────────────────────────────────────────────────────
let filesChanged = 0;

for (const f of svgFiles) {
  const content = readFileSync(f, 'utf-8');
  let result = content;
  let changed = false;

  for (const { base, required, rawId } of fileFields.get(f)) {
    if (!canonical.has(base)) continue; // unique field or consistent — skip
    const shouldBeRequired = canonical.get(base);
    if (required === shouldBeRequired) continue; // already correct

    // Rewrite the <g id="..."> tag in-place
    const correctId = shouldBeRequired ? `${base}*` : base;
    // Match the exact rawId in an id="..." attribute (with possible trailing * variants)
    const pattern = new RegExp(`(<g\\b[^>]*\\bid=")${escapeRegex(rawId)}"`, 'g');
    const before = result;
    result = result.replace(pattern, `$1${correctId}"`);
    if (result !== before) {
      console.log(`  ${path.basename(f)}: "${rawId}" → "${correctId}"`);
      changed = true;
    }
  }

  if (changed) {
    if (!DRY) writeFileSync(f, result, 'utf-8');
    filesChanged++;
  }
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

console.log(`\n${DRY ? '[dry] ' : ''}${filesChanged} file(s) updated.`);
if (DRY) console.log('Re-run without --dry to apply.');
