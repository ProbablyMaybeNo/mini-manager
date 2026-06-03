# UX Feedback Batch — 2026-06-03 (Ross)

Tracker for the live-testing feedback so nothing slips through the cracks.
`[ ]` open · `[~]` agent in flight · `[x]` shipped · `[?]` needs design decision
(folds into the mobile/desktop UPGRADE PLANS, not a quick fix).

## A. Coverage section → PLANNER (src/components/planner/**)
- [x] **A1. Make it tiny.** BrushForge fits their whole library in a colour wheel;
      we fit ours in a SQUARE. Each paint cell = literally ~pixel-sized (3–4px),
      so the full library packs into a compact square that fits the calendar's
      footprint. Current 9px is still too big.
- [x] **A2. Approximate the markers.** Owned/wishlist dots do NOT need to sit on
      the exact paint pixel — an at-a-glance estimate of where owned vs wishlist
      colours fall is fine. Render them as a sparse overlay (green=owned,
      yellow=wishlist, black ring) so the painter sees their collection + holes
      at a glance. Density/precision secondary to "small + legible".
- [x] **A3. Layout swap.** Put the COLLECTION square where the CALENDAR is now
      (the big left cell — square aspect). Move the calendar to a MUCH smaller
      widget BELOW the streak box.
- [x] **A4. Rename "Coverage".** Working title **"COLLECTION"** (alts: PALETTE /
      GAMUT / PAINT MAP / RACK) — Ross to confirm; agent applies COLLECTION as
      the default, trivially changed.

## B. Recipe creation page (src/components/recipes/**)
- [ ] **B1. Slot shows the PAINT NAME, not "Slot 1".** When a paint is pinned to
      a slot, the slot label = that paint's name (user can count; slot numbers are
      noise). Keep the layer text at the bottom of the slot.
- [ ] **B2. Custom "colour" squares are NOT addable to a recipe.** Only actual
      paints can be added to a slot. Remove/disable the custom-hex "use this
      colour" add path in the slot picker (PaintSlotPicker) — paints only.
- [ ] **B3. Brand filter in the ADD-A-NEW-COLOUR-SLOT slide-out.** The library
      list in the paint picker needs a paint-company/brand filter (reuse the
      FilterChip + library brand-filter pattern).
- [ ] **B4. Rename "COLOR SLOTS" → "RECIPE SLOTS"** (ZoneList title).
- [ ] **B5. Consolidate notes.** The Slots/Notes tab + the right-hand notes box
      are redundant on wide screens, and the NOTES tab "does nothing" — keep the
      notes BOX only (RecipeNotes), retitle it **"RECIPE NOTES"**, change the
      placeholder to ~"Take recipe notes — write down techniques, painting
      guides, etc." Fix/remove the broken tab (keep a working pane toggle on
      mobile only, or drop it if redundant).
- [?] **B6. Steps box vs Color/Recipe Slots — is it redundant?** Ross: "why do we
      need the Steps box?" Current model is zone(slot) → multiple steps(layers).
      Whether to collapse to a flat slot=paint+layer list is a STRUCTURAL recipe
      redesign → fold into the upgrade plan, don't collapse the data model blind.

## C. Project page (src/app/projects/[id]/** + components/projects/**)
- [ ] **C1. "+ Add Unit" → "+ Model" when viewing a Unit.** Reverts the earlier
      note — adding units to a unit is confusing; a unit contains models. (Army →
      Unit → Model is the mental model.)
- [ ] **C2. COLOR SCHEME box → match the recipe-slot format exactly** — squares
      with the paint name in the middle + layer at the bottom (depends on B1/B4
      landing first so the format matches).
- [?] **C3. "+ Wishlist" button — what does it do?** It deep-links to
      `/wishlist?project=<id>` (the project-filtered wishlist). It reads unclear.
      Decide: clarify (label/tooltip "Shop for this") or remove. → upgrade plan /
      Ross call.
- [?] **C4. Project flow still confusing.** Broad — the Army→Unit→Model flow +
      attach-recipe + color-scheme need a coherent pass. → fold into the upgrade
      plan.

## Conventions
- Per-surface agents, strictly disjoint dirs (planner / recipes / projects).
- tsc clean, tests INTO commits, `npm test` green, @theme tokens, no cyan on
  buttons, solid-fill Button discipline. Local commit only — Billy pushes.
- `[?]` items are intentionally NOT auto-built — they need the design pass.
