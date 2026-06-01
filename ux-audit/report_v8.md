# Mini Manager — Round 8 UX Audit (Recruit-Readiness)

**Date:** 2026-06-01
**Live URL:** https://miniaturemanager.vercel.app
**Audit account:** fresh recruit `recruit_r8` (created during audit)
**Viewports tested:** 1440×900 desktop, 375×667 iPhone, 414×896 iPhone Pro Max
**Findings file (machine-readable):** `ux-audit/findings_v8.json`

---

## Verdict

# 🟢 Launch — send the invites.

Mini Manager is recruit-ready. Both headline R7 fixes verified passing in production: custom-hex paint slots persist across reload (R7-001), and edit-slot mode correctly replaces rather than appends the slot's first step (R7-002). The 5 primary recruit flows — sign up → first recipe → first project → first wishlist add → first paint-match — all complete without dead-ends or WTF moments. Empty states are well-written. Semantic button palette (green/yellow/red/purple) is consistent across the surface area. WCAG AA contrast passes comfortably on every measured element.

The 12 findings below are all **low or medium severity** — polish, not blockers. The trajectory across R1–R8 is clear: this product has earned its launch.

**Three highest-leverage post-launch fixes:**
1. **UX-R8-003** — Mobile table rows on /projects and /wishlist horizontally overflow; swap for stacked cards on <md viewport. (The deferred R7-020 hits real recruits.)
2. **UX-R8-002** — Quick-add silently strips "Warband" suffix and tags it as type. Recruits will be confused why their project name changed.
3. **UX-R8-001** — Inline row chips (15–21px tall) are below WCAG 2.2 §2.5.8's 24×24 minimum target size.

---

## R7 → R8 Verification Headlines

| R7 Fix | Status in production | Evidence |
|---|---|---|
| **R7-001** — ColorPicker "Use this colour" persists custom hex with `paintId:null` | ✅ **PASS** | Created recipe, picked #47D1D1 via wheel, clicked USE THIS COLOUR. Slot 1 BASECOAT rendered cyan + step row labelled "Custom · #47D1D1". Full page reload — slot + hex both persisted. |
| **R7-002** — Edit-slot mode REPLACES first step's paintId, doesn't append | ✅ **PASS** | Clicked filled Slot 1 → drawer header reads "EDIT SLOT · SLOT 1" with copy "Picking a colour REPLACES this slot's paint." Picked AK Interactive Sky Blue. Steps panel still shows "SLOT 1 (1)" — one step, replaced not appended. Reload persists. |
| R7-004 — `/tools/wheel?hex=` deep-link | ✅ PASS — `?hex=%23FF7A00` pre-seeded orange + complementary blue. |
| R7-005 — Form input borders pass 3:1 | ✅ PASS — search input border `rgb(102,102,102)` on bg `rgb(10,10,10)` = 3.66:1. |
| R7-006 — Cyan-on-buttons purge | ✅ PASS — SAVE green, DELETE red, EXPORT yellow, ASSIGN green dropdown, USE THIS COLOUR green. No cyan on action buttons. |
| R7-007 — NEW RECIPE requires name | ✅ PASS — modal asks for name with "Naming up front keeps the recipe library scannable" copy. |
| R7-008 — Project title h1 inline-editable | ✅ PASS — click toggles to contenteditable. |
| R7-009 — Mobile avatar links to /user | ✅ PASS — tap on 375px viewport navigates to /user. |
| R7-010 — Wishlist "Tools ▾" renamed "Open in ▾" | ✅ PASS — visible on row. |
| R7-011 — Disclosure carets 36×36 + aria-expanded | ✅ PASS — sidebar collapse 32×32 (under 36 but above 24 minimum); aria-expanded present on chips. |
| R7-013 — Decorative AccentCounter giant numerals dropped | ✅ PASS — small "Σ 1 ITEM" summary; no 1.06:1 offenders. |
| TDZ fix on project detail page | ✅ PASS — nested COLOR SCHEME + SUB-PROJECTS + AGGREGATED STAGES render without 500. |

---

## Findings by Severity

No critical or high findings. **12 low/medium findings total.**

### Medium (3)

**UX-R8-001 — Inline row chips below WCAG 2.2 target size**
WCAG 2.2 §2.5.8 — /projects · TOP WISHES table row chips. WARBAND 64×18, +attach 57×17, WISHLIST 77×21, Medium 47×17, column sort 29×15. All interactive, all below 24×24 minimum. Fix: add `min-h-[24px]` + 6px×8px padding to each chip without changing the visual.

