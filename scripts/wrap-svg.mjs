#!/usr/bin/env node
/**
 * npm run wrap-svg -- <path-to-svg>
 *
 * Prepares an SVG file for use as an invitation template:
 *   1. Fixes XML entity encoding inside <tspan> text content
 *      (&apos; → '  and  &quot; → ")
 *   2. Lists every bare (unwrapped) <text> element with its text content
 *   3. Asks you to type a field ID for each editable one (Enter = static/skip)
 *   4. Wraps the named elements in  <g id="your_field">…</g>
 *   5. Saves the result back to the same file
 *
 * Usage:
 *   npm run wrap-svg -- "public/templates/It's a boy/Vachnacht + Bris/001.svg"
 */

import { readFileSync, writeFileSync } from 'fs';
import { createInterface } from 'readline';

// ── ANSI colours ─────────────────────────────────────────────────────────────
const R      = '\x1b[0m';
const BOLD   = '\x1b[1m';
const DIM    = '\x1b[2m';
const GREEN  = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN   = '\x1b[36m';
const RED    = '\x1b[31m';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Decode &apos; and &quot; inside <tspan>…</tspan> text content.
 *  These entities are valid in XML attributes but cause literal display
 *  when the parser sets textContent on a tspan node. */
function fixTspanEntities(svgText) {
  return svgText.replace(
    /<tspan([^>]*)>([\s\S]*?)<\/tspan>/g,
    (_, attrs, content) =>
      `<tspan${attrs}>${content.replace(/&apos;/g, "'").replace(/&quot;/g, '"')}</tspan>`,
  );
}

/** Pull the first readable string out of a <text>…</text> block. */
function extractDisplayText(textBlock) {
  const m = textBlock.match(/<tspan[^>]*>([\s\S]*?)<\/tspan>/);
  if (!m) return '(no text)';
  return m[1].replace(/&[a-z]+;/g, ' ').replace(/<[^>]+>/g, '').trim() || '(empty)';
}

/**
 * Scan the SVG and return every <text>…</text> element together with:
 *   - start / end  character positions in the string
 *   - isWrapped    true if the element is inside a <g id="…"> ancestor
 *   - parentGId    the nearest ancestor <g id> value (or null)
 *   - displayText  readable preview of the first tspan content
 */
function findTextElements(svgText) {
  const results = [];
  const textRe  = /<text\b([^>]*)>([\s\S]*?)<\/text>/g;
  let m;

  while ((m = textRe.exec(svgText)) !== null) {
    const start  = m.index;
    const end    = m.index + m[0].length;
    const before = svgText.slice(0, start);

    // Build a <g> stack from everything that precedes this <text>
    const gStack = [];
    const gRe    = /<(\/?)g\b([^>]*)>/g;
    let gm;
    while ((gm = gRe.exec(before)) !== null) {
      if (gm[1] === '/') {
        gStack.pop();
      } else {
        const idM = gm[2].match(/\bid="([^"]+)"/);
        gStack.push(idM ? idM[1] : null);
      }
    }

    const parentGId  = gStack.length > 0 ? gStack[gStack.length - 1] : null;
    const isWrapped  = parentGId !== null;

    results.push({
      start,
      end,
      fullMatch:   m[0],
      isWrapped,
      parentGId,
      displayText: extractDisplayText(m[0]),
    });
  }

  return results;
}

/** Ask a question and return the trimmed answer. */
function prompt(rl, question) {
  return new Promise(resolve => rl.question(question, ans => resolve(ans.trim())));
}

// ── Main ─────────────────────────────────────────────────────────────────────

const [,, filePath] = process.argv;

if (!filePath) {
  console.error(`\nUsage:\n  npm run wrap-svg -- <path-to-svg>\n`);
  process.exit(1);
}

let svg;
try {
  svg = readFileSync(filePath, 'utf-8');
} catch {
  console.error(`${RED}Cannot read file:${R} ${filePath}`);
  process.exit(1);
}

