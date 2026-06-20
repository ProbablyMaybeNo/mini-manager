# Typography Audit — mini-manager

**Date:** 2026-06-20 · Read-only audit, no code changed. Stack: Next.js 16, Tailwind v4 (`@theme`), tokens in `src/app/globals.css`. Kit primitives in `src/components/kit/` are the de-facto source of truth; many call sites bypass them with raw classes.

> **Purpose:** the app's font categories are tangled — the same family/size token is reused across surfaces that should be independent, so changing one bleeds into others ("bump a body size → random other text grows", "button size hits some buttons not others"). This maps the current state, names every bleed, and proposes a clean taxonomy + migration.

---

## 1. Current token inventory

### Font-family tokens (`globals.css` `@theme`, ~109–116)

| Token | Resolves to | Fallback | Intended role |
|---|---|---|---|
| `--font-display` | **Unbutton** | IBM Plex Mono | H1 / page titles |
| `--font-osd` | **IBM BIOS** | IBM Plex Mono | H2 / menu / headers / labels |
| `--font-mono` | **VT323** | IBM Plex Mono | body-1 / tables / text (app default) |
| `--font-button` | **DePixel Klein** | IBM Plex Mono | buttons |
| `--font-body2` | **VT323** | IBM Plex Mono | body-2 / log / activity |
| `--font-lightpixel` | Light Pixel 7 | IBM Plex Mono | unassigned |
| `--font-unbutton` | Unbutton | VT323 | unassigned |

Base bindings: `body → var(--font-mono)` (VT323, global default); `button → var(--font-button)` (DePixel Klein); inputs inherit (VT323); `.font-display` adds `letter-spacing:0.14em`.
Stale comment block (`globals.css:3–9`) claims body→Flexi IBM VGA True, H2→UAV OSD Mono, H1→3D Pixel — none match the live `@theme` values, which are authoritative.

### Body size scale (`~120–127`) — Tailwind emits `text-xs`…`text-4xl`
`xs` 12px · `sm` ~15.5 · `base` ~17.5 · `lg` 20 · `xl` ~24.5 · `2xl` ~29.5 · `3xl` 35 · `4xl` ~47.5.

### Role-size tokens (`~132–134`) — emit `text-button` / `text-dropdown` / `text-element`
`--text-button` 12px · `--text-dropdown` ~16.3px · `--text-element` 12px. Independent of the body scale by design — **but silently broken at runtime (see §3-B).**

### Custom typography utilities
- `label-osd` — `font-osd` + hard **12px** + uppercase + `0.15em`. Canonical H3/section/meta label. (Hard px, NOT `var(--text-xs)`.)
- `label-osd-h2` — `font-osd` + hard **16px**. H2 panel/stat titles.
- `text-glow-*`, `text-display-shadow` — colour/shadow, not sizing.

### Loaded-but-unwired faces
All `@font-face` faces have woff2 in `public/fonts/`. **Flexi IBM VGA True is loaded but assigned to NO `--font-*` token** — it appears only in the stale comment and as a Theme Studio dropdown choice. Despite multiple docs asking for Flexi as the body face, the live body font is VT323. `pixelsplitter-bold.woff2` exists with no `@font-face`.

---

## 2. Surface → token map

