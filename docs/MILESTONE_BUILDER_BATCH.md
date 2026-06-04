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
- [x] **M4 + D2 + D6 (shared core) — `/projects` re-architecture, `/planner` (desktop) route, glanceable collection grid** — **done** (all 5 sub-steps)
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
      5. ✅ **Desktop D2** — master-detail `/projects` via `ProjectsWorkspace` (single owner of the
         table; conditional mount per breakpoint): project list/table + filter left; **ProjectInspector**
         right with a Detail (default) / Focus tab; select-to-swap without navigation (off-cyan amber
         highlight). PLANNER absent on desktop (lives at `/planner`); mobile keeps collapsed sections.
         Page width-capped with `.content-cap`.
      Spans `app/projects`, new `app/planner`, `PlannerSection`, `HeatSinkGridClient`, `FocusPanel`.
      Acceptance: `/projects` interactive nodes drop >90% (target <300, re-measure); `tsc`/tests green.

### Group 3 — data tables (M3 depends only on Group-1 density tokens; D3 independent of D2)
- [x] **M3 — Mobile comparison table (restore the table)** · L · Impact 5 · `MOBILE §M3` — **done** (`7a30d94`)
      Replace the mobile card stack in `ProjectsDashboardTable` with a frozen-first-column,
      horizontally-scrollable table; zebra + press-highlight; expand chevron in frozen column;
      row-edit → nonmodal bottom sheet (fixes `InlineCellPopover` edge-clip).
- [x] **D3 — Library full data table** · L · Impact 5 · `DESKTOP §D3` — **done**
      Name-first columns; sortable headers + `aria-sort` (name/brand/hue); density-driven row height
      (40/32); bulk select (per-row checkbox + 3-state Select-All + batch bar); right-click context
      menu (Mark owned/wanted/Copy hex); zebra. Off cyan (amber). "Add to recipe" deferred to M5/D5.

### Group 4 — flows, action discipline, shared slot (SHARED — M5 ≡ D5)
✅ **B6 DECIDED 2026-06-04 (Ross): UNIFY + FLATTEN.** One concept = **"Recipe"** (the project-side
"color scheme" is just a Recipe rendered in the project box — retire the separate label). A recipe is a
**flat ordered list of slots**; each slot = **ONE paint (paintId | customColorHex) + its layer
(`technique`)** — **pure-flat, no zone/area name, no separate Steps box**. This supersedes the old
two-level zone→step model.

Built in **reviewable stages** (schema migration = one-way, so staged + gated):
- [x] **Stage 1** (`380ba20`) — flat `recipe_slot` table + migration 0016 (backfill from zone⋈step,
      flatten 0-based per recipe; `step.id` preserved as `slot.id`; old tables kept). Validated.
- [x] **Stage 2** (`c88781d`) — slot API: `getRecipeWithSlots`, `getSlotWithOwnerCheck`; actions
      `addSlot`/`updateSlot`/`deleteSlot`/`reorderSlots` (recipeSlots.ts). 16 integration tests.
- [x] **Stage 3** — component cutover: `ZoneList` + `StepList`/`StepRow` → one `SlotList`; simplify
      `RecipeEditorClient` (no zones/steps, no Steps box); `ProjectColorSchemeBox` renders the same flat
      slot list; share page + FOCUS panel read slots; retire "color scheme" labels → "Recipe". Read via
      `getRecipeWithSlots`; mutate via the recipeSlots actions. Paints-only (no custom-hex add path).
- [x] **Stage 4** — cleanup + D5 leftovers: re-point `recipe_step_completion` → `recipe_slot`
      (slot.id == old step.id, preserved), drop `recipe_zone`/`recipe_step` + dead zone/step
      queries/actions (migration 0017). Then the D5 polish: ≤1 prominent recipe CTA (Assign/Share →
      overflow/ghost; Delete → danger-outline at bottom), demote project DELETE, "+ Model" on Unit,
      breadcrumb keeps parent, fix "1 slots/steps" pluralization, wire the deferred Ctrl+Z/undo store.

### Group 5 — desktop power layer (desktop-only)
- [x] **D4 — Command palette & keyboard layer** · M · Impact 5 · `DESKTOP §D4` — **done**
      Cmd/Ctrl+K opens GlobalSearch (kept `/` alias); Commands section (nav + New project + Toggle
      density) with inline `<kbd>`; visible NavRail Search trigger (⌘K); Ctrl+F focuses the palette;
      Ctrl+Z fires `mm:undo` (D5 owns the undo store).

### Group 6 — forms, feedback, secondary surfaces
- [x] **M6 — Forms & feedback** · M · Impact 3 · `MOBILE §M6` — **done**
      Recovery-email input optimization (email type/inputmode/autocomplete + label-above + inline
      aria-described error); **StageCounter** polish: − / + at opposite ends, long-press repeat,
      tap-number-to-type via a new cascade-validated `setCounter` action. Toast/press-states pre-existing.
- [x] **D7 — Wishlist & user as desktop layouts** · M · Impact 3 · `DESKTOP §D7` — **mostly done**
      Wishlist persistent left filter rail (≥1024, `layout="rail"`) + tables right; two-column `/user`
      settings (`.content-cap` + `lg:grid-cols-2`, brand filter already collapsible); pricing
      width-capped. **Deferred:** wishlist bulk "Mark purchased" (needs a wishlist batch action).

### Group 7 — accessibility & polish (last; depends on everything above existing)
- [x] **M7 — Accessibility & polish (mobile)** · M · Impact 3 · `MOBILE §M7` — **done**
      Command palette: visible Close (×) + Back-dismiss (+ click-outside/Esc); collection canvas SR
      summary verified (role=img + aria-label); reduced-motion on the disclosure chevron; focus-visible
      rings on the new controls (NavRail search, inspector tabs, disclosure toggle, palette Close).
- [x] **D8 — Pointer affordances, feedback & a11y polish (desktop)** · M · Impact 3 · `DESKTOP §D8` — **done**
      Sortable-header tooltips; canvas crosshair (verified); context-menu keyboard parity; never-color-
      alone (% label + StatusPill); OK-first verb-labelled confirm modal; reduced-motion on new hovers.
      **Deferred:** Undo-over-confirmation snackbar for reversible deletes (pairs with D4 `mm:undo`).

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
