#!/usr/bin/env node
/**
 * One-command template publisher. Handles everything after you drop/replace
 * files in public/templates/<Category>[/<Sub>]/:
 *
 *   node scripts/publish-templates.mjs "It's a girl"
 *   node scripts/publish-templates.mjs "It's a boy/Shulem Zucher"
 *   node scripts/publish-templates.mjs "It's a girl" --dry     (report only)
 *   node scripts/publish-templates.mjs "It's a girl" --side    (multi-column designs)
 *
 * What it does, in order:
 *   1. Normalizes bad filenames (stray spaces before extensions)
 *   2. Backs up raw SVG exports to _originals/ before touching them
 *   3. Detects raw Illustrator exports and runs clean-svg + match-template on them
 *   4. wrap-static-texts on the folder
 *   5. Warns when a template's field set deviates from the folder's common set
 *   6. Validates (incl. strict XML parse) — aborts before publishing on any error
 *   7. Commits SVGs + force-adds new PNGs/thumbs, pushes
 *   8. Converts full PNGs + thumbs to WebP (hash-skips unchanged), uploads
 *   9. Syncs the folder to R2
 */

import { execFileSync, execSync } from 'child_process';
import { readdirSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, renameSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const TEMPLATES = path.join(ROOT, 'public', 'templates');

const args = process.argv.slice(2);
const folderArg = args.find(a => !a.startsWith('--'));
const DRY = args.includes('--dry');
const SIDE = args.includes('--side');

if (!folderArg) {
  console.error('Usage: node scripts/publish-templates.mjs "Category[/Sub]" [--dry] [--side]');
  process.exit(1);
}

const folderAbs = path.join(TEMPLATES, folderArg);
if (!existsSync(folderAbs)) {
  console.error(`✗ Folder not found: ${folderAbs}`);
  process.exit(1);
}

const run = (cmd, opts = {}) => execSync(cmd, { cwd: ROOT, stdio: 'inherit', ...opts });
const runQuiet = (cmd) => execSync(cmd, { cwd: ROOT, encoding: 'utf-8' });
const step = (n, msg) => console.log(`\n\x1b[1m[${n}] ${msg}\x1b[0m`);

// ── 1. filename hygiene ───────────────────────────────────────────────────────
step(1, 'Filename hygiene');
let renamed = 0;
for (const f of readdirSync(folderAbs)) {
  const fixed = f.replace(/\s+(\.[a-z]+)$/i, '$1');
  if (fixed !== f) {
    console.log(`   rename "${f}" → "${fixed}"`);
    if (!DRY) renameSync(path.join(folderAbs, f), path.join(folderAbs, fixed));
    renamed++;
  }
  if (/\.ai$/i.test(f)) console.log(`   ⚠ ${f} — .ai source files don't belong in public/ (move to your design folder)`);
}
if (!renamed) console.log('   ok');

// ── 2+3. detect raw exports, back up, process ────────────────────────────────
step(2, 'Detect raw Illustrator exports');
const svgs = readdirSync(folderAbs).filter(f => /\.svg$/i.test(f) && !/-thumb\.svg$/i.test(f));
const isRaw = (content) =>
  /font-variation-settings/.test(content) ||
  /font-family="&apos;/.test(content) ||
  /@import\s+url/.test(content);

const rawSvgs = svgs.filter(f => isRaw(readFileSync(path.join(folderAbs, f), 'utf-8')));
const thumbSvgs = readdirSync(folderAbs).filter(f => /-thumb\.svg$/i.test(f));
for (const t of thumbSvgs) console.log(`   ⚠ ${t} — thumb SVGs are not used (thumbs are PNG); remove or re-export`);

// quick per-file sanity: duplicate field ids poison everything downstream
const dupFieldIds = (file) => {
  const c = readFileSync(path.join(folderAbs, file), 'utf-8');
  const ids = [...c.matchAll(/<g id="([^"]+)"/g)].map(m => m[1].replace(/\*/g, ''))
    .filter(id => /^[A-Za-z]/.test(id) && !id.startsWith('_') && !/^layer/i.test(id));
  const seen = new Set(); const dups = new Set();
  for (const id of ids) { if (seen.has(id)) dups.add(id); seen.add(id); }
  return [...dups];
};

const failed = [];
if (rawSvgs.length === 0) {
  console.log('   none — all SVGs already processed');
} else {
  // Pick a known-good reference per language: a processed sibling with no
  // duplicate ids and the same E-prefix class (E* = English naming convention,
  // everything else = Hebrew). Never use files processed in this run —
  // one bad match would cascade into every following file.
  const isEnglish = (f) => /^e/i.test(f);
  const dupIdsInContent = (c) => {
    const ids = [...c.matchAll(/<g id="([^"]+)"/g)].map(m => m[1].replace(/\*/g, ''))
      .filter(id => /^[A-Za-z]/.test(id) && !id.startsWith('_') && !/^layer/i.test(id));
    const seen = new Set(); const dups = new Set();
    for (const id of ids) { if (seen.has(id)) dups.add(id); seen.add(id); }
    return [...dups];
  };
  // For a REPLACED template, the best reference is its own previous processed
  // version from git — same design, so content matching nails every field.
  const gitPrevRef = (f) => {
    try {
      const tracked = runQuiet(`git ls-files "public/templates/${folderArg}"`).split('\n')
        .find(p => path.basename(p).toLowerCase() === f.toLowerCase());
      if (!tracked) return null;
      // walk history: the newest committed version that is processed and clean
      const commits = runQuiet(`git rev-list -10 HEAD -- "${tracked}"`).trim().split('\n').filter(Boolean);
      for (const c of commits) {
        let prev;
        try { prev = runQuiet(`git show ${c}:"${tracked}"`); } catch { continue; }
        if (isRaw(prev) || dupIdsInContent(prev).length > 0) continue;
        if (!/<g id="/.test(prev)) continue;
        const tmp = path.join(ROOT, '_originals', `.prev-ref-${f}`);
        mkdirSync(path.dirname(tmp), { recursive: true });
        writeFileSync(tmp, prev);
        return tmp;
      }
      return null;
    } catch { return null; }
  };
  const pickRef = (forFile) => svgs.find(f =>
    !rawSvgs.includes(f) &&
    isEnglish(f) === isEnglish(forFile) &&
    !isRaw(readFileSync(path.join(folderAbs, f), 'utf-8')) &&
    dupFieldIds(f).length === 0);

  for (const f of rawSvgs) {
    console.log(`   raw export: ${f}`);
    if (DRY) continue;
    // backup original before clean-svg rewrites in place
    const bakDir = path.join(ROOT, '_originals', folderArg);
    mkdirSync(bakDir, { recursive: true });
    const bak = path.join(bakDir, f.replace(/\.svg$/i, '') + '.' + Date.now() + '.orig.svg');
    copyFileSync(path.join(folderAbs, f), bak);
    console.log(`   backed up → ${path.relative(ROOT, bak)}`);

    const rel = path.join('public/templates', folderArg, f);
    // multi-column guard: duplicate translate coords → needs --side
    const content = readFileSync(path.join(folderAbs, f), 'utf-8');
    const translates = [...content.matchAll(/translate\(([^)]*)\)/g)].map(m => m[1]);
    const hasDupes = new Set(translates).size !== translates.length;
    const sideFlag = (SIDE || hasDupes) ? ' --side' : '';
    if (hasDupes && !SIDE) console.log('   ⚠ duplicate translate positions detected → using --side automatically');

    // replaced template? its own previous git version is the ideal reference
    const prevRef = gitPrevRef(f);
    const goodRef = prevRef ? null : pickRef(f);
    if (prevRef) console.log(`   reference: previous git version of ${f}`);
    else if (goodRef) console.log(`   reference: ${goodRef}`);
    const refFlag = prevRef ? ` --ref "${prevRef}"` : goodRef ? ` --ref "public/templates/${folderArg}/${goodRef}"` : '';
    run(`node scripts/clean-svg.mjs "${rel}"${sideFlag}`);
    run(`node scripts/match-template.mjs "${rel}"${refFlag}`);

    // verify immediately — restore the original if the match produced garbage
    const dups = dupFieldIds(f);
    let xmlOk = true;
    try { execFileSync('xmllint', ['--noout', path.join(folderAbs, f)], { stdio: 'ignore' }); } catch { xmlOk = false; }
    if (dups.length > 0 || !xmlOk) {
      copyFileSync(bak, path.join(folderAbs, f));
      failed.push(f);
      console.log(`   ✗ ${f}: ${!xmlOk ? 'malformed XML' : 'duplicate ids: ' + dups.join(', ')} — restored original, will need manual review`);
    } else {
      console.log(`   ✓ ${f} processed cleanly`);
    }
  }
}

// ── 4. wrap static texts ─────────────────────────────────────────────────────
step(3, 'Wrap remaining bare text');
if (!DRY) run(`node scripts/wrap-static-texts.mjs "public/templates/${folderArg}"`);
else console.log('   (skipped — dry run)');

// ── 5. field-set deviation check ─────────────────────────────────────────────
step(4, 'Field-set consistency check');
const fieldSet = (file) => {
  const c = readFileSync(path.join(folderAbs, file), 'utf-8');
  return [...c.matchAll(/<g id="([^"]+)"/g)]
    .map(m => m[1].replace(/\*/g, ''))
    .filter(id => /^[A-Za-z]/.test(id) && !/^layer/i.test(id) && !/^line_/.test(id) && !id.startsWith('_'))
    .sort();
};
const sets = svgs.map(f => ({ f, set: fieldSet(f).join(',') }));
const counts = {};
for (const s of sets) counts[s.set] = (counts[s.set] ?? 0) + 1;
const commonSet = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
let deviations = 0;
for (const s of sets) {
  if (s.set !== commonSet) {
    deviations++;
    const common = new Set(commonSet.split(','));
    const mine = new Set(s.set.split(','));
    const missing = [...common].filter(x => !mine.has(x));
    const extra = [...mine].filter(x => !common.has(x));
    console.log(`   ⚠ ${s.f} deviates from folder pattern${missing.length ? ` — missing: ${missing.join(', ')}` : ''}${extra.length ? ` — extra: ${extra.join(', ')}` : ''}`);
  }
}
if (!deviations) console.log('   all templates match the folder field pattern');
else console.log('   review the ⚠ templates above — deviations are sometimes legitimate, often a matcher mistake');

// ── 6. validate (hard gate) ──────────────────────────────────────────────────
step(5, 'Validate all templates (strict)');
let out;
try {
  out = runQuiet('npm run validate-templates 2>&1');
} catch (e) {
  out = (e.stdout ?? '') + (e.stderr ?? '');
}
const summary = out.trim().split('\n').at(-1);
console.log('   ' + summary);
if (!/ 0 errors/.test(summary)) {
  // Only errors inside the target folder block THIS publish; errors elsewhere
  // are somebody else's problem — report them but don't hold this folder hostage.
  const lines = out.split('\n');
  const errBlocks = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('❌')) errBlocks.push({ file: lines[i], detail: lines.slice(i, i + 4).filter(l => l.includes('ERROR')).join('\n') || lines[i + 1] });
  }
  const inFolder = errBlocks.filter(b => b.file.includes(`${folderArg}/`)); // validator prints paths relative to public/templates
  const elsewhere = errBlocks.filter(b => !inFolder.includes(b));
  for (const b of elsewhere) console.log(`   ⚠ unrelated error outside this folder: ${b.file.trim()}`);
  if (inFolder.length > 0) {
    for (const b of inFolder) console.log(b.file + '\n' + b.detail);
    console.error('\n✗ Validation errors in this folder — fix before publishing. Nothing was committed or uploaded.');
    process.exit(1);
  }
}

