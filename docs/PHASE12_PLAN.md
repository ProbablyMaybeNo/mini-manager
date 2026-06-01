# Phase 12 — Color-First Rebuild

**Phase intent.** Ross's verbatim redesign brief: drop the model-part / "zone" abstraction entirely from the recipe flow. **Recipes are about COLOR and PAINTS, not parts of a model.** Plus full table-driven dashboards on Projects + Wishlist, contextual tools, paid-tier UI, library polish, and app-wide button-colour discipline.

This is bigger than any prior phase. **8 pillars, 24 milestones.** Some pillars (12.1 recipe rebuild, 12.3 project detail rebuild) are layout reworks; others (12.7 library polish, 12.8 button discipline) are surface-level sweeps.

## Q&A — Ross's confirmed answers (2026-06-01)

These supersede any earlier guesses elsewhere in the doc:

- **Q1 — One paint per slot.** Each slot = one paint. Users add slots for shadow/mid/highlight. Each layer name (undercoat / basecoat / midcoat / highlight / edge highlight / wash / detail / metallic) can be assigned to multiple paints on the same recipe — e.g. two "basecoat" slots is legal.
- **Q2 — Progress table rows.** Same column set across all rows regardless of project type: `name / type / count / color scheme / status`. Count = 1 for individual models, blank/null for rows where it doesn't apply.
- **Q3 — Status derivation.** Present-tense, derived from the lead stage: WISHLIST → PURCHASED (ownedCount > 0) → BUILDING → PRIMING → PAINTING → BASING → COMPLETE (all models complete). One model in a new stage immediately advances the pill — users build sequentially per unit, so partial-stage flicker is rare in practice.
- **Q4 — Color scheme box when a recipe is attached.** The boxes pre-fill with the recipe's palette automatically. Recipe name shown above. Click any filled box to swap that paint. No empty `+` placeholder when filled.
- **Q5 — Cyan discipline.** Cyan reserved for: titles, body text, active nav indicator, focus rings. **NO cyan buttons** anywhere. Buttons exclusively use the four-color palette (green / yellow / red / purple).
- **Q6 — Wishlist statuses.** Rename existing values app-wide: Wanted → WISHLIST, Bought → PURCHASED, Cancelled → HOLD. Schema string migration.
- **Q7 — Eyedropper pins.** Each pin's position SAMPLES the pixel under it. Dragging a pin re-samples the new location. Add / remove pins recomputes the extracted palette as needed.
- **Q8 — Status workflow.** Stages are sequential per unit (wargamers build the whole unit before priming, prime the whole unit before painting, etc.). Per-stage counts are partial-progress tracking. Status = the lead stage with any count > 0.

## Resolved smaller calls

- **Color picker layout** — three sub-panels stacked in one scrollable side panel (mini wheel + harmony dropdown / filterable library list / eyedropper sampler). No tab switching.
- **Paint match algorithm** — hue-band first (instant, ~50 results), with a "Show closer matches" button that runs ΔE2000 against the picked hex (slower, top 20 ranked).
- **Tier UI pricing** — pulls from PHASE10_PLAN.md: Free / Pro Monthly $4 / Pro Lifetime $29 / Founder $19.
- **Harmonies dropdown set** — mono / analogous / complementary / triadic / split / square / tetradic.
- **PAINT/MEDIUM labels in detail panel** — drop them; the paint TYPE pill already conveys the same info.
- **Recipe Assign flow** — after attaching to a project, navigate to the destination project's page.
- **Wishlist paint-row Tools → Match** — opens `/tools/match` pre-loaded with the paint's hex.
- **Library filter button (top-right, currently broken)** — wire to open the existing mobile filter drawer; hide entirely on desktop (FilterRail is already visible).
- **Archived projects** — stay hidden from the dashboard; an `Archive ▾` filter chip at the top of `/projects` reveals them.

## Locked design calls (from Ross's brief)

