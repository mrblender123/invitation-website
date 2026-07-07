#!/usr/bin/env node
/**
 * Within a folder, find line_N fields that carry identical placeholder text
 * but different numbers across templates, then rename them to a single
 * canonical ID so the Category Field Manager shows one row per concept.
 *
 * Canonical ID = the line_N used by the most templates for that text
 * (ties broken by lowest number).
 *
 * Usage:
 *   node scripts/normalize-line-ids.mjs "Folder/Sub" [--dry] [--no-commit]
 *   node scripts/normalize-line-ids.mjs --all           [--dry] [--no-commit]
 */

import { readdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';

const args = process.argv.slice(2);
const flags  = args.filter(a => a.startsWith('--'));
const posArgs = args.filter(a => !a.startsWith('--'));

const dry      = flags.includes('--dry');
const noCommit = flags.includes('--no-commit');
const allMode  = flags.includes('--all');

const TEMPLATES_DIR = path.join(process.cwd(), 'public', 'templates');

// ── helpers ──────────────────────────────────────────────────────────────────

function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/** Extract { id, placeholder } for every line_N <g> in an SVG string */
function extractLineFields(content) {
  const results = [];
  const gre = /<g\b[^>]*\bid="([^"]+)"/g;
  let m;
  while ((m = gre.exec(content)) !== null) {
    const raw = m[1];
    const hasStar = raw.includes('*');
    const id = raw.replace(/\*/g, '').trim();
    if (!/^line_\d+$/i.test(id)) continue;
    const after = content.slice(m.index + m[0].length);
    const tm = after.match(/<tspan[^>]*>([^<]+)/);
    const placeholder = tm?.[1]?.trim() ?? '';
    if (!placeholder) continue;
    results.push({ id, hasStar, placeholder });
  }
  return results;
}

/** Within a folder, compute canonical line_N for each placeholder text */
async function buildRenameMap(folderAbs) {
  let files;
  try { files = await readdir(folderAbs); } catch { return null; }

  const svgFiles = files.filter(f => /\.svg$/i.test(f) && !/-thumb\.svg$/i.test(f));
  if (!svgFiles.length) return null;

  // text → { id → count }
  const textCounts = new Map();

  for (const f of svgFiles) {
    const content = await readFile(path.join(folderAbs, f), 'utf-8').catch(() => null);
    if (!content) continue;
    for (const { id, placeholder } of extractLineFields(content)) {
      if (!textCounts.has(placeholder)) textCounts.set(placeholder, new Map());
      const m = textCounts.get(placeholder);
      m.set(id, (m.get(id) ?? 0) + 1);
    }
  }

  // For each placeholder with >1 line_N, pick canonical
  // Canonical = most-used; ties broken by lowest numeric suffix
  const lineNum = (id) => parseInt(id.replace('line_', ''), 10);
  const canonical = new Map(); // placeholder → canonical_id

  for (const [text, idCounts] of textCounts) {
    if (idCounts.size <= 1) continue;
    const sorted = [...idCounts.entries()].sort(([idA, cA], [idB, cB]) => {
      if (cB !== cA) return cB - cA; // most common first
      return lineNum(idA) - lineNum(idB); // lowest number first
    });
    canonical.set(text, sorted[0][0]);
  }

  return { svgFiles, canonical };
}

/** Apply the canonical map to a single folder */
async function processFolder(folderArg) {
  const folderAbs = path.join(TEMPLATES_DIR, folderArg);
  const result = await buildRenameMap(folderAbs);
  if (!result) return [];

  const { svgFiles, canonical } = result;
  if (!canonical.size) return [];

  const changedFiles = [];
  const skipped = [];

  for (const f of svgFiles) {
    const fp = path.join(folderAbs, f);
    const content = await readFile(fp, 'utf-8').catch(() => null);
    if (!content) continue;

    const fields = extractLineFields(content);
    // IDs already present in this template (to detect conflicts)
    const usedIds = new Map(fields.map(fld => [fld.id, fld.placeholder]));

    let updated = content;
    let fileChanged = false;

    for (const { id, placeholder } of fields) {
      if (!canonical.has(placeholder)) continue;
      const target = canonical.get(placeholder);
      if (id === target) continue;

      // Conflict check: target already exists in this template for different text
      if (usedIds.has(target) && usedIds.get(target) !== placeholder) {
        skipped.push({ file: f, from: id, to: target, reason: `"${target}" already used for "${usedIds.get(target)}"` });
        continue;
      }

      // Apply rename (preserve * if present)
      const re = new RegExp(`\\bid="${escRe(id)}(\\*?)"`, 'g');
      const next = updated.replace(re, (_, star) => `id="${target}${star}"`);
      if (next !== updated) {
        console.log(`${dry ? '[DRY] ' : ''}${f}: "${id}" → "${target}"  (placeholder: "${placeholder.slice(0, 40)}")`);
        updated = next;
        usedIds.set(target, placeholder);
        usedIds.delete(id);
        fileChanged = true;
      }
    }

    if (fileChanged && !dry) {
      await writeFile(fp, updated, 'utf-8');
      changedFiles.push(f);
    }
  }

  if (skipped.length) {
    console.log(`\nSkipped (conflicts):`);
    for (const s of skipped) console.log(`  ${s.file}: ${s.from} → ${s.to}  — ${s.reason}`);
  }

  return changedFiles;
}

// ── main ─────────────────────────────────────────────────────────────────────

let folders = [];

if (allMode) {
  const cats = await readdir(TEMPLATES_DIR);
  for (const cat of cats) {
    const catAbs = path.join(TEMPLATES_DIR, cat);
    let subs;
    try { subs = await readdir(catAbs); } catch { continue; }
    for (const sub of subs) {
      const subAbs = path.join(catAbs, sub);
      try {
        const stat = await readdir(subAbs);
        if (stat.some(f => f.endsWith('.svg'))) folders.push(`${cat}/${sub}`);
      } catch {}
    }
  }
} else {
  if (!posArgs[0]) {
    console.error('Usage: normalize-line-ids.mjs "Folder/Sub" [--dry] [--no-commit]');
    console.error('       normalize-line-ids.mjs --all         [--dry] [--no-commit]');
    process.exit(1);
  }
  folders = [posArgs[0]];
}

const allChanged = [];

for (const folder of folders) {
  console.log(`\n── ${folder}`);
  const changed = await processFolder(folder);
  for (const f of changed) allChanged.push(path.join('public/templates', folder, f));
}

if (allChanged.length === 0) {
  console.log('\nNothing to change.');
  process.exit(0);
}

if (dry || noCommit) {
  if (!dry) console.log(`\n${allChanged.length} file(s) updated. Skipping commit (--no-commit).`);
  process.exit(0);
}

console.log(`\n${allChanged.length} file(s) updated. Committing…`);
for (const f of allChanged) {
  execSync(`git add "${f}"`, { stdio: 'pipe' });
}
const folderList = [...new Set(folders)].join(', ');
execSync(`git commit -m "Normalize line_N IDs by placeholder text in: ${folderList}"`, { stdio: 'inherit' });

console.log('\nSyncing to R2…');
for (const folder of [...new Set(folders)]) {
  execSync(`node scripts/sync-r2.mjs "${folder}"`, { stdio: 'inherit' });
}
