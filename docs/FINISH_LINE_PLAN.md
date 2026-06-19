# Finish-Line Plan — remaining Mini Manager work

Consolidated, ordered backlog for an autonomous milestone-builder pass. Source:
the 16 still-open Vercel comment threads in `docs/VERCEL_THREAD_BACKLOG.md`
(everything else was verified shipped). Goal: clear every item that can be built
without a human decision; halt and report on the ones that genuinely need one.

## Rules for the builder (read first)

1. **Branch:** work only on `finish-line`. Do NOT push to `main`, do NOT open/merge PRs, do NOT resolve any Vercel threads — Ross + CI handle the merge, and thread resolution happens only after prod per `docs/AGENT_ONBOARDING.md`.
2. **Verify-before-build (critical):** ~80% of past "open" comments turned out already implemented. For EACH milestone, first inspect current `main` source (Grep/Read the named components). If it's already done, check it off with a one-line note ("already present in `<file>`") and move on — do NOT rebuild.
3. **Conventions:** follow `docs/AGENT_ONBOARDING.md` — kit primitives (`Button`, `Listbox`, `Panel`, `SlideOutPanel`), design tokens in `src/lib/palette.ts` + `src/app/globals.css`, green CTAs use `Button variant="add"`, purple = `--color-purple`.
4. **Per item:** implement → `npm run typecheck` (0 errors) → `npm run test:unit` (green) → commit with a clear message citing the thread id → tick the box here. One commit per milestone.
5. **Halt + report** if: tests fail and you can't fix in-scope, you can't identify the exact target element, or an item needs a design/architectural decision. Don't guess on destructive "remove this" items.
6. Use `--max` to run as many as you can in one go.

---

## Ready to build (clear spec)

- [ ] **M1 — Attach-recipe dropdown + purple (thread `fZRWinmZ-syG`).**
  The "+ ATTACH" affordance on collection paint rows must (a) render in the app **purple**, and (b) on click open a dropdown of **all the user's recipes** with a pinned **"+ New"** entry at the top. Selecting a recipe attaches it to that row **in place** (no navigation, persists after reload); selecting "+ New" routes to the recipe create page.
  Verify first: `src/components/collection/CollectionView.tsx` + `page.tsx` already wire `onAttachRecipe → RecipePickerDialog` (`src/components/recipe/RecipePickerDialog.tsx`). Likely only the **"+ New" pinned entry** and the **purple styling** are missing — add just those.

- [ ] **M2 — Army-list naming + model-count/type import (thread `RG-egS3QAoBi`).**
  When importing an uploaded army list (`ArmyImportPanel`), let the user **name the project before import**. The parser already derives model-count-per-unit and type — **port those into the created project rows** (currently dropped). Acceptance: imported army has the chosen name; child rows show correct model counts + types; survives reload.
  Start in `src/app/(app)/dashboard/ArmyImportPanel.tsx` and the import/parse path under `src/lib/`.

- [ ] **M3 — Projects KPI → centered percentage only (thread `S3lZ40vuocCL`).**
  On `/projects`, the completion KPI should be just the **percentage number, centered** (drop extra chrome). Sibling threads `qHYZN`/`4g3I`/`JxHyr` already centered the stat boxes — verify whether anything remains; if the KPI still shows extra labels/sections, strip to the centered number.

- [ ] **M4 — Calendar month label between the arrows (thread `yO830AqQH3Hu`).**
  In the planner mini-calendar, move the "Jun 2026" month label to sit **between** the `‹` and `›` nav arrows instead of below them. File: `src/components/kit/MiniCalendar.tsx` (and/or `src/components/dashboard/PlannerCalendar.tsx`). Small layout change.

- [ ] **M5 — Stat-box numbers: bigger (thread `6hWtJA2oArmz` follow-up).**
  The tracker totals should read larger. The font side ships separately (3D Pixel on `--font-display`); here just verify the **number size** on `src/components/kit/StatBox.tsx` and bump if still small. Per-box colours are already done — don't touch those.

---

## Attempt only if the in-thread screenshot makes the target unambiguous — else HALT + report

These are "remove this element" / "recolour this" comments with no element named in text. Each thread has a screenshot + a `context.selector`/`context.path`. Read the thread (Vercel toolbar MCP) to identify the exact element. **Only act if you are confident which element it is.** If not, leave the box unchecked and note "needs Ross to point at the element."

- [ ] **`8TkHnT9drEl2`** (/projects) — remove a whole section ("can re-add later").
- [ ] **`hA-bzgS5S98r`** (/projects) — remove a redundant section.
- [ ] **`FZj63NkdAnZb`** (/wishlist→collection) — remove an element from the paint table.
- [ ] **`lq5hIKKHJdVT`** (/wishlist→collection) — remove an unidentified element.
- [ ] **`Jqx4pDn-NWw1`** (/library) — recolour an element to a brand colour (green/cyan).
- [ ] **`RuYiw7plQqDV`** (/focus) — reorder the recipe-box label so it reads "RECIPE BOX" then "No Recipe Attached".
- [ ] **`TmE3k580uZWc`** (/planner) — progress bars styled per Figma "group 21".

---

## DO NOT attempt — needs Ross (leave for him)

- **`ORZm2dlzzxzq`, `vYOtzW8W9ciB`** — `/planner` full UI redesign. Subjective; needs a design pass + direction.
- **`KOdXd3JTo7rS`** — custom fonts + size. Already handled on branch `feat/custom-fonts` (PR #30), awaiting Ross's visual review. Do not touch fonts here.
- **Fixedsys Excelsior (FSEX302)** placement — unassigned; Ross to decide.

---

## When done

Report: which milestones built (with commit shas), which were already-present (skipped), which halted and why. Leave `finish-line` pushed for Ross to review + PR through the CI gate.
