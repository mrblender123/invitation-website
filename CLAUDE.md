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

**Alignment — Hebrew SVG text requires explicit centering:**

Browsers and Illustrator handle Hebrew text anchoring differently. Raw Illustrator-exported translate X values do **not** render correctly in browsers for Hebrew text (text overflows or goes off-frame). The only reliable approach is:

- Set `translate X = viewBoxWidth / 2` (e.g. `180` for 360-wide, `222` for 444-wide) on every `<text>` element.
- Add `text-anchor="middle"` to every `<text>` element.
- Set every `<tspan x="0">` so the center is at the translate origin.

This matches how R-001 (Vachnacht) was fixed and confirmed working.

**Exception — non-Hebrew / specifically side-positioned designs:** If a template intentionally has text aligned to the left or right (not centered), keep the original translate X and use `text-anchor="start"` or `text-anchor="end"` as appropriate. The app will still center edited text at the visual midpoint of the placeholder.

- **Never use** `data-no-center="true"`.
- Initial render is pixel-perfect (fields with placeholder values are left completely untouched).
- When editing: `text-anchor="middle"` fields stay centered at their translate X; `text-anchor="start"` fields center at the original placeholder's visual midpoint.

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
- [ ] Set all `translate X` to `viewBoxWidth / 2` (e.g. `180`) and add `text-anchor="middle"` to every `<text>`
- [ ] Set all `tspan x="0"`
- [ ] Wrap each editable `<text>` in `<g id="field_id">` with a meaningful id
- [ ] Write the cleaned SVG back to the file
- [ ] `git add` both the PNG and SVG files and `git commit` them