- **Recipe data model.** Schema unchanged. `recipe_zone` table stays. The "name" field of a zone (was "Carapace", "Pauldron") becomes the **color slot label** — a free-text optional name the user can set, but the slot's primary identity is its assigned paint. The existing `recipe_step` table's `technique` field becomes the **layer assignment** (undercoat / basecoat / midcoat / highlight / edge highlight / wash / detail / metallic).
- **Recipe creation flow.** User sees empty `+` boxes. Click `+` → side panel slides from right. Panel contains: mini color wheel (top, with harmony dropdown), filterable library paint list, eyedropper-style palette. User picks a color (any of three ways) → list of matching library paints appears → user selects paint → auto-fills slot. Add slots with trailing `+`. Once paints chosen, user clicks each paint to assign it to a **layer** (undercoat / basecoat / midcoat / highlight / edge highlight / wash / detail / metallic). No model-part assignment, ever.
- **Recipe actions.** `Save` button → adds to Recipes list. `Assign to project ▾` button → dropdown of projects → auto-populates that project's color scheme.
- **Projects = table-first.** `/projects` is a single dashboard table: name / type / recipes (color squares) / status / priority / completion bar. Completion bar tone: **red < 25%, pastel yellow 25–75%, neon green 75–100%**. Expandable rows: Army ▸ Units ▸ Models.
- **Project detail.** Title + type + count + status + progress bar (top). "Color Scheme" box (3 empty `+` boxes + "Add paint" button to extend). "Progress" table below (name / type / count / color scheme / status bar) with `+ ADD UNIT` / `+ ADD MODEL` button. Every cell inline-editable: click status → dropdown, click count → ±, click color scheme cell → recipe creator side panel opens.
- **Wishlist = two tables.** Paints + Models, separate. Paints: title / color / company / price / category (Acrylic / Wash / Contrast / Primer / Metallic / Transparent / Varnish / Special) / project / status (WISHLIST / PURCHASED / HOLD). Models: title / count / company / price / type / status. Inline edit only — no slide-out. Each paint row has a `Tools ▾` dropdown (Wheel / Match / Layering) → opens tool pre-populated with that paint.
- **Tools = contextual.** No mandatory `/tools` page. Tools accessible from project pages, wishlist, library, and recipe builder. The `/tools` landing can stay as an index but tools must work standalone too. **Gradient → renamed to "Layering."** Layering flow: user assigns a base paint/color (via library / wheel / eyedropper) → tool auto-suggests shadow / mid / highlight variants → filterable by company → assignable to a project or color scheme.
- **Eyedropper enhancement.** Movable color-pin circles overlaid on the uploaded image. Each circle = one extracted paint. User can add / remove / drag pins. Discovered colors assignable to projects or recipes.
- **User page.** Paid tier section (subscription vs lifetime), account info, password change, **persistent library brand-filter selection** (saved across sessions).
- **Library polish.** List/grid toggle: bigger spacing, terminal-button styling. Filter button (top-right) currently does nothing — fix or remove. Brand section: replace A-Z fold with simple checkbox list, all checked default. Harmonies in detail panel: dropdown for harmony type → display matching squares → clicking a square shows paints matching that hue.
- **App-wide button colour discipline.**
  - **Green** → ADD / NEW / CREATE buttons
  - **Pastel red** → REMOVE / CANCEL / DELETE / DESTRUCTIVE
  - **Pastel yellow** → SHARE / IMPORT / EXPORT / ADD TO WISHLIST
  - **Pastel purple** → SPECIAL / FEATURED / FOUNDER
  - **Cyan** → TITLES, ACTIVE STATES, FOCUS — **not buttons by default**

## Pillars + milestones

### Pillar 1 — Recipe rebuild (the centerpiece)

- [x] **P12.1 — `<ColorPicker>` primitive.** New shared primitive at `src/components/ui/ColorPicker.tsx`. Renders three stacked sub-panels:
  1. Mini color wheel (SVG HSL ring, draggable cursor) + harmony dropdown (mono / analogous / complementary / triadic / split / square / tetradic) → shows up to 6 harmonised swatches below the wheel
  2. Filterable library paint list (search + brand filter + type filter) with paint swatches and metadata
  3. Eyedropper sampler (drop / paste image → k-means top 6) — reuses existing `kmeans.ts` + DropZone components if possible
  Output: a `{ hex, paintId? }` shape via `onSelect` callback. Tests for each sub-panel + the harmony math.

- [x] **P12.2 — Recipe slot grid + side-panel flow.** Replace current ZoneList vertical-strip-with-zones with the **empty + boxes** pattern. Each slot is a clickable square. Click `+` (or any empty slot) → opens `<ColorPicker>` in a right slide-out side panel (~480px wide on desktop, full-width on mobile). Pick a color/paint → side panel closes, slot fills with the swatch + paint name. Drop the "starter pack" preset dropdown (model-part presets are out of scope per the brief). Add a trailing `+ Add color` square to extend the row.

- [x] **P12.3 — Layer-assignment on filled slots.** Click a filled slot → reveals a layer selector (the 8 layers from the brief). Stored on the existing `recipe_step` table's `technique` field. The first step of each slot defaults to "basecoat" but the user can override. Visual: small layer chip overlaid on the swatch (top-right corner) showing the assigned layer name in tiny caps.

