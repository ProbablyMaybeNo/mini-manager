# Mini Manager — Design Language (Vintage Terminal Rebuild)

> The single source of truth for the UI rebuild. Synthesized from Ross's Figma
> moodboard (GOOD/BAD examples + comments + style guide), his locked answers,
> and a ChatGPT reference plan (adapted — see **Deviations**). Compiled 2026-06-06.
>
> **One-line direction:** *terminal-first, dashboard-second, HUD-last* — a
> grounded retro-futurist command-center OS: black base, the **5 style-guide
> colors treated as glowing CRT phosphor**, nested panels, readable mono type.
> **Not** cheap toy sci-fi, and **not "phosphor"** (that's the garish connotation
> Ross is rejecting — it's *terminal phosphor*, our exact palette + tasteful glow).

---

## 1. North star

The app drifted into boring grey SaaS and **lost the vintage-computer-terminal /
hacker / cyberpunk soul** (Ross flagged the *current app* as a BAD example:
"boring… grey background on dashboard elements — just make it transparent").
The rebuild re-injects **color + character** while keeping the usability wins.

GOOD = pure-black bg, **multi-color** phosphor outlines, **nested rectangular borders**
with corner ticks, circular gauges, isometric 3D, readable tables with a
cyan-highlighted row, the pixel color wheel, minimal sharp icons.
BAD = single washed teal, over-ornamented dials, crowded HUD noise, nothing
readable, cheesy "Fisher-Price cyberpunk."

---

## 2. Color palette

Black base. **Cyan + green are the core UI colors**; yellow, purple, red are
**accents used sparingly** (warnings, tags, statuses, graphs). Kill ALL grey
fills → transparent / black panels with phosphor nested borders.

| Token | Hex | Role |
|---|---|---|
| `--color-bg` | `#000000` | Page base (pure black, matches GOOD examples) |
| `--color-surface` | transparent / `#0A0A0A` | Panels — transparent or near-black, **never grey** |
| `--color-cyan` | `#00D2FF` | **Primary** action, selection / highlighted table row, active nav, links |
| `--color-green` | `#51FD80` | Success / owned / "go" status, positive viz, secondary action |
| `--color-yellow` | `#EEF996` | Warning / wishlist / highlight tags (sparing) |
| `--color-purple` | `#9B80DC` | Special categories / secondary accent (sparing) |
| `--color-red` | `#FF4244` | Destructive / error / alert (sparing) |

- **Cyan-on-actions is now correct** — Ross's button sheet makes Primary cyan.
  This overrides the prior "no cyan on CTAs" guardrail.
- All phosphor-on-black pairings must clear **WCAG-AA (≥4.5:1)** for text.

---

## 3. Typography

| Role | Font | Notes |
|---|---|---|
| Title (page top / hero only) | **Digital Arcade** (or closest licensed display font) | Stylized; sparing use only |
| Heading 1 | **UAV OSD Mono** (or close tactical mono) | |
| Heading 2 | **IBM Plex Mono** | Free, available |
| Body | **IBM Plex Mono** | Readability floor — never sacrifice |

- Source `.woff2`, self-host in `public/fonts/`, wire via `@font-face`.
- IBM Plex Mono is free (Google/Fontsource). Substitute close, **commercially
  licensed** equivalents for Digital Arcade + UAV OSD Mono and note the picks.
- Stylized fonts for headers/labels/flavor only; **body stays readable**, no
  pixel-font walls of text.

---

## 4. Buttons

Rectangular (sharp / slightly rounded), thin **1px phosphor border**, **solid OR
outline** variant per tier. Solid = color fill + **black text**. No gradients,
no glassy/pill SaaS buttons.

| Tier | Color | Variants |
|---|---|---|
| Primary | cyan `#00D2FF` | solid (cyan fill, black text) + outline (cyan border, black fill, cyan text) |
| Secondary | yellow `#EEF996` / green | solid + outline |
| Tertiary | green `#51FD80` | minimal outline, icon-first, compact |

---

## 5. Panels, borders & layout

- **Nested rectangular frames** (box-in-box), 1px phosphor borders, small **corner
  ticks/brackets**, tiny technical labels (e.g. `SYS · OK`, coordinate tags).
- Panels: **transparent or black fill — never grey.**
- Strong grid, consistent padding, thin dividers. **Dense but controlled**, not
  chaotic. Group related info into modules (Gestalt proximity).
- **Responsive + mobile parity is mandatory** (see Deviations) — desktop is the
  design driver, but every surface reflows cleanly to phone.

---

## 6. CRT effects — **Medium, readability-floored**

Ross chose **Medium**; ChatGPT urged restraint. Reconciled: **medium scanlines +
restrained phosphor glow**, optional one-time boot/flicker flourish — but
**readability is a hard floor** (the BAD examples failed by being over-produced).

- Scanline overlay: subtle, generated in CSS (`repeating-linear-gradient`).
- Glow: the existing tiered `--glow-*` text-shadow tokens (already in `globals.css`).
- All motion/scanline/flicker stripped under `prefers-reduced-motion`.

---

## 7. Signature elements (all in first pass — Ross selected every one)

1. **Circular progress trackers** — for headline/KPI progress; keep linear bars
   in dense table rows where circular doesn't fit.
2. **Color bars with black text** — for statuses/labels/tags. Low effort, high impact.
3. **Pixel color-wheel upgrade** — restyle the existing wheel toward the pixel/
   retro rainbow wheel.
4. **Isometric 3D viz + radial menus** — HIGH effort. Attempt a circular
   radar/gauge hero element + radial accents; the full isometric-3D "city"
   visualization may be a fast-follow if it balloons — **HALT and flag** rather
   than ship something half-baked.

---

## 8. Top bar — functional status bar

Re-introduce a top bar (the dead `StatusBar` was removed earlier) — now **doing
real work**: **live clock + current Focus project + quick stats** (active
projects / streak). It earns its space; it is not decorative chrome.

---

## 9. Component library to build/restyle

Top status bar · nav rail / folder rail · data card · file/folder tile ·
project ("mission") card · activity-feed item · alert/warning badge ·
button tiers + icon button · terminal/data panel · graph/chart module ·
radar / color-wheel module.

---

## 10. Vibe keywords

**Positive:** vintage computer terminal · retro · hacker · cyberpunk (grounded) ·
nostalgic · old operating system · mission control · minimal-but-colorful ·
legible · sharp · phosphor/CRT · functional · glanceable · 5-color phosphor-on-black ·
circular/radial · isometric 3D · grid · nested borders · readable monospace.

**Negative:** cheap · toy / Fisher-Price / Tonka · over-produced / over-designed ·
cluttered / busy ("tribal tattoos") · too-futuristic sci-fi · boring · sterile
("clean but not minimal") · grey fills · glassmorphism · excessive glow ·
**garish "neon"** (it's terminal *phosphor*, not neon) · blue-only · illegible
graphs · tiny labels · cheesy logos · stock hacker template.

**Reference vibes (mood, not copy):** Alien/Aliens terminals · Blade Runner
(restrained) · Fallout terminal (cleaner) · Cyberpunk 2077 panels (less cluttered) ·
Tron grid discipline · Deus Ex / System Shock diegetic UI · NASA mission control
as a black retro terminal · 1980s vector arcade (sparingly).

---

## 11. Deviations from the ChatGPT reference plan

1. **NOT desktop-only.** ChatGPT said "prioritize desktop." We've invested
   heavily in mobile and recruits use phones — **mobile parity is required.**
   Desktop drives the design; everything must reflow.
2. **Effects:** Ross picked *Medium*; ChatGPT urged *low-glow*. Reconciled to
   "medium scanlines, restrained glow, readability floor."
3. **No information-architecture changes.** This is a **re-skin**. The recipe
   model (flat slots), `/projects` = Dashboard, Focus page, etc. stay as built.
4. **Keep WCAG-AA contrast** on all phosphor-on-black.

---

## 12. Rollout plan

- **Phase 0 — Tokens (this spec):** palette, type, buttons, borders, effects in
  `globals.css` / `@theme`.
- **Phase 1 — Dashboard hero re-skin** (`/projects`): full re-skin to lock the
  language. Lands on a **preview branch** for Ross's visual approval (Vercel
  branch preview + comments) **before** merge.
- **Phase 2 — Propagate** across every page via the orchestrator, per-area batches.
- **Phase 3 — Heavy signature pieces** that were parked (e.g. full isometric viz).

---

## 13. Data-viz kit — moodboard references (bespoke SVG)

The "re-skin isn't enough" feedback points here: the **content** (gauges, graphs,
progress) must become genuinely impressive, hand-built SVG styled to the Figma
moodboard — NOT generic widgets. Build under `src/components/viz/`. Each maps to a
specific moodboard reference (Ross's GOOD examples + comments):

- **Radial / circular gauges** ← moodboard **group 20** (josh-floyd "cyberspace" —
  *"LOVE THE VIBE… radial menus like the terminal access element, circular progress
  elements"*) + groups 22/24. Concentric rings, tick marks around the dial, a
  glowing phosphor arc, value in mono at center. This replaces the plain
  `CircularProgress` (Ross: *"make these even more stylistic — group 20"*).
- **Line / area graphs** ← **group 21** (*"line graphs… the memory element could be
  good for the color-map style"*). Phosphor plot line + low-alpha area fill,
  faint grid, plotted nodes; readable at a glance (no hover-only data).
- **Segmented / output-rate bars** ← the wireframe-globe "OUTPUT RATE" panel +
  group 27 (*"progress bars… boxes with black or no fill"*). Segmented blocks, not
  a smooth fill; color-bar-with-black-text idiom for labels.
- **Sparklines** ← trend cues for streak / completion-over-time (group 27's
  glanceable readouts).
- **Mission-table treatment** ← **group 27** (the favorite: 5-color palette,
  cyan-highlighted row, black/no-fill cells, quick-action buttons).
- **Wireframe / isometric hero** (heaviest, phase-able) ← group 20 (wireframe
  globe / radar), group 23 (3D city), terrain. A single signature hero viz, not
  everywhere.
- **Pixel color wheel** ← group 26 (done).

Style rules: phosphor stroke + restrained glow on active arcs/lines only; tick
marks + tiny tech labels for the HUD feel; medium scanline backdrop OK behind a
viz; animate on mount (motion-safe) but **readability is the hard floor**; 5-color
palette, more color than a one-hue HUD. Moodboard file (reference, Starter-tier
MCP is rate-limited): fileKey `IHy67xh3iXAxtJE6vHsjUJ`.
