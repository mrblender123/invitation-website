#!/usr/bin/env node
/**
 * Validates all SVG templates and reports issues.
 * Run with: node scripts/validate-templates.mjs
 */

import { readdir, readFile } from 'fs/promises';
import { execFileSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// xmllint is the same class of strict parser browsers use — regex checks below
// can miss malformed XML that renders as a blank error page for customers.
let hasXmllint = true;
try { execFileSync('xmllint', ['--version'], { stdio: 'ignore' }); } catch { hasXmllint = false; }

function xmlParseError(filePath) {
  if (!hasXmllint) return null;
  try {
    execFileSync('xmllint', ['--noout', filePath], { stdio: ['ignore', 'ignore', 'pipe'] });
    return null;
  } catch (e) {
    const msg = (e.stderr?.toString() ?? '').split('\n')[1]?.trim() || 'XML parse error';
    return msg;
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.join(__dirname, '..', 'public', 'templates');

const SUPPORTED_FONTS = new Set([
  'Heebo', 'Secular One', 'Dancing Script', 'Lora',
  'Montserrat', 'Oswald', 'Frank Ruhl Libre', 'Playpen Sans Hebrew', 'Lexend', 'Comic Neue',
]);

const SKIP_IDS = new Set(['static_text', 'layer_1', 'layer 1', 'background']);

function parseFields(content) {
  const gTagRegex = /<g\b([^>]*)>/g;
  const seen = new Set();
  const fields = [];
  const duplicates = new Set();
  let m;
  while ((m = gTagRegex.exec(content)) !== null) {
    const idMatch = m[1].match(/\bid="([^"]+)"/);
    if (!idMatch) continue;
    const rawId = idMatch[1];
    const gId = rawId.replace(/\*/g, '').trim();
    if (!gId || !/^[A-Za-z]/.test(gId)) continue;
    if (SKIP_IDS.has(gId.toLowerCase())) continue;
    if (/^layer/i.test(gId)) continue;
    if (/^text\d*$/i.test(gId)) continue;
    if (seen.has(gId)) { duplicates.add(gId); continue; }
    seen.add(gId);
    fields.push(rawId);
  }
  return { fields, duplicates: [...duplicates] };
}

function validateSvg(content, filePath) {
  const errors = [];
  const warnings = [];

  // 0. Must be well-formed XML — browsers refuse to render anything after a parse error
  const xmlErr = xmlParseError(filePath);
  if (xmlErr) {
    errors.push(`Malformed XML (browser will fail to render): ${xmlErr}`);
  }

  // 1. Must have a viewBox
  if (!/<svg[^>]+viewBox/.test(content)) {
    errors.push('Missing viewBox attribute on <svg>');
  }

  // 2. Must have at least one editable field
  const { fields, duplicates } = parseFields(content);
  if (fields.length === 0) {
    errors.push('No editable fields found (no valid <g id="..."> elements)');
  }

  // 2b. Same field id used on more than one <g> — the later one silently
  // shadows the earlier one in the editor (no error anywhere else catches this).
  if (duplicates.length > 0) {
    errors.push(`Same field id assigned to multiple <g> elements: ${duplicates.join(', ')}`);
  }

  // 3. No @import in style blocks
  if (/@import\s+url/.test(content)) {
    errors.push('Contains @import url(...) — embedded font imports must be removed');
  }

  // 4. No embedded <image> tags
  if (/<image[\s>]/.test(content)) {
    errors.push('Contains <image> tag — background images must be removed from SVG');
  }

  // 5. No base64 embedded data
  if (/data:image\//.test(content)) {
    errors.push('Contains embedded base64 image data — must be removed');
  }

  // 6. Check font-family values are supported
  const fontMatches = [...content.matchAll(/font-family="([^"]+)"/g)];
  for (const fm of fontMatches) {
    const families = fm[1].split(',').map(f => f.replace(/['"]/g, '').trim());
    const primary = families[0];
    if (!SUPPORTED_FONTS.has(primary)) {
      warnings.push(`Unsupported font-family "${primary}" — add it to app/layout.tsx and SvgCardPreview.tsx`);
    }
  }

  // 7. Every <text> inside an editable <g> should have text-anchor="middle"
  const textTags = [...content.matchAll(/<text\b([^>]*)>/g)];
  let missingAnchor = 0;
  for (const t of textTags) {
    if (!t[1].includes('text-anchor')) missingAnchor++;
  }
  if (missingAnchor > 0) {
    warnings.push(`${missingAnchor} <text> element(s) missing text-anchor attribute — Hebrew text may overflow`);
  }

  // 8. font-variation-settings should not be present
  if (/font-variation-settings/.test(content)) {
    warnings.push('Contains font-variation-settings — should be removed (use font-weight instead)');
  }

  return { fields, errors, warnings };
}

async function walk(dir) {
  const svgFiles = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      svgFiles.push(...await walk(full));
    } else if (entry.name.endsWith('.svg')) {
      svgFiles.push(full);
    }
  }
  return svgFiles;
}

async function main() {
  const svgFiles = await walk(TEMPLATES_DIR);
  let totalErrors = 0;
  let totalWarnings = 0;
  let totalOk = 0;

  for (const filePath of svgFiles.sort()) {
    const rel = path.relative(TEMPLATES_DIR, filePath);
    const content = await readFile(filePath, 'utf-8');
    const { fields, errors, warnings } = validateSvg(content, filePath);

    if (errors.length === 0 && warnings.length === 0) {
      console.log(`✅  ${rel} (${fields.length} fields)`);
      totalOk++;
    } else {
      if (errors.length > 0) {
        console.log(`❌  ${rel} (${fields.length} fields)`);
        for (const e of errors) console.log(`       ERROR: ${e}`);
        totalErrors += errors.length;
      }
      if (warnings.length > 0) {
        if (errors.length === 0) console.log(`⚠️   ${rel} (${fields.length} fields)`);
        for (const w of warnings) console.log(`       WARN:  ${w}`);
        totalWarnings += warnings.length;
      }
    }
  }

  console.log(`\n${svgFiles.length} templates checked — ${totalOk} ok, ${totalErrors} errors, ${totalWarnings} warnings`);
  if (totalErrors > 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