// ── Step 1: Fix entity encoding ───────────────────────────────────────────────
const fixed = fixTspanEntities(svg);
if (fixed !== svg) {
  console.log(`\n${GREEN}✓${R} Fixed XML entity encoding in <tspan> content (&apos; → '  &quot; → ")`);
}

// ── Step 2: Analyse text elements ────────────────────────────────────────────
const elements   = findTextElements(fixed);
const wrapped    = elements.filter(e =>  e.isWrapped);
const unwrapped  = elements.filter(e => !e.isWrapped);

console.log(`\n${BOLD}${CYAN}${filePath}${R}`);
console.log(`Found ${elements.length} <text> element(s).\n`);

if (wrapped.length > 0) {
  console.log(`${GREEN}Already wrapped:${R}`);
  for (const e of wrapped) {
    console.log(`  ${DIM}[${e.parentGId}]${R} "${e.displayText}"`);
  }
  console.log();
}

if (unwrapped.length === 0) {
  writeFileSync(filePath, fixed, 'utf-8');
  console.log(`${GREEN}${BOLD}All text elements are already wrapped — nothing to do.${R}`);
  console.log(`${DIM}Entity fixes (if any) saved.${R}\n`);
  process.exit(0);
}

console.log(`${YELLOW}Bare (unwrapped) elements — need a field ID:${R}`);
for (const e of unwrapped) {
  console.log(`  • "${e.displayText}"`);
}

console.log(`
${DIM}For each element below, type a field ID to make it editable
(e.g. father_name, event_date, venue_address)
or press ${R}${BOLD}Enter${R}${DIM} to leave it as static text.${R}
${DIM}Tip: Add * at the end of the ID (e.g. baby_name*) to mark it as optional.${R}
`);

const rl = createInterface({ input: process.stdin, output: process.stdout });
const assignments = new Map(); // element → fieldId

(async () => {
  for (let i = 0; i < unwrapped.length; i++) {
    const el = unwrapped[i];
    console.log(`${BOLD}[${i + 1}/${unwrapped.length}]${R} "${el.displayText}"`);
    const answer = await prompt(rl, '  Field ID (Enter to skip): ');

    if (!answer) {
      console.log(`  ${DIM}→ static (skipped)${R}\n`);
      continue;
    }

    // Validate: letters, digits, underscores, hyphens, optional trailing *
    if (!/^[\w-]+\*?$/.test(answer)) {
      console.log(`  ${RED}✗ Invalid ID — use only letters, numbers, _ or - (and optionally * at the end). Skipping.${R}\n`);
      continue;
    }

    assignments.set(el, answer);
    console.log(`  ${GREEN}→ will wrap as <g id="${answer}">…</g>${R}\n`);
  }

  rl.close();

  if (assignments.size === 0) {
    writeFileSync(filePath, fixed, 'utf-8');
    console.log(`\n${DIM}No fields assigned. Entity fixes (if any) saved.${R}\n`);
    process.exit(0);
  }

  // ── Step 3: Apply wrapping in reverse order (to preserve string positions) ──
  let result = fixed;
  const sorted = [...assignments.entries()].sort((a, b) => b[0].start - a[0].start);

  for (const [el, fieldId] of sorted) {
    // Detect the indentation used on the line containing this <text>
    const before      = result.slice(0, el.start);
    const indentMatch = before.match(/(\n?([ \t]*))\S[^\n]*$/);
    const indent      = indentMatch ? indentMatch[2] : '  ';

    const wrapped =
      `<g id="${fieldId}">\n` +
      `${indent}  ${el.fullMatch}\n` +
      `${indent}</g>`;

    result = result.slice(0, el.start) + wrapped + result.slice(el.end);
  }

  writeFileSync(filePath, result, 'utf-8');

  console.log(
    `\n${GREEN}${BOLD}✓ Wrapped ${assignments.size} field(s) and saved to:${R}\n  ${filePath}\n`,
  );

  console.log(
    `${DIM}Run  npm run check-templates  to verify the result.${R}\n`,
  );
})();
