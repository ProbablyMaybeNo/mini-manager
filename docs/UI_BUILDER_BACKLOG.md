# UI Builder Backlog — Mini Manager

Canonical design-polish queue for the `ui-builder` agent. Items are
ranked by impact-per-effort. Builder picks the next unchecked item,
implements it following the project's existing primitives + tokens,
runs typecheck + tests, commits, and ticks the box.

**Design north star.** Vintage CRT / phosphor terminal aesthetic
(reference: Alien / Fallout terminals, the Terminal_UI framework).
Restrained, monochromatic per surface, with selective color accents
(cyan = active/info, neon green = owned/success, pastel yellow =
wishlisted, amber = warning, red = danger, magenta = special). Every
move should reinforce "this is a working terminal, not a webapp."

---

## P0 — high impact, finish-the-look moves

- [ ] **Top status bar.** Thin row pinned to viewport top showing
      `SYS · NET · SAVED · TIME`. Mono, all-caps, colored status pills
      like the Terminal_UI reference. `SYS: OK` (green), `NET: OK/LAG`
      (green/amber based on `navigator.onLine` + a periodic ping),
      `SAVED · 12s ago` (cyan when in-flight, neutral when idle),
      `14:42:09` (live clock, updates every second). New component at
      `src/components/StatusBar.tsx`, wired into `src/app/layout.tsx`
      authed branch only. Mobile collapses to a single status dot in
      the existing MobileHeader. Don't break the existing MobileHeader
      layout — sit *above* it on mobile or merge into it.

- [ ] **`> ` selection caret on focused list items.** When a row in
      LibraryTable, ProjectRow, recipe ZoneList/StepList, or the
      WishlistTable is focused (keyboard) or active (`aria-current=true`),
      render a cyan `>` glyph as a `::before` prefix. Pure CSS, no
      layout shift (use `position: relative` + `::before` with
      `left: -1ch`). Affirms keyboard navigation visually + reads as
      a CLI prompt.

- [ ] **`<LogTag>` primitive + sweep.** New primitive at
      `src/components/ui/LogTag.tsx`. Renders `[INFO]` / `[OKAY]` /
      `[WARN]` / `[ERR]` / `[DEBG]` in mono, bracket-wrapped, colored
      to status tokens (info=cyan, okay=green, warn=amber, err=red,
      debg=magenta). Apply across:
        - ImportPreview output lines
        - Server-action error blocks (currently raw red text)
        - Toast viewport (already has icons; LogTag can replace the
          uppercase title prefix for parity with logs)
        - Empty-state messages where appropriate
      Single-commit primitive + vitest + 2-3 consumer wire-ins.

- [ ] **Caret colour on inputs.** Browser-native text caret is white
      and visually wrong. Add `caret-color: var(--color-cyan)` to all
      `input`, `textarea`, `select` in `globals.css`. Two-line change.

## P1 — polish

- [ ] **Phosphor glow on active nav.** Active NavRail items + active
      BottomTabBar items currently use plain cyan text/icon. Add
      `text-shadow: 0 0 6px color-mix(in srgb, var(--color-cyan) 30%, transparent)`
      to the active state only. Same idiom as the existing `glow-cyan`
      utility — extend that class or add `glow-cyan-soft`. Inactive
      items unchanged.

- [ ] **Animated number counters.** When a stage count, owned count,
      or progress percent changes, animate the value transition with
      a ~250ms count-up. New hook `src/lib/hooks/useAnimatedNumber.ts`
      (Web Animations API or `useState` + `requestAnimationFrame`).
      Apply to StageCounter, OwnedCounter, AggregateCountersDisplay,
      and the percent label next to ProgressBar in ProjectRow. Respect
      `prefers-reduced-motion: reduce`.

- [ ] **CRT sweep band.** Third body-level pseudo-element overlay
      layer (after the scanlines + vignette landed in `599f3a4`). A
      single faint horizontal band ~30px tall, ~5% opacity cyan,
      traveling top→bottom over 12s, then idle 8s before repeating.
      Animation gated on `prefers-reduced-motion: reduce`. Disable via
      the same `html.crt-off` opt-out class. Tweak duration if it
      reads as distracting on long pages.

- [ ] **Wishlist module surfaces — finish the yellow sweep.** The
      `599f3a4` commit flipped wishlist colours in InventoryControls
      + LibraryGrid. Extend to:
        - WishlistTable rows: Wanted-status text → yellow
        - WishlistFilters active-chip: amber → yellow
        - WishlistDetailDrawer chrome: any amber accents that
          semantically read "wanted" → yellow
        - TopWishesPanel / ShoppingForThisPanel: same audit
      Amber stays for warning/pending (P1.x mark-pending states,
      build-in-progress).

## P2 — decorative, may skip

- [ ] **Section divider as ASCII rule.** Replace `<hr>` / lone
      `border-t` lines used INSIDE cards with a styled divider that
      reads as `─────────────` (repeating box-drawing horizontals).
      Pure CSS — `background-image: repeating-linear-gradient` with
      a small dash. Don't apply to structural dividers (card-header
      bottom border, table header rule) — those stay solid.

- [ ] **`> _` blinking prompt in empty states.** Empty-state cards
      (no projects yet, no recipes, no wishlist) currently show prose.
      Add a `> _` prompt below the message with a blinking underscore
      (cyan, 1s blink, gated on reduced-motion). Reinforces the CLI
      feel + invites action.

- [ ] **Boot sequence on first authed load.** When a user lands on
      `/projects` for the very first time after sign-in (detect via
      sessionStorage flag), show a 1.5s overlay with stepped lines:
      `> initialising mini-manager…`, `> loading catalog…`,
      `> ready.` This is genuinely just decorative — skip if it costs
      perceived performance.

- [ ] **Sparkline for project completion trend.** Tiny inline SVG
      sparkline next to the ProgressBar on each project row showing
      the last 7 days of progress. Needs schema work (event log of
      stage bumps) to compute history — flag as needing data-side
      build first, then come back.

---

## Conventions for ui-builder when working this list

- One commit per item. Tests staged INTO the feature commit.
- Tick the box `[x]` and append the SHA on completion: `[x] **Top status bar.** → 599f3a4`
- Do NOT push — Ross reviews each item and pushes.
- Halt + ask if an item needs a new token, primitive, or schema change.
- Match the commit-message style of the last 5 commits in the repo.
- If a referenced primitive doesn't exist yet, halt and propose the addition.
