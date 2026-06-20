# Final Vercel comment batch — milestone-builder plan

**Created 2026-06-20.** Implements the remaining open mini-manager Vercel comments. The **typography migration (#47)** already answered the whole font cluster (body → Flexi IBM VGA True ~23.5px, the 7-category taxonomy in `docs/TYPOGRAPHY_AUDIT.md` is the source of truth). This plan covers the **non-font, implementable** items, best-guessing where Ross didn't fully specify (his standing instruction).

## Rules for the builder
- Conventions: kit primitives + design tokens (`src/lib/palette.ts`, `src/app/globals.css`, the 7 category utilities `font-{title,h1,h2,body,num1,num2}`/`text-*`), square terminal aesthetic, no new deps, TypeScript strict (0 errors). **Grey→white is already done app-wide** — secondary text is `text-fg`; keep grey only on placeholders/disabled.
- Per milestone: implement → `npm run db:migrate` (so the ~5 paintMetaCache tests pass) → `npm run typecheck` (0) → `npm run test:unit` (green; `git checkout -- public/sw.js` if it dirties) → commit citing the thread id → tick the box. One commit per milestone.
- Verify-before-build: use the file hints but confirm the real element. If a milestone genuinely needs a product decision you can't best-guess, leave it unchecked and note why.

## Milestones

- [x] **M1 — Space out the paint-table columns** (`EYIM_Wd9wKjl`, /library). The TYPE and HEX columns collide and there's an oversized gap between NAME and BRAND. In `library/PaintListTable.tsx`: stop the Name column absorbing all slack — give it a sensible max width, distribute the freed space to give Type/Hex/Brand breathing room (explicit `w-*`/`min-w-*` per column, or a fixed table layout). Confirm no horizontal overflow at desktop + 390px.

- [x] **M2 — Colour-map OWNED/WISHLIST circle indicators** (`7RFkgNxn5Cl6`, /library). The font part is done by #47. Replace the "glitchy bars" marking owned/wishlist paints on the library colour map (`library/ColorMapRail.tsx`) with **circle/dot indicators**: green = owned, yellow = wishlist, each with a **1–2px black stroke** (`stroke`/`border`), sized a touch larger than before for at-a-glance scanning (ok if slightly bigger than the exact paint position). Keep the colour-map title inside its border (no overflow).

- [x] **M3 — Recipe-box label order** (`RuYiw7plQqDV` / MM-22, /focus). On the Focus recipe box, reorder so the label reads **"RECIPE BOX"** first, then **"No Recipe Attached"**, then the box/card — i.e. heading above the empty-state text. Best-guess this order (Ross's confirmed read).

- [x] **M4 — Make the /projects activity section smaller + scrollable** (`UF5HOwXMpJxP`, /projects). The flagged section on `/projects` (the ACTIVITY card / the over-tall section) should be capped in height and scroll internally: add a `max-h-*` + `overflow-y-auto` so it doesn't dominate the page. Confirm against the current `/projects` layout (the pin references an older layout — target the equivalent current section).

- [x] **M5 — /projects KPI → centered percentage only** (`S3lZ40vuocCL`, /projects). Strip the flagged `/projects` KPI tracker(s) down to just the **percentage number, centered** (drop the surrounding label/bar chrome Ross flagged as too busy). Keep it a Number category. Confirm on the current `/projects` page.

- [ ] **M6 — ± Dropper buttons on the Colour Dropper tool** (`wBJeqQHQLK4g`, /tools/dropper). New feature, best-guessed: let the user add/remove dropper slots — start at **3**, with **+ / − dropper buttons**. Move the Save / Send-to-Recipe buttons to the right and put the +/− controls in their place (per Ross's sketch). Persist the count in component state; clamp to a sane min (1) / max (e.g. 8). Keep the existing palette-extraction behaviour for each dropper.

## Resolve-only — addressed by the typography migration (#47), no code needed
These need a reply + thread resolve once #47 is live in prod (handled by the comment routine, not this builder): `MXYr3npJ-vPG`, `pj1NxDMT6Eeq`, `2Jw51D8ETR0t`, `D5rNizh_a_aV`, `YYVDgCQcd0ma`, `e-j6I1OfIINp`, `aPHdSR4h7a_Z` (all "body too small / font / bigger" → Flexi 23.5px now), plus `swThO7pd9NE4` (SHARE button font — buttons are now unified at the single Buttons size, 11.5px).

## Needs Ross — cannot best-guess
- `8AYy8A9H_J9L` — "decrease button to 68×68px": the pinned button already renders ~28px, so 68px would *enlarge* it. Contradictory — needs Ross to clarify which button / which direction.
- `C9gZQOzR7nUM` — "add one more paint brand for symmetry": needs Ross to name the brand + supply its paint data.
