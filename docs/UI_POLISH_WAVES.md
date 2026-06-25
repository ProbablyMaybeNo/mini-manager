# UI Polish — Wave Plan (milestone-builder roadmap)

Consolidated from three UX audits (2026-06-24). Source-of-truth detail + screenshots live in:
- `mobile-ux-audit/findings.json` (MUX-*, compliance) + `mobile-ux-audit/shots/`
- `mobile-ux-audit/opportunities.json` (MOP-*, strategy) + `shots-strategic/`
- `ux-audit/desktop-production-opportunities.json` (DOP-*, desktop design) + `shots-desktop-prod/`

**How to run:** milestone-builder picks the next unchecked `- [ ]` item, implements to the project's conventions, runs `npm run typecheck` + the test suite, and commits/pushes per item if green. Work waves top-down. Items tagged **[ARCH — needs Ross]** are structural/design calls: milestone-builder should halt and surface a proposal rather than auto-implement.

**Guardrails:** strict TS, zero type errors; match neighboring patterns; no new deps without need; do NOT start a dev server while editing (shared `.next` corrupts). Branch: `redesign/project-panel` — commit/push here; do NOT merge to main (Ross reviews first).

---

## Wave 0 — Verify suspected bugs (do first; cheap, decides priority)
- [x] **DOP-010** — verified — not a bug: the typed name always persists. Every entry routes to `/recipes/new`, which pre-fills the name *value* as "Untitled recipe" (page.tsx `blankRecipe`); the editor binds `recipe.name` straight into `saveRecipe({ name })` → `createRecipe`/`updateRecipe` (both `name.min(1)`), so a typed name is never dropped. "Untitled recipe" only persists if the user never edits the default — expected, not a name-drop. (Minor UX nit, out of scope: that default could be a placeholder instead of a value.)
- [x] **DOP-004** — verified — not a bug (dev-fixture artifact): summary count and projects table share one source. `DashboardClient` computes `summary = deriveDashboardSummary(projects, …)` and passes the *same* `projects` array to `ProjectsTable`; both originate from `data.projects` (`buildProjectTree(listAllProjects(userId))`). `deriveDashboardSummary` is a pure fn on its argument — it does not read mock fixtures despite its file path. Any mismatch was the signed-out preview rendering pure fixtures. No real mismatch possible.

## Wave 1 — Quick comprehension & polish wins (trivial/small, high-confidence)
- [ ] **DOP-006** — Skip-safe welcome. Add a dismissible terminal-MOTD welcome card on the dashboard: one line on what the app is, 2–3 "start here" actions, and a "Take the tour" button that calls the existing `useTour().start()` (src/components/tour). Persist dismissal (reuse the tutorial-seen pattern or a small flag). Catches users who skip/never trigger the auto-tour. Acceptance: card shows for a user who hasn't dismissed it, relaunch button starts the tour, dismissal persists across reload.
- [x] **DOP-007a** — Renamed nav label "RECIPE" → "RECIPES" (src/components/shell/nav.ts MAIN_NAV; `key` stays `recipe`).
- [x] **DOP-007b** — Added `//`-comment-style descriptors via the existing `PageHeader` tagline on Library ("every paint on the market — mark what you own/want"), Collection ("only the pots & models you own"), Focus, Tools, Recipes. Single line each; reused PageHeader so no layout regression.
- [ ] **DOP-016 / MUX-013** — Fix the sidebar "N" glyph overlapping the "Report an Issue" / bottom nav region (src/components/shell). Verify with a live DOM probe (one auditor flagged it low-confidence). Acceptance: no overlap at desktop or 375px.
- [x] **MUX-009** — Added a contrast scrim + bold to the color-wheel hex caption (`captionScrim` in src/lib/color.ts → text-shadow halo opposite the chosen text tone) so the on-swatch hex stays AA-legible on saturated mid-tone reds where pure white/black alone dips under 4.5:1. Kept the YIQ `readableText` colour choice (its contract is unit-locked). Tests added in readableText.test.ts.
- [ ] **MUX-011** — Reserve space for the late block on /sign-in to cut CLS (0.089 → <0.1, ideally ~0). Acceptance: measured CLS improved, no visual regression.
- [x] **MOP-012** — Hid the "⤢ Open full page" inspector action below `md` (`hidden md:inline-flex`) in ProjectWorkspaceBody — the SlideOutPanel is `w-full` (full-bleed) under its `max-w-2xl` cap on mobile, so the action only earns its place on desktop where the panel is a capped side column.
- [x] **MUX-012** — verified — already handled: `next.config.ts` `redirects()` 308-permanent-redirects `/projects` → `/dashboard`, so the browser URL becomes `/dashboard` (no URL/title mismatch). No `(app)/projects/page.tsx` exists to shadow it, and no in-app `<Link>`/`push("/projects")` navigates there (only `revalidatePath("/projects")` no-ops). Audit predates the redirect. Full resource-list page remains DOP-017 (Wave 4, ARCH).

