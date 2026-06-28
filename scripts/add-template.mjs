#!/usr/bin/env node
/**
 * add-template.mjs
 *
 * Orchestrates the full "add a new template" pipeline from CLAUDE.md as one
 * fail-fast command, instead of running 5 separate scripts by hand and hoping
 * none of the steps got skipped or run out of order.
 *
 * Stages (each is a hard gate — a failure stops the pipeline before the next stage runs):
 *   1. Auto-detect multi-column layout (decides --side for you)
 *   2. Clean SVG (fonts, junk, centering)              — scripts/clean-svg.mjs
 *   3. Detect outlined/baked text masquerading as art   — new check, no existing script
 *   4. Match field IDs against a reference in the folder — scripts/match-template.mjs
 *      (hard stop on any field-count mismatch — silent guessing caused real bugs)
 *   5. Wrap any remaining bare text                      — scripts/wrap-static-texts.mjs
 *   6. Validate                                          — scripts/validate-templates.mjs
 *   7. Render a PNG preview to the scratch dir for visual review
 *   8. Print (not run) the exact git/sync-r2 commands — you stay in control of those
 *
 * Usage:
 *   node scripts/add-template.mjs "public/templates/Category/Sub/FILE.svg"
 *   node scripts/add-template.mjs "public/templates/Category/Sub/FILE.svg" --ack-static-art
 *   node scripts/add-template.mjs "public/templates/Category/Sub/FILE.svg" --ack-field-mismatch
 *
 * Flags:
 *   --ack-static-art       proceed even though a possible outlined-text block was found
 *   --ack-field-mismatch   proceed even though match-template found a field-count mismatch
 *   --side                 force side mode (skip auto-detection)
 */

