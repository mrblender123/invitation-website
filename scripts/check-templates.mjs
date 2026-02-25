#!/usr/bin/env node
/**
 * npm run check-templates
 *
 * Scans every SVG in public/templates/ and reports:
 *   ✓  viewBox present + dimensions
 *   ✓  matching image file found
 *   ✓  aspect ratio matches between PNG/JPG and SVG
 *   ✓  editable <g id> groups discovered
 *   ⚠  bare <text> elements outside any <g id> group
 */

import { readdir, readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const templatesDir = path.join(__dirname, '..', 'public', 'templates');

// ── ANSI colours ────────────────────────────────────────────
const R = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';

const ok   = msg => `  ${GREEN}✓${R} ${msg}`;
const fail = msg => `  ${RED}✗${R} ${msg}`;
const warn = msg => `  ${YELLOW}⚠${R} ${msg}`;

// ── Image dimension readers ──────────────────────────────────
function parsePngSize(buf) {
  if (buf.length < 24) return null;
  if (buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47) return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

function parseJpegSize(buf) {
  let i = 2;
  while (i < buf.length - 8) {
    if (buf[i] !== 0xff) break;
    const marker = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xc3) {
      return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  return null;
}

// ── SVG helpers ──────────────────────────────────────────────
function parseViewBox(svg) {
  const m = svg.match(/viewBox=["']([^"']+)["']/);
  if (!m) return null;
  const p = m[1].trim().split(/[\s,]+/);
  return p.length >= 4 ? { w: parseFloat(p[2]), h: parseFloat(p[3]) } : null;
}

function findGIds(svg) {
  const ids = [];
  const re = /<g\b([^>]*)>/g;
  let m;
  while ((m = re.exec(svg)) !== null) {
    const idM = m[1].match(/\bid="([^"]+)"/);
    if (idM) ids.push(idM[1]);
  }
  return ids;
}

/** Returns true if any <text> elements exist outside all <g id="..."> blocks. */
function hasBareText(svg) {
  // Strip every <g id="...">…</g> block, then check what's left for <text>.
  // Uses a repeated pass to handle adjacent (not nested) groups.
  let stripped = svg;
  let prev;
  do {
    prev = stripped;
    stripped = stripped.replace(/<g\b[^>]*\bid="[^"]*"[^>]*>[\s\S]*?<\/g>/g, '');
  } while (stripped !== prev);
  return /<text\b/.test(stripped);
}

// ── Main ─────────────────────────────────────────────────────
async function main() {
  const entries = await readdir(templatesDir, { withFileTypes: true });
  const folders = entries.filter(e => e.isDirectory()).map(e => e.name).sort();

  let totalIssues = 0;

  for (const folder of folders) {
    const folderPath = path.join(templatesDir, folder);
    const files = await readdir(folderPath);
    const svgFiles = files.filter(f => /\.svg$/i.test(f)).sort();
    const imgFiles = files.filter(f => /\.(png|jpg|jpeg)$/i.test(f));

    console.log(`\n${BOLD}${CYAN}📁 ${folder}/${R}`);

    for (const svgFile of svgFiles) {
      const stem = svgFile.replace(/\.svg$/i, '');
      const imgFile = imgFiles.find(
        f => f.replace(/\.(png|jpg|jpeg)$/i, '').toLowerCase() === stem.toLowerCase()
      );

      const svgPath = path.join(folderPath, svgFile);
      const svg = await readFile(svgPath, 'utf-8');
      const issues = [];

      console.log(`\n  ${BOLD}${stem}.svg${R}`);

      // 1. viewBox
      const vb = parseViewBox(svg);
      if (vb) {
        console.log(ok(`viewBox: ${vb.w} × ${vb.h}`));
      } else {
        console.log(fail('Missing viewBox — add viewBox="0 0 W H" to the <svg> tag'));
        issues.push('missing viewBox');
      }

      // 2. Matching image
      if (!imgFile) {
        console.log(warn(`No matching image (${stem}.png / ${stem}.jpg) — template will be skipped`));
        issues.push('no matching image');
      } else {
        console.log(ok(`Image: ${imgFile}`));

        // 3. Aspect ratio
        if (vb) {
          const imgBuf = await readFile(path.join(folderPath, imgFile));
          const size = /\.png$/i.test(imgFile) ? parsePngSize(imgBuf) : parseJpegSize(imgBuf);
          if (size) {
            const imgRatio = size.w / size.h;
            const svgRatio = vb.w / vb.h;
            const diff = Math.abs(imgRatio - svgRatio);
            if (diff < 0.01) {
              console.log(ok(`Aspect ratio matches  (image ${size.w}×${size.h})`));
            } else {
              console.log(fail(
                `Aspect ratio MISMATCH — image ${size.w}×${size.h} (${imgRatio.toFixed(3)}) ` +
                `vs SVG viewBox ${vb.w}×${vb.h} (${svgRatio.toFixed(3)})`
              ));
              console.log(`     ${DIM}Both must be exported from the same Illustrator artboard${R}`);
              issues.push('aspect ratio mismatch');
            }
          }
        }
      }

      // 4. Editable <g id> groups
      const gIds = findGIds(svg);
      const SKIP = /^(static_text|layer|background)/i;
      const editableIds = gIds.filter(id => !SKIP.test(id));

      if (editableIds.length > 0) {
        console.log(ok(`Editable fields: ${editableIds.map(id => `"${id}"`).join(', ')}`));
      } else {
        console.log(fail('No editable <g id> groups — users will have no fields to fill in'));
        console.log(`     ${DIM}Wrap each editable <text> in  <g id="name"> … </g>${R}`);
        issues.push('no editable groups');
      }

      if (gIds.includes('static_text')) {
        console.log(ok('"static_text" group present'));
      }

      // 5. Bare <text> outside groups
      if (hasBareText(svg)) {
        console.log(warn('<text> elements found outside any <g id> group'));
        console.log(`     ${DIM}Wrap static text in <g id="static_text"> and editable text in <g id="yourField">${R}`);
        issues.push('bare text elements');
      }

      totalIssues += issues.length;
      if (issues.length === 0) {
        console.log(`  ${GREEN}${BOLD}→ All good!${R}`);
      } else {
        console.log(`  ${RED}${BOLD}→ ${issues.length} issue(s) above${R}`);
      }
    }

    if (svgFiles.length === 0) {
      console.log(`  ${DIM}(no SVG files)${R}`);
    }
  }

  console.log('\n' + '─'.repeat(54));
  if (totalIssues === 0) {
    console.log(`${GREEN}${BOLD}All templates are valid!${R}\n`);
  } else {
    console.log(`${RED}${BOLD}${totalIssues} issue(s) found — fix them before publishing.${R}\n`);
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
