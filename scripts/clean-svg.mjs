/**
 * clean-svg.mjs — Auto-cleans Illustrator-exported SVGs for Pintle templates.
 *
 * What it does:
 *   - Normalizes font-family names (PostScript → CSS) and sets correct font-weight
 *   - Removes font-variation-settings, trailing-space tspans, scale() / rotate() on text
 *   - Centers all text at viewBox midpoint (unless --side is passed)
 *
 * Usage:
 *   node scripts/clean-svg.mjs public/templates/Bar\ mitzva/Bar\ Mizva/BM-06.svg
 *   node scripts/clean-svg.mjs public/templates/Tenoyim/CI-02.svg --side
 *   node scripts/clean-svg.mjs public/templates/Bar\ mitzva/Bar\ Mizva/BM-06.svg --dry
 *
 * Flags:
 *   --side   Text is intentionally side-positioned — skip centering
 *   --dry    Print result to stdout instead of writing the file
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

// ─── Args ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const filePath = args.find(a => !a.startsWith('-'));
const isSide = args.includes('--side');
const isDry  = args.includes('--dry');

if (!filePath) {
  console.error('Usage: node scripts/clean-svg.mjs <file.svg> [--side] [--dry]');
  process.exit(1);
}

const absPath = resolve(filePath);
let svg = readFileSync(absPath, 'utf8');

// ─── 1. Decode &apos; in attribute values (Illustrator encodes single quotes) ─

svg = svg.replace(/&apos;/g, "'");

// ─── 2. Font normalization ────────────────────────────────────────────────────
//
// Each rule: [regex-matching-the-font-family-attr, css-family-name, font-weight]
// The regex replaces the entire font-family="..." attr with the clean version.

const FONT_RULES = [
  // Heebo — named PostScript weights
  [/font-family="Heebo-Black,\s*Heebo"/,           'Heebo', '900'],
  [/font-family="Heebo-ExtraBold,\s*Heebo"/,       'Heebo', '800'],
  [/font-family="Heebo-Bold,\s*Heebo"/,            'Heebo', '700'],
  [/font-family="Heebo-SemiBold,\s*Heebo"/,        'Heebo', '600'],
  [/font-family="Heebo-Medium,\s*Heebo"/,          'Heebo', '500'],
  [/font-family="Heebo-Regular,\s*Heebo"/,         'Heebo', '400'],
  [/font-family="Heebo-Light,\s*Heebo"/,           'Heebo', '300'],
  // Heebo — variable-font numeric weights (common Illustrator exports)
  [/font-family="'Heebo_748[^']*',\s*Heebo"/,      'Heebo', '700'],
  [/font-family="'Heebo_588[^']*',\s*Heebo"/,      'Heebo', '600'],
  [/font-family="'Heebo_460[^']*',\s*Heebo"/,      'Heebo', '400'],
  // Playpen Sans Hebrew
  [/font-family="PlaypenSansHebrew-ExtraBold,\s*'Playpen Sans Hebrew'"/,  'Playpen Sans Hebrew', '800'],
  [/font-family="PlaypenSansHebrew-Bold,\s*'Playpen Sans Hebrew'"/,       'Playpen Sans Hebrew', '700'],
  [/font-family="PlaypenSansHebrew-SemiBold,\s*'Playpen Sans Hebrew'"/,   'Playpen Sans Hebrew', '600'],
  [/font-family="PlaypenSansHebrew-Medium,\s*'Playpen Sans Hebrew'"/,     'Playpen Sans Hebrew', '500'],
  [/font-family="PlaypenSansHebrew-Regular,\s*'Playpen Sans Hebrew'"/,    'Playpen Sans Hebrew', '400'],
  // Frank Ruhl Libre
  [/font-family="FrankRuhlLibre-Black,\s*'Frank Ruhl Libre'"/,   'Frank Ruhl Libre', '900'],
  [/font-family="FrankRuhlLibre-Bold,\s*'Frank Ruhl Libre'"/,    'Frank Ruhl Libre', '700'],
  [/font-family="FrankRuhlLibre-Regular,\s*'Frank Ruhl Libre'"/, 'Frank Ruhl Libre', '400'],
  [/font-family="FrankRuhlLibre-Light,\s*'Frank Ruhl Libre'"/,   'Frank Ruhl Libre', '300'],
];

// Apply specific rules first
for (const [pattern, family, weight] of FONT_RULES) {
  svg = svg.replace(new RegExp(pattern.source, 'g'),
    `font-family="${family}" font-weight="${weight}"`
  );
}

// Generic Heebo_NNN fallback (any numeric weight not covered above)
svg = svg.replace(/font-family="'Heebo_(\d+)[^']*',\s*Heebo"/g,
  (_, w) => `font-family="Heebo" font-weight="${w}"`
);

// ─── 3. Strip junk ───────────────────────────────────────────────────────────

// Remove font-variation-settings (redundant after weight normalization)
svg = svg.replace(/\s*font-variation-settings="[^"]*"/g, '');

// Remove trailing-space tspans (Illustrator RTL artifact: <tspan x="..." y="0"> </tspan>)
svg = svg.replace(/<tspan[^>]*>\s*<\/tspan>/g, '');

// Remove @import url(...) in style/defs
svg = svg.replace(/@import\s+url\([^)]+\);?\s*/g, '');