import { readFile, mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const args = process.argv.slice(2);
const filePath = args.find(a => !a.startsWith('--'));
const ackStaticArt = args.includes('--ack-static-art');
const ackFieldMismatch = args.includes('--ack-field-mismatch');
const forceSide = args.includes('--side');

if (!filePath) {
  console.error('Usage: node scripts/add-template.mjs <file.svg> [--ack-static-art] [--ack-field-mismatch] [--side]');
  process.exit(1);
}

const absPath = path.resolve(filePath);
const relPath = path.relative(ROOT, absPath);
const folder  = path.dirname(absPath);

function step(label) {
  console.log(`\n→ ${label}`);
}

function fail(msg) {
  console.error(`\n✗ ${msg}`);
  console.error('  Nothing past this point ran.');
  process.exit(1);
}

// ── Stage 1: auto-detect multi-column layout ──────────────────────────────────

async function detectSide() {
  if (forceSide) return true;
  const content = await readFile(absPath, 'utf-8');
  const translates = [...content.matchAll(/<text[^>]*\btransform="translate\(([^)]+)\)/g)]
    .map(m => m[1].trim());
  const seen = new Map();
  for (const t of translates) seen.set(t, (seen.get(t) ?? 0) + 1);
  return [...seen.values()].some(c => c > 1);
}

step('Checking for multi-column layout...');
const side = await detectSide();
console.log(side ? '  multi-column detected → using --side mode' : '  none found → centering mode');

// ── Stage 2: clean ─────────────────────────────────────────────────────────────

step('Cleaning SVG (fonts, junk, centering)...');
try {
  execSync(`node scripts/clean-svg.mjs "${relPath}"${side ? ' --side' : ''}`, { cwd: ROOT, stdio: 'pipe' });
  console.log('  done.');
} catch (e) {
  fail(`clean-svg.mjs failed:\n${e.stdout?.toString() ?? e.message}`);
}

// ── Stage 3: detect outlined/baked text ────────────────────────────────────────

step('Scanning for outlined/baked text passed off as artwork...');
{
  const content = await readFile(absPath, 'utf-8');
  // Heuristic matching the CI-01..08 bug: an anonymous (no id, or an
  // Illustrator auto-id) <g> containing many bare <path> children and no
  // <text> descendant. Real decorative artwork tends to be either much
  // smaller groups or have an explicit, human-named id.
  const gBlocks = [...content.matchAll(/<g\b([^>]*)>([\s\S]*?)<\/g>/g)];
  const suspects = [];
  for (const [, attrs, inner] of gBlocks) {
    const idMatch = attrs.match(/\bid="([^"]+)"/);
    const id = idMatch?.[1] ?? '';
    const hasHumanId = /^[A-Za-z]/.test(id) && !id.startsWith('_');
    if (hasHumanId) continue; // explicitly named — trust the designer/earlier pass
    if (/<text\b/.test(inner)) continue; // has real text — not a pure-path block
    const pathCount = (inner.match(/<path\b/g) ?? []).length;
    if (pathCount >= 8) suspects.push({ id: id || '(none)', pathCount });
  }

  if (suspects.length && !ackStaticArt) {
    console.error('\n  ✗ FOUND possible outlined text:');
    for (const s of suspects) {
      console.error(`     <g id="${s.id}"> — ${s.pathCount} bare <path> elements, no <text> nearby`);
    }
    console.error('\n  This usually means real text got exported as vector outlines (Illustrator');
    console.error('  "Create Outlines" or a missing font at export time) instead of staying editable.');
    console.error('  Fix the source/SVG so it\'s real <text>, or if this really is decorative art,');
    console.error('  re-run with --ack-static-art to proceed.');
    fail('Stopped at the outlined-text check.');
  }
  console.log(suspects.length ? '  found, but acknowledged via --ack-static-art' : '  none found.');
}

// ── Stage 4: match-template (only if a reference exists in the folder) ────────

step('Looking for a reference template in the folder...');
{
  const currentContent = await readFile(absPath, 'utf-8');
  const textCount = (currentContent.match(/<text\b/g) ?? []).length;
  const namedFieldCount = (currentContent.match(/<g\b[^>]*\bid="[A-Za-z][^"]*"/g) ?? []).length;
  const alreadyFullyTagged = textCount > 0 && textCount === namedFieldCount;

  const { readdir } = await import('fs/promises');
  const siblings = (await readdir(folder)).filter(f => /\.svg$/i.test(f) && path.join(folder, f) !== absPath);

  let hasProcessedSibling = false;
  for (const f of siblings) {
    const c = await readFile(path.join(folder, f), 'utf-8');
    const fieldCount = (c.match(/<g\b[^>]*\bid="[A-Za-z][^"]*"/g) ?? []).length;
    if (fieldCount >= 2) { hasProcessedSibling = true; break; }
  }

  if (alreadyFullyTagged) {
    console.log(`  every <text> in this file is already wrapped with a real <g id> (${namedFieldCount}/${textCount}) — skipping auto-match.`);
  } else if (!hasProcessedSibling) {
    console.log('  none found — this is the first template in this folder.');
    console.log('  Assign field IDs manually per the category table in CLAUDE.md, then re-run');
    console.log('  this script (it will skip this stage once a processed sibling exists).');
  } else {
    let out;
    try {
      out = execSync(`node scripts/match-template.mjs "${relPath}"`, { cwd: ROOT, stdio: 'pipe' }).toString();
    } catch (e) {
      fail(`match-template.mjs failed:\n${e.stdout?.toString() ?? e.message}`);
    }
    console.log(out.trim().split('\n').map(l => '  ' + l).join('\n'));

    // Don't rely on match-template's own warning (it only fires when the
    // diff is > 2) — parse the counts it printed and hard-stop on ANY
    // mismatch. A diff of exactly 1-2 is exactly how the TKS+CS scrambled-ID
    // bug slipped through before: it was below that threshold.
    const countsMatch = out.match(/ref fields:\s*(\d+)\s+new fields:\s*(\d+)/);
    const mismatch = countsMatch && countsMatch[1] !== countsMatch[2];
    // Also catch duplicate field-id assignment within the same file — another
    // way a count mismatch manifests as wrong (not just missing) ids.
    const assignedIds = [...out.matchAll(/wrap\s+"([^"]+)"/g)].map(m => m[1]);
    const dupes = assignedIds.filter((id, i) => assignedIds.indexOf(id) !== i);

    if ((mismatch || dupes.length) && !ackFieldMismatch) {
      if (mismatch) console.error(`\n  ✗ Field count mismatch: ref=${countsMatch[1]}, new=${countsMatch[2]}`);
      if (dupes.length) console.error(`  ✗ Same field id assigned more than once: ${[...new Set(dupes)].join(', ')}`);

      // Print the reference template's own id → content map so the mismatch
      // can be fixed by hand without going and reading the reference file
      // separately — that round-trip was the actual recurring cost here.
      const refLine = out.match(/reference:\s*(.+)/);
      if (refLine) {
        const refPath = path.join(ROOT, refLine[1].trim());
        try {
          const refContent = await readFile(refPath, 'utf-8');
          const refFields = [];
          const reGTag = /<g\b[^>]*\bid="([A-Za-z][^"]*)"[^>]*>/g;
          let rm;
          while ((rm = reGTag.exec(refContent)) !== null) {
            const after = refContent.slice(rm.index + rm[0].length);
            const tspan = after.match(/<tspan[^>]*>([^<]*)</);
            refFields.push(`${rm[1]} -> ${JSON.stringify(tspan?.[1]?.trim() ?? '')}`);
          }
          console.error(`\n  Reference template's own fields (${path.relative(ROOT, refPath)}):`);
          console.error(refFields.map(l => '    ' + l).join('\n'));
        } catch { /* best-effort — don't block the failure message on this */ }
      }

      fail('match-template\'s guesses are unreliable here (this is exactly how the TKS+CS\n' +
           '  scrambled-ID bug happened — it slipped through match-template\'s own >2 threshold).\n' +
           '  Compare the reference fields above against your file\'s current <g id> tags and\n' +
           '  fix the IDs by hand, or re-run with --ack-field-mismatch if you\'ve confirmed the\n' +
           '  assignment is correct.');
    }
  }
}

// ── Stage 5: wrap any remaining bare text ──────────────────────────────────────

step('Wrapping any remaining bare text...');
try {
  const out = execSync(`node scripts/wrap-static-texts.mjs "${path.relative(ROOT, folder)}"`, { cwd: ROOT, stdio: 'pipe' }).toString();
  const fixedLine = out.split('\n').find(l => l.includes(path.basename(absPath)));
  console.log('  ' + (fixedLine?.trim() ?? 'done.'));
} catch (e) {
  fail(`wrap-static-texts.mjs failed:\n${e.stdout?.toString() ?? e.message}`);
}

// ── Stage 6: validate ──────────────────────────────────────────────────────────

step('Validating all templates...');
{
  let out = '';
  let failed = false;
  try {
    out = execSync('npm run -s validate-templates', { cwd: ROOT, stdio: 'pipe' }).toString();
  } catch (e) {
    failed = true;
    out = e.stdout?.toString() ?? e.message;
  }
  const fileBase = path.basename(absPath);
  const relevant = out.split('\n').filter(l => l.includes(fileBase));
  if (relevant.length) console.log(relevant.map(l => '  ' + l.trim()).join('\n'));
  if (failed && relevant.some(l => l.includes('❌'))) {
    fail('validate-templates found errors in this file — fix them and re-run.');
  }
  console.log(failed ? '  (other unrelated files have pre-existing errors — not blocking this run)' : '  0 errors.');
}

// ── Stage 7: render preview ────────────────────────────────────────────────────

step('Rendering preview...');
{
  const scratchDir = process.env.CLAUDE_SCRATCHPAD ?? path.join(ROOT, '.scratch-previews');
  try {
    const { Resvg } = await import('@resvg/resvg-js');
    await mkdir(scratchDir, { recursive: true });
    const svg = await readFile(absPath, 'utf-8');
    const resvg = new Resvg(svg, { background: 'white' });
    const png = resvg.render().asPng();
    const outPath = path.join(scratchDir, `${path.basename(absPath, '.svg')}-preview.png`);
    await writeFile(outPath, png);
    console.log(`  saved: ${path.relative(ROOT, outPath)}  ← open this and check it looks right`);
  } catch (e) {
    console.log(`  (skipped — ${e.message})`);
  }
}

// ── Stage 8: print next commands (does not run them) ──────────────────────────

const stem = path.basename(absPath, '.svg');
const folderRel = path.relative(path.join(ROOT, 'public', 'templates'), folder);

console.log(`\n✓ Pipeline passed. Review the preview, then run:\n`);
console.log(`   git add -f "public/templates/${folderRel}/${stem}.png"`);
console.log(`   git add "public/templates/${folderRel}/${stem}.svg" "public/templates/${folderRel}/${stem}-thumb.png"`);
console.log(`   git commit -m "Add ${stem} template to ${folderRel}"`);
console.log(`   node scripts/convert-thumbs-to-webp.mjs`);
console.log(`   node scripts/sync-r2.mjs "${folderRel}"`);