| Surface | Font token | Size | Example |
|---|---|---|---|
| Page H1 title | `font-display` | `text-2xl`→`sm:text-3xl` | `shell/PageHeader.tsx:19` |
| H2 panel/stat title | `label-osd-h2` | hard 16px | `kit/StatBox.tsx:39`, `kit/Panel.tsx:50` |
| H2 section heading (raw) | `font-osd` | `text-sm`/`text-xs` | `public/LandingView.tsx:72`, `tools/ToolsHubView.tsx:43` |
| H3 label (canonical) | `label-osd` | hard 12px | `kit/Input.tsx:29`, `dashboard/ProjectWorkspaceBody.tsx:67` |
| H3 label (raw, not migrated) | `font-osd` | `text-[12px]` + tracking | dozens — `tools/*`, `library/*`, `recipe/*`, `focus/*` |
| Table column header | `font-osd` | `text-[12px]` uppercase | `dashboard/ProjectsTable.tsx:300`, `library/PaintListTable.tsx:72` |
| Table cell — project Title | `font-mono` (VT323) | `text-sm` | `dashboard/ProjectsTable.tsx:139,165` |
| Table cell — generic data | `font-mono` | `text-xs`/`text-[12px]` | `collection/CollectionTable.tsx:216` |
| Body / paragraph (notes, descriptions) | `font-mono` (VT323) | `text-sm` | `focus/FocusView.tsx:128`, `public/LegalDoc.tsx:27` |
| "Paste URL" / instructions | `font-mono` | `text-[12px]` | `collection/PasteUrlBar.tsx:97` |
| Button (kit) | `font-button` | **`text-button`** | `kit/Button.tsx:19` |
| IconButton (kit) | `font-button` | **`text-sm/base/lg`** (overrides `text-button`!) | `kit/IconButton.tsx:19–21` |
| "Buttons" that are raw spans/links | `font-osd` | `text-[12px]` | `library/PaintInfoPanelContent.tsx:70`, `focus/Stopwatch.tsx:74`, `error.tsx:18` |
| Dropdown — Listbox trigger + option | `font-osd` | **`text-dropdown`** | `kit/Listbox.tsx:143,161,203` |
| Chip / TypeChip / StatusText / PriorityTag | `font-osd` | `text-[12px]` | `kit/tags.tsx:38,56,71` |
| Stat / KPI number | `font-display` | `text-3xl`→`lg:text-4xl` | `kit/StatBox.tsx:47` |
| Tools "feature" copy | `font-mono` | **`text-element`** | `tools/ColorPicker.tsx:138`, `tools/LayeringTool.tsx:91` |
| Activity feed | `font-body2` (VT323) | **`text-element`** | `kit/ActivityFeed.tsx:23,36` |
| Form input text | `font-mono` (inherit) | `text-sm`/`text-xs` | `kit/Input.tsx:47` |
| Recipe/paint tile — name / brand / layer | `font-mono` / `label-osd` / `font-body2` | `text-[18px]` / 12px / `text-[14px]` | `kit/RecipePaintTile.tsx:45,48,51` |
| Colour-square / swatch labels | `font-osd`/`font-mono` | `text-[12px]` | `tools/ColourWheelTool.tsx:167,212` |
| Tooltip | `font-mono` | `text-[12px]` | `dashboard/UpcomingEventsBar.tsx:47` |
| Nav links | `font-osd` | `text-sm` uppercase | `shell/NavLinks.tsx:33` |

---

## 3. The bleed — core findings

**A. `font-mono` == `font-body2` (both VT323): one face, four "different" surfaces.** Byte-identical tokens. Body paragraphs, ALL table data cells (incl. project Title `ProjectsTable.tsx:139`), the activity feed (`font-body2`), and paint-tile layer text are the same typeface. Swapping `--font-mono` to give body a new face (the Flexi ask) instantly re-skins every table cell and data readout. There is **no separate "prose" vs "data" family**.

**B. Role-size tokens are DEAD at runtime — stripped by `tailwind-merge` (root cause of the Theme Studio slider bug).** `--text-button`/`--text-dropdown`/`--text-element` are real utilities, but `src/lib/cn.ts` does NOT register them as font-size utilities, so tailwind-merge classifies `text-dropdown`/`text-element`/`text-button` as **text-COLOR** and drops them when merged next to a real colour class. Verified against the live call sites:
```
Listbox option  ("…text-dropdown … text-fg")     → text-dropdown STRIPPED
Listbox trigger ("…text-dropdown text-fg-faint") → text-dropdown STRIPPED
ActivityFeed    ("…text-element text-cyan")       → text-element STRIPPED
```
So every surface pairing a role-size token with a palette colour inside `cn()` loses its size and falls back to inherited body size. **This is the SAME bug class as UX-001** (the glow tokens stripped next to `text-cyan`) — `cn.ts` needs the role tokens registered as a font-size group. It's a tailwind-merge config bug, not a CSS-var bug.

**C. IconButton ≠ Button on size.** `Button` uses `text-button`; `IconButton` overrides with `text-sm/base/lg` (`IconButton.tsx:19–21`). So `--text-button` governs text buttons but NOT icon buttons — the literal "button size affects some buttons not others."

**D. Many "buttons" are raw `font-osd` spans/links, not the kit Button.** `PaintInfoPanelContent`, `Stopwatch`, `RecipePaintPicker`, `PasteUrlBar`, `error.tsx`, `SegmentedToggle` use `font-osd text-[12px]` to look like buttons — IBM BIOS, not DePixel Klein, hard 12px not `text-button`. Changing the button font/size touches none of them.

**E. `font-osd` is one face shared across H2 headings, H3 labels, table headers, chips, badges, dropdowns, nav, and pseudo-buttons.** IBM BIOS is the most overloaded family — all these distinct surfaces move with one `--font-osd` change.

**F. `text-[12px]` is the universal small size** — column headers, chips, badges, meta labels, tooltips, small cells, helper text all ~12px. "Make chips a touch bigger" drags headers/labels/tooltips with it.

**G. `label-osd` / `label-osd-h2` hard-code px** (12/16), bypassing the size scale — a third separate sizing mechanism immune to the Theme Studio sliders.

**H. Adoption gap:** `label-osd` exists but ~40+ raw `font-osd text-[12px] tracking-[…]` labels (tracking 0.08–0.25em) never migrated. Two label systems coexist.

---

## 4. Proposed clean taxonomy

