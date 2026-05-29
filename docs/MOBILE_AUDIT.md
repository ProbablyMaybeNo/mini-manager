# Mobile Audit — P6.4

Captured 2026-05-28 against the iPhone-X-class viewport (375×812). The five
primary surfaces and the recipe editor were walked thumb-first. Each entry
records the before-state, the fix shipped in P6.4, and the file(s) touched.

The Phase 6 ship criterion (per V2-BUILD-PLAN §11.6) is "every primary flow
runs thumb-only on a 375px viewport." This pass clears the surfaces below
of that bar; future polish (pull-to-refresh, long-press menus, full PWA
install) is explicitly deferred.

---

## Library (`/library`)

**Before.** FilterRail rendered inline beside the LibraryTable. At 375px
the rail squeezed the table off-screen, the PaintDetailPanel was a
full-width drawer at the same z-index as the bottom tab bar
(introduced in P6.1), and the page used `h-screen` which overflowed the
new mobile chrome by ~80px.

**After.**
- FilterRail is hidden on mobile and replaced by a `[ Filters ]` trigger
  pinned to the top-right of the page (`top-14`, below the mobile
  header). Tapping it opens a bottom-sheet drawer (`max-h-[80vh]`,
  `bg-bg-panel`, scrim overlay) that auto-closes when a filter is
  committed.
- PaintDetailPanel `z-50` (above the `z-40` bottom tab bar) and the
  fixed drawer adds `pb-20` on mobile so the action footer clears the
  tab bar.
- Library page wrapper height is now `h-[calc(100dvh-3rem-5rem)]` on
  mobile (viewport minus mobile header height minus tab bar height) and
  `h-screen` on desktop. The header now uses `px-4 md:px-8` so the
  hero matches the surrounding chrome on narrow viewports.

**Files.** `src/components/library/LibraryPageClient.tsx`,
`src/components/library/PaintDetailPanel.tsx`, `src/app/library/page.tsx`.

---

## Wishlist (`/wishlist`)

**Before.** WishlistTable used a single 8-column grid template with
five columns visually hidden on mobile via `hidden md:inline`. With
`display: none` cells the cell allocation also collapsed, so the wider
column track sizes from the desktop template still bled through and
forced horizontal scroll. WishlistDetailDrawer shared the `z-40` bottom
tab bar layer.

**After.**
- WishlistTable now switches grid templates via Tailwind responsive
  arbitrary values: `grid-cols-[40px_minmax(0,2fr)_70px_14px_56px]` on
  mobile, the original 8-col layout on `md:` and up.
- WishlistDetailDrawer `z-50` and `pb-20` on mobile to clear the
  bottom tab bar like the library detail panel.

**Files.** `src/components/wishlist/WishlistTable.tsx`,
`src/components/wishlist/WishlistDetailDrawer.tsx`.

---

## Recipe editor (`/recipes/[id]`)

**Before.** The desktop three-pane layout (Body / Zones / Notes) had
working mobile-pane tabs already (P3.5 shipped them). PaintSlotPicker
opened as a `z-20` absolute popover anchored next to its step, but on
mobile the popover hit the new bottom tab bar and the 360px fixed width
was wider than a 375px viewport minus 12px gutters.

**After.**
- PaintSlotPicker `z-50` (clears the bottom tab bar) and
  `max-w-[calc(100vw-1.5rem)]` so it always lands within the viewport.
- Picker listbox `max-h-[55vh]` on mobile (was `max-h-[280px]`) so a
  taller viewport gets more list, a shorter one doesn't push the
  controls off-screen.

**Files.** `src/components/recipes/PaintSlotPicker.tsx`.

Note: zone swatches and step rows already use the global `tap-target`
class, which is 44px on mobile / 32px on desktop via `globals.css`. The
mobile-pane tabs at the top of the editor were already correct at 44px
high. No further changes needed here in P6.4 — step notes-on-mobile is
deferred to P6.6.

---

## StageCounter (project workspace)

**Before.** `+` / `−` buttons on the stage rows already use
`tap-target` (44px mobile, 32px desktop), and the row template
`grid-cols-[5rem_1fr_auto] sm:grid-cols-[5rem_1fr_auto_auto]` already
stacks the action buttons under the progress bar on the narrowest
screens.

**After.** No change. Audit confirms StageCounter ships mobile-correct.

**Files.** `src/components/StageCounter.tsx` (verified, no changes).

---

## Dashboard panels (`RecentlyBoughtLine`, `TopWishesPanel`)

**Before.** RecentlyBoughtLine is a short text line with no fixed
widths. TopWishesPanel uses `grid-cols-[14px_minmax(0,1fr)_auto]` with
both data spans `truncate`-ing. Both fit cleanly at 375px even before
this audit.

**After.** No change.

**Files.** `src/components/dashboard/RecentlyBoughtLine.tsx`,
`src/components/wishlist/TopWishesPanel.tsx` (verified, no changes).

---

## Layout-level fixes

The root layout from P6.1 already pushes `<main>` down by `pt-12`
(mobile header height) and `pb-20` (tab bar height) on mobile, and
clears them on `md+`. The library page intentionally opts out via its
own `h-[calc(100dvh-3rem-5rem)]` because its scrollable table needs
the full mobile viewport minus the chrome — `pb-20` on `<main>` would
have left dead space below the table on mobile.

---

## Deferred / out of scope

- **Step notes input on mobile.** Currently `hidden lg:block` on
  `StepRow.tsx`. The plan punts this to **P6.6** with a tappable
  expand-on-mobile pattern.
- **Zone reorder drag handle.** Also **P6.6**.
- **`window.prompt` for palette save.** **P6.6**.

These four entries are the surviving Phase 3–5 polish debts that the
phase plan explicitly groups in P6.6, so they are not in this audit.

---

## Verification

- `npm run typecheck` — 0 errors.
- `npm test` — 365 unit + integration tests green.
- Manual smoke run pending against a real device (Ross's phone) per
  the Phase 6 ship checklist.
