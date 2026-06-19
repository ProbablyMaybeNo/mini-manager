# UI Consistency — Quick-Wins Backlog

The "Top quick wins" from `docs/UI_CONSISTENCY_AUDIT.md`, turned into an ordered
build list. Each is a design-system consolidation: replace a bespoke element
with the canonical primitive so the same concept renders one way everywhere.

## Rules for the builder (read first)

1. **Branch:** work on the current branch `fix/ui-consistency-quickwins`. Do NOT
   create new branches, do NOT push, do NOT open/merge PRs — Ross + CI handle the
   merge.
2. **Verify-before-build:** for each item, first Read the named files. If it's
   already canonical, tick it with a one-line note and move on — do not rebuild.
3. **Conventions:** kit primitives (`Button`/`IconButton`/`Chip`/`Listbox`), tokens
   in `src/lib/palette.ts` + `src/app/globals.css`. Match neighbouring code style.
   No new colours/fonts. Keep the square hard-edge language (no `rounded-*`).
4. **Per item:** implement → `npm run typecheck` (0 errors) → `npm run test:unit`
   (green) → commit citing the item number → tick the box. One commit per item.
5. **Halt + report** if tests fail and you can't fix in-scope, or an item needs a
   design decision you can't make from the audit + code. Don't guess.

---

## Items

- [x] **1 — Dashboard WISHLIST status → bordered chip.** `StatusText` in
  `src/components/kit/tags.tsx` renders WISHLIST (and other statuses) as bare
  coloured text. Render through the existing `<Chip accent={statusAccent[status]}>`
  so every status reads as a bordered badge consistent with the rest of the app.
  Confirm consumers still render correctly: `ProjectsTable.tsx`,
  `ProjectWorkspaceBody.tsx`. (Audit: status/type indicators, **high**.)

- [x] **2 — Promote `STATUS_LABEL` to a shared export.** The inspector shows the
  raw enum (`BUILDING/PRIMING/PAINTING`) while the collection shows spec wording
  (`BUILT/PRIMED/PAINTED`) for the *same* state. Export `STATUS_LABEL` from
  `StatusDropdown.tsx` (find it under `src/components/`), and use it in the
  `ProjectWorkspaceBody` status Listbox and in `StatusText` so wording is
  identical everywhere. While there, pass `accent={statusAccent[...]}` to the
  inspector Listbox if it's currently untinted. (Audit, **high**.)

- [ ] **3 — Fix the two sub-12px labels.** `src/components/dashboard/PlannerCalendar.tsx`
  and `src/app/(app)/dashboard/ArmyImportPanel.tsx` still use `text-[10px]`,
  breaking the 12px readability floor. Change each to `text-[12px]`. (Audit, **high**.)

- [ ] **4 — Add a `label-osd` utility + adopt it.** Many OSD section labels repeat
  `font-osd text-xs uppercase tracking-[...]` with the tracking drifting across ~7
  values (0.08–0.25em). Add a single `@utility label-osd` in `globals.css`
  (`font-osd text-xs uppercase tracking-[0.15em]`) and replace the ad-hoc strings
  at the call sites listed in the audit's typography section. Keep visual output
  on the canonical `0.15em`. (Audit — **high churn, do carefully**.)

- [ ] **5 — Route bespoke add-`+` buttons through the canonical variant.**
  `ProjectsTable.tsx` rolls its own green/dashed `+` add buttons (and `rounded-sm`);
  `RecipePickerDialog.tsx` "+ New" is dashed purple. Use `IconButton`/`Button`
  `variant="add"` (the canonical neon-green add per MM-52) and drop `rounded-sm`.
  (Audit: button-likes, **high**.)

- [ ] **6 — Add a kit `CloseButton` and replace the hand-rolled `✕`.** The dismiss/
  remove `✕` is hand-built in ~8 places with two different glyphs (`✕` U+2715 vs
  `×` U+00D7) and clashing hover colours. Add a `CloseButton` primitive in `kit`
  (one `✕` glyph; `tone="dismiss"`→`hover:text-cyan`, `tone="destructive"`→
  `hover:text-red`; real `:focus-visible` ring, no `focus:outline-none`) and replace
  the instances in: `ModalDialog.tsx`, `SlideOutPanel.tsx`, `SlotRow.tsx`,
  `LayeringTool.tsx`, `EyedropperTool.tsx`, `CollectionTable.tsx`, `InspoBoard.tsx`,
  `CameraSampler.tsx`. (Audit: destructive/close, **high**.)

---

## When done

Report which items shipped (commit shas), which were already canonical (skipped),
which halted and why. Leave the branch for Ross to review + PR through the gate.