Each category = exactly ONE family token + ONE size token, zero cross-category sharing. New family tokens may alias the same face initially, but stay distinct so they can diverge without bleed. Values preserve the current look as a starting point.

| Category | Family | Size | Face / size | Migrates from |
|---|---|---|---|---|
| **Display / Title** (H1) | `--font-display` | `--text-title` | Unbutton ~29–35px | PageHeader H1, error/legal/recipe H1 |
| **Section Heading** (H2) | `--font-heading` *(new)* | `--text-heading` (16) | UAV OSD Mono *or* IBM BIOS | `label-osd-h2`, raw `font-osd` headings |
| **Section Label** (H3 eyebrow) | `--font-label` *(new)* | `--text-label` (12) | IBM BIOS 12px 0.15em | `label-osd` + 40+ raw labels |
| **Column Header** | `--font-label`/`--font-colhead` | `--text-colhead` (12) | IBM BIOS 12px 0.18em | all table `<th>` |
| **Body / Prose** | `--font-body` *(new → Flexi)* | `--text-body` (~15.5) | Flexi IBM VGA True | prose in FocusView, LegalDoc, PageHeader tagline, PasteUrl |
| **Mono-Data** (cells, Title, hex) | `--font-mono` (VT323 or Flexi) | `--text-data` (~15.5) | `font-mono` table cells |
| **Button** (text + icon) | `--font-button` | `--text-button` (12) | kit Button + IconButton + raw pseudo-buttons |
| **Control / Dropdown** | `--font-control` *(new)* | `--text-dropdown` (~16) | Listbox, SegmentedToggle |
| **Chip / Badge / Tag** | `--font-chip` *(new)* | `--text-chip` (12) | `tags.tsx` |
| **Stat-Number** | `--font-display` | `--text-stat` (~35–47) | StatBox |
| **Caption / Helper** | `--font-body` | `--text-caption` (12) | hints, errors, tooltips, footnotes |

**Open decision — Flexi IBM VGA True:** loaded but unwired. Wire it into `--font-body`? And does it replace VT323 for **Mono-Data** (table cells) too, or only prose? `pixelsplitter-bold.woff2` has no `@font-face` — wire or delete.

---

## 5. Migration delta (no edits made)

1. **Fix `cn.ts` to register the role-size tokens (THE UNLOCK).** Add `text-button`/`text-dropdown`/`text-element` (+ new `--text-*` role tokens) to a `font-size` override group in `extendTailwindMerge` so they stop being treated as colours. Single fix makes the existing Theme Studio sliders actually move Listbox/ActivityFeed. **Small. Highest priority** — without it every new role token below breaks the same way. (Same fix pattern as the glow-token fix already in `cn.ts`.)
2. **Split `--font-osd`** into `--font-heading` / `--font-label` / `--font-control` / `--font-chip` (all initially = IBM BIOS, look unchanged), then find-replace `font-osd` per surface (chips→`font-chip`, dropdowns→`font-control`, headers→colhead, H2→heading, H3→label). **Medium.**
3. **Adopt one label class** — replace the 40+ raw `font-osd text-[12px]` strings with `label-osd`/`text-label`; convert `label-osd`/`label-osd-h2` to `var(--text-label)`/`var(--text-heading)` instead of hard px. **Large** (highest churn).
4. **Split body family** — add `--font-body` (Flexi) + `--text-body`/`--text-data`; migrate prose → `font-body text-body`, leave table cells on `font-mono text-data`. Finally separates prose from data. **Medium–Large** (~225 `text-*` across 64 files, mostly mechanical).
5. **Unify buttons** — `IconButton` → `text-button`; convert raw pseudo-buttons to kit `Button`/`buttonVariants`. **Medium.**
6. **Chip/Stat/Dropdown size tokens** — `tags.tsx`→`text-chip`, `StatBox`→`text-stat`, confirm Listbox→`text-dropdown`. **Small** (depends on step 1).
7. **Wire/remove stray faces** — `--font-body`→Flexi; add `@font-face` for `pixelsplitter-bold` or delete; fix the stale comment block (`globals.css:3–9`). **Small.**

**Suggested order:** 1 → 7 → 2 → 6 → 5 → 3 → 4. Step 1 is the unlock — do it first and verify a slider moves the Listbox before building new role tokens on the same broken merge config.

**Key files:** `src/app/globals.css`, `src/lib/cn.ts:11–35` (the bug), `kit/Button.tsx:19`, `kit/IconButton.tsx:19–21`, `kit/Listbox.tsx:143,161,203`, `kit/ActivityFeed.tsx:23,36`, `kit/tags.tsx:38,71`, `kit/StatBox.tsx:39,47`, `dashboard/ProjectsTable.tsx:139,300`, `dev/theme/ThemeStudio.tsx`, `dev/ThemeOverrides.tsx`.
