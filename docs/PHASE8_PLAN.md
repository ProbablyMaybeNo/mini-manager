# Mini Manager — Phase 8 Build Plan

Source of truth for the milestone-builder agent. Each unchecked item is a self-contained milestone with scope, patterns, and acceptance criteria. Build top-down. Tick the box when shipped.

**Phase goal:** Design overhaul. Take Mini Manager from "looks like a developer's terminal cosplay" to "looks like a polished hobby-app you'd pay for." Reference target: the `terminal-ui-framework` aesthetic — cyan-primary action colour, restrained palette, card-based layout, confident type, semantic status pills, clean utility chrome. **Preserve all UX flows unchanged** — this is purely visual + design-system refinement.

**Two Ross-approved direction decisions baked in:**
1. **Cyan-primary.** `--color-accent` and `--color-active` swap from green → cyan. Green is demoted to "success/positive state" only.
2. **Drop ASCII box decoration.** Headings like `┌─ PROJECTS ─` lose the boxes — bold mono caps + cyan colour carries the personality.

**Ship criterion:** Ross opens the live app and says "this looks like a real product now." Every existing page still works. No new routes. No new dependencies.

**Already shipped (do not re-run):** none — Phase 8 starts fresh on top of Phase 7.

**Remaining (build in this order):**

---

## P8.1 — Design token refresh + direct-color audit sweep

- [x] Build this milestone

**Context.** The foundation. Update `src/app/globals.css` tokens to the new palette and rhythm, then sweep the codebase for direct `var(--color-green)` references used for "action / interactive / active" semantics — those need to flip to `var(--color-cyan)` or `var(--color-accent)`. References used for "success / positive / complete" semantics stay green.

**Files to modify.**
- `src/app/globals.css` — token changes:
  ```css
  /* Backgrounds — lift one notch for better card depth */
  --color-bg:          #050607  →  #0a0e14
  --color-bg-elevated: #0c0f12  →  #11161b
  --color-bg-panel:    (new)    →  #1a212b    /* nested elevation */

  /* Accent semantic swap — primary becomes cyan, green stays for success only */
  --color-accent:      var(--color-green)  →  var(--color-cyan)
  --color-active:      var(--color-green)  →  var(--color-cyan)

  /* Cyan refinement — softer primary, keep current bright as callout variant */
  --color-cyan:        #00e5ff  →  #7dd3fc
  --color-cyan-bright: (new)    →  #00e5ff   /* for the rare emphatic-cyan callout */

  /* Status semantic tokens (new — drives the pill component in P8.5) */
  --status-ok:         (new) →  var(--color-green)
  --status-warning:    (new) →  var(--color-amber)
  --status-danger:     (new) →  var(--color-red)
  --status-info:       (new) →  var(--color-cyan)
  --status-neutral:    (new) →  var(--color-fg-muted)
  ```
- `h1` base style — colour shifts from `--color-green` to `--color-cyan`, glow follows.
- `a` link colour — already cyan, no change.
- Focus ring — already cyan, no change.

**Sweep + replace.**
- `grep -rn "var(--color-green)" src/components src/app` — for each hit, decide:
  - "Action / interactive / focus / selected" → replace with `var(--color-accent)` (now cyan)
  - "Success / complete / positive" → keep as `var(--color-green)`
  - "Glow on active nav" → replace with `var(--color-cyan)` + use `.glow-cyan` utility instead of `.glow-green`
- Common patterns to flip: hover backgrounds (`color-mix(in srgb, var(--color-green) 8%, transparent)` → cyan), active borders, selected pill backgrounds, primary button text colour.

**Files to modify (component sweep — non-exhaustive, follow the grep results).**
- `src/components/NavRail.tsx` — active link colour → cyan
- `src/components/MobileHeader.tsx` — branding accent → cyan
- `src/components/BottomTabBar.tsx` — active tab → cyan
- `src/components/ProjectRow.tsx` — selected/hover borders → cyan
- `src/components/QuickAddBar.tsx` — focus ring already cyan, no change
- All `[ + ] Add ...` style buttons — hover `var(--color-green)` → `var(--color-accent)`
- Recipes editor, library filters, wishlist filters — same sweep

