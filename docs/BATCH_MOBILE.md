# Mini Manager — Mobile UX/UI Batch (M3–M7)

> Execution list for the **mobile** milestone-builder agent. Source of truth per item is its section
> in `docs/MOBILE_UXUI_UPGRADE_PLAN.md`. This file is the running order, not a re-spec.
>
> **Branch:** work on `batch/mobile-uxui` only. Commit per milestone (`feat(mN): …`). **Do NOT push
> to main and do NOT merge** — the lead reconciles the two batch branches afterward.
> **Per-item gate:** `npm run typecheck` clean **and** `npm test` green before each commit.
> **HALT and report** at any `⚠ DECISION` item (write a short proposal, do not build it), on test
> failure, or on a shared build flagged `🔗 SHARED`.

Done already (shipped + pushed): **M1 ✅**, **M2 ✅**, **M3 ✅** (crash-recovered).

---

- [x] **M3 — Restore the comparison table (mobile)** · L · Impact 5 · `MOBILE §M3`
      Replace the mobile card stack in `ProjectsDashboardTable` with a frozen-first-column,
      horizontally-scrollable table; zebra + press-highlight; expand chevron in the frozen column;
      row-edit → nonmodal bottom sheet (fixes `InlineCellPopover` edge-clip). Feedback-batch precondition
      is satisfied. **This is the one independent mobile item — build it first.**

- [x] **M4 — `/projects` collapsed sections + glanceable collection grid** · L · Impact 5 · `MOBILE §M4` — **done**
      🔗 SHARED with **D2 + D6** · ✅ **DECIDED** (see `MILESTONE_BUILDER_BATCH.md` › Decisions 2026-06-03)
      FOCUS + PLANNER now collapse into `CollapsibleSection` progressive-disclosure sections on
      `/projects`, collapsed-by-default on mobile; a collapsed section does NOT mount its body (children
      gated behind `open`) so the first phone viewport is bench strip + table only. Desktop stays
      expanded inline (chevron `md:hidden`). PLANNER mounts the shared cluster `bare`. No `app/focus`;
      `/planner` stays desktop-only (D6). Glanceable canvas + gap-fill bottom sheet shipped in `e7251eb`.
      **One** `/projects` page: bench strip + search + project table (M3), then **`▸ FOCUS`** and
      **`▸ PLANNER`** as progressive-disclosure sections (collapsed by default). **Do NOT create
      `app/focus` / `app/planner` for mobile** (the plan's dedicated-routes recommendation is overridden).
      Collection grid → one glanceable canvas (gradient + sparse dots, not ~7,144 buttons); tap → gap-fill
      **bottom sheet** (searchable paint list, mark owned/wanted; keep brand chips + count + bar). Build the
      collection canvas + planner widgets as **shared components** with D6.

- [ ] **M5 — Recipe/project flows, shared RecipeSlot, action discipline** · L · Impact 4 · `MOBILE §M5`
      🔗 SHARED with **D5** · ⚠ DECISION (B6 schema)
      Shared `RecipeSlot`, ≤1 prominent CTA, demote DELETE, "+ Model" on Unit, two-line step row,
      breadcrumb parent, fix "1 slots/steps". **HALT:** the shared `RecipeSlot` component overlaps D5;
      B6 Steps-vs-Slots schema must NOT be collapsed blind. Propose, then stop.

- [x] **M6 — Forms & feedback (mobile)** · M · Impact 3 · `MOBILE §M6` — **done**
      Input optimization on the recovery-email form (type/inputmode/autocomplete email + visible
      label-above + inline field-level error via aria-invalid/aria-describedby, clears as you type).
      `StageCounter` polish: − / + at opposite ends (justify-between), long-press repeat (400ms hold →
      90ms auto-fire), tap-number-to-type (number input; commit on Enter/blur, cancel on Esc) backed by
      a new cascade-validated `setCounter` action. Press-states + Undo toasts pre-existing (toast system).

- [x] **M7 — Accessibility & polish (mobile)** · M · Impact 3 · `MOBILE §M7` — **done**
      Command-palette overlay now has a visible Close (×) + Back-dismiss (popstate) on top of
      click-outside + Escape (never gesture-only). De-buttoned collection grid already exposes ONE
      labelled SR summary (`role="img"` + aria-label) — verified. Reduced-motion on the disclosure
      chevron. Focus-visible rings (≥2px) on the new controls: NavRail Search trigger, inspector tabs,
      disclosure toggle, palette Close. StatusPill is already never-color-alone (text label). 200/400%
      reflow holds (content-cap + min-w-0 layouts ship from D1/D2/D3).
