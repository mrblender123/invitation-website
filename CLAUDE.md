# Share Your Simcha — Developer Guide for Claude

## Adding a New Template

When the user says "add this template" or provides new PNG/SVG files, follow this checklist end-to-end.

---

### 1. File Placement & Naming

- Drop files into `/public/templates/{Category}/{Subcategory}/` (or flat `/public/templates/{Category}/` if no subcategory).
- The PNG and SVG **must share the same stem** — `mycard.png` + `mycard.svg`. Case-insensitive match.
- Both files must be **committed to git** — untracked files won't appear on Vercel.
- Category/subcategory folder names become the UI labels (spaces and special chars are supported).

---

### 2. Script-Based Processing Workflow

**Always use the scripts — never manually edit SVG attributes that the scripts handle.**

#### Step 1 — Run `clean-svg.mjs` first (mandatory)

```bash
node scripts/clean-svg.mjs "public/templates/Category/Sub/FILE.svg"
```

This automatically fixes every mechanical issue:
- PostScript/variable font names → clean CSS (`Heebo-ExtraBold, Heebo` → `font-family="Heebo" font-weight="800"`)
- Removes `font-variation-settings`
- Removes trailing-space tspans (RTL artifacts)
- Removes `scale()` transforms on text
- Removes `@import url(...)` and `<image>` tags
- Centers all text at `viewBoxWidth / 2` with `text-anchor="middle"` and `tspan x="0"`

**Before running, always check for multi-column designs:**
```bash
grep -o 'translate([^)]*)' FILE.svg | sort | uniq -d
```
If any duplicate translate positions exist (same X Y appearing on multiple text elements), the SVG has overlapping columns — **always use `--side`** for these. `--side` preserves the original translate X positions so columns stay separated.

For side-aligned or multi-column designs: add `--side` flag.
To preview without writing: add `--dry` flag.

The script **reports** the current `<g id>` field list after cleaning. Review it.

#### Step 2 — Auto-assign field IDs from an existing template (mandatory)

```bash
node scripts/match-template.mjs "public/templates/Category/Sub/FILE.svg"
```

This looks at the other already-processed templates in the same folder, matches text elements by Y position (visual top→bottom), and automatically wraps each element with the correct `<g id>`, field name, REQ/OPT, and order — exactly matching the category pattern.

**This only works if there is at least one already-processed template in the folder.** For the very first template in a new folder, assign field IDs manually using the category table below, then subsequent templates use `match-template.mjs`.

Rules for field IDs:
- Use `snake_case`, English only
- Append `*` for required fields (always shown in editor)
- No `*` for optional fields (hidden behind "Show all fields")
- Forbidden IDs (silently skipped): `static_text`, `layer_1`, `layer 1`, `background`, anything matching `/^layer/i`

#### Step 3 — Wrap any remaining bare text (mandatory)

Every `<text>` must be in a `<g id>`. Run:
```bash
node scripts/wrap-static-texts.mjs "public/templates/Category/Sub"
```
This wraps any bare text in `<g id="line_N">` (optional). Run it even if you think all texts are already wrapped — it's a no-op if nothing is bare.

#### Step 4 — Check field order (was Step 3)

The order `<g id>` elements appear in the SVG document is the order fields appear in the editor. It must follow the category standard (see table below).

If the order is wrong, either:
- Edit the SVG manually (move `<g id>` blocks to the correct position), or
- Use the GUI reorder tool:
  ```bash
  node scripts/reorder-fields.mjs
  # then open http://localhost:3333 — drag fields, click Save
  ```
  This rewrites all SVGs in the folder at once.

#### Step 5 — Validate (mandatory before committing)

```bash
npm run validate-templates
```

Must complete with **0 errors**. Fix anything it flags before proceeding.

#### Step 6 — Commit both files

```bash
git add -f "public/templates/Category/Sub/FILE.png"
git add "public/templates/Category/Sub/FILE.svg" "public/templates/Category/Sub/FILE-thumb.png"
git commit -m "Add FILE template to Category/Sub"
```

Note: PNG files are in `.gitignore` — always use `git add -f` for them.

#### Step 7 — Compress thumbnails (mandatory — prevents slow loading)

Thumbnail PNGs straight from Illustrator are 2-3MB each. Always compress them to WebP before syncing:

```bash
node scripts/convert-thumbs-to-webp.mjs
```

This converts every `*-thumb.png` → `*-thumb.webp` (3-20KB) and uploads directly to R2. Without this step, thumbnails will load slowly for all users.

#### Step 7b — Convert the full background to WebP (mandatory — prevents stale/missing background on live site)

Production always requests the **full background** as `FILE.webp`, not `FILE.png` — `scripts/sync-r2.mjs` only uploads the raw `.png` (used as a dev/fallback asset). Without this step, a *new* template's background 404s and silently falls back to the PNG (slower, not broken) — but updating an **existing** template's PNG without re-running this leaves the live site serving the *old* WebP indefinitely, with no error to notice.

```bash
node scripts/convert-full-to-webp.mjs "Category/Sub"
```

Run this any time a background PNG is added OR replaced (not just brand-new templates). Skips unchanged files like the thumbnail script; pass `--force` to reconvert everything in scope.

#### Step 8 — Sync to R2 (mandatory — prevents 404 on live site)

The production site serves SVGs and PNGs from R2 (Cloudflare). Git/Vercel deploys the files to the server but does **not** upload them to R2 automatically. Always run this after committing new template files:

```bash
node scripts/sync-r2.mjs "Category/Sub"
```

Or to sync an entire category:
```bash
node scripts/sync-r2.mjs "Category"
```

This reads from local `public/templates/` and uploads to R2 using the credentials in `.env.local`. Without this step, new templates will show a 404 error on the live site.

---

### 3. Category Field Reference (REQ/OPT Patterns)

Use these exact field IDs and required/optional status. Consistency across templates in the same category is critical.

#### It's a girl / It's a boy

Order in editor (top → bottom) matches this table order:

| # | Field ID | REQ/OPT | Placeholder example |
|---|---|---|---|
| 1 | `day*` | **REQ** | ביום שבת קודש |
| 2 | `parasha*` | **REQ** | פרשת ויגש |
| 3 | `location*` | **REQ** | בביהמ״ד קהל חסידי בעלזא |
| 4 | `street*` | **REQ** | 1247 38th St |
| 5 | `greeting` | OPT | ידידכם המצפה לקבל פניכם |
| 6 | `time*` | **REQ** | שחרית |
| 7 | `shachrit_time*` | **REQ** | 9:30 (only if separate from `time*`) |
| 8 | `host_name*` | **REQ** | ברוך זאב ראטנבערג |
| 9 | `father_name_1` | OPT | ב״ר בנימין משה הי״ו |
| 10 | `father_name_2` | OPT | חתן בערל גרינפעלד הי״ו |

#### Bavarfen / Father

| # | Field ID | REQ/OPT | Placeholder example |
|---|---|---|---|
| 1 | `day*` | **REQ** | ביום שבת קודש |
| 2 | `parasha*` | **REQ** | פרשת ויגש |
| 3 | `location*` | **REQ** | בביהמ״ד קהל חסידי בעלזא |
| 4 | `street*` | **REQ** | 1247 38th St |
| 5 | `greeting*` | **REQ** | ידידכם המצפה לקבל פניכם |
| 6 | `time` | OPT | שחרית |
| 7 | `host_name*` | **REQ** | ברוך זאב ראטנבערג |
| 8 | `father_name_1*` | **REQ** | ב״ר בנימין משה הי״ו |
| 9 | `father_name_2*` | **REQ** | חתן בערל גרינפעלד הי״ו |

#### Bar Mitzvah

| # | Field ID | REQ/OPT | Placeholder example |
|---|---|---|---|
| 1 | `day*` | **REQ** | ביום א׳ פרשת שמות |
| 2 | `location*` | **REQ** | באולם פרדס נח |
| 3 | `address*` | **REQ** | 5015 15th Ave |
| 4 | `time*` | **REQ** | 7:00 |
| 5 | `greeting` | OPT | ידידכם המצפה לקבל פניכם |
| 6 | `host_name*` | **REQ** | חייםמשה ראטה |
| 7 | `father_name_1*` | **REQ** | ב״ר בנימין משה הי״ו |
| 8 | `father_name_2*` | **REQ** | חתן בערל גרינפעלד הי״ו |

#### Sheva Brachos