**Patterns to follow.**
- Prefer `var(--color-accent)` over direct `var(--color-cyan)` for "interactive / primary action" so future palette shifts only need one token change.
- Keep `var(--color-green)` direct where the meaning is "this thing is complete / owned / positive" — e.g. `[ ✓ ]` Owned toggle, the "complete" stage indicator, progress bars at 100%.
- `.glow-green` stays available but its usage shrinks to status indicators. `.glow-cyan` becomes the standard for active nav + primary headings.

**Acceptance criteria.**
- `npm run typecheck` exits 0.
- `npm test` 438 tests pass / 1 skipped (unchanged from baseline).
- Visually verify on five anchor pages: `/projects`, `/projects/[id]`, `/library`, `/recipes/[id]`, `/tools/wheel`. Active nav highlight is cyan. Primary buttons are cyan. Selected rows have cyan border. "Complete" / "Owned" indicators stay green.
- Hover states across the app feel cyan-flavoured.

**Commit message:** `feat(design): P8.1 — cyan-primary palette + token refresh`

---

## P8.2 — Card primitive, button primitives, pill primitive

- [x] Build this milestone

**Context.** Replace the ad-hoc `frame p-N space-y-N` combos scattered across components with proper named primitives. This is what Terminal UI does — every widget is a "card" with a "card header" and a "card body." Mini Manager currently does this implicitly; making it explicit cleans up component code and ensures visual consistency.

**Files to create.**
- `src/components/ui/Card.tsx` — `'use client'` not required (server component). Props: `title?: string`, `headerActions?: ReactNode`, `accentColor?: 'cyan' | 'green' | 'amber' | 'red'`, `children`. Renders a `<section>` with the new `.card` / `.card-header` / `.card-body` styles.
- `src/components/ui/Button.tsx` — variants: `primary` (filled cyan), `secondary` (outlined), `ghost` (transparent), `danger` (outlined red). Sizes: `sm`, `md`, `lg`. Replaces the inline `inline-flex items-center gap-2 px-4 py-2 frame-strong ...` patterns.
- `src/components/ui/StatusPill.tsx` — props: `status: 'ok' | 'warning' | 'danger' | 'info' | 'neutral'`, `children`. Renders a small bordered pill with semantic colour.