- [x] **P12.4 — Save vs Assign actions.** Recipe header gets two clearly distinct CTAs:
  - **Save** (green button) — adds to Recipes list, stays on the page
  - **Assign to project ▾** (cyan button) — dropdown of user's projects; on pick, auto-attaches this recipe to that project's color scheme and navigates to it
  Plus existing Share modal stays accessible.

- [x] **P12.5 — Recipes list table redesign.** `/recipes` becomes a table: name / body type (or remove if redundant) / palette swatches (small colored squares of slot paints) / step count / created. Per-row actions: `Assign ▾` button + `Share` button (yellow). Click a row name → opens the recipe editor.

### Pillar 2 — Projects dashboard rebuild

- [x] **P12.6 — `/projects` table layout.** Replace current backlog/active/all-projects card sections with a single sortable dashboard table. Columns: **Name · Type · Recipes (palette squares) · Status · Priority · Completion (bar)**. Completion bar tone: red < 25%, pastel yellow 25–75%, neon green 75–100% (the `<ProgressBar tone>` already supports the colour transitions — wire it to thresholds). Sortable by every column.

- [x] **P12.7 — Expandable hierarchy rows.** Each row has a left chevron — click expands inline to show child rows (Army → Units → Single Models). Indentation + a tree-connector line indicates depth. Persists across navigation (sessionStorage for expanded set). Click any row name → standalone project detail page.

### Pillar 3 — Project detail rebuild

- [x] **P12.8 — Header strip.** Project title (cyan, big), then a stat row: type chip · model count · status pill · `+ Add unit` (or model/terrain etc.) green CTA. Below the row: full-width colored progress bar (same red/yellow/green thresholds as the dashboard) with percent overlay.

- [ ] **P12.9 — Color Scheme box.** A horizontal row of 3 starter empty `+` boxes. Click any → opens the same ColorPicker side panel from P12.2. `+ Add paint` button at the end of the row to extend. If a recipe is attached, the boxes pre-fill with that recipe's palette and the box title shows the recipe name.

- [ ] **P12.10 — Progress table.** Replaces the existing NamedModels panel + sub-projects panel + aggregated stages. Single table: **Name · Type · Count (with ± buttons) · Color scheme (squares) · Status bar**. `+ ADD UNIT` / `+ ADD MODEL` / `+ ADD TERRAIN` buttons at the top (green). Inline edit every cell — click status → dropdown, click priority → dropdown, click color scheme cell → recipe creator side panel slides out (the same one from P12.2).

### Pillar 4 — Wishlist split

- [ ] **P12.11 — Schema: wishlist item kind.** Add `kind: 'paint' | 'model'` column to the `wishlist_item` table. Drizzle migration. Default existing rows to whatever they look like (heuristic — has paint-related metadata = paint, else model). One-time backfill.

- [ ] **P12.12 — Two-table layout on `/wishlist`.** Stacked: "Models" table at top with its 5 columns, "Paints" table below with its 7 columns. Each table independently filterable by status. Inline editing on every cell — no row click → drawer. Drop the right-side drawer entirely.

- [ ] **P12.13 — Tools dropdown per paint row.** New "Tools ▾" affordance on each paint row → reveals Wheel / Match / Layering options → opens the corresponding tool pre-populated with that paint's hex + name.

### Pillar 5 — Tools refactor

- [ ] **P12.14 — Rename Gradient → Layering.** All UI strings flip. URL stays `/tools/gradient` (back-compat) but the page renders as "Layering" + new component name internally. Rewire the gradient client to the new mental model: user picks a base color (via ColorPicker primitive) → tool generates shadow/mid/highlight steps with library-paint matches per step. Per-step filter by company. Each step assignable to a project or recipe via "Assign ▾" button.

- [ ] **P12.15 — Eyedropper movable pins.** Overlay pin circles on the uploaded image. Each pin = one of the k-means-extracted paints. Drag any pin to reassign which region of the image that paint represents. Add / remove pins (max 8). Each pin clickable to assign that paint to a project or recipe.

- [ ] **P12.16 — Universal "Assign to ▾" on every tool result.** Wheel harmony swatches, Match results, Layering steps, Eyedropper paints — every paint surface in `/tools/*` gets an Assign button that opens a project/recipe picker and auto-attaches.

### Pillar 6 — User page

