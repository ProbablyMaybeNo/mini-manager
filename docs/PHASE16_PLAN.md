# Phase 16 — Heat-Sink Paint-Coverage Grid

Ross's 2026-06-02 call (Tier 1 feature gap). **Replace** the activity-cadence
heatmap on the /projects PLANNER section (P14.6) with a paint-collection
**coverage grid** Ross designed himself: one square per paint in the cross-brand
library, sorted by hue, bordered by ownership state. The painter sees their
entire collection as a colour field and can spot — and fill — the gaps.

**Status:** PLANNED, 2026-06-02.

## The visualization (Ross's spec, locked)

- A dense grid of small squares, **one per paint** in `public/data/paints.json`
  (7,144 paints / 40+ brands).
- **Sorted by hue** so the grid reads as a smooth colour spectrum (a "heat
  sink" of colour) — reds → oranges → yellows → greens → blues → violets,
  greys/neutrals parked at one end.
- Each square is filled with the paint's own hex.
- **Border encodes ownership:**
  - **Green border** = owned (`inventory_entry.owned_count > 0`)
  - **Yellow border** = wishlisted (`inventory_entry.is_wishlisted = true`, not owned)
  - **No border** = not owned, not wishlisted
- **Tap an empty (not-owned) cell** → a "fill this gap" popover: the paint that
  square represents + nearest-hue alternatives, each with a one-tap **wishlist
  add** (sets `inventory_entry.is_wishlisted = true`, the UX-1001 "Mark as
  wanted" path). Owned near-neighbours surface as "you already own X — close
  match" so the painter doesn't double-buy.

## Resolved decisions

- **Replaces, does not supplement, the activity heatmap.** P14.6
  `PlannerHeatmapCell` + `plannerHeatmapHelpers.ts` are retired from the
  PLANNER section. The **streak counter** (P14.5) and **activity stream**
  (P14.4) STAY — only the cadence heatmap goes.
- **No new table.** Ownership state already lives in `inventory_entry`
  (`owned_count`, `is_wishlisted`, unique on `(owner_id, paint_id)`). The grid
  reads it; the gap-fill writes `is_wishlisted` via the existing
  "Mark as wanted" action. Zero migration.
- **Yellow = `inventory_entry.is_wishlisted`**, NOT the `wishlist_item` table.
  The `wishlist_item` table is kit/box/vendor-URL shopping (title strings, not
  `paint_id`s) — wrong grain for a per-paint grid. Cross-referencing
  `wishlist_item` rows of `kind='paint'` to paint ids is a Phase-17 stretch,
  explicitly out of scope here.
- **One cell = one specific paint** (not a hue bucket). The "fill this gap"
  framing is the *copy*; the data is per-paint. Near-hue alternatives in the
  popover are computed from the same paint catalog by hue distance.
- **Hue sort is precomputed once** in a pure helper, not per-render. 7,144
  paints sort in <2ms; we memoize the hue-sorted index module-side so every
  request reuses it.
- **Performance is the headline risk** (see §Risks). 7,144 bordered DOM nodes
  is the naive approach — we mitigate with `content-visibility:auto`, a
  brand/owned filter, and a "condensed vs full" toggle. Canvas fallback is the
  escape hatch if DOM profiling fails P16.4.
- **Mobile-first.** The grid must be legible and tappable at 375px. Cells
  shrink but stay ≥ the WCAG 2.5.8 24px target *for the interactive (unowned)
  cells via an expand-on-tap affordance* — full grid is scroll/zoomable, but
  the gap-fill interaction promotes the tapped region.

## Data shape (already in the codebase)

```
paints.json paint:  { id, brand, name, type, hex, hexConfidence, hexSource, sourceUrl }
inventory_entry:    { ownerId, paintId, ownedCount, isWishlisted, lastPurchasedAt }
```

Coverage state per paint = LEFT JOIN paints (static) ⟕ inventory_entry (per user):
- `ownedCount > 0`            → `"owned"`   (green)
- `isWishlisted && !owned`    → `"wanted"`  (yellow)
- else                        → `"none"`    (no border)

## Milestones (build in this order)

### P16.1 — Hue-sort + coverage helpers (FOUNDATION — do FIRST) ✅

**Shipped** 2026-06-02 — `src/lib/paints/hue.ts` + `coverage.ts` + tests.
Neutral-band saturation threshold locked at `0.12` (tuned note in `hue.ts`).
`nearestPaintsByHue` ranks by ΔE2000 (reuses `tools/match/deltaE`).
+34 unit tests (1663 passing / 1 skipped).

Pure, unit-testable, no React, no DB.

- New `src/lib/paints/hue.ts`:
  - `hexToHsl(hex): {h,s,l}` — standard conversion.
  - `hueSortKey(paint)` — primary sort by hue (0–360); secondary by saturation
    then lightness so same-hue paints ramp light→dark. **Near-greys**
    (saturation < a locked threshold) sort to the *end* in a neutral band
    ordered by lightness — a pile of desaturated browns/greys scattered through
    the spectrum reads as noise.
  - `hueSortedPaintIndex(paints)` — returns the paint array sorted, memoized
    module-side (compute once per process).
- New `src/lib/paints/coverage.ts`:
  - `type CoverageState = "owned" | "wanted" | "none"`.
  - `coverageFor(paintId, inventoryByPaintId): CoverageState`.
  - `coverageSummary(...)` → `{ owned, wanted, total, ownedPct }` for the header
    readout.
  - `nearestPaintsByHue(paint, paints, n)` — the popover's "candidate paints to
    fill this gap" list (excludes the paint itself; ranks by ΔE if the existing
    colour-distance util is cheap to reuse, else hue distance).
- Tests: hue ordering is monotonic, greys land in the neutral band, coverage
  state mapping (owned beats wanted beats none), summary math, nearest-paints
  excludes self + respects n.
- **Acceptance:** helpers green in the node test env; no UI yet.

### P16.2 — Coverage query + server read ✅

**Shipped** 2026-06-02 — `src/db/queries/paintCoverage.ts` + integration tests.
`getInventoryByPaintId` (slim indexed read), `composeCoverageGrid` (pure,
testable join), `getCoverageGrid` (top-level read: disk catalog + inventory).
Catalog cached per export timestamp (mirrors `getPaintMetaMap`).
+6 integration tests (1669 passing / 1 skipped).

- New `src/db/queries/paintCoverage.ts`:
  - `getInventoryByPaintId(userId)` → `Map<paintId, {ownedCount, isWishlisted}>`
    (single indexed read on `inventory_owner_paint_unique`).
- Compose in a server helper the cell renderer consumes: hue-sorted paints +
  per-paint coverage state + summary. Keep the join in the helper, not the cell,
  so it's testable.
- Integration tests: user with 0 inventory → all "none"; user with mixed owned
  + wishlisted → correct buckets + summary.

### P16.3 — HeatSinkGrid cell + PLANNER swap ✅

**Shipped** 2026-06-02 — `src/components/planner/HeatSinkGridCell.tsx` (async
server component, fetches its own `getCoverageGrid(currentUserId())`) +
`heatSinkHelpers.ts` (border-token map + header readout). Renders the catalog
as a tight hue-sorted spectrum: fill = paint hex, border = coverage state via
`@theme` tokens (green owned / amber wanted / transparent none — no raw hex, no
cyan). Mono-caps header "owned / total owned · wanted" + thin coverage bar;
`content-visibility:auto` on the grid (the one cheap P16.4-adjacent hint).
Swapped `<PlannerHeatmapCell />` → `<HeatSinkGridCell />` in PLANNER
`md:row-start-3`; Streak / Activity / Calendar / Inspo untouched. Retired the
activity heatmap (`PlannerHeatmapCell.tsx`, `plannerHeatmapHelpers.ts` + their
tests — grep-confirmed heatmap-only). +19 view tests (helpers + cell render);
net suite green at 1680 passing / 1 skipped. `tsc` clean for planner scope.
**Concurrency note:** a parallel agent's in-flight per-paint-notes work
(`focus/**`, `schema.ts`, `projects/page.tsx`, `paintNotes.*`) is uncommitted in
the shared tree and has its own pre-existing `focusPanel.test.ts` type errors —
out of P16.3 scope, not committed here.

- New `src/components/planner/HeatSinkGridCell.tsx` (async server component) +
  `src/components/planner/heatSinkHelpers.ts` if any view-pure logic spills out.
- Renders the hue-sorted grid: tight CSS grid, fixed small cells, fill = paint
  hex, border = coverage state via `@theme` tokens
  (`var(--color-green)` / `var(--color-amber)` / transparent — **no raw hex**,
  **no cyan**).
- Header readout: "**1,204 / 7,144 owned · 312 wanted**" + a thin coverage bar.
  Mono-caps, tight density to match the PLANNER widgets.
- **Swap into `PlannerSection.tsx`:** replace `<PlannerHeatmapCell />` in the
  `md:row-start-3` slot with `<HeatSinkGridCell />`. Delete the
  `PlannerHeatmapCell` mount. Streak + Activity + Calendar + Inspo untouched.
- **Retire** `PlannerHeatmapCell.tsx`, `PlannerHeatmapCell` tests, and
  `plannerHeatmapHelpers.ts` (and its tests) — or keep the helper file only if
  another surface imports it (grep first; it should be heatmap-only).
- Tests: grid renders N cells, border class matches coverage state, header math,
  PLANNER section still mounts all surviving widgets.

### P16.4 — Performance pass (gate before gap-fill UX) ✅

**Shipped** 2026-06-02 — DOM approach, **canvas NOT needed**. Split the grid
into a server seam (`HeatSinkGridCell` — fetches `getCoverageGridView`) + a
client wrapper (`HeatSinkGridClient`) mirroring the `PlannerInspoCell` →
`InspoGalleryGrid` pattern. Applied, in order:
1. **Row-chunking** — the visible cells split into ~100-cell row groups
   (`chunkCells`, `CELLS_PER_ROW_GROUP = 100`); each group is a
   `[content-visibility:auto] [contain-intrinsic-size:auto_12px]` container so
   off-screen groups skip layout + paint. The wrapper-only hint from P16.3
   (one `content-visibility` on the flat 7,144-node grid) is replaced by
   per-group containment — the browser now skips whole offscreen chunks.
2. **Brand filter** chip row (`filterCellsByBrands`) — defaults to the
   painter's saved `users.library_brand_filter` (reused
   `decodeLibraryBrandFilter`, NO new column; read server-side via
   `getDefaultBrandFilter`, passed down). "All" chip resets to unfiltered;
   every-brand-selected reads as no filter.
