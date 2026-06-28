# Redesign V2 — "HEX.CODE" modern dark system

Total reskin + project-flow rebuild, driven by Ross's Figma:
`https://www.figma.com/design/zF0GgSpxJuCS0cXeV3bAl4` (file key `zF0GgSpxJuCS0cXeV3bAl4`).
**Visual source of truth = the Figma frames** (read them directly via the Figma MCP — `get_design_context` / `get_screenshot` per node). **Project-flow source of truth = the panel model below** (NOT the Figma full project-page; borrow its elements only).

This REPLACES the vintage-terminal/CRT aesthetic entirely. New branch `redesign/v2-hexcode` off `main`. Do NOT deploy until Ross approves the look.

## Figma node map (read these for exact values)
- Style Guide `1:2` (colors-typography `1:13`, buttons-states `1:66`, form-elements `1:107`, table-elements `1:149`, navigation `1:191`, cards-panels `1:243`, status-indicators `1:276`, icons `1:313`)
- dashboard-main `4:4` · project-page `13:4` · collection-ideal `24:4` · recipes-page `28:4`
- Paint-Pick side panel `37:5` · army-panel `43:4` · unit-panel `44:4`

## Design tokens (from style guide 1:13)
| token | value |
|---|---|
| `--bg` | `#0D0D17` |
| `--surface` | `#1A1A1F` |
| `--surface-2` | slightly lifted (`#202028`-ish, confirm in Figma) |
| `--border` | `rgba(255,255,255,0.12)` |
| `--accent` (cyan) | the vivid cyan used for logo/active-nav/primary buttons/progress — sample exact from Figma (`get_variable_defs` on a primary button / GO PAINT footer) |
| `--blue` | `#3182E0` |
| `--success` | `#09CD7E` |
| `--warning` | `#F5F17A` |
| `--danger` | `#F12D52` |
| `--highlight` | `#FF2B6D` |
| `--purple` | secondary accent (ON HOLD pill, Models section, Attach button) — sample from Figma |
| `--text` | `#E6E5E5` / titles `#FCFCFC` |
| `--text-dim` | `#888` |
| radius | 6px (controls/cards-inner), 12px (panels/cards) |
| spacing | 8 / 16 / 24 / 40 rhythm |

## Typography
- **Display / headings:** Inter (ExtraBold for page titles e.g. `DASHBOARD`, Bold for section + panel names). letter-spacing tight on big titles (`-0.5px`).
- **Body / labels / table / values:** JetBrains Mono (Regular; Semibold for emphasis). Numbers + hex codes always mono.
- Install via `@fontsource/inter` + `@fontsource/jetbrains-mono` (or next/font) — replace the VT323/Flexi/UAV/Plex stack in globals.css. Keep a `--font-display` / `--font-mono` token pair.

## Core components (style guide 1:66–1:313 — match exactly)
- **Buttons:** primary = cyan fill, dark text, 6px radius (e.g. `+ NEW PROJECT`, `GO PAINT`); secondary = outline; coloured outline variants (green `+ Create`, purple `+ Attach`, blue `ATTACH RECIPE`). Icon+label.
- **Status pills:** outline rounded pills, colour-coded — IN PROGRESS green · PLANNED yellow · ON HOLD purple · DONE cyan · OVERDUE red. Also model stages BUILT/PRIMED/PAINTED/BASED/COMPLETE/WISHLIST.
- **Priority:** coloured dot + label (HIGH red/pink · MED yellow · LOW dim).
- **Filter chips:** pill row, active = filled accent, rest = outline/ghost (ALL · IN PROGRESS · PLANNED · ON HOLD · DONE · NEARLY DONE · OVERDUE).
- **Tables:** mono, row hover, thin white-12% dividers, header row dim labels; cells: swatch-strip, type, count, status pill, priority, completion bar+%, time, action icons (edit/delete/focus-target/chevron).
- **Cards / panels:** `--surface` fill, white-12% border, 12px radius, generous padding.
- **Progress bar:** rounded track, cyan fill (green at/near 100%). Mono % label.
- **Sidebar nav (220px):** logo block top, icon+label items (active = cyan text + cyan left/ållfill indicator + filled row), footer items (SETTINGS/ACCOUNT/TUTORIAL/FEEDBACK). Icons from the icon set.
- **Right rail (270px):** mini month calendar + `+ ADD DATE`, UPCOMING list, RECENT ACTIVITY (coloured dot + text + time-ago).
- **Sliders** (saturation/lightness), **tab bar** (underline-active), **drag-handle step rows**, **swatch strips** — per style guide.

## Pages

### App shell
Sidebar (220px, fixed) + content + optional right rail (270px). Match `4:4`/`13:4` chrome.

