# Mini Manager — Ground-Up UI Rebuild Spec (Figma, 2026-06-09)

> THE build document for the full redesign. Source of truth = Ross's Figma file
> (`IHy67xh3iXAxtJE6vHsjUJ`, "Design" page) — reference PNG exports live in
> `docs/redesign-refs/`. Companion docs: `DESIGN_LANGUAGE.md` (tokens/vibe),
> `REDESIGN_AUDIT_BRIEF.md` (moodboard intent), `UX-UI-BEST-PRACTICES.md`
> (global, auto-loaded for Claude; ask if missing).
>
> **This is a REBUILD, not a re-skin of the current pages.** Build each page to
> match its reference PNG. Where the design and best practices conflict on
> sizes/spacing/contrast, best practices win (Ross: "I just went by what I
> thought looked good"). Where a page wasn't designed, extrapolate from the
> language here. The current implementation may be mined for logic/data hooks —
> not for layout or styling.

---

## 0. Locked decisions (Ross, 2026-06-09)

1. **Focus = full page** (`/focus`), launched from dashboard project rows and
   the active-focus chip. No dashboard drawer in v1 (delete/ignore the WIP
   `FocusDrawer.tsx` approach).
2. **Project detail = slide-out inspector** from the dashboard table (same
   panel pattern as library paint-info). `/projects/[id]` page goes away
   (redirect to `/projects` with the inspector open; keep deep-linkability).
3. **FILTER slide-out: normalize to black bg + cyan border** — the blue fill in
   the mock is NOT kept. One uniform panel language app-wide.
4. **Assets:** exported from Figma by Claude. Pixel logo at
   `docs/redesign-refs/assets/logo-pixel.png` (move into `public/brand/`).
   Activity/pixel icons: crop from frame PNGs at native 1x or redraw as tiny
   SVGs (`image-rendering: pixelated` for raster crops). Tool hero graphics:
   bespoke SVG components per DESIGN_LANGUAGE §13, styled to the mock.
5. Mobile layouts derived from desktop by us (desktop drives; collapsed
   sections on mobile per the locked /projects re-architecture decisions).
6. Color/font/button drift in the mocks gets normalized to the §1 tokens.
   Calendar shows the real current month (the "MAY 1985" in the mock is vibe,
   not function). Placeholder copy duplicated across mock pages gets fixed.

## 0.1 Ross's Figma comment on the PAINT INFO slide-out (verbatim intent)

- Keep the layout, restyle: **solid black background, cyan borders**.
- **Add the MATCH feature** found on the recipe-creator slide-out panel.
- **Remove the "PAINT" chip** ("it's obviously a paint").
- **Add TYPE** with options: `ACRYLIC, CONTRAST, WASH, GLAZE, PRIMER,
  CLEAR/TRANSPARENT, TEXTURE, ENAMEL, OIL`.
- **Remove the "Medium Confidence" element.**
- **Rename "MARK AS WANTED" → "+ WISHLIST".**
- **Remove the SOURCE row entirely** (never expose scrape origin).

---

## 1. Tokens (single source — kill all drift)

Palette (matches Style Guide page + DESIGN_LANGUAGE.md):

| Token | Hex | Role |
|---|---|---|
| `--color-bg` | `#0A0A0A` | page base (never pure #000) |
| `--color-surface` | transparent / `#0A0A0A` | panels; **never grey** |
| `--color-cyan` | `#00D2FF` | primary action, selected row, active nav, links, panel borders |
| `--color-green` | `#51FD80` | success/owned/go, positive viz, secondary headings |
| `--color-yellow` | `#EEF996` | warning/wishlist/highlight (sparing) |
| `--color-purple` | `#9B80DC` | special categories/secondary accent (sparing) |
| `--color-red` | `#FF4244` | destructive/error/alert (sparing) |

Any colour in a mock that is *close to* one of these (off-cyan, off-green…)
**becomes** the token. No new hues. Dim/secondary text ≥ `#888` on near-black
(WCAG-AA 4.5:1 floor for body text, 3:1 for large text — check every pairing).

Type (already self-hosted in `public/fonts/`):

| Role | Font | Notes |
|---|---|---|
| Page title | PixelSplitter | pixel display font, top-of-page only, with restrained glow |
| H1/section | UAV OSD Mono | section headers (`PROJECTS`, `ACTIVITY TRACKER`…) |
| H2 + body + data | IBM Plex Mono | readability floor; min 15px body (mono reads small), `rem` units |

Buttons (per Style Guide page): rectangular, sharp corners, 1px border.

| Tier | Solid | Outline |
|---|---|---|
| Primary | cyan fill, **black text** | cyan border, transparent fill, cyan text |
| Secondary | yellow fill, black text | yellow border, yellow text |
| Tertiary | green fill, black text | green border, green text (icon-first, compact) |
| Destructive | red outline / red text (e.g. REMOVE PAINT, CLEAR FILTER) | |

Effects: medium static scanlines + tiered phosphor glow (`--glow-*` exists in
`globals.css`), readability floor, everything animated guarded by
`prefers-reduced-motion`. Hover = brighten + glow-up, not color swap.

Panels: 1px phosphor border, black/transparent fill, corner ticks + tiny
tech labels (`SYS · OK` idiom) on hero panels. Box-in-box nesting.

---

## 2. App shell (every page)

Per all frame refs:

- **Left sidebar rail** (~130px, full height, cyan 1px right border):
  pixel **logo** (CRT monitor, ~88px) top → nav links in IBM Plex Mono caps:
  `DASHBOARD · LIBRARY · RECIPE · TOOLS · COLLECTION` → divider →
  `SETTINGS · ACCOUNT` pinned to a lower group. Active link = cyan + glow;
  inactive = white/green-tinted. Mobile: collapses to top bar + hamburger/sheet
  (44px touch targets).
- **Page header**: PixelSplitter title in page accent colour with glow
  (DASHBOARD green, LIBRARY purple, RECIPE red, TOOLS cyan w/ wrench glyph,
  FOCUS cyan, COLLECTION yellow) + one-line IBM Plex Mono tagline. Unique,
  correct tagline per page (mock reuses Library's line on Recipe/Tools — fix).
- **Routes**: `/projects` = Dashboard (unchanged), `/focus` (new full page),
  `/collection` (new; `/wishlist` + `/collections` redirect into it),
  `/library`, `/recipes`, `/tools/*` stay.

## 3. Dashboard (`docs/redesign-refs/Dashboard.png`)

- **KPI strip** — 4 equal cells in one bordered row: label (green, mono caps)
  over big value (white/cyan): `Active projects`, `Completion %`, `Streak`,
  `Time Total`.
- **PROJECTS panel** — UAV OSD header + green sub-label
  ("OVERVIEW OF ACTIVE PROJECTS AND THEIR PROGRESS"). Table (green header
  row text, black/no-fill cells): `# · TITLE · TYPE · RECIPE · STATUS ·
  PRIORITY · COMPLETION`. RECIPE = row of small colour chips. STATUS = green
  text (IN PROGRESS/COMPLETED/ON HOLD/NOT STARTED). PRIORITY = colour-coded
  (HIGH red, MEDIUM yellow, LOW green-dim). COMPLETION = segmented linear bar
  (cyan in-progress, green 100%, purple on-hold) + % value. Row hover/selected
  = cyan-highlight-row idiom (group-27). Row click → **project inspector
  slide-out**; row also exposes FOCUS launch.
- **Buttons under table**: `ADD PROJECT` (primary solid) ·
  `UPLOAD ARMY LIST` (tertiary outline).
- **Right rail (~320px)**: **PLANNER** panel — month calendar (current month,
  cyan title, red weekend numbers, today boxed, event dots) + `EVENTS` list
  (time + title + description, left cyan bar per item, category tag) +
  `+ ADD EVENT` outline button. **ACTIVITY TRACKER** panel — vertical feed:
  timestamp (cyan, small) / action text (green) / pixel icon right-aligned
  (coin=bought, hammer=built, spray=primed, pot=painted, check-burst=completed,
  magnifier=added). Dashed separators.
- **Footer ticker** — full-width bordered bar: `UPCOMING EVENTS:` + scrolling/
  static items (name red, details white) + date right in green. Reuse/adapt the
  existing `DashboardEventTicker` concept, restyled.

## 4. Library (`Library - Grid.png`, `Library - L_ist.png`)

- Header: LIBRARY (purple) + "Growing library of N paints across all the major
  companies." (N = real count).
- **Grid view**: main canvas = paint-swatch grid (1 cell = 1 paint, ~40px
  cells, thin dark gaps; hue-sorted). Selected cell = cyan ring. Click →
  PAINT INFO slide-out.
- **List view**: table `☐ · swatch · NAME ⇅ · BRAND ⇅ · LINE · T(ype) ·
  HEX(dot+code) · OWN · ★` — selected row solid cyan w/ black text.
  `FILTER` + `CLEAR FILTER`(red) controls above. Grid/List toggle (mock
  implies both views; add an explicit toggle in the header row).
- **COLOR MAP right rail**: "At a glance collection — 1 cell = 1 paint" pixel
  spectrum map, data-driven from the library (hue×lightness sort, greyscale
  band at bottom), with dots marking WISHLIST (yellow) / OWNED (green) paints;
  legend chips at top. This is a canvas/SVG viz component, not an image.
- **FILTER slide-out** (normalized black+cyan): checkbox groups `COLOR`
  (colour-bar-label header, green) / `COMPANY` / `STATUS (WISHLIST, OWNED)`,
  `CLEAR FILTER` red at bottom.
- **PAINT INFO slide-out** (~311px wide): breadcrumb `SYS > PAINT` + brand +
  big paint name (cyan); large swatch image; `NOT OWNED`/`OWNED` status bar;
  **TYPE** value (from §0.1 list); HEX + copy; INVENTORY owned counter (- n +);
  `+ WISHLIST` (yellow outline); HARMONIES (scheme dropdown: complementary/
  analogous/triadic + computed swatch pair w/ nearest-paint links); **MATCH**
  (ported from recipe creator); SIMILAR IN OTHER BRANDS (5 rows: swatch + name).
  NO source row, NO confidence, NO "PAINT" chip.

## 5. Recipes (`Recipe.png`)

- Header: RECIPE (red) + proper tagline (e.g. "Build and share paint recipes
  for every model in your collection.").
- Table: `NAME · RECIPE (chips of step colours) · PROJECT (ASSIGN dropdown,
  purple accent) · SHARE (button)`. `+ RECIPE` full-width outline row below.
- Row click → recipe editor. **Create/edit page not designed** — extrapolate:
  same shell, recipe name header, ordered step list (paint card per step:
  brand/name/technique, solid colour fill + black text per Focus card idiom),
  +PAINT step adder opening the library paint picker w/ MATCH slide-out
  (keep current editor's functionality, rebuilt visually).
- Share keeps existing `/r/[slug]` flow.

## 6. Tools (`Tools.png`)

2×2 card grid (each card = nested-border panel, heading colour-coded, hero
graphic, one-liner):

| Card | Accent | Route | Hero (bespoke SVG component) |
|---|---|---|---|
| COLOR WHEEL | green | /tools/wheel | spiral pixel rainbow wheel + ANALOGOUS 3-swatch callout w/ hex labels |
| COLOR MATCH | yellow | /tools/match | flowing cyan curve bundle (phosphor lines) |
| COLOR DROPPER | purple | /tools/eyedropper | wireframe 3D terrain w/ pin markers + hex labels |
| COLOR STACKING | cyan | /tools/gradient | overlapping translucent colour diamonds |

Sub-tool pages: restyle to shell + tokens, keep current functionality.

## 7. Focus (`Focus.png`) — new `/focus`

- Header: FOCUS (cyan, glow) + "Painting session companion…" tagline.
- **Project bar**: `PROJECT NAME  ×QTY` (green pixel-ish emphasis) + pot icon.
- **Recipe cards row**: one card per recipe step — solid paint-colour fill,
  black text (brand / paint / technique), ~110px; `+ PAINT` outline tile at
  end. Horizontal scroll on overflow.
- **NOTES panel**: free text notes (cyan caps label, mono body).
- **Session row**: stopwatch icon + `HH:MM:SS` timer, `START/STOP` + `LOG`
  controls | `PROGRESS BAR` panel: `+ n/N -` model counter, segmented bar
  (red→yellow→green as completion rises is NOT in mock — mock shows red at
  15%; use single accent fill, colour by % band: red <34, yellow <67, green ≥67)
  + % label.
- **INSPIRATION panel**: `Paste URL to ADD INSPO` input + `Search` button,
  thumbnail row (bordered tiles), lightbox on click (keep current INSPO
  lightbox behaviour).
- Launched with a project context (`/focus?project=…` or last-active).

## 8. Collection (`Wishlist.png`) — new `/collection`

- Header: COLLECTION (yellow, glow). Top-right: `PASTE URL TO ADD PAINTS AND
  MODELS` input + type dropdown (`PAINT ▾`/`MODEL`) — feeds the existing
  scraper/import pipeline.
- **MY PAINT COLLECTION** panel (green sub-label "TRACK AND MANAGE YOUR PAINT
  COLLECTION"): table `IMAGE · NAME · COMPANY · VENDOR · PRICE · RECIPE(chips)
  · STATUS(dropdown WISHLIST/OWNED, yellow/green) · LINK(icon)`;
  `+PAINT` left / `REMOVE PAINT` red right.
- **MY MODEL COLLECTION** panel: `IMAGE · NAME · QUANTITY · COMPANY · VENDOR ·
  PRICE · PROJECT(ASSIGN dropdown) · STATUS · LINK`; `+ MODELS` / `REMOVE
  MODEL`. Selected rows cyan-highlight.
- Wishlist data merges here (STATUS=WISHLIST) and surfaces in Library map dots.

## 9. Project inspector slide-out (not designed — extrapolate)

Same panel language as PAINT INFO (~360px, black, cyan border, breadcrumb
`SYS > PROJECT`): name + type, recipe chips (+assign), status/priority
selectors, completion counter (+ n/N -), army-list/units summary if imported,
`FOCUS` primary button, edit/delete (red) actions.

## 10. Undesigned pages — extrapolate the language

Auth (sign-in/up/forgot/reset), `/user`, `/pricing`, `/projects/new`,
`/projects/import`: shell + tokens + panel idiom. Auth = single centered
nested-border terminal panel with pixel title. Keep all current logic.

## 11. Quality bars

- TypeScript strict, **0 type errors**; build passes; unit + Playwright green.
- Verification gate: `npm run test:verify` (see `docs/MISSIONS.md` § FIGMA Rebuild).
- WCAG-AA contrast on every text/bg pair; focus visible (cyan ring ≥3:1);
  44×44 touch targets; labels on every input; `prefers-reduced-motion`
  strips scanline/flicker/glow animation.
- Keyboard: tables navigable, slide-outs focus-trapped + Esc to close.
- Real data only — no mock content. Empty states designed (terminal idiom:
  `NO ACTIVE PROJECTS — ADD PROJECT to begin`).
- Mobile (375px): rail → top bar; KPI strip 2×2; tables → card rows or
  horizontal scroll with sticky first column; right rail stacks below;
  slide-outs → full-width sheets.
- Match the reference PNGs. When in doubt, open the PNG and compare.
