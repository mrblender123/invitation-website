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
import { createInterface } from 'readline/promises';

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

// ── Interactive field-assignment wizard ─────────────────────────────────────
// Used when match-template's Y-position guessing can't be trusted (field
// count differs from the reference, or it produced duplicate ids). Instead of
// requiring someone to hand-edit SVG XML, this walks each text line and lets
// you pick its field id from a numbered list — no XML knowledge needed.

async function runAssignWizard(targetPath, refFields, rl) {
  let content = await readFile(targetPath, 'utf-8');

  // Each <text> is preceded by zero or more stacked <g id="..."> openers
  // (an Illustrator auto-id wrapping a real id, or just one, or none yet).
  const textRe = /((?:<g\b[^>]*\bid="[^"]+">\s*)*)<text\b([^>]*)>([\s\S]*?)<\/text>/g;
  const items = [];
  let m;
  while ((m = textRe.exec(content)) !== null) {
    const openers = [...m[1].matchAll(/<g\b[^>]*\bid="([^"]+)">/g)].map(x => x[1]);
    const yMatch = m[2].match(/translate\(\s*[-\d.]+[\s,]+(-?[\d.]+)\s*\)/);
    const y = yMatch ? parseFloat(yMatch[1]) : Number.POSITIVE_INFINITY;
    const tspan = m[3].match(/<tspan[^>]*>([^<]*)</);
    items.push({ full: m[0], start: m.index, end: m.index + m[0].length, openers, y, text: (tspan?.[1] ?? '').trim() });
  }
  items.sort((a, b) => a.y - b.y);

  const existingLineNums = [...content.matchAll(/\bid="line_(\d+)\*?"/g)].map(x => parseInt(x[1], 10));
  let nextLineNum = existingLineNums.length ? Math.max(...existingLineNums) + 1 : 1;

  console.log('\n  ── Field assignment wizard ──────────────────────────────────');
  console.log('  Reference fields:');
  refFields.forEach((f, i) => console.log(`    ${i + 1}) ${f.id}  (${f.text})`));
  console.log('\n  For each line: type a number above, "o" for a new optional line,');
  console.log('  a custom id (add * to make it required), or press Enter to keep it as-is.\n');

  const choices = [];
  for (const item of items) {
    const currentId = item.openers[item.openers.length - 1];
    const currentLabel = currentId && /^[A-Za-z]/.test(currentId) ? currentId : '(unassigned)';
    console.log(`  "${item.text}"  — currently: ${currentLabel}`);
    const answer = (await rl.question('  > ')).trim();
    let chosen = null;
    if (answer === '') {
      chosen = /^[A-Za-z]/.test(currentId ?? '') ? currentId : null;
    } else if (answer.toLowerCase() === 'o') {
      chosen = `line_${nextLineNum++}`;
    } else if (/^\d+$/.test(answer) && refFields[parseInt(answer, 10) - 1]) {
      chosen = refFields[parseInt(answer, 10) - 1].id;
    } else {
      chosen = answer;
    }
    console.log(`    → ${chosen ?? '(left unchanged)'}\n`);
    choices.push({ item, chosen });
  }

  // Apply back-to-front so earlier offsets stay valid as content shifts.
  for (const { item, chosen } of choices.slice().reverse()) {
    if (!chosen) continue;
    const lastOpener = item.openers[item.openers.length - 1];
    const lastOpenerIsNamed = lastOpener && /^[A-Za-z]/.test(lastOpener);
    let newFull;
    if (lastOpenerIsNamed) {
      const needle = `id="${lastOpener}"`;
      const idx = item.full.lastIndexOf(needle);
      newFull = item.full.slice(0, idx) + `id="${chosen}"` + item.full.slice(idx + needle.length);
    } else {
      const textStart = item.full.indexOf('<text');
      newFull = item.full.slice(0, textStart) + `<g id="${chosen}">\n      ` + item.full.slice(textStart) + '\n    </g>';
    }
    content = content.slice(0, item.start) + newFull + content.slice(item.end);
  }

  await writeFile(targetPath, content);
}

async function getReferenceFields(refPath) {
  const refContent = await readFile(refPath, 'utf-8');
  const fields = [];
  const reGTag = /<g\b[^>]*\bid="([A-Za-z][^"]*)"[^>]*>/g;
  let rm;
  while ((rm = reGTag.exec(refContent)) !== null) {
    const after = refContent.slice(rm.index + rm[0].length);
    const tspan = after.match(/<tspan[^>]*>([^<]*)</);
    fields.push({ id: rm[1], text: (tspan?.[1] ?? '').trim() });
  }
  return fields;
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
  for (const m of gBlocks) {
    const [full, attrs, inner] = m;
    const idMatch = attrs.match(/\bid="([^"]+)"/);
    const id = idMatch?.[1] ?? '';
    const hasHumanId = /^[A-Za-z]/.test(id) && !id.startsWith('_');
    if (hasHumanId) continue; // explicitly named — trust the designer/earlier pass
    if (/<text\b/.test(inner)) continue; // has real text — not a pure-path block
    const pathCount = (inner.match(/<path\b/g) ?? []).length;
    if (pathCount >= 8) suspects.push({ id: id || '(none)', pathCount, full, start: m.index, end: m.index + full.length, inner });
  }

  if (suspects.length && !ackStaticArt) {
    console.error('\n  ✗ FOUND possible outlined text:');
    for (const s of suspects) {
      console.error(`     <g id="${s.id}"> — ${s.pathCount} bare <path> elements, no <text> nearby`);
    }
    console.error('\n  This usually means real text got exported as vector outlines (Illustrator');
    console.error('  "Create Outlines" or a missing font at export time) instead of staying editable.');

    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = (await rl.question(
      '\n  Rebuild these as real text now? You\'ll need to type what each line says\n' +
      '  (read it off your design) — no XML editing needed. [y/n] '
    )).trim().toLowerCase();

    if (answer === 'y' || answer === 'yes') {
      const viewBoxMatch = content.match(/viewBox="[\d.\s-]+?\s+([\d.]+)\s+[\d.]+"/);
      const centerX = viewBoxMatch ? parseFloat(viewBoxMatch[1]) / 2 : 180;

      // Real <text> elements already in the file — used both to find the
      // nearest neighbor's styling and to anchor the new line's Y position.
      const realTexts = [...content.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)].map(t => {
        const yMatch = t[1].match(/translate\(\s*[-\d.]+[\s,]+(-?[\d.]+)\s*\)/);
        return { y: yMatch ? parseFloat(yMatch[1]) : null, attrs: t[1] };
      }).filter(t => t.y !== null);

      let updated = content;
      for (const s of suspects.slice().sort((a, b) => b.start - a.start)) {
        // Approximate the block's own Y position from its path coordinates —
        // these blocks keep their original (uncentered) artboard coordinates,
        // which happen to live in the same coordinate space as everything else.
        const coords = [...s.inner.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map(c => parseFloat(c[2]));
        const approxY = coords.length ? coords.sort((a, b) => a - b)[Math.floor(coords.length / 2)] : 0;

        const nearest = realTexts.slice().sort((a, b) => Math.abs(a.y - approxY) - Math.abs(b.y - approxY))[0];
        const fill = nearest?.attrs.match(/\bfill="([^"]+)"/)?.[1] ?? '#000';
        const fontFamily = nearest?.attrs.match(/\bfont-family="([^"]+)"/)?.[1] ?? 'Heebo';
        const fontWeightAttr = nearest?.attrs.match(/\bfont-weight="[^"]+"/)?.[0] ?? '';
        const fontSize = nearest?.attrs.match(/\bfont-size="([^"]+)"/)?.[1] ?? '12';

        console.log(`\n  Line ~y=${Math.round(approxY)} (style matched to nearest text: ${nearest ? JSON.stringify(nearest.attrs.match(/<tspan[^>]*>([^<]*)</)?.[1] ?? '') : 'none found'})`);
        const text = (await rl.question('  What does this line say? > ')).trim();

        const newText = `<text transform="translate(${centerX} ${approxY})" fill="${fill}" font-family="${fontFamily}" ${fontWeightAttr} font-size="${fontSize}" text-anchor="middle"><tspan x="0" y="0">${text}</tspan></text>`;
        updated = updated.slice(0, s.start) + newText + updated.slice(s.end);
      }
      rl.close();

      await writeFile(absPath, updated);
      console.log('\n  ✓ rebuilt as real text — continuing the pipeline.');
    } else {
      rl.close();
      console.error('\n  Fix the source/SVG so it\'s real <text>, or if this really is decorative art,');
      console.error('  re-run with --ack-static-art to proceed.');
      fail('Stopped at the outlined-text check.');
    }
  } else {
    console.log(suspects.length ? '  found, but acknowledged via --ack-static-art' : '  none found.');
  }
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
      console.error('  match-template\'s guesses are unreliable here (this is exactly how the TKS+CS');
      console.error('  scrambled-ID bug happened — it slipped through match-template\'s own >2 threshold).');

      const refLine = out.match(/reference:\s*(.+)/);
      const refPath = refLine ? path.join(ROOT, refLine[1].trim()) : null;
      let refFields = [];
      if (refPath) {
        try { refFields = await getReferenceFields(refPath); } catch { /* best-effort */ }
      }

      let wizardSucceeded = false;
      if (refFields.length) {
        const rl = createInterface({ input: process.stdin, output: process.stdout });
        const answer = (await rl.question(
          '\n  Run the interactive field-assignment wizard now to fix this yourself? [y/n] '
        )).trim().toLowerCase();

        if (answer === 'y' || answer === 'yes') {
          await runAssignWizard(absPath, refFields, rl);
          rl.close();

          // Re-check: did the wizard leave a clean, unique set of ids?
          const afterContent = await readFile(absPath, 'utf-8');
          const afterTextCount = (afterContent.match(/<text\b/g) ?? []).length;
          const afterIds = [...afterContent.matchAll(/<g\b[^>]*\bid="([A-Za-z][^"]*)"/g)].map(m => m[1]);
          const afterDupes = afterIds.filter((id, i) => afterIds.indexOf(id) !== i);

          if (afterIds.length !== afterTextCount || afterDupes.length) {
            fail('Wizard finished but the result still doesn\'t line up ' +
                 `(${afterIds.length} ids for ${afterTextCount} text elements` +
                 (afterDupes.length ? `, duplicates: ${[...new Set(afterDupes)].join(', ')}` : '') +
                 '). Re-run this script to try again.');
          }

          console.log('  ✓ wizard finished — continuing the pipeline.');
          wizardSucceeded = true;
        } else {
          rl.close();
        }
      }

      if (!wizardSucceeded) {
        console.error(`\n  Reference template's own fields (${refPath ? path.relative(ROOT, refPath) : 'unknown'}):`);
        console.error(refFields.map(f => `    ${f.id} -> ${JSON.stringify(f.text)}`).join('\n'));

        fail('Compare the reference fields above against your file\'s current <g id> tags and fix\n' +
             '  the IDs by hand, or re-run with --ack-field-mismatch if you\'ve confirmed the\n' +
             '  assignment is correct.');
      }
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