// Remove <image> tags (background comes from the PNG, not the SVG)
svg = svg.replace(/<image[^/]*\/>/g, '');
svg = svg.replace(/<image[^>]*>[\s\S]*?<\/image>/g, '');

// ─── 4. Deduplicate font-weight per element ───────────────────────────────────
// Font normalization can leave two font-weight attrs on the same element
// (our new one + the original). Keep the first (our normalized value).

svg = svg.replace(/<(text|tspan)(\s[^>]*)>/g, (match, tag, attrs) => {
  let seen = false;
  const cleaned = attrs.replace(/(\s+font-weight="[^"]*")/g, m => {
    if (!seen) { seen = true; return m; }
    return '';
  });
  return `<${tag}${cleaned}>`;
});

// ─── 5. Centering ────────────────────────────────────────────────────────────

if (!isSide) {
  // Derive center X from viewBox
  const vbMatch = svg.match(/viewBox="([\d.\s]+)"/);
  const vbParts = vbMatch ? vbMatch[1].trim().split(/\s+/) : [];
  const centerX = vbParts.length >= 3 ? parseFloat(vbParts[2]) / 2 : 180;

  // Process each <text>…</text> block as a unit so we know whether its
  // tspans have a parent transform or not.
  svg = svg.replace(/<text(\s[^>]*)>([\s\S]*?)<\/text>/g, (_, attrs, inner) => {
    const hasTransform = /\btransform=/.test(attrs);
    let a = attrs;
    let content = inner;

    if (hasTransform) {
      // Replace translate X with centerX; strip any trailing scale() / rotate()
      a = a.replace(
        /transform="translate\(\s*-?[\d.]+\s+(-?[\d.]+)\s*\)[^"]*"/,
        (_, y) => `transform="translate(${centerX} ${y})"`
      );
      // Set tspan x="0" (offset from the centred translate)
      content = content.replace(/(<tspan[^>]*)\bx="-?[\d.]+"/g, '$1x="0"');
    } else {
      // No transform — set tspan x directly to centerX
      content = content.replace(/(<tspan[^>]*)\bx="-?[\d.]+"/g, `$1x="${centerX}"`);
    }

    // Add / overwrite text-anchor
    if (!a.includes('text-anchor=')) {
      a += ' text-anchor="middle"';
    } else {
      a = a.replace(/text-anchor="[^"]*"/, 'text-anchor="middle"');
    }

    return `<text${a}>${content}</text>`;
  });
}

// ─── 6. Report ───────────────────────────────────────────────────────────────

const KNOWN_FONTS = [
  'Heebo', 'Playpen Sans Hebrew', 'Frank Ruhl Libre',
  'Dancing Script', 'Lora', 'Montserrat', 'Oswald', 'Secular One',
];

const unknownFonts = new Set(
  [...svg.matchAll(/font-family="([^"]+)"/g)]
    .map(([, f]) => f)
    .filter(f => !KNOWN_FONTS.includes(f))
);

const fieldIds = [...svg.matchAll(/<g\s[^>]*\bid="([^"]+)"/g)]
  .map(([, id]) => id)
  .filter(id => !['Layer_1', 'Layer 1'].includes(id) && !/^layer/i.test(id));

if (isDry) {
  process.stdout.write(svg);
} else {
  writeFileSync(absPath, svg, 'utf8');
  console.log(`✓ ${filePath}${isSide ? '  [side mode]' : ''}`);
}

if (unknownFonts.size) {
  console.warn(`\n⚠  Unknown fonts — add to layout.tsx & SvgCardPreview.tsx:\n   ${[...unknownFonts].join(', ')}`);
}

if (fieldIds.length) {
  console.log(`\nEditable fields (${fieldIds.length}) — review IDs and add * for required:`);
  for (const id of fieldIds) {
    const required = id.endsWith('*') ? ' ✓' : ' (optional?)';
    console.log(`   ${id}${required}`);
  }
} else {
  console.log('\n⚠  No <g id="..."> fields found — all text is static. Add wrappers manually.');
}