- [ ] **P12.17 — Plan tier section + pricing.** Replace the current static "Plan: FREE" card with a richer block: tier badge + price + feature bullets. Subscription vs lifetime distinction. Founder slot for early supporters. Placeholder until P10 Stripe ships — copy + structure can be in place.

- [ ] **P12.18 — Password change.** Form with current password + new password + confirm. Server action uses bcryptjs `verifyPassword` for the current + `hashPassword` for the new. Updates `passwordHash` column.

- [ ] **P12.19 — Persistent library brand filter.** Add `library_brand_filter` column to user table (JSON array of brand IDs). User page renders a checkbox list of all brands in the catalog (default all checked). Saving writes to the column. Library page reads the saved filter as the default brand set on load.

### Pillar 7 — Library polish

- [ ] **P12.20 — Filter button + view-toggle polish.** Top-right "Filter" trigger on mobile is a no-op — wire it to open the existing bottom-sheet filter drawer. List/Grid buttons in the view toggle have too-tight spacing — bump padding + gap, restyle to match the terminal-button reference.

- [ ] **P12.21 — Brand filter: checkbox list.** Drop the A-Z fold inside the FilterRail. Render all brands as a simple scrollable checkbox list. Default all checked. User's persistent selection (from P12.19) is the saved baseline.

- [ ] **P12.22 — Detail panel harmonies dropdown.** Currently the harmony strip on the paint detail panel just shows the 8 HSL-rotated swatches. Replace with a dropdown for harmony type (mono / analogous / complementary / triadic / split / square) → renders only the harmonised colors for the selected scheme. Clicking any harmony swatch shows library paints matching that hue (inline list below).

### Pillar 8 — App-wide button colour discipline

- [x] **P12.23 — Button variant semantics.** Add three new variants to the Button primitive: `success` (green-filled, for ADD/CREATE/NEW), `warning` (pastel-yellow-filled, for SHARE/IMPORT/EXPORT/ADD-TO-WISHLIST). The existing `primary` (cyan) stays but is restricted to navigation / "save" / "confirm" — not ADD. `danger` (red) stays for delete/destroy/cancel. `purple` for SPECIAL/FEATURED/FOUNDER. Update globals.css with the new `.btn-success` + `.btn-warning` classes.

- [ ] **P12.24 — Sweep every button across the app to the right semantic.** ADD MODEL / ADD UNIT / NEW PROJECT / CREATE RECIPE → success (green). Share/Export/Import/Add-to-wishlist → warning (yellow). Cancel/Delete/Remove → danger (red). Founder/Pro/Featured → purple. Save/Confirm/Sign-in → primary (cyan). This is a sweep similar to the Round-5 bracket-retirement; cleanups across ~40 files.

## Out of scope (deferred)

- **Recipe schema rename** — `recipe_zone` table stays. Only UI strings flip.
- **Marketing landing page** at `/` — still deferred from earlier phases.
- **PWA + offline-first** — post-launch.

## Sequencing recommendation

Hard dependencies:
- P12.1 (ColorPicker primitive) blocks 12.2, 12.9, 12.10, 12.14, 12.15
- P12.23 (button variants) blocks 12.24

Sensible build order:
1. **P12.23** — button variants (small, blocks one sweep)
2. **P12.1** — ColorPicker primitive (medium, blocks everything color)
3. **P12.2 → P12.5** — recipe rebuild (Pillar 1 ships)
4. **P12.6 + P12.7** — projects dashboard
5. **P12.8 → P12.10** — project detail
6. **P12.11 → P12.13** — wishlist split
7. **P12.14 → P12.16** — tools refactor
8. **P12.17 → P12.19** — user page
9. **P12.20 → P12.22** — library polish
10. **P12.24** — button sweep

## Risk register

- **P12.1 ColorPicker** is a substantial new primitive. ~500 LOC + tests. Worth a sanity check after it lands before piling on consumers.
- **P12.11 wishlist `kind` migration** touches the schema — needs a heuristic backfill that doesn't drop rows.
- **P12.7 expandable hierarchy** with persistent sessionStorage is a UX-state problem that's easy to get subtly wrong on navigation. Worth E2E coverage.
- **P12.24 button sweep** is large but mechanical. Could land in 2–3 commits split by surface area like the Round-5 sweep.

## Conventions for milestone-builder

- One commit per milestone where practical. Larger items (12.1, 12.10, 12.24) may need to split into 2–3 commits.
- Use existing primitives + new ones added in this phase. Never raw hex.
- `'use server'` files export ONLY async functions.
- Tests INTO feature commit. Never orphans.
- Local commit only — Ross merges.
- Match recent commit style.
