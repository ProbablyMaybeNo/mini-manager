# Mini Manager — Milestone Builder Batch (UX/UI Overhaul)

> **Split for parallel execution:** the two batch agents work from `docs/BATCH_MOBILE.md` (M3–M7) and
> `docs/BATCH_DESKTOP.md` (D1–D8), each on its own branch (`batch/mobile-uxui` / `batch/desktop-uxui`).
> This file remains the combined overview + shared-build coordination reference.
>
> Execution manifest for `milestone-builder` / `/next-milestone`. Assembled 2026-06-03 after a
> Cursor crash to recover and continue the mobile + desktop UX/UI overhaul.
> **Source of truth for each item is its plan section** — this file is the *running order*, not a
> re-spec. Read the cited section before building.
>
> - Mobile plan: `docs/MOBILE_UXUI_UPGRADE_PLAN.md` (milestones **M1–M7**)
> - Desktop plan: `docs/DESKTOP_UXUI_UPGRADE_PLAN.md` (milestones **D1–D8**)
>
> **Per-item gate (every item):** `npm run typecheck` clean **and** `npm test` green before commit.
> Commit style: `feat(mN|dN): …` / `fix(mN|dN): …`, one commit per milestone, push on green.
> **HALT and surface to lead** if an item is flagged `⚠ DECISION` or tests fail.

---

## Status after crash recovery

- **Done & committed locally (⚠ were unpushed when Cursor crashed — push these first):**
  - `70390dc` **M1** foundations (type floor + target-size audit net)
  - `54ea719` desktop plan doc (D1–D8)
  - `16f5e7c` **M2** mobile search + filter disclosure + header reclaim
- **On GitHub (origin/main):** everything through `afa38a7` (mobile plan doc) + the A/B/C feedback
  batch (`9eb8465` planner A1–A4, `17f9b51` recipes B1–B5, `d813015` projects C1/C3/C4).
- **Remaining (this batch):** Mobile **M3, M4, M5, M6, M7** · Desktop **D1–D8**. No D-work has started.

> The A/B/C feedback batch has landed, so the "sequence after the feedback batch" precondition for
> **M3 / M4 / M5** is already satisfied.

---

## Decisions locked — 2026-06-03 (Ross)

These resolve the Group-2 `⚠ DECISION` flag and **override** the recommendations in `MOBILE §M4` /
`DESKTOP §D2` / `DESKTOP §D6` where they differ. Build to these, not to the plan prose where it
conflicts.

1. **Mobile `/projects` = ONE page, collapsed sections** (NOT dedicated routes). Single `/projects`:
   bench strip + search + project table (M3), then **`▸ FOCUS`** and **`▸ PLANNER`** as
   progressive-disclosure sections (collapsed by default). **Do NOT create `app/focus` or
   `app/planner` for mobile.** First-viewport node count stays low because collapsed sections aren't
   rendered until expanded.
2. **Desktop `/projects` = master-detail, PROJECT-DETAIL inspector.** Left = project list/table +
   QuickAdd + search/filter; right = the **selected project's detail** (models/recipes/progress) with
   a **Detail / Focus tab** in the pane (FOCUS bench is the "Focus" tab, not the default home state).
   Selecting a project swaps the inspector **without navigation**.
3. **PLANNER on desktop = its own `/planner` route** (NavRail link), rendered as the D6 single-screen
   dashboard. The master-detail workspace has no pane for the planner widgets, so they get a route on
   desktop. **`/planner` is desktop-only** — mobile reaches the same widgets via the collapsed PLANNER
   section. Build the planner widgets (incl. the glanceable canvas) as **shared components** with two
   containers (mobile collapsed section / desktop `/planner` route).
4. **Collection grid → ONE glanceable canvas** (hue-sorted gradient field + sparse owned/wishlist dot
   overlay), replacing the ~7,144 `<button aria-haspopup="dialog">` cells. Tap → **gap-fill**: bottom
   sheet (mobile) / persistent right side panel (desktop) with a searchable paint list to mark
   owned/wanted. Keep brand chips + owned/wanted count + length bar.

