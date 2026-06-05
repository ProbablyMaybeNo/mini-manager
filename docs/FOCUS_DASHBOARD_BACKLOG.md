# FOCUS + Dashboard Feature Backlog

Ross's 2026-06-02 feature wave. Captures the "whole list of features to add"
he flagged — some already shipped (noted), some new, some needing a decision.
Living doc; tick as they land.

> **Status (2026-06-04, branch `batch/focus-dashboard`, do NOT merge — lead
> reconciles):** the IA restructure landed. **PLANNER → FOCUS** — `/planner`
> is now the FOCUS painting screen (FocusPicker + FocusPanel recipe row with
> inline per-paint notes + compact project panel + Stopwatch + the reused
> inspo board); the path stays `/planner`, the NavRail label + H1 are
> retitled FOCUS. **PROJECTS → DASHBOARD** — `/projects` H1 is now DASHBOARD,
> the projects table titled "PROJECTS" is full-width (the D2 master-detail
> `ProjectsWorkspace`/`ProjectInspector` are deleted), the relocated planner
> widgets (streak/activity/calendar) sit below it, and a new RECIPES table
> (enhanced `RecipesTable` → `DashboardRecipesTable`: bigger squares with
> paint name + layer, recipe title, "Assign Recipe", owned-green /
> wishlist-yellow square borders) closes the surface. This SUPERSEDES the
> "Dashboard reorder" item below and the D2/D6 master-detail layout in
> `DESKTOP_UXUI_UPGRADE_PLAN.md` / `MOBILE_UXUI_UPGRADE_PLAN.md`. typecheck
> clean; vitest 2078 passing.

## Decided / queued

- [x] **Dashboard reorder → FOCUS → Projects → Planner.** ~~Ross's call
      2026-06-02.~~ SUPERSEDED 2026-06-04 by the FOCUS/DASHBOARD IA
      restructure (`batch/focus-dashboard`): FOCUS left `/projects`
      entirely for its own `/planner` screen, so there is no FOCUS card to
      order above the table. `/projects` is now the DASHBOARD: PROJECTS
      table → planner widgets (streak/activity/calendar) → RECIPES table →
      recently bought. The "where are my projects?" burying is resolved by
      the table sitting directly under the header.

## Needs a decision before build

- [x] **Per-paint notes in the FOCUS color scheme.** Ross wants to note
      colours/techniques against the paints he's using, to refer to while
      painting. We ALREADY have per-*step* notes (`recipe_step.notes`,
      edited inline on FOCUS). Open question: does he want notes attached to
      the *paint itself* (one note per paint, follows that paint everywhere
      it's used) vs the current *per-step* model (a note per occurrence)?
      → Ross's LOCKED call: **per-paint** (the note follows the paint
      everywhere it's used).
      - **Shipped:** new `paint_notes` table (unique on user+paint,
        migration `0015_aberrant_smasher.sql`), `getPaintNotesMap` query,
        `setPaintNote` upsert/clear action, per-paint editor in the FOCUS
        panel with an "applies to this paint everywhere" affordance. The
        existing per-step notes were KEPT (non-destructive). Tests +18
        (1680 → 1698 passing / 1 skipped), `tsc --noEmit` clean.
      - **Follow-up RESOLVED (2026-06-02):** consolidated the FOCUS scheme
        to per-PAINT notes ONLY. The per-step "Painting notes…" textarea
        (`recipe_step.notes` via `updateStepNotes`) was retired from the
        FOCUS panel; `PaintNoteEditor` is now the single notes affordance
        per paint-backed step. NON-DESTRUCTIVE: the `recipe_step.notes`
        column, the `updateStepNotes` action + its integration test, and
        the recipe-editor `notesMd` field all remain untouched — this was a
        FOCUS-only UI consolidation. The now-dead `notes` field was also
        trimmed from the `FocusStepView` view model + `buildFocusZones`.
        Tests updated to assert the per-step editor is GONE and the
        per-paint editor remains.

## Already shipped (reconciled — do NOT rebuild)

- [x] **Stopwatch / painting-speed timer.** `Stopwatch` in FOCUS
      (start/pause/resume/stop) + `paint_sessions` table + today/week
      rollups. Shipped Phase-14 spillover `2f50fcb`.
- [x] **Project progress bar.** Completion column on ProjectsDashboardTable
      (red <25% / yellow 25-75% / green ≥75%) + recipe-completion % added to
      FOCUS in P15.0 `13605d7`.
- [x] **FOCUS companion mechanics (P15.0).** Active-slot indicator,
      per-step done-checkboxes, +Paint/+Prime/Advance quick-actions,
      project-state pill, recipe completion %. `13605d7`.

## "Other FOCUS things we wanted" — candidates to jog memory

Ross couldn't recall the rest. Plausible items from the original brief +
painting-companion patterns — confirm which (if any) he wants, add the real
ones, drop the noise:

- [ ] Paint-mix ratios per step (e.g. "2:1 Macragge : Lahmian medium").
- [ ] Reference photo per zone/recipe (paste a URL, like the inspo gallery).
- [ ] Per-paint "currently low / out of stock" flag surfaced in FOCUS so you
      know to reorder before a session.
- [ ] Technique tag chips per step beyond the 8-layer set (drybrush, glaze,
      wet-blend as annotations).
- [ ] "Next session" suggestion — which project/slot to pick up next.
- [ ] Estimated time-to-complete from stopwatch history × remaining steps.
- [ ] Print / export a recipe as a bench card (PDF/printable).

## Conventions

- Land each item as its own commit, prefix by phase. Tests INTO the commit.
- `npm test` green throughout; `npx tsc --noEmit` clean before every commit.
- Solid-fill Button discipline; no cyan on action buttons; `@theme` tokens only.
- Local commit only — Billy pushes after verifying.
