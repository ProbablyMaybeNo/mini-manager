# Post-Launch Polish Backlog

Items deferred across R9 / R10 / R11 audits + Phase 14 (stopwatch) spillover. Working through these while Stripe wire-up is blocked on Ross's account setup.

## Cluster A — Surface polish (no FocusPanel touch)

- [ ] **UX-904 — Unified attach-recipe modal across surfaces.** Audit found three paths producing different outcomes: (a) /recipes/[id] → ASSIGN TO PROJECT ▼ (attaches existing), (b) /projects table → + ATTACH (creates NEW empty recipe auto-named), (c) /projects/[id] COLOR SCHEME box → click + tile (does nothing). Fix: unify on a modal with "Pick from your library" + "Start new recipe" tabs, surfaced from every entry point.

- [ ] **UX-908 — ColorPicker library-match sort + ΔE cap.** Drawer's library matches include far-off paints (picking magenta returns "Rubber Black"). Fix: same MATCH score sort as standalone /tools/match; cap at a sane ΔE threshold rather than padding to 50 results.

- [ ] **UX-910 — Library paint name truncation on mobile.** At 414px "507a Admiralty Dark Grey" → "507a Admiralty…" with empty whitespace right of BRAND. Fix: NAME ~1.5× BRAND width on mobile, let BRAND wrap to 2 lines.

- [ ] **UX-1001 — Library star vs Wishlist page IA gap.** Library row star toggles `isWishlistedPaint` (paint inventory column), but `/wishlist` only renders vendor-URL or Match-tool adds. Two parallel "wishlist" sources sharing the same name confuses recruits. Fix path: rename the library star to "Mark as wanted" / "Favorite" and keep `/wishlist` for kit/box/manual adds. Cheapest unification; data layers stay disjoint but the naming makes intent clear.

- [ ] **UX-1002 — NET·LAG threshold trips on Vercel cold start.** The `>1200ms` threshold in `StatusBar.useNetStatus()` flashes amber on free-tier cold starts. UX-911 tooltip mitigates but the flash is visible. Fix: bump to ~2000ms (one-line in `StatusBar.tsx:68`) or skip the first ping tick.

- [ ] **UX-912 — Slot swatch tint vs label hex consistency.** Two slots created at slightly different wheel positions render as different cyan shades but both labels show "#47D1D1". Either swatch shows a LIGHTNESS-adjusted preview or the label is wrong. Needs investigation — render the swatch from the exact hex the label shows.

## Cluster B — FOCUS section expansion (FocusPanel.tsx)

These both modify `src/components/focus/FocusPanel.tsx` and `src/components/focus/FocusPicker.tsx` — must ship in the same agent run.

- [x] **UX-907 — Multi-recipe per project tabs on FOCUS / leaf workspace.** A project can have 2+ recipes attached but FOCUS panel + leaf COLOR SCHEME box only display ONE (most recent). Per-step notes from older recipes appear to "disappear" (still persisted, just hidden). Fix: horizontal tab/segmented control above the slot grid when 2+ recipes attached; default to most recently used; segmented buttons follow P13.1 solid-fill discipline. → `3d5a321`

- [x] **Phase 14 spillover — Stopwatch feature.** Originally planned for FOCUS, deferred until PLANNER landed. Now ships: → `2f50fcb`
  - Stopwatch UI in the FOCUS panel header (start / pause / resume / stop).
  - Optional `paint_sessions` table: `id`, `user_id`, `project_id`, `started_at`, `ended_at`, `duration_seconds`.
  - On stop → persist session row + emit `activity_log` row `kind = 'paint_session'`.
  - Time-spent rollup somewhere visible: "1h 47m today" / "8h 12m this week" / "47h painted in May" (stash trophy energy).
  - Stretch: pause/resume across reloads via the session row (started_at + cumulative paused-ms in metadata).

## Conventions

- Land each item as its own commit. Tests INTO commit, no orphans.
- `npm test` stays green throughout. Baseline: 1486 passing, 1 skipped.
- `npx tsc --noEmit` clean before every commit.
- Solid-fill Button discipline (P13.1) holds.
- Cyan banned from action buttons.
- Local commit only — Billy pushes.

## Out of scope (blocked or deferred)

- **P10.4-P10.8** Stripe wire-up — blocked on Ross's Stripe account setup.
- **UX-903** Generic "this page couldn't load" on recipe-assign (intermittent) — couldn't reproduce; waits for a real recurrence with telemetry.