**Files to modify.**
- `src/app/globals.css` — add the `.card`, `.card-header`, `.card-body`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-danger`, `.pill-*` utility classes referenced by the new components.

**Patterns to follow.**
- Components are thin wrappers over the utility classes. Painters / future agents adding new surfaces should be able to use either `<Card title="...">` OR raw HTML with `.card` classes — both work.
- StatusPill is single-line, mono, all-caps, 2px padding, 1px bordered. Matches the Terminal UI reference exactly.
- Button.primary uses cyan filled background with dark text (`color: var(--color-bg)`) for high-contrast CTAs.
- Don't add a Modal primitive yet — existing `<dialog>` pattern works fine.

**Acceptance criteria.**
- `npm run typecheck` exits 0.
- A throwaway page or Storybook-equivalent renders one of each variant of Card / Button / StatusPill correctly.
- No existing pages broken — these are additive, not yet adopted.

**Commit message:** `feat(design): P8.2 — Card, Button, StatusPill primitives`

---

## P8.3 — Heading hierarchy refresh (drop ASCII boxes)

- [x] Build this milestone

**Context.** Mini Manager currently decorates `<h1>` elements with ASCII box-drawing: `┌─ PROJECTS ─`, `┌─ LIBRARY ─`, `┌─ NEW PROJECT ─`. This was personality earlier; now it reads as decoration noise. Drop the boxes — let the bold mono caps + cyan colour + letter-spacing carry the brand.

**Files to modify.**
- Every page-level h1 across `src/app/**/*.tsx`. Find them with:
  ```
  grep -rn "┌─" src/app
  ```
  Replace the JSX from:
  ```tsx
  <h1 className="text-2xl">┌─ PROJECTS ─</h1>
  ```
  to:
  ```tsx
  <h1 className="text-3xl tracking-wide">PROJECTS</h1>
  ```
- `src/app/globals.css` — `h1` base styles get a slight bump:
  - `font-size: var(--text-3xl)` (36px) for page-level h1s
  - `font-weight: 700` (bumped from 500 to read as confident vs. friendly)
  - `letter-spacing: 0.04em` (slight expansion for the all-caps mono look)
  - `color: var(--color-cyan)` (already shifted in P8.1)
- Sub-headings (`<h2>`) get matching size bump: `var(--text-xl)` (22px), letter-spacing `0.06em`, colour `var(--color-fg-muted)` for non-primary sections.

**Patterns to follow.**
- ASCII box decoration is GONE from h1s, but you CAN keep occasional `┌─ ─┐` decoration on truly decorative places (boot-sequence home page, error pages, modal corner accents) — judgment call per location.
- Page subtitles (the muted prose under h1) stay sans-serif as-is. They're prose, not chrome.
- Mobile: h1 text-3xl wraps cleanly at narrow widths because mono is constant-width. Verify on 375px.

**Acceptance criteria.**
- `npm run typecheck` exits 0.
- Grep returns zero `┌─` in h1-containing JSX (occasional ASCII art in body content is fine).
- Visually: every page's title reads as a confident headline, not a decorated nameplate.

**Commit message:** `feat(design): P8.3 — drop ASCII heading boxes, bump h1 hierarchy`

---

## P8.4 — Card-based layout adoption on primary surfaces

- [x] Build this milestone

**Context.** Adopt the `<Card>` primitive across the primary widget surfaces. Currently most pages stack inline sections separated by `.section-title` divider lines. Cards group related content visually and create a clear z-axis. Reference: the Terminal UI dashboard's RESOURCE_MONITOR / ACTIVE_PROCESSES / QUICK_ACTIONS / KERNEL_LOG layout.

**Files to modify (per surface).**
- **`/projects` dashboard** — wrap `<TopWishesPanel />`, `<RecentlyBoughtLine />`, the Backlog list, the Active list, and the All Projects table each in a `<Card title="...">`. The current per-section `.section-title` line dividers are replaced by card headers.
- **`/projects/[id]`** (project workspace) — wrap stage counter panel, named-models panel, recipe panel, "Shopping for this" panel each in a `<Card>`. Keep the workspace's existing layout flow.
- **`/library`** — wrap the filter rail (left column) in a single `<Card title="FILTERS">`. Wrap the detail panel (right slide-in) in a `<Card title="PAINT DETAIL">`. Leave the table itself uncarded — it's the primary content, not a widget.
- **`/recipes/[id]`** (recipe editor) — wrap the zone list in a `<Card title="ZONES">`, the step list in a `<Card title="STEPS">`, the notes pane in a `<Card title="NOTES">`. Mobile pane tabs sit above the cards.
- **`/wishlist`** — wrap the quick-add bar in a `<Card title="QUICK ADD">`, the filters in a `<Card title="FILTERS">`, and leave the table itself uncarded (same logic as /library).
- **`/tools/*`** — each tool's input pane in a `<Card title="INPUT">`, output pane in a `<Card title="OUTPUT">`. The footer (Send to recipe / Save palette) stays sticky as-is.

**Patterns to follow.**
- Don't wrap EVERYTHING in cards — primary content (paint table, recipe step rows) stays uncarded so the surface has breathing room.
- Card headers are 10-12px vertical padding, body is 14-16px padding. Tight enough to stay information-dense.
- On mobile, cards still render but become single-column stacked — no horizontal scrolling.
- Don't introduce new layout grids — reuse the existing Tailwind grid setups, just wrap children in Card.

**Acceptance criteria.**
- `npm run typecheck` exits 0.
- Each anchor page (the 6 listed above) renders with the card-based layout — no broken layouts, no lost content.
- Mobile viewport (375px) — cards stack vertically without horizontal scroll.

**Commit message:** `feat(design): P8.4 — card-based layout on primary surfaces`

---

## P8.5 — Status pills replace plain-text labels

- [x] Build this milestone

**Context.** Mini Manager renders project status, paint type, paint owned/wishlist, recipe attachment status, and wishlist item status as plain coloured text. Terminal UI uses pill chips for ALL of these — bordered, mono, all-caps, semantic colour. The pill component from P8.2 already exists; this milestone is its rollout.

**Files to modify.**
- `src/components/ProjectRow.tsx` — the `displayStatus(project)` output ("Pile", "Building", "Painting", etc.) renders as a `<StatusPill status="...">` matched by semantic:
  - Untouched / Pile → `neutral`
  - Building / Priming → `info` (cyan)
  - Painting → `warning` (amber, in progress)
  - Completed → `ok` (green)
  - Shelved → `neutral` muted
- `src/components/library/PaintRow.tsx` — paint type indicator: `<StatusPill status="info">PAINT</StatusPill>`, `<StatusPill status="warning">WASH</StatusPill>`, etc. (Note: matches Terminal UI's "RUN / SLP / STP / IDL" pattern.)
- `src/components/wishlist/WishlistTable.tsx` — wishlist item status: `Wanted` → `info`, `Bought` → `ok`, `Cancelled` → `neutral`.
- `src/components/recipes/AttachedRecipeSummary.tsx` (or sibling) — recipe attachment chip: `Standalone` → `neutral`, `Attached: <project>` → `info`.

**Patterns to follow.**
- Pill text stays ≤ 12 chars where possible. "PAINTING" not "CURRENTLY PAINTING."
- One pill per row max in dense table contexts — no pill clusters cluttering rows.
- Pills inside cards: use the card's accent colour subtly (border-only, no fill) to avoid over-saturating.

**Acceptance criteria.**
- `npm run typecheck` exits 0.
- Across `/projects`, `/library`, `/wishlist`, and `/recipes/[id]`, every status indicator renders as a pill (not plain text).
- Colour-coding is consistent: green = success, cyan = info/in-progress, amber = warning, red = blocked/error, grey = neutral.

**Commit message:** `feat(design): P8.5 — status pills replace plain-text labels`

---

## P8.6 — Top utility cluster + bottom user chip (chrome polish)

- [x] Build this milestone

**Context.** Terminal UI's top bar carries `SYS: OK | NET: LAG | Default ▾ | NOTIFICATIONS [3]` — a compact utility cluster that surfaces system state at a glance. Bottom-left carries a user chip with avatar + "USER_ADMIN | ONLINE" status. Adopt the spirit of both for Mini Manager's NavRail / MobileHeader.

**Files to modify.**
- `src/components/NavRail.tsx` — add a footer to the desktop nav:
  - Small "v0.x.x // STABLE" build label (read from package.json version at build time)
  - User chip at the bottom: small circle avatar (initial letter) + username + green online dot
- `src/components/MobileHeader.tsx` — add a small status cluster top-right next to the user avatar:
  - Online indicator (green dot + "ON")
  - Skip notifications counter for now (no notifications feature shipped)
- `src/app/projects/[id]/page.tsx` — verify the breadcrumb (`← Projects > {project name}`) reads well with the new typography.

**Patterns to follow.**
- User chip avatar: 32px circle, initial letter from username, cyan border on hover.
- Online dot: 8px green circle with `box-shadow: 0 0 6px var(--color-green)` for the subtle phosphor pulse.
- Status cluster items are pills (reuse P8.2's StatusPill).

**Acceptance criteria.**
- `npm run typecheck` exits 0.
- Desktop NavRail footer shows user chip with online dot. Build version label visible above.
- Mobile header shows online indicator next to user avatar.
- Breadcrumbs render with new typography correctly.

**Commit message:** `feat(design): P8.6 — top utility cluster + user chip`

---

## P8.7 — Dashboard accent counter + section signature polish

- [x] Build this milestone

**Context.** Terminal UI's reference image shows a faded "01" numeral in the corner of the welcome hero — a decorative accent that signals "section 1" without being functional. Mini Manager can adopt the same on its primary dashboard surfaces — `/projects` empty state, `/library` header, `/recipes` empty state — to add polish without distraction.

**Files to create.**
- `src/components/ui/AccentCounter.tsx` — server component. Props: `value: string | number`. Renders the value as a giant (96px) faded-cyan numeral, absolutely positioned in the surface's corner.

**Files to modify.**
- `src/app/projects/page.tsx` — add `<AccentCounter value="01" />` in the empty state.
- `src/app/library/page.tsx` — add `<AccentCounter value="02" />` (only in empty-paint-library case — never shows since catalog always has 7,128 entries).
- `src/app/recipes/page.tsx` — add `<AccentCounter value="03" />` in empty state.
- `src/app/wishlist/page.tsx` — add `<AccentCounter value="04" />` in empty state.

**Patterns to follow.**
- Counter colour: `color-mix(in srgb, var(--color-cyan) 10%, transparent)` — barely visible, decorative only.
- Position: absolute, top-right of the hero/empty-state surface, 24px inset from edges.
- Hide on mobile (`<md`) to preserve narrow viewport real estate.

**Acceptance criteria.**
- `npm run typecheck` exits 0.
- Each empty-state surface renders the counter at desktop widths.
- Counter is decorative only — pointer-events: none, no a11y noise.

**Commit message:** `feat(design): P8.7 — accent counters on empty-state heroes`

---

## P8.8 — Visual regression sweep + mobile polish

- [ ] Build this milestone

**Context.** Catch-up milestone. Walk every primary route at 375px / 768px / 1440px and fix any layout breaks or token-drift from the cumulative P8.1-P8.7 changes. Focus on:
- Anything that visually broke during the palette swap
- Any card layout that overflows or clips on mobile
- Any heading bumped to text-3xl that wraps awkwardly
- Any status pill cluster that crowds a row

**Files to modify.**
- Whatever's broken. Walk through:
  - `/`, `/sign-in`, `/projects`, `/projects/[id]`, `/projects/new`, `/projects/import`, `/projects/import/[id]/preview`, `/library`, `/wishlist`, `/recipes`, `/recipes/[id]`, `/tools` (and each of 4 tools), `/r/[slug]`, `/user`
- Common fixes:
  - Card body padding tightened on mobile
  - Pill colour bumped where contrast is borderline (use the WCAG checker on dim text + new bg)
  - Buttons that lost their colour during the cyan sweep
  - Any `space-y-N` that needs adjustment after the card adoption

**Acceptance criteria.**
- `npm run typecheck` exits 0.
- `npm test` 438 passing / 1 skipped.
- `npm run test:e2e` all 9 missions green.
- Manual sweep through all routes at 375 / 768 / 1440 — no broken layouts, no clipped content.
- Lighthouse mobile ≥ 90, desktop ≥ 95 on `/`, `/projects`, `/library`, `/recipes/[id]`, `/tools/eyedropper` (rolls forward the P6.7 partial measurement).

**Commit message:** `polish(design): P8.8 — visual regression sweep + mobile polish`

---

## Phase 8 ship checklist

After P8.8 lands, before declaring Phase 8 done:

- Ross opens the live app on his phone and says "this looks like a real product now."
- All 9 Playwright E2E missions still green (no functional regressions from the visual overhaul).
- `npm run typecheck` exits 0.
- Lighthouse mobile ≥ 90 / desktop ≥ 95.
- `docs/PERFORMANCE_AUDIT.md` updated with the new Lighthouse scores (closes the P6.7 partial).
- No new dependencies added.

**Deferred to later phases (do NOT build in Phase 8):**
- Light theme / "Daylight" alt theme — defer until painter feedback says it's needed.
- PWA installability + offline-first.
- Custom illustrations for empty states (icon system).
- Per-page colour theming (e.g. orange Necron theme, blue Ultramarines theme) — way out of scope.

---

## Conventions for milestone-builder

Same as PHASE1-7_PLAN.md:

- **Commit only locally; do NOT push.** Ross reviews before pushing — visual changes especially need eyeballing.
- **Pre-commit:** `npm run typecheck` 0 errors. Refuse to commit if it fails.
- **Pre-commit:** `npm test` passes 438 / 1 skipped. **Watch for visual-token-only changes breaking snapshot-style tests** — none currently exist, but if any are added, verify before commit.
- **CRITICAL — stage new test files INTO the same commit as the feature they test.** Past phases leaked test orphans; don't repeat.
- **Bundle plan-tick INTO the feature commit** (1 commit per milestone). No separate `chore: tick` commits.
- **No new dependencies.** Phase 8 is pure CSS / token / component refactor. If you find yourself wanting `framer-motion` or `clsx-variants` or similar — stop and ask.
- **No `any`. No `@ts-ignore`.** Strict mode mandatory.
- **`"use server"` files export ONLY async functions.** Pure helpers go in `src/lib/<domain>/<name>.ts`. Past phases shipped this bug — don't repeat.
- **Server-side first.** New primitives (Card, AccentCounter) stay server components. Button + StatusPill can be server too unless they need interactivity.
- **Tailwind v4 syntax.** CSS-first `@theme`. Use existing tokens — no arbitrary hex.
- **Halt and report** if a milestone has an architectural decision the plan doesn't cover. Do not guess.
