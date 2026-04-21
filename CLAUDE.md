# Pintle — Developer Guide for Claude

## Adding a New Template

When the user says "add this template" or provides new PNG/SVG files, follow this checklist end-to-end.

---

### 1. File Placement & Naming

- Drop files into `/public/templates/{Category}/{Subcategory}/` (or flat `/public/templates/{Category}/` if no subcategory).
- The PNG and SVG **must share the same stem** — `mycard.png` + `mycard.svg`. Case-insensitive match.
- Both files must be **committed to git** — untracked files won't appear on Vercel.
- Category/subcategory folder names become the UI labels (spaces and special chars are supported).

---

### 2. SVG Structure Rules

**Alignment — preserve the designer's positions:**
- Keep all `translate(X Y)` values exactly as they are in the Illustrator export. Do NOT change X to `viewBoxWidth/2` or any other fixed value.
- Keep all `tspan x` values as designed (only remove trailing-space tspans which are Illustrator artifacts).
- Do **not** add `text-anchor` to `<text>` elements in the SVG — the app handles centering during editing automatically.
- **Never use** `data-no-center="true"`.
- Initial render is always pixel-perfect to the SVG (fields with placeholder values are left completely untouched).
- When a user edits a field: the app measures the original placeholder width and centers the new text at the same visual midpoint, so text grows/shrinks from its natural center.

**Editable fields:**
- Wrap each editable `<text>` in `<g id="field_id">…</g>`.
- The `id` becomes the field key; auto-label is generated as Title Case from the id (e.g. `host_name` → "Host Name").
- For **optional fields** (hidden by default), append `*` to the id: `<g id="field_name*">`.
- Forbidden ids (silently skipped): `static_text`, `layer_1`, `layer 1`, `background`, anything matching `/^layer/i`.
- The first `<tspan>` text inside the group becomes the **placeholder** shown in the editor.
- For multi-line fields (multiple `<tspan>` rows): only the first tspan is editable — the rest stay as static placeholder lines.

**No embedded fonts:**
- Do NOT include `@import url(...)` in SVG `<style>` or `<defs>` blocks — it is stripped at runtime anyway.
- Do NOT embed base64 font data in the SVG.

---

### 3. Fonts

**Only Google Fonts are supported** (no Adobe Fonts — domain whitelist issues).

Currently loaded fonts in `app/layout.tsx` (available in SVGs via their plain CSS name):

| SVG `font-family` value | CSS variable       | Notes                          |
|-------------------------|--------------------|--------------------------------|
| `Heebo`                 | `--font-heebo`     | Hebrew + Latin, weights 100–900 |
| `Secular One`           | `--font-secular-one` | Hebrew + Latin, weight 400   |
| `Dancing Script`        | `--font-dancing-script` | Latin only                |
| `Lora`                  | `--font-lora`      | Latin only                     |
| `Montserrat`            | `--font-montserrat`| Latin only                     |
| `Oswald`                | `--font-oswald`    | Latin only                     |

**How the font mapping works:**
`next/font/google` loads fonts under a scoped internal name, not the plain CSS name. `SvgCardPreview.tsx` injects a `<style>` block into every SVG that maps the plain name → CSS variable. This mapping lives in `injectFieldValues()` in `app/components/SvgCardPreview.tsx`.

**If the template uses a font NOT in the table above:**
1. Add it to `app/layout.tsx` using `next/font/google`.
2. Add the CSS variable to the `<html>` className string.
3. Add a mapping line to the `fontMapStyle` in `injectFieldValues()` in `SvgCardPreview.tsx`.

---

### 4. Font Map in SvgCardPreview.tsx

The mapping block (search for `fontMapStyle`) must cover every font used across all templates:

```css
[font-family="Heebo"]          { font-family: var(--font-heebo, Heebo), sans-serif; }
[font-family="Secular One"]    { font-family: var(--font-secular-one, "Secular One"), sans-serif; }
[font-family="Dancing Script"] { font-family: var(--font-dancing-script, "Dancing Script"), cursive; }
[font-family="Lora"]           { font-family: var(--font-lora, Lora), serif; }
[font-family="Montserrat"]     { font-family: var(--font-montserrat, Montserrat), sans-serif; }
[font-family="Oswald"]         { font-family: var(--font-oswald, Oswald), sans-serif; }
```

---

### 5. Template Auto-Discovery

Templates are discovered at runtime by `app/api/templates/route.ts`:
- Scans `/public/templates/` recursively (1 or 2 levels deep).
- Pairs `.png`/`.jpg` files with same-stem `.svg` files.
- Parses the SVG to extract: `viewBox` → canvas size, `<g id>` elements → fields.
- No manual registration needed.

---

### 6. Checklist When Adding a Template

Do all of the following **in order**:

- [ ] Read the raw SVG the user provided
- [ ] Fix `font-family` — strip PostScript names (e.g. `Heebo-SemiBold, Heebo` → `Heebo`)
- [ ] Remove `font-variation-settings` attributes (redundant with `font-weight`)
- [ ] Remove trailing-space tspans (Illustrator RTL artifacts: `<tspan x="..." y="0"> </tspan>`)
- [ ] Remove any `<image>` tags (background is loaded from the PNG, not the SVG)
- [ ] Remove any `@import url(...)` or embedded `<image>` in `<defs>`
- [ ] Keep all original `translate(X Y)` values — do NOT change X to the card center
- [ ] Keep original `tspan x` values (only remove trailing-space tspans)
- [ ] Wrap each editable `<text>` in `<g id="field_id">` with a meaningful id
- [ ] Write the cleaned SVG back to the file
- [ ] `git add` both the PNG and SVG files and `git commit` them