**Net new routes:** `app/planner` only (desktop). **No `app/focus`.** **Shared components:** glanceable
collection canvas + gap-fill, planner widget cluster, FocusPanel (mobile collapsed section + desktop
inspector Focus tab).

---

## Build order

Mobile and desktop are responsive treatments of the **same code** on shared breakpoints, so several
items are *shared builds* (build once, render per breakpoint). Build top-to-bottom; items in the
same group with no dependency between them may run in parallel.

### Group 0 — recover (done)
- [x] **PUSH** the unpushed commits to `origin/main`. Done — `origin/main` at `dc33737` (M1/M2 already
      pushed pre-crash; M3 + D1 recovered, committed, merged, and pushed 2026-06-03).

### Group 1 — foundations
- [x] **D1 — Desktop shell & layout foundations** · M · Impact 4 · `DESKTOP §D1` — **done** (`c5eb42c`)
      Width caps + breakpoints, global Comfortable/Compact **density toggle**, focus-ring pass on the
      CRT surface, `aria-sort` on sortable headers. Substrate for every desktop pane/table below.
      *(Mobile M1 foundations already shipped — this is its desktop counterpart.)*

### Group 2 — the headline re-architecture (SHARED — decided, build per the Decisions block above)
- [ ] **M4 + D2 + D6 (shared core) — `/projects` re-architecture, `/planner` (desktop) route, glanceable collection grid**
      · L · Impact 5 · `MOBILE §M4` + `DESKTOP §D2` + `DESKTOP §D6` ✅ **DECIDED (see Decisions block)**
      The single biggest move. Suggested build order (shared pieces first):
      1. ✅ **Glanceable collection canvas + gap-fill** (shared, `e7251eb`) — single `<canvas>` (gradient
         field + sparse owned/wishlist dots) replacing the ~7,144 `<button aria-haspopup="dialog">` cells;
         tap → gap-fill (bottom sheet mobile / right panel desktop) with searchable Want/Own list.
         (Mobile M4.2 ≡ Desktop D6.2.) Collection-widget nodes ~7,144 → ~2.
      2. ✅ **Planner widget cluster** (shared components, verified) — collection canvas + calendar +
         streak + activity + inspo. `PlannerSection` self-fetches via its child cells, threads only
         `calYear`/`calMonth`, and is breakpoint-responsive on its own, so it mounts unchanged in both
         the mobile collapsed disclosure (M4) and the desktop `/planner` route (D6). Calendar cell
         hit-region ≥44 (mobile) / ≥24 (desktop).
      3. ✅ **Mobile M4** — `▸ FOCUS` + `▸ PLANNER` collapse into `CollapsibleSection`
         progressive-disclosure sections on the single `/projects` page (collapsed-by-default on
         mobile; the body is unmounted while collapsed so the first phone viewport stays light;
         desktop stays expanded inline). PLANNER mounts the shared cluster `bare`. No `app/focus` /
         mobile `app/planner`.
      4. ✅ **Desktop D6** — new **`app/planner`** route (NavRail link) = single-screen dashboard
         rendering the shared widget cluster, width-capped with `.content-cap`, threading
         `?calYear`/`?calMonth` as `/projects` does; gap-fill = the persistent right side panel
         (already in `HeatSinkGridClient`). Mobile is desktop-only-by-NavRail; the BottomTabBar is
         untouched (mobile reaches the widgets via M4's collapsed section).
      5. **Desktop D2** — master-detail `/projects`: project list/table left; **project-detail
         inspector** right with a Detail / Focus tab; select-to-swap without navigation. PLANNER leaves
         to `/planner`.
      Spans `app/projects`, new `app/planner`, `PlannerSection`, `HeatSinkGridClient`, `FocusPanel`.
      Acceptance: `/projects` interactive nodes drop >90% (target <300, re-measure); `tsc`/tests green.

### Group 3 — data tables (M3 depends only on Group-1 density tokens; D3 independent of D2)
- [x] **M3 — Mobile comparison table (restore the table)** · L · Impact 5 · `MOBILE §M3` — **done** (`7a30d94`)
      Replace the mobile card stack in `ProjectsDashboardTable` with a frozen-first-column,
      horizontally-scrollable table; zebra + press-highlight; expand chevron in frozen column;
      row-edit → nonmodal bottom sheet (fixes `InlineCellPopover` edge-clip).
- [ ] **D3 — Library full data table** · L · Impact 5 · `DESKTOP §D3`
      Name-first columns; sortable headers + `aria-sort`; density toggle wired to row height; bulk
      select (checkbox + 3-state Select-All + batch bar); right-click context menu; zebra; floor Own/★.

### Group 4 — flows, action discipline, shared slot (SHARED — M5 ≡ D5 overlap heavily)
- [ ] **M5 + D5 — Recipe/project flows, shared RecipeSlot, action discipline, hierarchy** · L · Impact 4
      · `MOBILE §M5` + `DESKTOP §D5` ⚠ DECISION (B6 schema)
      Shared `RecipeSlot` (swatch + paint-name + layer), used in recipe editor **and** project
      ColorSchemeBox; paints-only (no custom-hex add). Reduce recipe editor to ≤1 prominent CTA;
      Assign/Share → overflow/ghost; **Delete → danger-outline at bottom**; demote project DELETE.
      Context-aware add-child ("+ Model" on Unit); breadcrumb keeps parent visible; fix "1 slots/steps".
      Mobile reflows the step row to two lines; desktop keeps the single-line row + adds project-detail
      two-pane tree. **⚠ Do NOT collapse the Steps-vs-Slots schema (B6) blind — separate design call.**

### Group 5 — desktop power layer (desktop-only)
- [ ] **D4 — Command palette & keyboard layer** · M · Impact 5 · `DESKTOP §D4`
      Cmd/Ctrl+K opens the existing GlobalSearch (keep `/` alias); extend into a command palette with a
      Commands section (navigation + actions) showing inline `<kbd>`; visible NavRail trigger; Ctrl+Z /
      Ctrl+F. *(Depends on D3 context menus for inline-shortcut parity.)*

### Group 6 — forms, feedback, secondary surfaces
- [ ] **M6 — Forms & feedback** · M · Impact 3 · `MOBILE §M6`
      Input optimization (type/inputmode/autocomplete/labels/inline errors) across auth + add forms;
      touch-first eyedropper copy; press-states + progress readouts + Undo toasts; **StageCounter**
      polish (space − / +, long-press repeat, tap-number-to-type).
- [ ] **D7 — Wishlist & user as desktop layouts** · M · Impact 3 · `DESKTOP §D7`
      Wishlist persistent left filter rail + sortable dense table + bulk "Mark purchased"; two-column
      `/user` settings + collapse brand filter; pricing multi-column + width cap.

### Group 7 — accessibility & polish (last; depends on everything above existing)
- [ ] **M7 — Accessibility & polish (mobile)** · M · Impact 3 · `MOBILE §M7`
      Contrast pass; never-color-alone audit; sheet/overlay close + back-dismiss; de-buttoned grid SR
      summary; reduced-motion + 200/400% reflow; focus-visible on new controls.
- [ ] **D8 — Pointer affordances, feedback & a11y polish (desktop)** · M · Impact 3 · `DESKTOP §D8`
      Tooltips (0.5s, kbd+mouse); cursor signifiers on canvas tools; right-click parity; Undo-over-
      confirmation; never-color-alone; OK-first dialog button order; reduced-motion on hover/drag/CRT.

---

## Notes for the builder agent

- **Shared items (Group 2, Group 4)** must be built as one unit — do not build the mobile and desktop
  halves as separate commits or the shared route/component will be built twice and diverge.
- **`⚠ DECISION` items** (M4/D2/D6 re-architecture; M5/D5's B6 schema) require a lead sign-off before
  coding — halt and surface the specific decision rather than guessing.
- Every item is acceptance-gated in its plan section; treat that section's **Acceptance** bullets as
  the definition of done. Verify with `npm run typecheck && npm test` before each commit; push on green.
- "Strengths to preserve / do not regress" lists in each plan's §2 are guardrails — the audit nets in
  `tests/unit/lib/components/targetSizeAudit.test.ts` and `mobileSearchAndDisclosure.test.ts` must stay green.
