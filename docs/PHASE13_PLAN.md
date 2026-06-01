# Phase 13 — Post-Round-8 Ross Feedback Batch

Ross dropped a 10-item batch the moment Round 8 returned the 🟢 verdict. None of these were in scope of Phase 12 / Round 7 / Round 8. This phase ships them, then we re-audit and ship for real.

**Status:** PLANNED, 2026-06-01.

## Resolved questions

- **Named models** → DROP ENTIRELY. No fold to 1-model-units, no preserve-with-panel-removal. The `named_models` table goes; the `NamedModelsPanel` component goes; the named-model UI flow goes. Ross's call when asked.

## Milestones (build in this order)

### P13.1 — Button primitive overhaul (FOUNDATION — do FIRST) ✅ → `3054f9b`
Drop the `[ ]` bracketed-text aesthetic for buttons app-wide. Replace with **solid-color filled buttons + black or white text per WCAG contrast.**

- Rewrite `src/components/ui/Button.tsx`:
  - Variants stay (`success` / `warning` / `danger` / `special` / `secondary`) but render **filled by default** with high-contrast B/W text.
  - Remove `[ ]` bracket text decoration from `btn-*` classes in `globals.css`.
  - Outlined remains an option for low-emphasis surfaces via a new `tone="outline"` prop (default `tone="solid"`).
  - Test contrast: every variant's text-on-fill must be ≥4.5:1 (AA).
- Update visual regression baselines in tests.
- This cascades to every page that consumes Button — no downstream changes needed if API stays the same.
- **Acceptance:** every button on the app renders as a solid color with crisp B/W text. No `[ ]` brackets visible. Tests green.

### P13.2 — Project workspace simplification ✅ → `b23d4a0`
Remove the four panels Ross flagged from `src/app/projects/[id]/page.tsx`:

- **Remove `AttachedRecipePanel`** — recipe info already lives in `ProjectColorSchemeBox`.
- **Remove `NamedModelsPanel`** — named models being deprecated (see P13.4).
- **Remove `ShoppingForThisPanel`** — replace with a `+ Wishlist` button next to the existing `+ Add unit` action.
- **Remove the redundant "Add model" form/box** — header strip's `+ Add Model` button is the canonical entry. (Probably lives inside the now-deprecated `NamedModelsPanel`; double-check `ProjectHeaderStrip`.)

Leaf workspace becomes: **Header → ColorSchemeBox → Progress Table → Stages → action button row.** No Roster card if it was driven by named models.

Delete the unused panel component files outright once nothing imports them.

### P13.3 — Delete project + cascade ✅ → `a43f044`
New feature.

- `deleteProject` server action — validates ownership, deletes the project AND all descendants.
- Confirm modal: "Delete X and N sub-projects?" with destructive-red confirm button (per new P13.1 button discipline).
- Mounts on project detail header (next to settings button) AND on each row of the `/projects` dashboard table.
- After delete: redirect to `/projects` if from detail, revalidate dashboard if from table.

### P13.4 — Schema: fold Model into Unit, drop namedModels, type constraints ✅ → `193f286`
Schema migration. **Land each step in its own commit so we can roll back narrowly.**

- Migration 1: Backfill — UPDATE projects SET type='Unit', count=count WHERE type='Single Model'. (Single Model was already a 1-of, just rename.)
- Migration 2: For each row in `named_models`, INSERT a new project row with type='Unit', count=1, parentId=its project, name=the named-model name, and the stage booleans mapped to stage counters (built→buildCount=1, etc.).
- Migration 3: DROP TABLE named_models.
- Code: Remove `'Single Model'` and `'Model'` from `PROJECT_TYPES` union in `src/types/projects.ts` / wherever it lives. Remove all UI selectors offering them. Update Zod schemas. Update tests.
- Code: Remove `NamedModelsPanel.tsx` and `named_models` schema entirely. Remove any imports.
- Sub-project type rule: Army/Warband/Unit parent can hold **only Unit** as children. Terrain Piece + Diorama stay top-level only. Enforce in `src/app/projects/new/page.tsx` (the parent-aware new-project picker) + the inline status dropdown's type cell.
- **Acceptance:** existing data preserved, no orphan Single Models, no UI offers Model/Single Model anywhere, type tests green.

### P13.5 — Stage counter performance
Diagnose & fix slowness when bumping build/prime/paint/base/complete.

