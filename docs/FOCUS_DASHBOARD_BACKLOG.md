# FOCUS + Dashboard Feature Backlog

Ross's 2026-06-02 feature wave. Captures the "whole list of features to add"
he flagged — some already shipped (noted), some new, some needing a decision.
Living doc; tick as they land.

## Decided / queued

- [ ] **Dashboard reorder → FOCUS → Projects → Planner.** Ross's call
      2026-06-02. The project table got buried below FOCUS + the (large)
      PLANNER section, so "where are my projects?" The new order:
      header → FOCUS card → **ProjectsDashboardTable** → Top Wishes →
      PLANNER → Recently bought. Single edit in `src/app/projects/page.tsx`
      (reorder the JSX in the non-empty branch). Held until the P15.2
      touch-sweep agent finishes (it's editing the same surface).

## Needs a decision before build

- [ ] **Per-paint notes in the FOCUS color scheme.** Ross wants to note
      colours/techniques against the paints he's using, to refer to while
      painting. We ALREADY have per-*step* notes (`recipe_step.notes`,
      edited inline on FOCUS). Open question: does he want notes attached to
      the *paint itself* (one note per paint, follows that paint everywhere
      it's used) vs the current *per-step* model (a note per occurrence)?
      → see the question posed to Ross. Build follows his answer.

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
