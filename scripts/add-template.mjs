#!/usr/bin/env node
/**
 * add-template.mjs
 *
 * Efficient workflow for assigning field IDs to SVG templates.
 * Uses a per-folder schema so you only answer questions ONCE per folder —
 * every other template in that folder is processed automatically.
 *
 * Usage:
 *   node scripts/add-template.mjs <file.svg|folder> [--side] [--dry]
 *
 * --side  skip centering (for side-aligned designs)
 * --dry   preview without writing anything
 *
 * Schema file (_schema.json) is saved in each template subfolder.
 * It stores field order, IDs, and required/optional status.
 */

import { readFile, writeFile, readdir, stat } from 'fs/promises';
import path from 'path';
import readline from 'readline';
import { execSync } from 'child_process';

// ── SVG parsing ───────────────────────────────────────────────────────────────

/**
 * Find all <text>...</text> blocks in the SVG.
 * Returns each block with its position, text preview, and whether it's
 * already inside a proper <g id="english_name"> wrapper.
 */
function parseTextBlocks(svg) {
  const blocks = [];
  const re = /<text\b[^>]*>[\s\S]*?<\/text>/g;
  let m;

  while ((m = re.exec(svg)) !== null) {
    const start = m.index;
    const end   = start + m[0].length;
    const block = m[0];

    // Preview: first non-empty tspan content
    const ts = block.match(/<tspan[^>]*>([^<]+)</);
    const preview = ts ? ts[1].trim() : '';
    if (!preview) continue; // skip blank/whitespace-only tspans

    blocks.push({ start, end, block, preview, wrapped: isInsideGId(svg, start) });
  }

  return blocks;
}

/**
 * Check if the <text> at `start` is already inside a <g id="englishName"> wrapper.
 * Strategy: find the nearest preceding <g or </g> tag.
 * If it's a <g> with an English-named id, we consider it wrapped.
 */
function isInsideGId(svg, start) {
  const before     = svg.slice(0, start);
  const lastOpen   = before.lastIndexOf('<g');
  const lastClose  = before.lastIndexOf('</g>');

  if (lastOpen === -1)          return false; // no <g at all
  if (lastClose > lastOpen)     return false; // the last thing was a closing tag

  // Grab the opening tag text
  const tagEnd = before.indexOf('>', lastOpen);
  const tag    = before.slice(lastOpen, tagEnd + 1);

  // Only consider it "wrapped" if the id starts with an ASCII letter
  // (rules out Illustrator auto-IDs like "_חתן" or "g1234")
  return /\bid="[A-Za-z]/.test(tag);
}

/**
 * Rewrite SVG wrapping the specified text blocks with <g id> tags.
 * Process in reverse order so earlier positions stay valid.
 */
function applyIds(svg, assignments) {
  const sorted = [...assignments]
    .filter(a => a.id)
    .sort((a, b) => b.start - a.start);

  let result = svg;
  for (const { start, end, block, id, required } of sorted) {
    const fullId  = required ? `${id}*` : id;
    const indent  = detectIndent(svg, start);
    const wrapped = `<g id="${fullId}">\n${indent}  ${block}\n${indent}</g>`;
    result = result.slice(0, start) + wrapped + result.slice(end);
  }
  return result;
}

/** Detect the indentation before a position in the SVG. */
function detectIndent(svg, pos) {
  const lineStart = svg.lastIndexOf('\n', pos - 1) + 1;
  const raw = svg.slice(lineStart, pos);
  return raw.match(/^(\s*)/)?.[1] ?? '  ';
}

// ── schema ────────────────────────────────────────────────────────────────────

async function loadSchema(dir) {
  try {
    return JSON.parse(await readFile(path.join(dir, '_schema.json'), 'utf-8'));
  } catch {
    return null;
  }
}

async function saveSchema(dir, schema) {
  await writeFile(path.join(dir, '_schema.json'), JSON.stringify(schema, null, 2));
}

// ── readline helpers ──────────────────────────────────────────────────────────

function ask(rl, question) {
  return new Promise(resolve => rl.question(question, a => resolve(a.trim())));
}

async function askField(rl, preview) {
  console.log(`\n  ┌─ "${preview}"`);
  const id = await ask(rl, `  │  Field ID (blank = static text): `);
  if (!id) {
    console.log(`  └─ static (will not be editable)`);
    return { id: '', required: false };
  }
  const req = await ask(rl, `  │  Always visible? (y/n): `);
  const required = req.toLowerCase().startsWith('y');
  console.log(`  └─ ${id}${required ? '*' : ''} — ${required ? 'always shown' : 'hidden (Show all fields)'}`);
  return { id, required };
}

// ── file processing ───────────────────────────────────────────────────────────

