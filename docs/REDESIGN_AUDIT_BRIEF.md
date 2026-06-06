# Redesign Audit Brief — the design target

Feed for a **holistic** UX/UI audit of mini-manager's vintage-terminal redesign.
Judge the live app against THIS target (Ross's Figma moodboard + a ChatGPT
direction outline), not generic heuristics. Companion to `DESIGN_LANGUAGE.md`
(full tokens) and `UXUI_DASHBOARD_DESIGN.md`.

---

## 1. Figma moodboard — GOOD examples (Ross's own comments, verbatim intent)
- Minimal, sharp icons; a minimal calendar.
- Folders, **line graphs**, a "memory" element → mimic for the **color-map** style.
- Minimal terminal **dashboard**; an "operation activity" section; a **mission table**.
- **"LOVE THE VIBE" (group 20):** radial menus (a "terminal access" element),
  **circular progress** elements, a 3D color wheel.
- **Circular progress trackers** (recurring love).
- Row of **folders that open a window** on click → could be **paint squares**;
  a **3D/isometric city** visualization.
- **Color bars with black text**; "I want MORE colors."
- Minimal **3D** designs; a **grid** vibe.
- A loved **color palette**; a **side panel**; a **nested border** style.
- A **pixelated retro color wheel**.
- **FAVORITE (group 27):** looks like an **old operating system**; a **5-color
  palette** (not the usual 1–2); **quick-action buttons**; **progress bars**;
  boxes with **black or no fill**; **cyan-highlighted** selected row; a
  **functional top bar**. Disliked: big numbers, "a bit boring."

## 2. Figma moodboard — BAD examples (what to avoid)
- Cheap, toy-like, "Fisher-Price cyberpunk"; too futuristic, not vintage terminal.
- "Tonka-toy," bad color combos, silly sci-fi; gimmicks that look low-budget.
- Cheesy sci-fi; **boring / hard-to-read data viz**; lame graphs.
- Over-produced, over-designed, too busy ("generic tribal tattoos").
- (The OLD app) boring, lost the aesthetic; grey backgrounds → make transparent.
- Too crowded, too futuristic, "not enough colors."
- "Too clean but not minimal"; over-designed.

## 3. Style guide
- **Colors:** cyan `#00D2FF` · green `#51FD80` · yellow `#EEF996` · purple
  `#9B80DC` · red `#FF4244`, as glowing CRT **phosphor** (NOT garish "neon").
- **Fonts:** PixelSplitter (title) · UAV OSD Mono (headings) · IBM Plex Mono (body).
- **Buttons:** solid color fill + **black text** + outline variants; Primary cyan,
  Secondary green, Tertiary ghost.

## 4. ChatGPT direction outline (condensed)
- **Vibe:** dark UI, retro-futurist, **mission control**, terminal OS, tactical,
  minimal sci-fi, CRT, modular panels, nested borders, readable mono, command
  center, wireframe graphics, low-glow, sharp icons, pixel accents.
- **Avoid:** cheap sci-fi, toy cyberpunk, cluttered HUD, glassmorphism, glossy
  buttons, excessive glow, hologram overload, unreadable/tiny text, busy UI,
  "neon vomit," childish, overdesigned, blue-only.
- **Mantra:** *terminal-first, dashboard-second, HUD-last.*
- **Components to nail:** top nav/status bar · sidebar/folder rail · data card ·
  file/folder tile · mission/project card · activity feed · alert badge · button
  tiers · icon button · terminal/data panel · graph/chart module ·
  radar/map/wireframe module.
- **Reference vibes (mood, not copy):** Alien/Aliens terminals · Blade Runner
  (restrained) · Fallout terminal (cleaner) · Cyberpunk 2077 panels (less
  cluttered) · Tron grid discipline · Deus Ex / System Shock diegetic UI · NASA
  mission control as a black retro terminal · 1980s vector arcade (sparingly).
- **Goal:** a stylish retro-futurist terminal OS — black, technical, **readable**,
  modular, serious; cool like a fictional cyberpunk OS yet practical as a real
  dashboard.

## 5. What's already built (current state to audit)
Terminal re-skin across every page; 5-color phosphor palette on pure black;
nested-border panels w/ corner ticks + tech labels; PixelSplitter/UAV/IBM Plex
fonts; **bespoke SVG viz kit** (RadialGauge / LineGraph / AreaGraph / Sparkline /
SegmentedBar) applied to the Dashboard; pixel color wheel; functional top status
bar; INSPO lightbox; stopwatch TIMER section. Pages: `/projects` (Dashboard),
`/library`, `/recipes` + `/recipes/[id]`, `/planner` (Focus), `/tools/*`,
`/projects/[id]`, `/wishlist`, auth.

## 6. The audit ask — HOLISTIC, not minutia
Ross: *"a pass not just focused on the minutia but on the entire design — where
we can improve, what could use a custom graphic, what seems confusing, etc."*

Prioritize, per page and overall:
- **Direction fit:** how close is each surface to the moodboard target (esp.
  group 20 / group 27)? Where does it still read "re-skinned" rather than
  genuinely designed?
- **Where to improve most** (biggest-impact moves, ranked).
- **Custom-graphic opportunities:** where a bespoke illustration / hero viz /
  iconography / the parked isometric-wireframe hero would elevate it.
- **Confusion / IA / hierarchy:** what's unclear, mislabeled, or buried; where the
  5-second read fails.
- **Cohesion:** inconsistencies across pages (spacing rhythm, panel language,
  color-role usage, button tiers).
- **Readability floor:** anywhere the CRT styling hurts legibility.
Keep nitpick-level pixel tweaks to a short appendix; lead with the big moves.
