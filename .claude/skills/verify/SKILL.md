---
name: verify
description: How to build, launch, and drive this app for runtime verification — dev server handle, admin auth bypass, Playwright mobile emulation recipe.
---

# Verifying invitation-app changes

## Handle

- The user usually has `npm run dev` already running on **port 3002** (`next dev --port 3002`). Check with `curl -s -o /dev/null -w "%{http_code}" http://localhost:3002` before starting your own — EADDRINUSE means reuse theirs (it hot-reloads your edits).
- Playwright: `npm i --no-save playwright && npx playwright install chromium`. Run driver scripts **from the repo root** (module resolution) — copy to `./.verify-drive.mjs`, run, delete.

## Admin editor auth

`/admin/template-editor` requires Supabase login as `bycheshin@gmail.com` (guard in the page: a `router.replace('/login')` effect + a `return null` render guard). For local verification, temporarily prefix both with a `process.env.NODE_ENV === 'development'` bypass — **always revert before committing** (grep for `VERIFY-TEMP`).

## Gotchas

- Template list buttons show names with dashes converted to spaces (`stemToName`): the button for K-10.svg says **"K 10"**.
- Category folders start collapsed; tap the category row first. "It's a girl" folder renders as **"It's a Girl"**.
- On mobile (<768px) selecting a template auto-switches to the canvas panel; the Templates panel is `display: none` after that — locators for list items will time out.
- A stray `page.touchscreen.tap()` over the list selects a template — don't tap blind coordinates.
- Layer dots are `div[style*="border-radius: 50%"][title]` inside the canvas; `title` = layer id. Playwright `.tap()` correctly exercises the touch path (`onTouchStart` handlers).
- Mobile flows worth driving: bottom tab bar (Templates/Editor/Layers), dot tap → nudge bar appears, nudge arrows move X/Y readout by step, step button cycles 1→10→0.1px, Multi toggle + second dot → "N selected", 🔍 zoom cycles 1/1.5/2× (canvas img width ×1.5), Layers panel rows.