async function processFile(filePath, rl, opts) {
  const { side, dry } = opts;
  const filename = path.basename(filePath);
  const dir      = path.dirname(filePath);

  console.log(`\n${'─'.repeat(64)}`);
  console.log(`▶ ${path.relative(process.cwd(), filePath)}`);

  // Step 1: clean fonts/centering
  if (!dry) {
    process.stdout.write('  Cleaning... ');
    try {
      execSync(`node scripts/clean-svg.mjs "${filePath}"${side ? ' --side' : ''}`, { stdio: 'pipe' });
      console.log('✓');
    } catch (e) {
      console.log('(clean-svg not found, skipping)');
    }
  }

  // Step 2: parse
  const svg      = await readFile(filePath, 'utf-8');
  const blocks   = parseTextBlocks(svg);
  const needIds  = blocks.filter(b => !b.wrapped);

  if (needIds.length === 0) {
    console.log('  ✓ All fields already assigned — skipping');
    return;
  }

  console.log(`  ${needIds.length} text element(s) need IDs`);

  // Step 3: schema
  let schema       = await loadSchema(dir);
  const assignments = [];

  if (!schema) {
    // ── Define schema (first template in this folder) ──────────────────
    console.log(`\n  No schema yet. Defining schema for this folder.`);
    console.log(`  You'll answer for each text element once — all other`);
    console.log(`  templates in this folder will be done automatically.\n`);

    const fields = [];
    for (const b of needIds) {
      const { id, required } = await askField(rl, b.preview);
      fields.push(id ? { id, required } : null);
      assignments.push({ ...b, id, required });
    }

    schema = { fields };
    if (!dry) {
      await saveSchema(dir, schema);
      console.log(`\n  → Schema saved (_schema.json)`);
    }

  } else {
    // ── Auto-apply schema ──────────────────────────────────────────────
    const { fields } = schema;

    for (let i = 0; i < needIds.length; i++) {
      const b = needIds[i];

      if (i < fields.length) {
        const field = fields[i];
        if (field) {
          console.log(`  ✓ ${field.id}${field.required ? '*' : ''}  ←  "${b.preview}"`);
          assignments.push({ ...b, id: field.id, required: field.required });
        } else {
          console.log(`  —  static  ←  "${b.preview}"`);
          assignments.push({ ...b, id: '', required: false });
        }
      } else {
        // Extra field not covered by schema
        console.log(`\n  ⚠ Extra field at position ${i + 1} (not in schema):`);
        const { id, required } = await askField(rl, b.preview);
        assignments.push({ ...b, id, required });
      }
    }

    // Warn about schema fields that had no matching element
    const expectedCount = fields.filter(Boolean).length;
    const gotCount      = assignments.filter(a => a.id).length;
    if (gotCount < expectedCount) {
      const missing = fields.slice(needIds.length).filter(Boolean).map(f => f.id);
      console.log(`\n  ⚠ ${missing.length} schema field(s) not found in this template: ${missing.join(', ')}`);
      console.log(`     (template may have fewer elements than the schema defines)`);
    }
  }

  // Step 4: write
  if (!dry) {
    const newSvg = applyIds(svg, assignments);
    await writeFile(filePath, newSvg);
    const applied = assignments.filter(a => a.id).length;
    console.log(`\n  ✓ Saved — ${applied} field(s) wrapped`);
  } else {
    const applied = assignments.filter(a => a.id).length;
    console.log(`\n  [dry] Would wrap ${applied} field(s)`);
  }
}

// ── entry ─────────────────────────────────────────────────────────────────────

const args    = process.argv.slice(2);
const side    = args.includes('--side');
const dry     = args.includes('--dry');
const targets = args.filter(a => !a.startsWith('--'));

if (!targets.length) {
  console.log('Usage: node scripts/add-template.mjs <file.svg|folder> [--side] [--dry]');
  console.log('');
  console.log('  file.svg   process a single file');
  console.log('  folder     process all SVGs in folder (uses shared schema)');
  console.log('  --side     skip centering (side-aligned designs)');
  console.log('  --dry      preview without writing');
  process.exit(1);
}

// Collect SVG files
const svgFiles = [];
for (const t of targets) {
  let s;
  try { s = await stat(t); } catch { console.error(`Not found: ${t}`); continue; }

  if (s.isDirectory()) {
    const files = (await readdir(t))
      .filter(f => f.toLowerCase().endsWith('.svg') && !f.startsWith('_'))
      .sort()
      .map(f => path.join(t, f));
    svgFiles.push(...files);
  } else {
    svgFiles.push(t);
  }
}

if (!svgFiles.length) {
  console.error('No SVG files found.');
  process.exit(1);
}

console.log(`Found ${svgFiles.length} SVG file(s).`);
if (dry) console.log('(dry run — nothing will be written)');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

for (const f of svgFiles) {
  await processFile(f, rl, { side, dry });
}

rl.close();
console.log('\n✓ Done!');
