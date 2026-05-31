# Phase 11 — App-Wide UX Overhaul

**Phase intent.** Ross verbatim: _"When starting a new project it isn't immediately apparent what the user can or should do… we just need to do a big overhaul of the UI… do a deeper dive across the whole app to locate issues like this and suggest ways we can improve the UI/UX."_

Scope: **every primary surface**. Project pages, recipe pages, wishlist, library tables, tools, settings — full audit + sweep. Drop `[ ]` as a chrome design element. Replace abstract terminology with concrete visuals. Add brief inline microcopy where intent isn't obvious. Lift table rows from "dash-and-text" to polished color-coded chrome matching the Terminal_UI reference.

Reference image: Terminal_UI dashboard — 5-color palette (**cyan / pastel yellow / pastel red / neon green / pastel purple**), solid filled buttons with dark text, symmetrical panels, colored status pills per row, color-coded log tags, color-per-metric progress bars.

## Locked design decisions

- **5-color palette enforcement.** Add `--color-purple-pastel: #b794f6` as the 5th semantic accent. Update `magenta` semantic mapping to point at it (rename internal `--color-magenta` → `--color-purple` to match the design vocabulary). Buttons + StatusPills + LogTags pick up the new variant automatically.
- **Color semantics (locked, used consistently across the app):**
  - **Cyan** — primary action / selection / active state / interactive
  - **Neon green** — owned / complete / success / "you've got this"
  - **Pastel yellow** — wishlist / wanted / pending choice
  - **Pastel red** — danger / delete / alert
  - **Pastel purple** — special / accent / featured / "this is unusual"
- **Stage labels** (StageCounter B/P/A/S/C) → `BUILD · PRIME · PAINT · BASE · DONE` full mono-caps; keyboard shortcut shown small + dim as annotation.
- **"Zone" in recipes** → **"COLOR SLOT"** (or "SLOT" in dense contexts). Schema unchanged.
- **"Shopping for this"** → **"WISHLIST"** everywhere.
- **Recipe slot UI** → horizontal row of empty colored squares with `+ ADD COLOR` labels; click empty → paint picker, click filled → technique editor; `+` at row end adds a new slot.
- **Empty-stage cells in project rows** → render as 5 small colored bars / squares (BUILD cyan / PRIME cyan / PAINT yellow / BASE yellow / DONE green tinted), each filled in proportion to that stage's count. Today they're text dashes. The visual IS the meaning.
- **Inline editing affordances** for any "click to change" cell in a table — visible chevron + clear hover state, opens a small popover or chip-toggle. Currently the Wishlist project column + status column have this pattern (the project column was fixed in commit `709fdda`; the status column got `StatusChangePopover` in `c352fe4`); the rest of the app needs the same audit.
- **Section microcopy** — under every primary section heading on first-encounter surfaces, one sentence-case line explaining what this section is and what the user does here.

## Milestones — Phase 11a (project + recipe + StageCounter)

- [x] **P11.1 — StageCounter readable labels + cascade explainer.** _(c5de9f2)_ Drop B/P/A/S/C single-letter headers in favour of `BUILD · PRIME · PAINT · BASE · DONE` with kbd shortcut annotation. One-line cascade explainer microcopy. Per-stage color tone (build/prime = cyan, paint/base = yellow, done = green).

- [x] **P11.2 — Project detail page layout + visible primary CTAs.** _(4417b1a)_ Restructure `/projects/[id]` to: header → StageCounter left + Recipe slots right → NamedModels + Wishlist below. Each section gets `+ ADD ...` cyan/yellow CTA button + one-line inline help. Fill the empty middle.

- [x] **P11.3 — Recipe editor: slots-first redesign.** _(9c77645)_ Rename UI strings "Zone" → "Color slot" (schema unchanged). Replace linear "Add zone" form with horizontal row of empty colored squares. Click empty → paint picker. Click filled → technique editor. `+` button at row end. Inline help on first-load.

- [x] **P11.4 — Wishlist rename + project-side panel polish.** _(3f56be1)_ "Shopping for this · N" → "WISHLIST · N" everywhere. `+ ADD TO WISHLIST` yellow CTA at panel top. Empty-state copy + same CTA, no big empty middle.

## Milestones — Phase 11b (app-wide table + chrome polish)