| # | Field ID | REQ/OPT | Placeholder example |
|---|---|---|---|
| 1 | `date*` | **REQ** | ביום ג׳ פרשת שמות |
| 2 | `hebrew_date*` | **REQ** | ט״ו טבת תשפ״ו |
| 3 | `location*` | **REQ** | באולם פרדס נח |
| 4 | `address*` | **REQ** | 5015 15th Ave |
| 5 | `groom_name*` | **REQ** | שמעון לוי |
| 6 | `groom_name_2*` | **REQ** | ברענאוויטש |

---

### 4. SVG Structure Rules

**Alignment — Hebrew SVG text requires explicit centering:**

Browsers and Illustrator handle Hebrew text anchoring differently. Raw Illustrator-exported translate X values do **not** render correctly in browsers for Hebrew text (text overflows or goes off-frame). The only reliable approach is:

- Set `translate X = viewBoxWidth / 2` (e.g. `180` for 360-wide, `222` for 444-wide) on every `<text>` element.
- Add `text-anchor="middle"` to every `<text>` element.
- Set every `<tspan x="0">` so the center is at the translate origin.

**`clean-svg.mjs` does this automatically — do not do it manually.**

**Exception — non-Hebrew / specifically side-positioned designs:** If a template intentionally has text aligned to the left or right (not centered), keep the original translate X and use `text-anchor="start"` or `text-anchor="end"` as appropriate. Pass `--side` to `clean-svg.mjs`.

- **Never use** `data-no-center="true"`.
- Initial render is pixel-perfect (fields with placeholder values are left completely untouched).
- When editing: `text-anchor="middle"` fields stay centered at their translate X; `text-anchor="start"` fields center at the original placeholder's visual midpoint.

**Editable fields:**
- **Every `<text>` element must be wrapped in a `<g id>` — no bare static text allowed.**
- Named fields (e.g. `host_name*`, `day*`) use descriptive snake_case ids.
- Previously-static intro/filler lines use `line_1`, `line_2`, … as ids (all optional).
- Use `node scripts/wrap-static-texts.mjs "<folder>"` to automatically wrap any remaining bare text in a folder.
- The `id` becomes the field key; auto-label is generated as Title Case from the id (e.g. `host_name` → "Host Name").
- For **required fields** (always shown), append `*` to the id: `<g id="field_name*">`. Fields WITHOUT `*` are optional (hidden behind "Show all fields"). If NO fields have `*`, all are treated as required.
- Forbidden ids (silently skipped): `static_text`, `layer_1`, `layer 1`, `background`, anything matching `/^layer/i`.
- The first `<tspan>` text inside the group becomes the **placeholder** shown in the editor.
- For multi-line fields (multiple `<tspan>` rows): only the first tspan is editable — the rest stay as static placeholder lines.

**No embedded fonts:**
- Do NOT include `@import url(...)` in SVG `<style>` or `<defs>` blocks — it is stripped at runtime anyway.
- Do NOT embed base64 font data in the SVG.

---

### 5. Fonts

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
| `Frank Ruhl Libre`      | `--font-frank-ruhl-libre` | Hebrew + Latin            |
| `Playpen Sans Hebrew`   | `--font-playpen-sans-hebrew` | Hebrew + Latin, weights 400–800 |

**How the font mapping works:**
`next/font/google` loads fonts under a scoped internal name, not the plain CSS name. `SvgCardPreview.tsx` injects a `<style>` block into every SVG that maps the plain name → CSS variable. This mapping lives in `injectFieldValues()` in `app/components/SvgCardPreview.tsx`.

**If the template uses a font NOT in the table above:**
1. Add it to `app/layout.tsx` using `next/font/google`.
2. Add the CSS variable to the `<html>` className string.
3. Add a mapping line to the `fontMapStyle` in `injectFieldValues()` in `SvgCardPreview.tsx`.

---

### 6. Font Map in SvgCardPreview.tsx

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

### 7. Template Auto-Discovery

Templates are discovered at runtime by `app/api/templates/route.ts`:
- Scans `/public/templates/` recursively (1 or 2 levels deep).
- Pairs `.png`/`.jpg` files with same-stem `.svg` files.
- Parses the SVG to extract: `viewBox` → canvas size, `<g id>` elements → fields.
- No manual registration needed.
