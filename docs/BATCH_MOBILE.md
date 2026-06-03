# Mini Manager — Mobile UX/UI Batch (M3–M7)

> Execution list for the **mobile** milestone-builder agent. Source of truth per item is its section
> in `docs/MOBILE_UXUI_UPGRADE_PLAN.md`. This file is the running order, not a re-spec.
>
> **Branch:** work on `batch/mobile-uxui` only. Commit per milestone (`feat(mN): …`). **Do NOT push
> to main and do NOT merge** — the lead reconciles the two batch branches afterward.
> **Per-item gate:** `npm run typecheck` clean **and** `npm test` green before each commit.
> **HALT and report** at any `⚠ DECISION` item (write a short proposal, do not build it), on test
> failure, or on a shared build flagged `🔗 SHARED`.

Done already (shipped + pushed): **M1 ✅**, **M2 ✅**.

---

- [ ] **M3 — Restore the comparison table (mobile)** · L · Impact 5 · `MOBILE §M3`
      Replace the mobile card stack in `ProjectsDashboardTable` with a frozen-first-column,
      horizontally-scrollable table; zebra + press-highlight; expand chevron in the frozen column;
      row-edit → nonmodal bottom sheet (fixes `InlineCellPopover` edge-clip). Feedback-batch precondition
      is satisfied. **This is the one independent mobile item — build it first.**

- [ ] **M4 — `/projects` split + glanceable collection grid** · L · Impact 5 · `MOBILE §M4`
      🔗 SHARED with **D2 + D6** · ⚠ DECISION
      Split `/projects` into `/projects` + `/focus` + `/planner` routes; collection grid → one
      glanceable element (not ~7,144 buttons); gap-fill bottom sheet. **HALT:** the `/planner` route and
      collection-grid rebuild are shared with desktop D6 and must be built once, jointly. Write a
      proposal (the plan recommends dedicated routes) and stop.

- [ ] **M5 — Recipe/project flows, shared RecipeSlot, action discipline** · L · Impact 4 · `MOBILE §M5`
      🔗 SHARED with **D5** · ⚠ DECISION (B6 schema)
      Shared `RecipeSlot`, ≤1 prominent CTA, demote DELETE, "+ Model" on Unit, two-line step row,
      breadcrumb parent, fix "1 slots/steps". **HALT:** the shared `RecipeSlot` component overlaps D5;
      B6 Steps-vs-Slots schema must NOT be collapsed blind. Propose, then stop.

- [ ] **M6 — Forms & feedback (mobile)** · M · Impact 3 · `MOBILE §M6`
      Input optimization (type/inputmode/autocomplete/labels/inline errors); touch-first eyedropper
      copy; press-states + progress readouts + Undo toasts; `StageCounter` polish (space − / +,
      long-press repeat, tap-number-to-type). Note `StageCounter` overlaps D8 — commit on this branch.

- [ ] **M7 — Accessibility & polish (mobile)** · M · Impact 3 · `MOBILE §M7`
      Contrast pass; never-color-alone; sheet/overlay close + back-dismiss; **de-buttoned grid SR
      summary (depends on M4)**; reduced-motion + 200/400% reflow; focus-visible on new controls.
