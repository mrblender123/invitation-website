#!/usr/bin/env node
/**
 * Rename a field ID across all SVGs in a folder.
 * Handles both id="old" and id="old*" (preserves the * suffix).
 *
 * Usage:
 *   node scripts/rename-field.mjs "Folder/Sub" old_id new_id [--dry] [--no-commit]
 *
 * Flags:
 *   --dry        Preview changes without writing
 *   --no-commit  Write files but skip the git commit + R2 sync
 *                (useful when running many renames in a batch)
 */

import { readdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';

const args = process.argv.slice(2);
const flags = args.filter(a => a.startsWith('--'));
const positional = args.filter(a => !a.startsWith('--'));

const [folderArg, oldId, newId] = positional;
const dry = flags.includes('--dry');
const noCommit = flags.includes('--no-commit');

if (!folderArg || !oldId || !newId) {
  console.error('Usage: rename-field.mjs "Folder/Sub" old_id new_id [--dry] [--no-commit]');
  process.exit(1);
}

if (oldId === newId) {
  console.log('old_id and new_id are identical — nothing to do.');
  process.exit(0);
}

const TEMPLATES_DIR = path.join(process.cwd(), 'public', 'templates');
const folderAbs = path.join(TEMPLATES_DIR, folderArg);

let files;
try {
  files = await readdir(folderAbs);
} catch {
  console.error(`Folder not found: ${folderAbs}`);
  process.exit(1);
}

const svgFiles = files.filter(f => /\.svg$/i.test(f) && !/-thumb\.svg$/i.test(f));
if (!svgFiles.length) {
  console.log('No SVG files found.');
  process.exit(0);
}

// Escape special regex characters in the field ID (e.g. spaces, dots)
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Match id="old_id" or id="old_id*" — captures the optional star separately
const re = new RegExp(`\\bid="${escRe(oldId)}(\\*?)"`, 'g');

const changedFiles = [];

for (const f of svgFiles) {
  const fp = path.join(folderAbs, f);
  const content = await readFile(fp, 'utf-8');

  const updated = content.replace(re, (_, star) => `id="${newId}${star}"`);

  if (updated === content) continue;

  const hits = [...content.matchAll(re)].length;
  console.log(`${dry ? '[DRY] ' : ''}${f}: "${oldId}" → "${newId}"  (${hits} occurrence${hits > 1 ? 's' : ''})`);

  if (!dry) {
    await writeFile(fp, updated, 'utf-8');
    changedFiles.push(f);
  }
}

if (changedFiles.length === 0) {
  console.log(`No occurrences of "${oldId}" found in ${folderArg}.`);
  process.exit(0);
}

if (dry || noCommit) {
  if (!dry) console.log(`\n${changedFiles.length} file(s) updated. Skipping commit (--no-commit).`);
  process.exit(0);
}

// Commit + sync
console.log(`\n${changedFiles.length} file(s) updated. Committing…`);
const relFolder = `public/templates/${folderArg}`;
for (const f of changedFiles) {
  execSync(`git add "${path.join(relFolder, f)}"`, { stdio: 'pipe' });
}
execSync(
  `git commit -m "Rename field '${oldId}' → '${newId}' in ${folderArg}"`,
  { stdio: 'inherit' }
);
console.log('\nSyncing SVGs to R2…');
execSync(`node scripts/sync-r2.mjs "${folderArg}"`, { stdio: 'inherit' });