### Dashboard (`4:4`)
Title `DASHBOARD` (Inter XBold, cyan underline). Blue `SYS — WELCOME` card (dismissible, 4 CTAs). `PROJECTS ROSTER`: filter-chip row + SORT + filter/add icons; the roster table (TITLE/TYPE/#/RECIPE/STATUS/PRIORITY/COMPLETION/TIME/delete); `+ NEW PROJECT` cyan button. Right rail: calendar + UPCOMING + RECENT ACTIVITY.

### Project FLOW — **panel model (source of truth), not the full page**
Clicking a project row opens the **Army panel** as a right-side overlay (440px); it does NOT navigate away from the dashboard/roster. Drill into a unit → **Unit panel** (breadcrumb back). `GO PAINT` → Focus. Provide an "Expand ⤢ / Open full page" affordance that opens the full project view (`13:4` layout: progress card + big-square recipe + sub-project table + timeline + quick-stats) for users who want the roomy view — but the panel is the default, primary interaction.

#### Army panel (`43:4`) — container
Header: name (Inter Bold) + ARMY pill · `PAINTING · HIGH · 4h 20m` (mono dim) · overall progress bar + % (cyan/green). `UNITS (n)` list — each row: name · 3 recipe-swatch dots · mini bar · % · `›` (drills to Unit panel). `+ Add unit` (green outline). Sticky footer: cyan `▸ GO PAINT · NEXT: <unit>`.

#### Unit panel (`44:4`) — leaf workbench
Header: `‹ <army>` breadcrumb · name + UNIT pill + stage pills (MID/BUILT…) · meta. `RECIPE`: 5 large named swatches + `+ Attach ▾` / `+ Create`. `PROGRESS · n MODELS`: cumulative stage counters (Built/Primed/Painted/Completed) each `– n/N +` stepper + bar; clamp `completed ≤ painted ≤ primed ≤ built ≤ N`; `OVERALL` bar derived w/ partial credit, **rolls up** to the army. Sticky footer: cyan `▷ GO PAINT!`.

### Pick & Paint panel (`37:5`) — the recipe ingredient-picker
`RECIPE › SLOT n` · `PICK & PAINT`. Tabs: **WHEEL + LIBRARY** (HSL wheel + selected swatch + `USE THIS COLOUR →` + HARMONY dropdown + sat/light sliders + the live library matches), **MATCH**, **DROPPER**, **LAYERING**. Library matches: dot + name + brand + match badge (EXACT/NEAR/CLOSE/SIMILAR by ΔE) + `+ ADD` / `✓ OWNED`. Opening from a recipe step's "choose paint" fills that slot.

### Recipes (`28:4`) — 3-pane
nav | recipe list (search, cards w/ swatch strip + "used in N · M steps" + star, tabs MY RECIPES/GALLERY/SHARED, `+ NEW`) | editor (title + SHARE LINK + `⚡ AI GENERATE [PRO]`, swatch strip, ordered step rows: drag-handle + `01` + technique pill (BASECOAT/SHADE/LAYER/HIGHLIGHT/DRYBRUSH/DETAIL) + paint dot+name+brand + note + delete, `+ ADD STEP`, `SAVE RECIPE` + `ATTACH RECIPE`).

### Collection (`24:4`)
Title + `// paints & models…`. PAINT/MODEL toggle + URL auto-import input + ENTER. PAINTS (n): filter chips + `+ PAINT`; table (checkbox/swatch/name/brand/type/qty/price/project chip/status pill/edit+delete) + `+ Add paint row`. MODELS (n) (purple): table (name/type/qty/price/project/status/time/actions). Bottom **BUDGET bar**: per-project `$spent / $budget +remaining` chips + TOTAL SPENT / TOTAL.

### Focus / Library / Tools / Account / Public
Reskin to the system. Focus = paint-along (recipe checklist + timer, loaded by GO PAINT). Library = paint catalog + filter + paint-info panel. Tools hub (wheel/match/dropper/layering) — same engines as the Pick & Paint tabs. Account/settings, landing/pricing/auth — apply tokens + Inter/Mono.

## Phasing (build on `redesign/v2-hexcode`, preview-gated)
0. **Foundation:** tokens + Inter/JetBrains-Mono fonts in globals.css; radii; remove phosphor/scanline/glow. Restyle core kit (Button, Card/Panel, Badge/StatusPill, PriorityTag, Input, Table, ProgressBar, Chip, Slider, Tabs).
1. **Shell + Dashboard:** sidebar nav + right rail + dashboard roster.
2. **Project flow:** Army panel + Unit panel + drill + Go Paint + roll-up; expand-to-full-page.
3. **Recipes** 3-pane + step editor + **Pick & Paint** panel.
4. **Collection** (tables + URL import + budget) + **Focus**.
5. **Library + Tools + Account + public** + polish + a11y/contrast pass.

Each phase: strict TS, reuse new kit, typecheck + unit + integration green, commit per item, preview screenshot, Ross checkpoint before merge.
