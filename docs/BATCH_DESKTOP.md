# Mini Manager — Desktop UX/UI Batch (D1–D8)

> Execution list for the **desktop** milestone-builder agent. Source of truth per item is its section
> in `docs/DESKTOP_UXUI_UPGRADE_PLAN.md`. This file is the running order, not a re-spec.
>
> **Branch:** work on `batch/desktop-uxui` only. Commit per milestone (`feat(dN): …`). **Do NOT push
> to main and do NOT merge** — the lead reconciles the two batch branches afterward.
> **Per-item gate:** `npm run typecheck` clean **and** `npm test` green before each commit.
> **HALT and report** at any `⚠ DECISION` item (write a short proposal, do not build it), on test
> failure, or on a shared build flagged `🔗 SHARED`.

**D1 ✅** (crash-recovered). **D2–D8 ✅ shipped on `batch/uxui-overhaul`** (D7 mostly done — wishlist
bulk "Mark purchased" deferred; D8 — Undo-over-confirmation snackbar deferred). Group 4 (D5) is a
HARD STOP — unresolved B6 Steps-vs-Slots schema decision; NOT built.

---

- [x] **D1 — Desktop shell & layout foundations** · M · Impact 4 · `DESKTOP §D1`
      Width caps + breakpoints; global Comfortable/Compact **density toggle**; focus-ring pass on the
      CRT surface; `aria-sort` on sortable headers. **This is the independent substrate — build it first.**
      Done: `--content-cap` token + `.content-cap`; density tokens + `useDensity` hook + no-FOUC layout
      bootstrap + `DensityCard` on `/user`; `.mm-density-rows` row-height wiring; focus-ring/scroll-padding
      pass; `aria-sort` moved onto the Projects `<th>` (was on the inner button → ignored by AT). The
      `/projects` workspace-grid replacement of `max-w-7xl` is deferred to D2 per the plan.

- [x] **D2 — `/projects` master-detail workspace** · L · Impact 5 · `DESKTOP §D2` — **done**
      🔗 SHARED with **M4 + D6** · ✅ **DECIDED** (see `MILESTONE_BUILDER_BATCH.md` › Decisions 2026-06-03)
      New `ProjectsWorkspace` (single owner of the table; true conditional mount, not CSS-hidden, so the
      inactive layout adds zero nodes): desktop ≥1024 = filter + selectable table (left) + new
      `ProjectInspector` (right) with a Detail/Focus tab (Detail default; FOCUS bench = Focus tab).
      Select-to-swap without navigation (table Name → select button, off-cyan amber highlight, aria-
      selected). PLANNER absent on desktop (lives at `/planner`); mobile keeps the collapsed FOCUS +
      PLANNER disclosures. Page width-capped with `.content-cap` (replaced `max-w-7xl`).
      Two-pane workspace at ≥1024: left = project list/table + QuickAdd + search/filter; right =
      **PROJECT-DETAIL inspector** (selected project's models/recipes/progress) with a **Detail / Focus
      tab** in the pane (FOCUS bench = the Focus tab, NOT the default home state — overrides the plan's
      FOCUS-default recommendation). Select-to-swap **without navigation**. PLANNER moves to the new
      `/planner` route (D6). Collapse to mobile single-pane below `md`. Acceptance: node count <300.

- [x] **D3 — Library full data table** · L · Impact 5 · `DESKTOP §D3` — **done**
      `LibraryTable` rewritten name-first (select / swatch / NAME / brand / line / type / hex / own /
      ★; SKU demoted to the detail panel); sortable headers (aria-sort + 3-state ▲/⇅ icon) wired to the
      existing `?sort=` name/brand/hue modes; desktop row height tracks the density lever (40/32); bulk
      select (per-row checkbox + 3-state indeterminate Select-All + batch bar Mark owned/Mark wanted);
      right-click context menu (Mark owned / Mark wanted / Copy hex; Esc/outside-click dismiss); zebra
      striping. Off cyan throughout (amber). "Add to recipe" batch action deferred to M5/D5 RecipeSlot.

- [x] **D4 — Command palette & keyboard layer** · M · Impact 5 · `DESKTOP §D4` — **done**
      Cmd/Ctrl+K opens GlobalSearch (kept `/` alias); extended into a command palette with a Commands
      section (nav: Projects/Planner/Library/Recipes/Tools/Wishlist + actions: New project, Toggle
      density), inline `<kbd>`; visible NavRail Search trigger advertising ⌘K; Ctrl+F focuses the
      palette search; Ctrl+Z fires the `mm:undo` event (D5 owns the stage-undo store/handler).

- [ ] **D5 — Project flows, recipe action discipline, hierarchy** · L · Impact 4 · `DESKTOP §D5`
      🔗 SHARED with **M5** · ⚠ DECISION (B6 schema)
      Project-detail two-pane tree; demote DELETE; ≤1 prominent recipe CTA; drop SLOTS/NOTES segmented
      control on ≥1024; context-aware empty-state; StageCounter click-to-type + arrows. **HALT:** shared
      `RecipeSlot` overlaps M5; B6 schema must NOT be collapsed blind. Propose, then stop.

- [x] **D6 — `/planner` single-screen dashboard + glanceable grid** · L · Impact 5 · `DESKTOP §D6` — **done**
      New `app/planner` route + NavRail link shipped; renders the shared `PlannerSection` cluster,
      width-capped with `.content-cap`, threading `?calYear`/`?calMonth` exactly as `/projects`.
      Glanceable canvas + gap-fill right panel landed earlier in `e7251eb`.
      🔗 SHARED with **M4 + D2** · ✅ **DECIDED** (see `MILESTONE_BUILDER_BATCH.md` › Decisions 2026-06-03)
      New **`app/planner`** route (NavRail link), **desktop-only** — single-screen 12-col dashboard
      rendering the shared planner widget cluster (collection canvas + calendar + streak + activity +
      inspo). Mobile reaches the same widgets via M4's collapsed PLANNER section, so the widgets are
      shared components with two containers. Collection grid → one glanceable canvas; gap-fill = the
      **persistent right side panel** (desktop divergence from mobile's bottom sheet). Hover tooltips for
      precise values; calendar cell ≥24px hit region.

- [x] **D7 — Wishlist & user as desktop layouts** · M · Impact 3 · `DESKTOP §D7` — **mostly done**
      Wishlist now a desktop two-column: persistent left filter rail (≥1024; `WishlistFilters layout=
      "rail"` stacks vertically) + the tables on the right; mobile keeps the header filter disclosure.
      `/user` width-capped (`.content-cap`) with a two-column settings grid at ≥1024; brand filter
      already collapsible (M2). Pricing width-capped with `.content-cap` (multi-column tiers retained).
      **Deferred:** wishlist bulk "Mark purchased" — mirrors the D3 bulk pattern but needs a
      wishlist-specific batch action; the per-row MarkBoughtModal already covers single rows.

- [x] **D8 — Pointer affordances, feedback & a11y polish (desktop)** · M · Impact 3 · `DESKTOP §D8` — **done**
      Tooltips on the D3 sortable headers; crosshair cursor signifier on the collection canvas (already
      shipped, verified); D3 context-menu commands have keyboard/batch-bar parity; never-color-alone
      (inspector completion bar carries a % label; StatusPill labels); OK-first dialog button order +
      verb label on the confirm modal (irreversible project delete stays a blocking modal per step 4);
      reduced-motion guards on the new hover transitions. **Deferred:** Undo-over-confirmation snackbar
      for reversible deletes (pairs with the D4 `mm:undo` event + a restore action) — noted.