if (DRY) { console.log('\n— dry run complete, nothing published —'); process.exit(0); }

// ── 7. git ───────────────────────────────────────────────────────────────────
step(6, 'Commit & push');
const relFolder = `public/templates/${folderArg}`;
// Add SVGs individually — glob "path with apostrophe"/*.svg silently fails in
// both bash and zsh because the shell quoting boundary interferes with glob expansion.
for (const f of svgs) run(`git add "${relFolder}/${f}"`);
// force-add PNGs for stems that have an SVG (gitignore blocks them otherwise)
for (const f of readdirSync(folderAbs)) {
  if (!/\.png$/i.test(f)) continue;
  const stem = f.replace(/(-thumb)?\.png$/i, '');
  if (svgs.some(s => s.replace(/\.svg$/i, '').toLowerCase() === stem.toLowerCase())) {
    run(`git add -f "${relFolder}/${f}"`);
  }
}
let staged = true;
try { runQuiet('git diff --cached --quiet'); staged = false; } catch { /* non-zero exit = staged changes exist */ }
if (staged) {
  run(`git commit -m "Update templates in ${folderArg}" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"`);
  run('git push');
} else {
  console.log('   nothing to commit');
}

// ── 8+9. assets → R2 ─────────────────────────────────────────────────────────
step(7, 'Convert backgrounds to WebP (changed only)');
run(`node scripts/convert-full-to-webp.mjs "${folderArg}"`);
step(8, 'Convert thumbnails to WebP (changed only)');
run('node scripts/convert-thumbs-to-webp.mjs');
step(9, 'Sync folder to R2');
run(`node scripts/sync-r2.mjs "${folderArg}"`);

console.log('\n✅ Published. If templates should appear immediately, press "↺ Refresh cache" in the admin editor.');