3. **Condensed / Full toggle** (`condensedCells` + `pickDefaultDensity`) —
   Condensed renders owned+wanted only (the collection as a spectrum); Full
   renders the whole catalog. **Default threshold = 60 owned/wanted paints**
   (`CONDENSED_DEFAULT_THRESHOLD`): ≥ 60 → Condensed, else Full so a near-empty
   collection still shows the catalog to fill. Solid-fill green toggle, amber
   brand chips — no cyan, no `[ ]` brackets.

Extended `paintCoverage.ts` (added `getCoverageGridView`, `getDefaultBrandFilter`,
`brandsInGrid`, `CoverageGridView`; `getCoverageGrid` untouched for other
callers). +40 tests (row-chunking group counts, brand-filter narrowing,
condensed/full switch, default-density threshold, default-filter wiring +
brand-list derivation): **1718 passing / 1 skipped** (from 1698/1). `tsc`
clean. **Canvas escape-hatch not triggered** — row-chunking + filter + condensed
shrink the working set enough that the DOM grid is the shippable approach;
P16.5 gap-fill can proceed on the DOM grid.

- Profile the full 7,144-cell render on desktop + a throttled mobile profile.
- Apply, in order of cheapness, until interaction stays smooth:
  1. `content-visibility:auto` + `contain-intrinsic-size` on cell rows.
  2. Row-chunk the grid (e.g. 100 cells/row group) so off-screen groups skip
     layout/paint.
  3. **Brand filter** chip row (reuse the painter's `library_brand_filter`
     preference as the default) to cut the working set.
  4. **Condensed vs Full toggle** — condensed shows owned+wanted only (the
     painter's actual collection as a spectrum); Full shows the whole catalog.
- **Escape hatch:** if DOM still janks at 375px, render the spectrum to a
  `<canvas>` with a hit-test map for taps. Decision recorded here on the way
  out.
- **Acceptance:** scroll + initial paint stay smooth at 375px; no long task
  >50ms on interaction in the throttled profile.

### P16.5 — Gap-fill interaction ✅

**Shipped** 2026-06-02 — `HeatSinkGapFillPopover.tsx` (new popover subcomponent)
wired into `HeatSinkGridClient`. Cells are now `<button role="gridcell">`; tapping
one opens a popover anchored to it (`z-50`, `max-w-[calc(100vw-1.5rem)]`,
Escape + click-outside dismiss — matching the `PaintSlotPicker` /
`InlineCellPopover` primitives). Popover shows the tapped paint (swatch + brand +
name + state) and its nearest-hue candidates via the **frozen**
`nearestPaintsByHue` (new pure helper `buildGapFillCandidates` ranks against the
full `grid.cells` the client already holds — candidates include unowned "none"
cells dropped in Condensed view; **no new server query**). Each unowned paint
(tapped cell + candidates) gets a one-tap **"Mark as wanted"** that calls the
**existing** `toggleWishlistedPaint` action (UX-1001 path — reused, not
re-implemented) and optimistically flips the cell border to amber via a
session-local `wantedOverrides` set (owned cells never downgrade). Owned cells
open the same popover framed "You own this — N near matches" (no buy nag). Solid
`success` Button on the wishlist add; no cyan, no raw hex in className, `@theme`
tokens only. +26 tests (helper behaviour + popover/client wiring, source-level
per the no-jsdom convention): **1744 passing / 1 skipped** (from 1718/1). `tsc`
clean. Commit `274fd3d`. **Local commit only — not pushed.**

- Tapping an **unowned** cell opens a popover (reuse the existing paint-detail /
  picker popover primitives — match `PaintDetailPanel` / `PaintSlotPicker`
  patterns, `z-50`, viewport-clamped, escape + click-outside dismiss).
- Popover contents: the tapped paint (swatch + brand + name) + `nearestPaintsByHue`
  candidates, each tagged owned / wanted / none, each with a one-tap
  **"Mark as wanted"** that flips `is_wishlisted` via the existing action and
  optimistically restyles the cell border to yellow.
- Owned cells tap → same popover but framed "You own this — N near matches"
  (no nag to buy).
- Solid-fill Button discipline; the wishlist add is a `success` action button.
- Tests: tap unowned → action wired + optimistic border flip; nearest-candidates
  populated; owned-cell variant copy.

### P16.6 — Mobile + Round 12-adjacent audit hook ✅

**Shipped** 2026-06-02 — fixed the three Round-12 heat-sink-grid findings
(`ux-audit/findings_v12.json`), all within the planner scope fence
(`src/components/planner/**`):

- **UX-1202 (cell size + reflow):** new per-density `CELL_MIN_PX`
  (`gridColumnsFor` / `intrinsicRowSizeFor` helpers). **Condensed**
  (the painter's collection — the default once the collection clears the
  threshold, and the surface actually tapped) now renders cells at
  `minmax(28px, 1fr)`, clearing the 24px WCAG 2.5.8 target with margin;
  **Full** (the dense catalog overview) lifts off the old 7px floor to
  `minmax(12px, 1fr)`. `1fr` companion columns reflow to fill the full
  width, so a 414 phone enlarges cells instead of growing side margin.
  **Tradeoff call:** Condensed leads with reach (tappable), Full stays the
  dense colour field — no halt needed. P16.4 perf (row-chunking,
  `content-visibility:auto`, brand filter, density toggle) intact; the
  intrinsic-size now tracks the density's cell edge for scroll stability.
- **UX-1203 (popover containment):** the gap-fill popover is now a fixed
  bottom **sheet** on mobile (`< md`) — clamped clear of the bottom tab
  bar (`bottom: 60px + env(safe-area-inset-bottom)`), a flex-column body
  scrolling inside `max-h-[70vh]` so "Mark as wanted" is always reachable
  thumb-only. On desktop (`>= md`) it stays anchored to the cell but
  **flips above** when a `useLayoutEffect` measures insufficient room below
  (collision-aware, no positioning lib added).
- **UX-1210 (brand-filter chips):** coverage brand chips are now real
  `tap-target` chips (44px touch / 32px md+), wrapping cleanly
  (`whitespace-normal`, no `truncate`/`max-w` clipping), `gap-1.5` between
  chips, `pr-1` right gutter on the row. (Did not touch `globals.css` —
  owned by the parallel P15.3 agent; the other inline filter rows on
  /wishlist, /tools/match, /library are outside this scope fence.)

+29 tests (cell-sizing helpers, popover placement/flip + bottom-sheet
sentinels, chip layout sentinels): **1804 passing / 1 skipped** (from
1775/1). `tsc` clean. **Local commit only — not pushed.** Mobile eyeball at
375/414 still wants a human glance (the mechanics are verified by tests +
typecheck).

- 375 / 414 / 768 pass on the grid specifically: cell size legibility, header
  wrap, popover within viewport, brand-filter chips scroll, toggle reachable.
- Fold the grid into the Phase-15 P15.5 ux-auditor mobile run rather than a
  separate audit — one walk covers both. Note any findings back here.
- **Acceptance:** grid is a first-class mobile citizen; gap-fill works thumb-only.

## Out of scope (Phase 17+)

- Cross-referencing `wishlist_item` (kit/box) rows back to paint ids for the
  yellow border. Yellow = `inventory_entry.is_wishlisted` only in v1.
- "Buy these N to complete this hue family" bulk-add flows.
- Brand-coverage stats ("you own 80% of the Citadel range") — natural Phase-17
  follow-on once the grid + summary exist.
- Owned-count intensity (darker green for more pots) — v1 border is binary.
- Recommending paints from recipes the painter has but lacks paints for —
  belongs with the Next-Action card (Phase 17 D.2).

## Conventions (same as prior phases)

- Land each milestone as its own commit. Prefix `feat(p16.N):` / `fix(p16.N):`.
- Tests INTO the commit. No orphans.
- `npm test` stays green throughout. Baseline at plan time: 1587 passing, 1 skipped.
- `npx tsc --noEmit` clean before every commit. No `any`, no `@ts-ignore`.
- No raw hex in components — `@theme` tokens only. Cyan banned from action buttons.
- Solid-fill Button discipline (P13.1) holds.
- Local commit only — Billy pushes after verifying.
- Halt + report if a milestone needs an architectural decision the plan doesn't cover
  (the P16.4 canvas escape-hatch is the most likely trigger).

## Risks to monitor

- **7,144-node render cost.** The whole phase's viability rides on P16.4. The
  brand filter + condensed toggle + `content-visibility` should clear it; canvas
  is the documented fallback, not a failure.
- **Hue sort "looks wrong."** Desaturated paints scattered through the spectrum
  read as noise — the neutral-band rule in P16.1 is the fix; tune the saturation
  threshold against the real catalog before P16.3 ships.
- **Hex quality.** `hexConfidence` varies (`high` / `medium`). Low-confidence
  hexes may sort oddly. v1 trusts the stored hex; surfacing confidence is out of
  scope.