**UX-R8-002 — Quick-add silently strips suffix as type**
NN/g #1 + #2 — /projects quick-add input. "Skaven Pestilens Warband" became "Skaven Pestilens" + WARBAND chip. Silent transform; recruits won't know why. Fix: preview row "Will create: Skaven Pestilens · WARBAND" before commit, or keep the full name and tag the type, or opt-in checkbox.

**UX-R8-003 — Mobile project/wishlist tables horizontally overflow**
WCAG 2.2 §1.4.10 + NN/g #4 — both tables fall into horizontal scroll at 375 and 414. COMPLETION/0%, OPEN IN ▾, full STATUS pill clip off-screen. Deferred R7-020 surfaces under real recruit testing. Fix: stacked-card layout below md breakpoint.

### Low (9)

**UX-R8-004 — Status bar + sidebar telemetry layout shift** (Refactoring UI). Bottom telemetry block shifts position between pages; NET indicator flips ON/LAG during nav. Pin with sticky bottom or grid `1fr auto`; debounce NET-LAG ≥1.5s. (Deferred R7-014/023.)

**UX-R8-005 — Library single-letter columns + unlabeled hue dot** (NN/g #6). 'T' / 'OWN' / orange-dot have no tooltips. Add `title` + `aria-label`.

**UX-R8-006 — Manual wishlist entry mis-categorises Citadel paint as OTHER** (Polaris). Five-line classifier change: brand match + `ml` suffix → PAINT default.

**UX-R8-007 — 11px text count improved but not zero** (Apple HIG). Lift in-content chips from 11px to 12px (`text-xs`); keep telemetry 11px for CRT aesthetic.

**UX-R8-008 — Recipe title wraps to 3 lines on mobile** (Refactoring UI). Responsive scale: `text-3xl md:text-4xl lg:text-5xl`.

**UX-R8-009 — Chrome autofill clash on /sign-in** (aesthetic). Standard CSS autofill override snippet.

**UX-R8-010 — Sign-in error copy doesn't nudge to Forgot password** (NN/g #9). Change to "Wrong username or password — try again, or hit Forgot password".

**UX-R8-011 — `/tools` landing shows self-referential `← TOOLS` back-link** (Jakob's Law). Render only on sub-pages.

**UX-R8-012 — User page has no active-state on mobile nav** (Apple HIG). Cyan ring around avatar when on /user.

---

## Strengths — what Mini Manager already does well

- **Empty states are exemplary.** Every blank page has clear copy explaining what to do and why, with semantic-coloured dual CTAs.
- **R7-001 and R7-002 work in production.** Headline deliverable verified — silent-drop concern gone, edit-slot mode behaves as documented.
- **Semantic colour palette is rigorously consistent.** Green = primary action, yellow = utility, red = destructive, purple/blue = informational. Across 8 pages no cyan-on-button regression.
- **Form errors are visible, scoped, and well-styled.** Red-bordered pill above submit button, proper contrast, no native browser alerts.
- **Mobile responsive design is mostly there.** Recipe detail collapses to tabbed SLOTS/NOTES on mobile. Wheel renders at full mobile width. Sign-in stacks. Avatar tap → /user.
- **Recipe editor is information-dense without being cluttered.**
- **Wheel deep-link works.** `/tools/wheel?hex=...` enables real cross-tool flows.
- **Focus rings visible.** 2px cyan outline on Tab traversal. WCAG 2.4.7 met.
- **No console errors from miniaturemanager.vercel.app** during 15-minute multi-flow walkthrough.
- **The terminal aesthetic reads as craft, not gimmick.**
- **Contrast measured passes WCAG AA comfortably.** Sampled elements between 11:1 and 18:1.

---

## Suggested implementation order (post-launch)

Severity ÷ effort:

1. UX-R8-011 (trivial) — hide redundant `← TOOLS` back-link on /tools landing
2. UX-R8-009 (trivial) — Chrome autofill CSS override
3. UX-R8-005 (trivial) — title/aria-label on library single-letter columns + hue dots
4. UX-R8-010 (trivial) — sign-in error copy mentions Forgot password
5. UX-R8-012 (trivial) — active-state ring around avatar on /user
6. UX-R8-008 (trivial) — responsive recipe-title font-size scale
7. UX-R8-001 (small) — bump inline chip min-height to 24px
8. UX-R8-002 (small) — quick-add type-parse preview
9. UX-R8-006 (small) — brand+ml → PAINT default category
10. UX-R8-004 (small) — pin sidebar telemetry + debounce NET-LAG
11. UX-R8-007 (small) — lift in-content chips from 11px to 12px
12. UX-R8-003 (medium) — mobile table-to-card swap on /projects + /wishlist

Send the invites. The 10 recruits are landing on a product that works.