## Wave 2 — Mobile compliance fixes (touch targets, semantics, reflow)
- [ ] **MUX-003** — Planner calendar date cells + month chevrons to ≥44px hit area (currently `min-h-6 min-w-6`). Dashboard + inspector calendars (PlannerCalendar).
- [ ] **MUX-004** — Projects-table row-action buttons to ≥44px hit area + ≥8px gap from the row's own tap target.
- [ ] **MUX-007** — Sub-project tab buttons to ≥44px min-height, ≥8px gap (label+close share a tight cell). (ProjectPanelStack.tsx)
- [ ] **MUX-006** — Give sub-project tabs real tab semantics: `role=tablist/tab/tabpanel`, `aria-selected`, arrow-key nav, non-color active indicator.
- [ ] **MUX-008** — Fix 320px horizontal overflow on public landing/pricing (scrollWidth 356>320, likely the pixel-font H1 → `clamp()`/wrap).
- [ ] **MUX-010** — Add a thumb-reachable secondary dismiss to the inspector (currently only top-right ×); confirm Back/Esc close it.
- [ ] **MUX-005** — [ARCH — needs Ross] Move primary actions/nav into the bottom-third thumb zone per screen (overlaps the bottom-nav decision below).
- [ ] **MUX-002 / MOP-003** — [ARCH — needs Ross] Projects/dense tables: reflow to cards at <600px (or right-edge fade + frozen TITLE col + scroll cue). Decide the pattern before building.
- [ ] **MUX-001** — [ARCH — needs Ross] Persistent bottom nav (3–5 labelled items) <600px; rail ≥840px. Structural; propose before implementing.

## Wave 3 — The inspector keystone (DOP-001 + MOP-001/002/004/005 converge)
> Both audits flagged the project inspector as the #1 structural opportunity. Do the cheap stepping-stones first, then the big redesign as a deliberate ARCH task. This is the branch you're on.
- [ ] **MOP-002** — Sticky bottom action bar in the inspector; demote Archive/Duplicate/Delete to an overflow menu so the destructive verb leaves the thumb-rest zone. (Stepping stone; high value, medium effort.)
- [ ] **MOP-005 / M4 decision** — Replace the five always-expanded inspector sections with collapsed sections / a segmented tab rail (Sub-projects + Progress open by default). Matches the locked "mobile collapsed sections" decision.
- [ ] **DOP-002** — Two-up the inspector body on desktop (use the width instead of one narrow column).
- [ ] **MOP-004** — Sticky drill breadcrumb / back chip for sub-project tabs; ensure OS Back pops one tier, not the whole sheet.
- [ ] **MOP-001 / DOP-001** — [ARCH — needs Ross] The keystone: inspector → true bottom sheet on mobile (grab handle, swipe-down + fallback, peek, thumb-reachable close) AND desktop master-detail (stop dimming half the screen for a 672px column). Schedule deliberately; the items above fold into it.

## Wave 4 — Under-built pages catch up to the good ones
- [ ] **DOP-009** — Recipe list: add swatch-preview rows + a card view (currently a thin 4-col table, no color preview).
- [ ] **DOP-011** — Recipe editor: example/empty-state slot + live scheme preview.
- [ ] **DOP-012** — Collection: compact the two stacked full-height empty tables (side-by-side, swatch rows) instead of wasting the width.
- [ ] **DOP-008** — Library: add hover tooltips + clickable hue rail; propagate the color-map canvas pattern (the app's best surface) where it fits.
- [ ] **DOP-003** — Fill the dashboard's empty lower half with purposeful content (e.g. a "continue painting" tier) — page ends at ~55% viewport.
- [ ] **DOP-014** — [ARCH — needs Ross] Kill the app-wide ~270px right-gutter; pick one consistent grid intent across pages.
- [ ] **DOP-017** — [ARCH — needs Ross] Give projects a real resource-list page (sort/filter/bulk) for the power-user audience; `/projects` currently === dashboard.
- [ ] **DOP-005** — [ARCH — needs Ross] Untangle FOCUS vs PLANNER vs `/planner` naming + give the calendar a clear home. Naming/IA decision.
- [ ] **DOP-015** — Surface existing cross-feature bridges (Wheel→Recipe, Library→paint-pick) at the moment of need.
- [ ] **DOP-013** — Fill the Color-Wheel's lower-right void with more matches (hold the rest of the layout — it's already good).
- [ ] **MOP-011** — Stat strip: reflow the 4-up to 2×2 on mobile (overlap at 375px); keep the "N" mark off the action row.

## Wave 5 — Mobile delight & PWA (beyond-minimum)
- [ ] **MOP-007** — Optimistic swipe-to-progress / tally increment on PROGRESS rows with haptics (the most-repeated painter action) + visible button fallback (WCAG 2.5.7).
- [ ] **MOP-006** — Finish the PWA: apple meta tags, install nudge, offline paint-library caching for table-side use.
- [ ] **MOP-013** — Section-shaped skeletons + optimistic edits instead of "▸ Loading…" text.
- [ ] **MOP-008** — [ARCH — needs Ross] Context-aware bottom-right quick-add FAB (project/sub-project/recipe). FAB is a deliberate app-wide choice — confirm.
- [ ] **MOP-009** — Extend the Color-Wheel's direct-manipulation language to the other tools + recipe paint-picking.
- [ ] **MOP-010** — Register as a Web Share Target + clipboard-detect to extend the paste-first collection capture.

---

### Notes for the runner
- Waves 0–2 are largely autopilot (small, testable). Wave 3's keystone and every **[ARCH — needs Ross]** item should HALT with a short proposal — they're design decisions, not mechanical edits.
- After each item: `npm run typecheck` + `npm run test:unit` (+ integration where touched). Commit per item with a `fix(ux):`/`feat(ux):` message referencing the finding id (e.g. `fix(ux): raise color-wheel hex contrast to AA (MUX-009)`).
- Re-verify any positional/overlap claim with a live DOM probe before "fixing" it (the audits ran as webdrivers; a couple of findings are low-confidence).