- [x] **P11.5 — Projects list row redesign.** _(f104164)_ Per Ross's screenshot:
  - Replace text dashes `─ ─ ─ ─ ─` for empty stage cells with **5 small colored squares** sized to row height, filled proportionally to stage count. Empty stages = dim colored square. Visual at-a-glance.
  - Type label ("UNIT", "ARMY") → small colored chip (subtle bg tint per type — e.g. ARMY cyan-tinted, UNIT amber-tinted, SINGLE MODEL purple-tinted, TERRAIN PIECE green-tinted, DIORAMA magenta-tinted).
  - Status pill ("PILE") → use `<StatusPill>` primitive with proper bordered chrome (it's currently rendering as plain text).
  - Progress bar → use the solid-bar `<ProgressBar>` primitive (already done elsewhere; verify on ProjectRow).
  - Faction sub-label gets its own colored chip (subtle muted-purple tint) instead of plain gray text.

- [x] **P11.6 — Inline editing affordance sweep.** _(6f6a4ed)_ Walk every "click to change" cell across the app:
  - **Wishlist Project column** (already fixed in `709fdda`) — verify still works.
  - **Wishlist Status column** (already shipped in `c352fe4` as `StatusChangePopover`) — verify keyboard navigation, dismiss-on-outside-click, visible chevron affordance.
  - **Project detail status pill** — clicking should open a status changer? Or rely on stage counter for status transitions? Decision: status pill is **read-only** (derived from stage counts). No click.
  - **Recipe attached-project link** (`/recipes/[id]`) — currently a label; should be a clickable link to the project.
  - **Library OWN ✓** + **WISH ★** (compact InventoryControls) — already toggleable. Verify hover affordance is clear.
  - **NamedModel rows** in project detail — clicking a model row should open an inline edit drawer (currently? Check).
  - Anywhere "click to change" exists, ensure: visible chevron / pencil / edit icon, clear hover state, accessible aria-label.

- [x] **P11.7 — Recipes list polish.** _(b837c8e)_ Same treatment as P11.5: per-row chrome, color-coded body-type chip, recipe-slot mini-preview (3-5 swatches inline), proper status pills for "draft / published / cloned" semantic if relevant.

- [x] **P11.8 — Tools page polish.** _(100498a)_ `/tools` index — currently a grid of cards. Apply 5-color palette to each tool card (wheel = magenta, eyedropper = green, gradient = yellow, match = cyan, …). Add brief one-line description under each tool name.

- [x] **P11.9 — Settings / user page polish.** _(cb132a8)_ `/user` — section consistency, real CTAs not text links, status pills on plan tier ("FREE" neutral, "PRO" cyan, "FOUNDER" purple).

## Milestones — Phase 11c (color palette + bracket retirement)

- [x] **P11.10 — Pastel-purple token + magenta retirement.** _(5f4a0b7)_ Add `--color-purple-pastel: #b794f6` (or rename `--color-magenta` if the existing #ff66cc is close enough — verify against the reference). Update `StatusPill` `magenta` kind + Button `magenta` variant if added. Audit any surface using `--color-magenta` and decide: does it read as pastel purple, or should it shift?

- [x] **P11.11 — App-wide bracket-as-chrome audit + sweep.** _(e6461c5)_ Grep `\[ ` and `\]` patterns inside JSX text. Each match: keep (data) or replace (decoration). Decoration goes. Audit subtitles + section headings, flip remaining `[ X · N ]` formats.

- [x] **P11.12 — Microcopy pass.** _(121b46b)_ Add 1-line inline help under primary section headings on: `/projects/[id]`, `/projects/new`, `/recipes/[id]`, `/recipes/new`, `/wishlist`, `/tools/wheel/eyedropper/gradient/match`, `/user`. Sentence case, ≤80 chars, plain prose.

## Milestones — Phase 11d (verification)

- [x] **P11.13 — Round-5 UX auditor pass.** _(SKIPPED — running in parallel via the ux-auditor agent; coordinator note in milestone-builder run)_

- [x] **P11.14 — Regression sweep + Playwright update.** _(e045774)_ Update Playwright selectors for any renamed labels (`Add zone` → `Add color`, `Shopping for this` → `Wishlist`, `BUILD` instead of single letters in stage tests, etc.). Full vitest + Playwright sweep on chromium + chromium-mobile. Lighthouse re-check on `/projects`, `/recipes/[id]`, `/wishlist`.

## Out of scope (deferred)

- **Schema renames** — `recipe_zone` table stays, only UI strings flip.
- **Color picker primitive for Gradient/Match** (Notion item 13) — separate plan.
- **Onboarding tour / first-run walkthrough** — bigger feature, separate plan if launch needs it.
- **Mobile-specific overrides** beyond what falls out of bracket retirement — Phase 6 covered the mobile baseline.

## Conventions for milestone-builder

- **Local commit only.** Push deferred to Ross's review.
- **`npm run typecheck`** 0 errors before commit. **Tests INTO** the feature commit.
- **`npm test`** stays green (549 baseline).
- **One commit per milestone** where practical; P11.2 + P11.5 + P11.6 may each need 2-3 commits split by surface area.
- **Use existing primitives** + new tokens added in P11.10. Never raw hex.
- **`'use server'`** files export only async functions.
- **Halt + report** if a milestone needs a new token / primitive / schema decision the plan doesn't pin.
- **Match commit-message style** of recent commits (`polish(...)`, `feat(...)`, `fix(...)`).

## Sequencing recommendation

Run in this order — each phase compounds on the prior:

1. **P11.10** first (pastel purple token + palette) — every later milestone uses it.
2. **P11.1 → P11.4** (Phase 11a — project + recipe + StageCounter + wishlist) — the most-touched surfaces.
3. **P11.5 → P11.9** (Phase 11b — app-wide table + chrome polish).
4. **P11.11 + P11.12** (bracket audit + microcopy).
5. **P11.13 + P11.14** (verification — auditor + regression sweep).

14 milestones total. milestone-builder can run with `--max 14` and chain them.
