# Mini Manager — Desktop UX/UI Batch (D1–D8)

> Execution list for the **desktop** milestone-builder agent. Source of truth per item is its section
> in `docs/DESKTOP_UXUI_UPGRADE_PLAN.md`. This file is the running order, not a re-spec.
>
> **Branch:** work on `batch/desktop-uxui` only. Commit per milestone (`feat(dN): …`). **Do NOT push
> to main and do NOT merge** — the lead reconciles the two batch branches afterward.
> **Per-item gate:** `npm run typecheck` clean **and** `npm test` green before each commit.
> **HALT and report** at any `⚠ DECISION` item (write a short proposal, do not build it), on test
> failure, or on a shared build flagged `🔗 SHARED`.

**D1 ✅** (crash-recovered). Remaining: D2–D8.

---

- [x] **D1 — Desktop shell & layout foundations** · M · Impact 4 · `DESKTOP §D1`
      Width caps + breakpoints; global Comfortable/Compact **density toggle**; focus-ring pass on the
      CRT surface; `aria-sort` on sortable headers. **This is the independent substrate — build it first.**
      Done: `--content-cap` token + `.content-cap`; density tokens + `useDensity` hook + no-FOUC layout
      bootstrap + `DensityCard` on `/user`; `.mm-density-rows` row-height wiring; focus-ring/scroll-padding
      pass; `aria-sort` moved onto the Projects `<th>` (was on the inner button → ignored by AT). The
      `/projects` workspace-grid replacement of `max-w-7xl` is deferred to D2 per the plan.

- [ ] **D2 — `/projects` master-detail workspace** · L · Impact 5 · `DESKTOP §D2`
      🔗 SHARED with **M4 + D6** · ⚠ DECISION
      List-left + FOCUS-inspector-right workspace; PLANNER moves to `/planner`. **HALT:** the `/projects`
      re-architecture + `/planner` route are shared with mobile M4 / desktop D6 and must be built once,
      jointly. Write a proposal (plan recommends master-detail with FOCUS in-pane) and stop.

- [ ] **D3 — Library full data table** · L · Impact 5 · `DESKTOP §D3`
      Name-first columns; sortable headers + `aria-sort`; density toggle wired to row height; bulk
      select (checkbox + 3-state Select-All + batch bar); right-click context menu; zebra; floor Own/★.
      Independent of D2 — can build after D1.

- [ ] **D4 — Command palette & keyboard layer** · M · Impact 5 · `DESKTOP §D4`
      Cmd/Ctrl+K → command palette (keep `/` alias); Commands section + inline `<kbd>`; visible NavRail
      trigger; Ctrl+Z / Ctrl+F. Pairs with D3 context menus for shortcut parity.

- [ ] **D5 — Project flows, recipe action discipline, hierarchy** · L · Impact 4 · `DESKTOP §D5`
      🔗 SHARED with **M5** · ⚠ DECISION (B6 schema)
      Project-detail two-pane tree; demote DELETE; ≤1 prominent recipe CTA; drop SLOTS/NOTES segmented
      control on ≥1024; context-aware empty-state; StageCounter click-to-type + arrows. **HALT:** shared
      `RecipeSlot` overlaps M5; B6 schema must NOT be collapsed blind. Propose, then stop.

- [ ] **D6 — `/planner` single-screen dashboard + glanceable grid** · L · Impact 5 · `DESKTOP §D6`
      🔗 SHARED with **M4 + D2** · ⚠ DECISION
      Built jointly with M4/D2 (shared `/planner` route + collection-grid rebuild; desktop renders the
      gap-fill as a right side panel). HALT — joint build.

- [ ] **D7 — Wishlist & user as desktop layouts** · M · Impact 3 · `DESKTOP §D7`
      Wishlist persistent filter rail + sortable dense table + bulk "Mark purchased"; two-column `/user`;
      pricing multi-column + width cap.

- [ ] **D8 — Pointer affordances, feedback & a11y polish (desktop)** · M · Impact 3 · `DESKTOP §D8`
      Tooltips (0.5s, kbd+mouse); cursor signifiers on canvas tools; right-click parity; Undo-over-
      confirmation; never-color-alone; OK-first dialog button order; reduced-motion on hover/drag/CRT.