- Hypothesis: server action + `revalidatePath` round-trip is what's slow.
- Fix: optimistic UI with `useTransition` + local state update. Visual change within 50ms; server confirms in background. On error, revert + toast.
- Also: visually shrink the counter — Ross said "the aggregator could be much smaller and better designed." Look for places where 3-4 rows could collapse to 1 dense row.

### P13.6 — Gradient + Match clickable color cells
Each shadow/base/highlight cell becomes click-target. Opens the `ColorPicker` primitive (with R7-3 lightness slider) in a popover.

- `MatchClient.tsx` + `GradientClient.tsx` — wrap each color cell in a `<Popover>` or `<Drawer>` mount.
- ColorPicker selection updates the active stop's hex; tool re-renders matches/ramp.
- Keyboard accessible: Enter to open, Esc to close.

### P13.7 — Match brand filter redesign
Current filter is "jumbled" per Ross.

- Audit `MatchClient.tsx` brand filter section.
- Redesign with P13.1 solid-color buttons; group by brand family if 6+ brands; alphabetise; consider columns for >12 brands.
- Tighter visual hierarchy. Mobile-friendly stack.

### P13.8 — Color wheel harmony display redesign
Same family of complaint as P13.7.

- `src/app/tools/wheel/` — audit the harmony picker.
- Redesign as clear stacked rows: solid color swatch + harmony name + per-swatch action button.
- No more bracketed labels — falls under P13.1 discipline.

### P13.9 — ΔE label clarity
`ΔE` is jargon. Make it legible to recruits.

- Rename column header to `MATCH` or `DIFF` or `CLOSENESS`. Probably `MATCH` since the page is called Match.
- Add tooltip: "0 = exact match, ≤2 = imperceptible, >5 = noticeably different. Industry standard (CIE ΔE 2000)."
- Keep the value display.

### P13.10 — App-wide basic-functions audit (FINAL pass)
After P13.1 cascades + harmony + brand + tool surfaces are done.

- Sweep all "basic function" surfaces: pickers, toggles, segmented controls, dropdowns, popovers, empty-states, modals.
- Check each fits the new solid-fill aesthetic.
- Fix any straggler `[ ]`-style remnants.

### P13.11 — Focus recipe widget on /projects
Pulled forward from Phase 14 per Ross 2026-06-01: "the major thing a user will need if they want to use the dashboard while they paint."

- Schema migration:
  - Add `users.focus_project_id` — nullable FK to projects, set null on project delete.
  - Add `recipe_zone_steps.notes` — text, nullable. Per-step painting notes.
- UI on `/projects` (the dashboard):
  - **FOCUS** section (locked label, Ross's call) above the main projects table.
  - Focus picker: dropdown of projects with attached recipes. Select one → user.focusProjectId persists.
  - Big recipe panel: renders the focused project's recipe in full — slot grid + each step's paint card + notes textarea per step.
  - Auto-save notes on blur (server action + revalidate).
  - "Clear focus" button to unset.
- Empty state when no focus set: copy + nudge to attach a recipe / set focus.
- **Acceptance:** painter can select a focus project from the dashboard, the recipe shows big with per-step notes editable. Notes persist across reloads. Section header reads "FOCUS".

**Naming locked for Phase 14:** the second dashboard section (calendar / heatmap / activity / streak / inspo) will be labelled **PLANNER**, not Campaign. Simpler at-a-glance per Ross's call.

**Inspo image hosting locked for Phase 14:** external URL pastes (Pinterest / IG / ArtStation), no Vercel Blob, no S3. Ships in a day when the time comes.

## Out of scope (deferred to Phase 14+)

- The R8 polish items (chip target sizes, mobile table-card swap, quick-add suffix-strip, etc.)
- Stripe pricing gates (Phase 10 — pending Ross creating Stripe account)
- Marketing landing page

## Convention

- Land each milestone as its own commit. Commit message prefix: `feat(p13.N):` or `fix(p13.N):` or `polish(p13.N):` etc.
- Tests INTO the commit. No orphans.
- `npm test` stays green throughout. Baseline: 1083 passing, 1 skipped.
- `npx tsc --noEmit` clean before every commit.
- Local commit only — Billy merges + pushes after each milestone or at sensible batch boundaries.
- After P13.4 (schema migration), run `npm run db:migrate` locally and verify libsql migration files are clean.
