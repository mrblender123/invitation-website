/**
 * Wrap top-level <text> elements (direct children of <svg>, not inside any <g>)
 * in <g id="textN"> groups so they become optional editable fields.
 *
 * Usage:
 *   node scripts/wrap-static-texts.mjs "public/templates/It's a girl"
 *   node scripts/wrap-static-texts.mjs "public/templates/It's a boy/Vachnacht-Bris"
 */

import { readFile, writeFile, readdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const folderArg = process.argv[2];
if (!folderArg) {
  console.error('Usage: node scripts/wrap-static-texts.mjs "<folder path>"');
  process.exit(1);
}

const TARGET_DIR = path.join(ROOT, folderArg);

/**
 * Parse SVG and find all <text> elements that are NOT inside any <g> element
 * (i.e. direct children of the root <svg> element).
 * Returns array of { start, end, content } for each unwrapped text block.
 */
function findUnwrappedTexts(svg) {
  const results = [];
  let depth = 0; // depth of <g> nesting
  let i = 0;

  while (i < svg.length) {
    // Look for next interesting tag
    const lt = svg.indexOf('<', i);
    if (lt === -1) break;

    // Check what tag this is
    const rest = svg.slice(lt);

    if (rest.startsWith('</g>')) {
      if (depth > 0) depth--;
      i = lt + 4;
      continue;
    }

    // Opening <g ...>
    if (/^<g[\s>]/.test(rest)) {
      // Check it's not self-closing
      const tagEnd = svg.indexOf('>', lt);
      if (tagEnd === -1) break;
      const tag = svg.slice(lt, tagEnd + 1);
      if (!tag.endsWith('/>')) {
        depth++;
      }
      i = tagEnd + 1;
      continue;
    }

    // <text ...>...</text> block at depth 0 (direct child of <svg>)
    if (rest.startsWith('<text ') && depth === 0) {
      const closeTag = '</text>';
      const closeIdx = svg.indexOf(closeTag, lt);
      if (closeIdx === -1) break;
      const end = closeIdx + closeTag.length;
      results.push({ start: lt, end, content: svg.slice(lt, end) });
      i = end;
      continue;
    }

    i = lt + 1;
  }

  return results;
}

async function fixSvg(filePath) {
  let content = await readFile(filePath, 'utf-8');

  const unwrapped = findUnwrappedTexts(content);
  if (unwrapped.length === 0) {
    console.log(`  skip (no unwrapped texts): ${path.basename(filePath)}`);
    return;
  }

  // Find max existing textN id to avoid collisions
  const existingNums = [...content.matchAll(/<g id="text(\d+)[^"]*"/g)].map(m => parseInt(m[1], 10));
  let nextId = existingNums.length > 0 ? Math.max(...existingNums) + 1 : 2;

  // Apply replacements in reverse order to preserve indices
  const sorted = [...unwrapped].sort((a, b) => b.start - a.start);
  let result = content;
  for (const { start, end, content: textBlock } of sorted) {
    const id = `text${nextId++}`;
    // Detect the indentation of the <text> tag
    const lineStart = result.lastIndexOf('\n', start) + 1;
    const indent = result.slice(lineStart, start).match(/^\s*/)?.[0] ?? '  ';
    const wrapped = `${indent}<g id="${id}">\n  ${indent}${textBlock.trimStart()}\n${indent}</g>`;
    result = result.slice(0, start) + wrapped + result.slice(end);
  }

  await writeFile(filePath, result, 'utf-8');
  console.log(`  fixed (${unwrapped.length} texts): ${path.basename(filePath)}`);
}

async function main() {
  let files;
  try {
    files = await readdir(TARGET_DIR);
  } catch {
    console.error(`Cannot read directory: ${TARGET_DIR}`);
    process.exit(1);
  }

  const svgFiles = files.filter(f => /\.svg$/i.test(f)).sort();
  console.log(`Found ${svgFiles.length} SVG file(s) in ${folderArg}\n`);

  for (const file of svgFiles) {
    await fixSvg(path.join(TARGET_DIR, file));
  }

  console.log('\nDone.');
}

main().catch(err => { console.error(err); process.exit(1); });
