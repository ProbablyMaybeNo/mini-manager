# Mini Manager — FINAL Pre-Launch UX/UI Audit

**Date:** 2026-06-19 · **Target:** http://localhost:3000 (live, real Chromium via Playwright)
**Auth:** populated account `auditxlizov` (35 projects / 6 recipes / seeded activity feed), session injected.
**Widths:** desktop 1440 · tablet 768 · mobile **390×844** · **Audit only — no app code changed.**
**Routes covered (16):** `/`, `/pricing`, `/sign-in`, `/sign-up`, `/dashboard`, `/projects`, project-detail, `/collection`, `/library`, `/recipes`, recipe-detail, `/focus`, `/tools`, `/tools/match`, `/tools/wheel`, `/tools/stacking` (the layering tool).

---

## Resolution (2026-06-20, branch `fix/audit-regressions`)

- **UX-001 — FIXED** (`7b2bb40`). Root cause confirmed: `cn()` let tailwind-merge group `text-glow-*` with `text-color` and strip the accent class. Fixed via `extendTailwindMerge` custom groups. Verified: `cn("text-cyan","text-glow-cyan")` now keeps both; typecheck 0, 515 unit tests green.
- **UX-002 — NOT REPRODUCIBLE (false positive).** Against a *fresh* dev server the priority "MED" tag computes `rgb(255,157,60)` = `#ff9d3c` orange, and `.text-orange { color: var(--color-orange) }` emits identically to its working siblings. The audit measured a **stale compiled CSS chunk** — `--color-orange` was added in the very batch (#38) being audited, and the long-running dev server served a cached chunk predating the token. No code change needed.
- **UX-003 — FIXED** (`d215455`). Color Wheel closest-paint rows reflow at ≤390px; Assign drops to its own line. Verified live at 390px: 0 horizontal overflow, 0 Assign↔label overlap.

---

## Executive summary

The build is in **good launch shape** — strong aesthetic, clean responsive behaviour, real focus rings on every page, near-zero contrast failures on the new pure-black theme, and **no horizontal page overflow at 390px on any route** (the prior P1 Color Match / Color Wheel mobile fixes hold). Of the just-shipped batch, **most landed cleanly**: dotted-border larger-font dropdowns, themed DateField, sign-in/up headings (the old UX-010 is fixed), pixel activity-feed icons, pure-black background with the blue cast removed, and the Color Stacking tool which is a standout at 390px.

**9 findings: 0 P0, 3 P1 (high), 3 P2 (medium), 3 P3 (low).** No launch-blocking P0. The three P1s are the priority before ship and all are **small** effort:

1. **UX-001 — dashboard stat colours render white.** The headline batch item (time=purple/streak=yellow/completion=green/active=cyan) is silently neutralised by `tailwind-merge` stripping `text-cyan` when it sits next to `text-glow-cyan`. Measured live: all four numbers compute `#ffffff`. One-file fix in `cn.ts`.
2. **UX-002 — priority dropdown "MED" renders white** instead of orange. `text-orange`/`border-orange` resolve to white at runtime (High=red and Low=yellow work; MED, the default, doesn't). Token-rename fix.
3. **UX-003 — Color Wheel "closest paints" rows overlap at 390px** — ASSIGN button collides with the paint brand labels, both unreadable. Mobile-only reflow fix (Color Stacking already does it right).

---

## Did the new batch land cleanly? — verdict

**Mostly yes — 2 of the batch items are broken at runtime despite being correct in source.**

| Batch item | Verdict |
|---|---|
| Pixel-art status/activity icons (feed + status) | **Landed.** Activity feed shows pixel icons (magnifier/brush/check/coin) and reads well at all widths. |
| Dashboard stat colours (purple/yellow/green/cyan) | **BROKEN (UX-001).** Source is correct; `tailwind-merge` strips the colour class — numbers render white. |
| All dropdowns: dotted border + thinner font + larger text | **Landed.** Confirmed dotted 1px border, 16px font, role=combobox; native `<select>` largely replaced. Reads well, no mobile overflow. |
| PROJECTS priority dropdown coloured by priority | **Partially broken (UX-002).** High=red ✓, Low=yellow ✓, **MED=white ✗** (orange utility resolves to white). |
| Pure-black backgrounds (blue cast removed) | **Landed.** `--color-bg:#000000`, no blue cast. Contrast did not suffer (only 1 borderline 4.34:1 near-miss app-wide). Minor §9 halation note logged as UX-009. |
| Bigger paint squares + recipe-tile fonts | **Appears landed** (squares/fonts present; no before to diff — not flagged). |
| Completion bar + % bigger; heading hierarchy H1/H2/H3 | **Mostly landed.** Stat numbers bumped large ✓, sign-in/up now have h1 ✓. One heading-order miss remains (UX-005: project-detail starts at h2). |

**Console:** zero JS/console errors on every audited route. (The only 404 was me requesting `/tools/layering` from the brief — the layering tool actually lives at `/tools/stacking` and is linked correctly from the Tools hub; no dead in-app links.)

---

## LAUNCH BLOCKERS (P0 / P1)

**P0:** none.

### UX-001 · HIGH · Dashboard stat colours render white (batch regression)
`src/components/kit/StatBox.tsx` via `src/lib/cn.ts` · screenshot `final-shots/dashboard-desktop.png`
All four stat numbers compute `rgb(255,255,255)`. `cn()` = `twMerge(clsx(...))`; tailwind-merge groups `text-cyan` and `text-glow-cyan` as the same text-color group and last-wins drops `text-cyan`, leaving only the glow on white text. Reproduced in isolation. **Fix:** extend tailwind-merge to register `text-glow-*` as a non-color group (snippet in findings.json). *Principle: Refactoring UI colour/hierarchy; M3 colour roles. Confidence 0.97.*

### UX-002 · HIGH · Priority "MED" dropdown renders white, not orange
`src/lib/palette.ts` `--color-orange` · screenshots `projects-desktop.png`, `project-detail-desktop.png`
`text-orange`/`border-orange` resolve to white at runtime even though `--color-orange:#ff9d3c` is declared; `text-red`/`text-yellow` work, so High/Low are colour-coded but MED (the default) is white. **Fix:** rename token to a non-colliding `--color-amber` (Tailwind v4's built-in orange palette shadows the bare `text-orange`), or add explicit `@utility` rules. *Principle: colour-is-not-the-only-channel + brief. Confidence 0.95.*

### UX-003 · HIGH · Color Wheel "closest paints" rows overlap at 390px
`/tools/wheel` mobile · screenshot `tools-wheel-mobile.png`
ASSIGN dropdown overlaps the paint brand labels (WARCOLOURS / MONUMENT HOBBIES) — both unreadable. Desktop is fine; the row doesn't stack at mobile. **Fix:** flex-wrap / stacked grid under ~480px, mirroring the Color Stacking ramp rows which already reflow correctly. *Principle: WCAG 1.4.10 Reflow. Confidence 0.90.*

---

## MEDIUM (P2)

### UX-004 · Model-collection empty state clips at 390px
`/collection` mobile · `collection-mobile.png` — "NO M…" truncated and an inline "+ A…" CTA cut off the right edge. First-run empty state; paint block above reflows fine. **Fix:** let text wrap, make CTA full-width. *Polaris empty states / WCAG 1.4.10. Conf 0.85.*

### UX-005 · Heading order: project-detail starts at h2 (no h1)
`/projects/[id]` · `project-detail-desktop.png` — document outline opens at h2; also `/projects` h1 reads "DASHBOARD". **Fix:** promote project name to h1 (tag only). *WCAG 1.3.1 / 2.4.6. Conf 0.90.*

### UX-006 · Touch targets under 24px
Inputs render 22px tall app-wide (2px under WCAG 2.5.8); library "Hue coverage map" button is 316×2px (untappable). **Fix:** min-height ≥24px on shared input/Listbox trigger; fix the collapsed library button. *WCAG 2.5.8. Conf 0.82.*

---

## LOW (P3)

- **UX-007 · Time "X:XX" colon glyph crowds digits** in the pixel font at 3xl/4xl. Add `tabular-nums`/letter-spacing. *needs Ross's eye, conf 0.60.*
- **UX-008 · project-detail TYPE field affordance mismatch** — solid-border box next to dotted dropdowns. *needs Ross's eye, conf 0.60.*
- **UX-009 · Pure-black `#000000` halation caveat** — deliberate aesthetic choice; logged as a §9 trade-off to monitor, not a defect. No action needed. *conf 0.55.*

---

## Strengths (what's already good)

- **No horizontal overflow at 390px on any route** — the prior P1 Color Match / Color Wheel mobile fixes hold. Verified `document.scrollWidth - clientWidth === 0` across all 16 routes.
- **Color Stacking tool (`/tools/stacking`)** is a highlight at 390px — layering ladder, ramp rows, stacking layers, predicted result, and the optical-mix Venn all reflow cleanly. It's the reference pattern UX-003 and UX-004 should copy.
- **Focus rings everywhere** — every page's first focusable shows `outline: 2px solid` cyan. WCAG 2.4.7 satisfied.
- **Contrast on the new pure-black theme is strong** — exactly one near-miss app-wide (4.34:1 white-on-red swatch label), so the blue-cast removal did not hurt readability.
- **Dropdowns landed well** — consistent dotted-border, 16px, role=combobox; native selects mostly retired.
- **Prior findings fixed:** sign-in/up now have h1 (old UX-010), project-detail TARGET DATE is now a themed DateField (old UX-012).
- **Zero console/JS errors** on every audited route. Activity-feed pixel icons read clearly.

---

## Suggested implementation order (severity ÷ effort, top-down)

1. **UX-001** (HIGH / small) — stat colours; one-file `cn.ts` fix, un-breaks the headline batch item.
2. **UX-002** (HIGH / small) — priority MED orange; token rename.
3. **UX-003** (HIGH / small) — Color Wheel mobile row reflow.
4. **UX-005** (MED / trivial) — project-detail h1.
5. **UX-004** (MED / small) — model-collection empty state.
6. **UX-006** (MED / small) — input/touch-target min-height.
7. **UX-007 / UX-008 / UX-009** (LOW) — polish; UX-009 likely "leave as-is" (deliberate). Send 007/008 past Ross.

*Evidence: `ux-audit/evidence/final-audit-data.json` (per-page a11y tree, computed contrast ratios, touch targets, focus, overflow). Screenshots: `ux-audit/final-shots/` (each route × 3 widths). Driver: `ux-audit/final-driver.cjs`.*
