# Desktop UX/UI Best Practices — The Ultimate Reference

> Synthesized from primary design systems (Apple HIG macOS/iPadOS, Microsoft Fluent 2, Atlassian Design System, IBM Carbon), the WCAG 2.2 standard, and empirical UX research (Nielsen Norman Group, Baymard Institute, Laws of UX, Refactoring UI). Every claim is traceable to a cleaned source file in `docs/research/sources/desktop/` (new desktop sources) or `docs/research/sources/mobile/` (reused cross-cutting sources). Retrieved 2026-06-03.
>
> This is the **desktop counterpart** to `docs/research/MOBILE_UXUI_BEST_PRACTICES.md`. It **builds on** that report — where guidance is cross-cutting (Gestalt, color, feedback timing, progressive disclosure, steppers, dashboards-preattentive) it reuses the mobile sources and points to them; the bulk here is **desktop-specific depth**: pointer affordances, keyboard/shortcuts/command palettes, dense data tables, sidebars/mega-menus, multi-pane master-detail, and the higher information density a pointer + big screen permit. It ends with a desktop-vs-mobile contrast section and a Mini Manager application section.

---

## Table of Contents
1. [Executive Summary](#1-executive-summary)
2. [Hard-Numbers Cheat Sheet](#2-hard-numbers-cheat-sheet)
3. [Buttons (desktop)](#3-buttons-desktop)
4. [Pointer Affordances (desktop-only)](#4-pointer-affordances-desktop-only)
5. [Keyboard, Shortcuts & Command Palettes](#5-keyboard-shortcuts--command-palettes)
6. [Typography, Sizing Ratios & Density](#6-typography-sizing-ratios--density)
7. [Layout: Multi-Column, Sidebars, Breakpoints, Master-Detail](#7-layout)
8. [Navigation & Disclosure on Desktop](#8-navigation--disclosure-on-desktop)
9. [Large Lists & Databases (Data Tables)](#9-large-lists--databases-data-tables)
10. [Dashboards](#10-dashboards)
11. [Project / Sub-Project Hierarchical Flows](#11-project--sub-project-hierarchical-flows)
12. [Status Indicators & +/− Steppers](#12-status-indicators--steppers)
13. [Information Tracking & Feedback](#13-information-tracking--feedback)
14. [Accessibility (woven throughout, summarized)](#14-accessibility)
15. [Desktop vs Mobile: What Changes and Why](#15-desktop-vs-mobile-what-changes-and-why)
16. [Where Sources Agree / Disagree](#16-where-sources-agree--disagree)
17. [Applied to Mini Manager](#17-applied-to-mini-manager)
18. [Source Index](#18-source-index)

---

## 1. Executive Summary

Where mobile UX is governed by three constraints (slow typing, no overview, no focus hints) [baymard__mobile-checkout-forms], **desktop UX is governed by three opposite affordances** that all desktop-specific guidance derives from:

1. **A precise pointer + hover.** The cursor can hit small targets and, crucially, can *hover without committing* — unlocking tooltips, hover-reveal controls, row-hover highlighting, drag-and-drop, and right-click context menus that have no touch equivalent [apple-hig__pointing-devices; nngroup__tooltip-guidelines; nngroup__contextual-menus; nngroup__drag-drop].
2. **A physical keyboard.** Shortcuts, focus order, accelerators, and command palettes make experts dramatically faster and are a first-class input, not an afterthought [apple-hig__keyboards; nngroup__ui-accelerators].
3. **A large, high-resolution canvas.** Far more can be shown at once, so the design problem flips from "what do I hide" to "how do I make dense information scannable" — multi-pane master-detail, persistent sidebars, full data tables, and glanceable dashboards [fluent2__layout; carbon__data-table; nngroup__vertical-nav; nngroup__complex-application-design].

The single highest-leverage desktop decision is therefore the inverse of mobile's: not *what to hide*, but **how to organize density so the eye can scan it** — spacing-as-grouping, salience through hierarchy (and through *removing* clutter), frozen headers, master-detail panes, and visible navigation [atlassian__spacing; nngroup__complex-application-design; nngroup__data-tables]. Pointer precision lets targets shrink toward a **~24px floor** (vs the 44px touch floor), but every authority still rewards comfortable targets, generous spacing, and a visible ≥2px/3:1 focus ring [wcag22__target-size-minimum; wcag22__focus-appearance-and-not-obscured].

---

## 2. Hard-Numbers Cheat Sheet

Every concrete desktop value with its source. (Cross-cutting numbers shared with mobile are marked ↔ and sourced from the mobile set.)

| Metric | Value | Applies to | Source |
|---|---|---|---|
| **Click target — WCAG legal minimum** | **24 × 24 CSS px** (or 24px-circle spacing) | Web AA (SC 2.5.8) | ↔ wcag22__target-size-minimum |
| **Comfortable target (pointer)** | **~24–28px+** practical; 44px = AAA/touch-safe | Desktop controls | wcag22__target-size-minimum; apple-hig__buttons |
| **Pointer hit-region padding — bezeled element** | **~12 pt** all sides | macOS/iPadOS | apple-hig__pointing-devices |
| **Pointer hit-region padding — bare glyph / borderless** | **~24 pt** all sides | macOS/iPadOS | apple-hig__pointing-devices |
| **Image-button padding (macOS)** | ~10 px image-to-edge | macOS | ↔ apple-hig__buttons |
| **Hover-menu / tooltip reveal delay** | **0.5 s** stationary before showing | Hover-dependent UI | nngroup__mega-menus |
| **Hover-menu show time after delay** | within **0.1 s** | Hover panels | nngroup__mega-menus |
| **Hover-menu hide delay after pointer leaves** | **0.5 s**, then remove in <0.1 s | Hover panels | nngroup__mega-menus |
| **Drag reshuffle animation** | **~100 ms** with easing | Reorder drag-drop | nngroup__drag-drop |
| **Drag reshuffle trigger point** | when **center** of dragged item crosses target edge | Reorder drag-drop | nngroup__drag-drop |
| **Min draggable touch space (cross-device)** | 1 cm × 1 cm | Touch drag | ↔ nngroup__drag-drop / touch-target-size |
| **Focus indicator size (AAA 2.4.13)** | ≥ **2 CSS px perimeter** around component | Web | wcag22__focus-appearance-and-not-obscured |
| **Focus indicator contrast (AAA 2.4.13)** | ≥ **3:1** focused vs unfocused | Web | wcag22__focus-appearance-and-not-obscured |
| **Focus not obscured (AA 2.4.11)** | focused control not **entirely** hidden by sticky chrome | Web AA | wcag22__focus-appearance-and-not-obscured |
| **Dialog button order — Windows** | **OK / confirm FIRST (left)**, Cancel right | Windows | nngroup__ok-cancel-button-order |
| **Dialog button order — macOS** | **Cancel left, confirm LAST (right/trailing)** | macOS | nngroup__ok-cancel-button-order |
| **Web dialog default** | OK first / Cancel last (Windows majority) | Web | nngroup__ok-cancel-button-order |
| **Spacing base unit — Fluent 2** | **4 px** ("4x" ramp: 4,8,12,16,20,24,28,32,36,40,48…) | Microsoft/desktop | fluent2__layout |
| **Spacing base unit — Atlassian / Carbon** | **8 px** (Atlassian space.100; Carbon 2x grid) | Productivity/enterprise | atlassian__spacing; (carbon ↔ existing ref) |
| **Spacing scale (shared)** | 4,8,12,16,24,32,48,64,96,128 px | All | ↔ refactoring-ui; atlassian__spacing |
| **Layout grid columns (desktop)** | **12 columns** (Fluent); Carbon **16** | Web app layout | fluent2__layout; (carbon ↔ existing ref) |
| **Breakpoint — desktop (Fluent x-large)** | **1024–1365 px** | Desktop | fluent2__layout |
| **Breakpoint — desktop (Fluent xx-large)** | **1366–1919 px** | Desktop | fluent2__layout |
| **Breakpoint — large desktop (Fluent xxx-large)** | **≥ 1920 px** | Large desktop | fluent2__layout |
| **Breakpoint — Material Expanded/Large/XL** | 840–1199 / 1200–1599 / ≥1600 dp | tablet→desktop | ↔ material3__window-size-classes |
| **Breakpoint — Carbon Large/XL/Max** | 1056 / 1312 / 1584 px | enterprise web | ↔ existing ref (Carbon) |
| **Max content width (Carbon)** | container 1584 px; content ~1312 px | enterprise web | ↔ existing ref (Carbon) |
| **Line length** | **45–75 characters** | Body text | ↔ refactoring-ui |
| **Body text — web convention** | 16 px (≈ Apple 17pt); 11px floor | Web | ↔ apple-hig__typography; refactoring-ui |
| **Attention leans left** | left half of screen viewed **~80%** of time | Desktop layout | nngroup__vertical-nav |
| **Content-to-chrome ratio (vertical vs horizontal nav)** | ~**5:1** (sidebar) vs ~**12:1** (top bar), same screen | Desktop nav choice | nngroup__vertical-nav |
| **Carbon data-table row sizes** | **5** (XL, L, M, S, XS) | Dense tables | carbon__data-table |
| **Toolbar actions (Carbon table)** | **≤ 5** in toolbar, rest in overflow | Dense tables | carbon__data-table |
| **Inline row actions threshold** | **< 3** → keep inline as icon buttons | Dense tables | carbon__data-table |
| **Context-menu length** | **< 10–12 items**, no scroll | Right-click menus | nngroup__contextual-menus |
| **Select-all checkbox states** | **3** (checked / unchecked / indeterminate) | Bulk select | carbon__data-table |
| **Doherty Threshold** | **< 400 ms** | Interaction | ↔ lawsofux__principles |
| **Progress indicator needed if action >** | ~**1.0 s** (spinner 2–10s; %-done ≥10s) | All | ↔ nngroup__progress-indicators |
| **Contrast — normal / large-UI text AA** | 4.5:1 / 3:1 | Web | ↔ existing ref wcag |
| **Colorblindness prevalence** | ~4.5% overall (8% men) | Color decisions | ↔ nngroup__dashboards-preattentive |
| **Working memory (chunk size)** | 7 ± 2 | Grouping / menus | ↔ lawsofux__principles |

### Reconciling the 24 vs 44 target floor (pointer vs touch)
The mobile report fixed 44–48px as the comfortable target and 24px as the absolute web floor. On **desktop the pointer is precise**, so:
- **24 × 24 CSS px** (WCAG AA SC 2.5.8) is a genuinely usable floor for pointer-driven controls, *provided* there is 24px-circle spacing clearance around small targets [wcag22__target-size-minimum].
- **But** the same control must stay touch-safe on a hybrid/touchscreen laptop or tablet, and motor-impaired pointer users still benefit from size. So: **build toolbar/table-cell controls at ~24–28px+ with generous spacing; build primary actions and anything that might be touched at 44px**. Apple frames it as "select it whether they use a fingertip, pointer, eyes, or remote" [apple-hig__buttons]. The pointer lets you go *denser*, not *smaller-than-usable*.

---

## 3. Buttons (desktop)

### Sizing — pointer vs touch
- The **44pt touch floor relaxes to a ~24px practical minimum** for precise pointer use, but keep comfortable size + spacing (see §2 reconciliation) [wcag22__target-size-minimum; apple-hig__buttons].
- Atlassian ships **default vs `compact` button spacing — use `compact` specifically inside tables/dense data**; default elsewhere [atlassian__button].
- macOS image buttons: ~10px image-to-edge padding [apple-hig__buttons]. Pointer hit-regions get ~12pt (bezeled) / ~24pt (bare glyph) padding even when the visual is small [apple-hig__pointing-devices].

### Hover / active / focus / disabled / loading — define ALL states
- Desktop adds a **hover state** that touch lacks — it's a primary affordance, not optional. Plus active (pressed), **focus** (keyboard), disabled, selected, loading [atlassian__button].
- **Focus ring spec (do this on every interactive element):** ≥2px perimeter, ≥3:1 contrast against the unfocused state (WCAG 2.2 AAA 2.4.13; also satisfies AA 2.4.7) [wcag22__focus-appearance-and-not-obscured].
- **Loading** replaces the label with a spinner and blocks interaction [atlassian__button].
- **Disabled caveat:** disabled buttons leave the tab order → accessibility gap. **Prefer inline validation over disabling** where possible [atlassian__button].
- A custom button without a press state "feels unresponsive" [apple-hig__buttons].

### Label & font size
- Start labels with a **verb**; in dialogs, **name the button for what it does** ("Save", "Delete") rather than generic "OK" — explicit labels act as just-in-time help [apple-hig__buttons; nngroup__ok-cancel-button-order].
- Button text rides the type scale (≥16px/17pt for primary actions) [↔ apple-hig__typography].
- **Avoid truncation;** if a button is in a narrow container, truncate with an ellipsis (screen readers still read the full label) rather than wrap and break layout [atlassian__button].

### Primary / secondary / destructive hierarchy
- Atlassian's desktop ladder: **Default → Primary (once per area, not every screen) → Subtle (secondary, best in toolbars/groups) → Warning (significant change/data loss) → Danger (final confirm of irreversible/destructive) → Discovery (new experiences)** [atlassian__button].
- **Use STYLE, not size, to signal the preferred choice**; keep prominent buttons to 1–2 per view [apple-hig__buttons]. Von Restorff: one distinct primary CTA [↔ lawsofux__principles].
- **Never make a destructive action the default/primary** — people activate prominent buttons (or hit Enter) without reading [apple-hig__buttons; nngroup__ok-cancel-button-order].

### Placement — dialog button ORDER is an OS convention (desktop-specific)
- **Windows: confirm button FIRST (left), Cancel right.** **macOS: Cancel left, confirm LAST (trailing/right).** **Web default: OK first / Cancel last** (Windows majority) [nngroup__ok-cancel-button-order].
- The primary button's placement **matches the alignment of the other buttons in the layout** [atlassian__button].
- **Make the most-common button the default and highlight it — except destructive ones** (so Enter doesn't trigger them) [nngroup__ok-cancel-button-order].
- Fitts's Law: primary CTA = biggest, closest-to-intent target [↔ lawsofux__principles].

### Keyboard activation
- The default button responds to **Return/Enter**; Cancel/Esc dismisses; respect platform shortcut conventions [apple-hig__keyboards]. **Full-width buttons** are the exception on desktop — used for login forms and similar, not the default [atlassian__button].

---

## 4. Pointer Affordances (desktop-only)

This entire section has **no mobile equivalent** — it is what a precise, hover-capable pointer unlocks.

### Hover states & hover-reveal
- The pointer can **hover without committing**, so desktop can hide secondary controls and reveal them on hover (minimized toolbars, video playback controls, row action overflow) [apple-hig__pointing-devices; carbon__data-table].
- **Row-hover highlight should always be on in data tables** — it helps users scan a row's columns even when the row isn't interactive [carbon__data-table].
- **Caveat:** never make *essential* affordances hover-only — Baymard found permanent carousel arrows/dots beat hover-only indicators, and hover fails for keyboard/touch users [baymard__desktop-ux-ecommerce; nngroup__ui-accelerators]. Hover is for *enhancement*, not for hiding required functionality.

### Tooltips (timing, placement, content)
- A tooltip is a **user-triggered, desktop-only** microcontent message on **mouse-hover OR keyboard-hover** [nngroup__tooltip-guidelines].
- **Timing:** the same hover discipline as mega-menus — **0.5 s stationary before showing**, to avoid flicker as the pointer crosses elements [nngroup__mega-menus].
- **Rules:** never put task-critical info in a tooltip (it disappears); keep it brief/non-redundant; **support both mouse AND keyboard hover**; use a **tooltip arrow** when elements are crowded; deploy tooltips **consistently** (they're hard to discover); ensure moderate contrast; **position so it doesn't block related content** [nngroup__tooltip-guidelines].
- Always provide a tooltip for every **unlabeled icon** (text labels are better still) [nngroup__tooltip-guidelines].

### Cursors (signal interactivity & operation)
- macOS standard cursors communicate state: **arrow** (select), **pointing hand** (link), **I-beam** (text), **crosshair** (precise rectangular selection), **open/closed hand** (can drag / dragging), **resize cursors** (up/down/left/right/diagonal), **contextual-menu** arrow, **drag-copy** (Option), **drag-link** (alias), **operation-not-allowed**, **disappearing-item** [apple-hig__pointing-devices].
- For drag-drop, **use the platform's standard cursor — don't invent one** [nngroup__drag-drop].
- iPadOS pointer content effects (relevant to hybrid/large-window apps): **highlight** (small transparent-bg control), **lift** (small opaque control), **hover** (large element, tint-only for rows since they can't scale) [apple-hig__pointing-devices].

### Right-click / context menus
- Desktop triggers: **right-click**, **Ctrl+click**, **two-finger trackpad click** — and the menu content **must be identical regardless of trigger** [apple-hig__pointing-devices; nngroup__contextual-menus].
- Rules: a **focused set** of element-relevant actions only (no global Save/Print); **every command must also be reachable from the main menu** (context menus are hidden by default); show a **signifier** (⋯/⋮ or ▾) — never a gear/hamburger (those read as global settings); **frequency-of-use order** (top = most used); **show keyboard shortcuts inline**; keep to **< 10–12 items**, no scroll; **disable (grey) irrelevant items rather than hide them**, and keep command families complete (Cut→Copy→Paste) [nngroup__contextual-menus].

### Drag-and-drop
- Best for **moving/reordering/resizing**; inefficient and error-prone over distance → **pair with a precise input** (drag roughly, then arrow keys) or offer a menu alternative [nngroup__drag-drop].
- **Signifiers:** grab-handle icons (not universal — avoid hamburger/kebab look-alikes) + cursor changes. **Feedback while grabbed:** outline/shadow/tilt/ghost image. **Reshuffle animation ~100 ms with easing, triggered when the dragged item's CENTER crosses the target edge** (edge=twitchy, cursor=mushy). **Magnetism:** make drop zones active slightly outside their border so users can release early [nngroup__drag-drop].
- **Accessibility:** handle must be **Tab-focusable, Space to grab, arrows to move/resize**, with screen-reader announcements of state/position [nngroup__drag-drop].

### Multi-select
- **Band/marquee selection** — click-drag a rectangle over items to select them (standard in collection views) [apple-hig__pointing-devices].
- **Checkbox-per-row + Select-All** for table bulk selection; the header select-all checkbox has **3 states** (checked/unchecked/indeterminate) [carbon__data-table; ↔ nngroup__data-tables].
- Convention (carry from desktop OS): Shift+click = range, Ctrl/Cmd+click = toggle individual.

---

## 5. Keyboard, Shortcuts & Command Palettes

Keyboard is a **first-class desktop input**, not an accessibility afterthought.

### Shortcuts & accelerators
- An **accelerator** is an *additional, alternate* way to do a task — experts use it, novices ignore it; the task must remain doable another way [nngroup__ui-accelerators].
- **Only add shortcuts for frequently-repeated core actions** (repetition is what makes them stick); don't overwhelm — reveal gradually; let experts **customize** [nngroup__ui-accelerators].
- **Never override the universal shortcuts:** Ctrl/Cmd+C/V/X, Z (undo), Shift+Z (redo), A (select all), F (find), S (save), P (print), N/O, comma (settings), ? (help), Esc/period (cancel) [apple-hig__keyboards; nngroup__ui-accelerators].
- **Modifier preference & order:** Command primary, Shift secondary, Option for power features, **avoid Control** (system-reserved); list modifiers as **Control, Option, Shift, Command** [apple-hig__keyboards].
- **Maintain shortcut consistency across web/mobile/desktop** [nngroup__ui-accelerators].

### Discoverability (available yet ignorable)
- **Show keyboard shortcuts inline in menus** (right-aligned / parenthesized), styled distinctly so experts spot them and novices skip them — this also teaches them [nngroup__ui-accelerators; nngroup__contextual-menus].
- Reveal via **tooltip/hover** (caveat: not for keyboard/touch users), **just-in-time hints** after the manual action, **multiple locations** for macros, and a **cheat sheet** in Help (Shopify organizes its by workflow) [nngroup__ui-accelerators].

### Command palettes
- The command-palette pattern (a searchable action list, à la Intercom/VS Code) is the strongest desktop accelerator surface: it combines **search + recognition over recall + inline shortcuts**. NN/g's accelerator guidance explicitly cites a "Search actions" menu that right-aligns the shortcut next to each command [nngroup__ui-accelerators]. Use it to expose every command (with its shortcut) without cluttering the chrome.

### Focus order & focus appearance
- **All functionality must be keyboard-operable, no traps** (WCAG 2.1.1 / 2.1.2) [↔ existing ref wcag].
- **Logical focus/tab order** following reading order; group navigation with Tab/Control-Tab between control groups [apple-hig__keyboards].
- **Visible focus ring ≥2px / ≥3:1** (2.4.13) and **not entirely obscured by sticky headers/footers** — fix with CSS `scroll-padding` (2.4.11 AA) [wcag22__focus-appearance-and-not-obscured].
- **Support Full Keyboard Access** — navigate/activate windows, menus, controls by keyboard alone [apple-hig__keyboards].

---

## 6. Typography, Sizing Ratios & Density

### Body min & scale (largely shared with mobile)
- **Body 16px web / 17pt iOS; 11px/pt absolute floor;** constrain to ~8 sizes; line-height ~1.5 body / ~1.2 headings [↔ apple-hig__typography; refactoring-ui].
- **Line length 45–75 characters** regardless of screen width — *this is the key desktop constraint*: a wide monitor must NOT produce 200-character lines. Cap text columns (Fluent's "manuscript grid" exists precisely to hold optimal line length on big screens) [↔ refactoring-ui; fluent2__layout].

### Text-to-element / icon / button ratios (Ross's explicit ask, desktop version)
- The mobile ratios still hold but the *target* end can shrink with a pointer: **label 14–16px → padding ~8–12px (compact) or ~12–16px (default) → control height ~28–40px → icon 16–24px** [synthesis: atlassian__spacing usage ranges + atlassian__button + ↔ apple-hig__typography].
- Atlassian's concrete component ranges: **small spacing (0–8px)** for icon-to-text gaps, badge/icon-button/**table-cell** padding, input padding; **medium (12–24px)** for **button** padding; **large (32–80px)** for page-section spacing [atlassian__spacing].
- **Icon glyph : target ≈ 1:2** still applies; align objects/icons centrally and text left when combining [↔ google-android; fluent2__layout].

### Information density — desktop can (and should) be denser, quantified
- Desktop deliberately runs **denser than mobile**: Carbon offers **5 table row heights** (XL→XS) and a `compact` spacing variant; Atlassian's 8px system is explicitly built to support **customizable UI density** [carbon__data-table; atlassian__button; atlassian__spacing].
- **Density is a design lever, not license to crowd:** spacing still communicates grouping (more gap between groups than within), and **removing nonessential elements can make important data MORE salient than adding emphasis** [atlassian__spacing; nngroup__complex-application-design].
- Offer a **density control** — benefits both motor-impaired (larger) and power/low-vision users (their preference) [↔ wcag22__target-size-minimum; atlassian__spacing].

---

## 7. Layout
### (Multi-column, sidebars, breakpoints, master-detail)

### Spacing grid & margins
- **Fluent 2: 4px base ramp** (4,8,12,16,20,24,28,32,36,40,48,52,56) [fluent2__layout]. **Atlassian & Carbon: 8px base** (Atlassian space.100=8px; Carbon 2x grid) [atlassian__spacing; ↔ existing ref]. Pick one base per project; both are subsets of the shared 4/8 scale.
- **Spacing denotes grouping** — consistent spacing makes a table/list read as one cohesive collection; vary spacing to create rhythm and salience; use **optical adjustment** off the scale when visual weight demands it [atlassian__spacing; fluent2__layout].
- Use **whitespace/background shifts instead of borders** to separate sections [↔ refactoring-ui; fluent2__layout].

### Columns & max content width
- **12-column grid** is the desktop default (Fluent); Carbon uses **16 columns**, container max **1584px**, content ~**1312px** [fluent2__layout; ↔ existing ref Carbon].
- On very large displays, don't stretch content edge-to-edge — **cap content width and let margins absorb the excess** (IBM Watson Studio does this; it's also why vertical nav stops costing content space on big screens) [nngroup__vertical-nav; fluent2__layout].

### Responsive breakpoints (desktop ↔ tablet ↔ mobile)
- **Fluent 2:** small 320–479 / medium 480–639 / large 640–1023 / **x-large 1024–1365 / xx-large 1366–1919 / xxx-large ≥1920** [fluent2__layout].
- **Material:** Compact <600 / Medium 600–839 / Expanded 840–1199 / Large 1200–1599 / XL ≥1600 dp [↔ material3__window-size-classes].
- **Carbon:** Small 320 / Medium 672 / Large 1056 / XL 1312 / Max 1584 [↔ existing ref Carbon].
- The **five responsive techniques** to move between sizes: **Reposition, Resize, Reflow** (1-col→2-col), **Show/Hide** (more metadata on bigger screens), **Re-architect** (the big one: expand a single pane into a **list-beside-details master-detail** on desktop) [fluent2__layout].

### Multi-pane master-detail (the defining desktop layout)
- A wide screen affords **two/three panes**: list + detail (+ optional sidebar/inspector) visible at once — Fluent's "re-architect" and Material's list-detail [fluent2__layout; ↔ material3__window-size-classes].
- For editing a record, **a nonmodal side panel keeps the table/list visible** (vs a modal that covers reference rows) [↔ nngroup__data-tables; carbon__data-table].
- macOS caveat: **don't put critical controls at the window bottom** (often dragged offscreen) [↔ apple-hig__layout].

---

## 8. Navigation & Disclosure on Desktop

Desktop has more room, so the mobile instinct (hide nav behind a hamburger) **inverts**: keep navigation **visible**.

### Sidebar (vertical) vs top (horizontal) nav
- **Left-side vertical nav** scales to **as many top-level items as needed**, scans efficiently (attention leans left **~80%**; vertical lists need fewer fixations), is familiar from desktop apps (Slack, Gmail), and **translates straight to mobile**. Best for **broad/growing IAs** and desktop apps [nngroup__vertical-nav].
- **Top horizontal nav** gives a better **content-to-chrome ratio (~12:1 vs ~5:1)** but only fits a few stable categories [nngroup__vertical-nav].
- Sidebar rules: **on the left, visually salient, left-aligned, keyword-front-loaded TEXT labels (not icon-only), least-important items at the bottom, never hidden behind a hamburger, never duplicated as both bar + hamburger** [nngroup__vertical-nav].
- **Material adaptive mapping:** compact → bottom bar; medium → nav rail; expanded+ → **persistent drawer/sidebar** [↔ material3__window-size-classes].

### Mega-menus, dropdowns, popovers
- **Mega-menus** beat regular dropdowns for big IAs: 2-D panel, grouped, everything visible (no scroll), recognition over recall, can show 2 IA levels and images [nngroup__mega-menus].
- **Hover-menu timing (reuse everywhere):** 0.5s before show → show in 0.1s → keep until pointer out 0.5s → hide in <0.1s; handle the **diagonal problem** (keep open along the pointer's path to a submenu item) [nngroup__mega-menus].
- Mega-menu content: card-sorted groups, medium granularity, front-loaded labels, top-left = most important, each choice once; **no GUI widgets / no hidden search box inside** [nngroup__mega-menus].

### Modals vs inline panels (desktop has room to prefer inline)
- Because desktop has space, **prefer nonmodal side panels / inline panels over blocking modals** for editing and detail — modals cover reference data and add a dismiss goal [↔ nngroup__data-tables; ↔ nngroup__modal-nonmodal-dialogs; carbon__data-table]. Reserve modals for **critical/irreversible confirmations or required-to-continue info** [↔ nngroup__modal-nonmodal-dialogs].
- Use **staged disclosure** to reduce clutter without losing capability (advanced settings appear only when a related field is checked) [nngroup__complex-application-design; ↔ nngroup__progressive-disclosure].

### What to show vs hide (desktop vs mobile)
| Show on desktop (room permits) | Still hide / defer |
|---|---|
| Persistent sidebar nav (many items) | Rarely-used global settings |
| Master + detail panes simultaneously | Advanced parameters (staged disclosure) |
| Full data table w/ many columns | Tertiary metadata (hover/expand row) |
| Inline row actions (<3) | Bulk tools until rows selected |
| Always-visible search box | Right-click-only accelerators (duplicated in menus) |
Sources: [nngroup__vertical-nav; carbon__data-table; nngroup__complex-application-design; nngroup__contextual-menus].

---

## 9. Large Lists & Databases (Data Tables)

The desktop's signature strength. Builds on the mobile data-table guidance (4 tasks: find / compare / view-edit / act) [↔ nngroup__data-tables], with desktop-specific table machinery from Carbon.

### Full data tables
- **Tables win for comparison** (adjacent values, no eye-movement/memory cost) — on desktop you keep the full table, you don't reflow to cards [↔ nngroup__data-tables].
- **Sortable columns:** sort in column headers; 3 states (unsorted/up/down); sort icon on the sorted column + on hover for others [carbon__data-table].
- **Frozen header rows AND columns** when the table exceeds the viewport (compare task) [↔ nngroup__data-tables].
- **Row density modes:** Carbon's **5 row heights (XL/L/M/S/XS)**; header row matches body; toolbar height pairs with row size [carbon__data-table]. Expose a density toggle.
- **Zebra striping + always-on row hover** to keep place while scanning [carbon__data-table; ↔ nngroup__data-tables].
- **Inline edit / view:** prefer a **nonmodal side panel** for deep edit (keeps reference rows visible); inline-edit only if the table is narrow; avoid modals [↔ nngroup__data-tables; carbon__data-table].
- **First column = human-readable identifier**, not a mystery ID; important columns first; related columns adjacent [↔ nngroup__data-tables].
- **Column titles** 1–2 words; if long, wrap to 2 lines then truncate with full text in a hover tooltip [carbon__data-table].

### Bulk actions & inline actions
- **Batch:** checkbox-per-row + **Select All (3-state header checkbox)** → batch-action bar appears at top; disable per-row actions in batch mode; exit via Cancel/deselect [carbon__data-table; ↔ nngroup__data-tables].
- **Inline:** if **< 3 actions, keep them inline as icon buttons** (saves a click, visible at a glance); otherwise per-row overflow menu — **persistent by default** (signals actions exist) or on-hover to reduce clutter [carbon__data-table].
- **Toolbar:** global actions (search, filter, settings, primary) — **≤ 5, rest in overflow** [carbon__data-table].

### Pagination vs infinite scroll on desktop
- For **task-oriented, searchable record lists, prefer pagination** (re-findability) over infinite scroll [↔ nngroup__infinite-scroll-vs-pagination].
- Carbon: **simple pagination** (current + prev/next) or **advanced** (items-per-page + jump-to-page), always at the table bottom [carbon__data-table].
- Virtualize rows for very large sets [↔ nngroup__data-tables].

### Powerful search / filter / faceting & record recall
- **Discoverable, powerful filters with an active-filter indicator;** transparent filter syntax; combine multiple values of the same type [↔ nngroup__data-tables; baymard__desktop-ux-ecommerce].
- **Explain industry-specific filter terms** — 66% of sites don't; use no-jargon labels, tooltips, or thumbnail illustrations [baymard__desktop-ux-ecommerce].
- **Always-visible search box** (Carbon offers collapsed-trigger or always-open search in the table toolbar) [carbon__data-table; ↔ nngroup__mega-menus "search must be visible"].
- **Recognition over recall** — global search to recall any record from anywhere [↔ lawsofux; nngroup__data-tables].
- **Loading:** use **skeleton states, not spinners**, for table loads [carbon__data-table].

---

## 10. Dashboards

Builds directly on the mobile dashboards section (preattentive processing) [↔ nngroup__dashboards-preattentive], plus desktop composition from complex-app guidance.

- **Glanceable, single-screen, at-a-glance** — surface the few metrics answering "is everything OK / what changed" as **big numbers + length-based bars**; avoid pie/donut/gauge/3D for magnitude [↔ nngroup__dashboards-preattentive].
- **Length (bars) & 2D position (lines)** for quantities; **color for categories only**; pair color with shape/position/label (~4.5% colorblind) [↔ nngroup__dashboards-preattentive].
- **Composition (desktop):** 12-column grid, card patterns, clear size/weight/contrast hierarchy [fluent2__layout; ↔ refactoring-ui]. **F/Z scan patterns** — note NN/g's correction: the **F-pattern applies to unstructured text, not chrome/dashboards** — so for a dashboard, drive the scan with deliberate salience (size, position top-left, contrast), not by assuming an F [nngroup__vertical-nav].
- **Make important info salient — including by REMOVING clutter** (drop decorative icons so the numbers pop) [nngroup__complex-application-design].
- **Glanceability vs detail:** show summary on the dashboard; let users **hover a chart point to reveal precise values in a tooltip** without leaving the screen (ease primary↔secondary transition) [nngroup__complex-application-design].
- **Learning by doing:** live-preview dashboard widgets as users configure them [nngroup__complex-application-design].

---

## 11. Project / Sub-Project Hierarchical Flows

Wide screens let you show parent↔child *simultaneously* rather than drilling page-by-page.

- **Master-detail two/three-pane:** parent list beside child detail, both visible (Fluent re-architect / Material list-detail) — the desktop upgrade over mobile's single-pane drill-down [fluent2__layout; ↔ material3__window-size-classes].
- **Breadcrumbs** for deep hierarchies so users always know which parent they're under (recognition over recall) [↔ lawsofux; nngroup__vertical-nav references breadcrumbs].
- **Trees / expandable rows:** Carbon's expandable data table progressively discloses children inline; **batch-expand exists but off by default** (expand-all negates lazy-load); if expanded content is cramped, route to a dedicated page/side panel [carbon__data-table].
- **Local (sub-) navigation** in a left sidebar showing sibling pages within a parent category is a standard, well-understood desktop pattern [nngroup__vertical-nav].
- **Two-level disclosure limit** before grouping; **flexible/fluid pathways** (jump back/forward between steps without losing progress) for multi-step flows [↔ nngroup__progressive-disclosure; nngroup__complex-application-design].
- Express hierarchy with **alignment/indent + spacing**, parent context top/leading [↔ apple-hig__layout; atlassian__spacing].

---

## 12. Status Indicators & +/− Steppers

### Status pills / badges
- **Never color alone** — pair color with icon/shape/label (categorical encoding; ~4.5% colorblind) [↔ nngroup__dashboards-preattentive; refactoring-ui]. Atlassian renders status with badges (small-spacing padded) [atlassian__spacing].
- Interactive pills need an adequate target + the standard hover/focus states [§3].

### +/− counters / steppers (Ross's explicit ask, desktop angle)
The dedicated stepper guidance is in the mobile set and is fully reusable [↔ nngroup__input-steppers]; the desktop-specific adjustments:
- **Use steppers for fields with a clear common value + small deviations** (perfect for stage/quantity counters); set the most-frequent value as default; **disable/grey the segment at min/max** [↔ nngroup__input-steppers].
- **Pointer lets the +/− buttons be smaller** (~24–28px) and **side-by-side or compact** — but keep them ≥44px / well-separated if the app also runs on touch [↔ nngroup__input-steppers; wcag22__target-size-minimum].
- **Add keyboard support:** the field is a text input (type a value); **Up/Down arrows increment/decrement**; the +/− buttons are Tab-focusable with a visible focus ring [apple-hig__keyboards; wcag22__focus-appearance-and-not-obscured].
- **Hover state** on +/− buttons (desktop affordance); optimistic instant update with a press state [↔ nngroup__input-steppers; lawsofux Doherty].
- Show clearly which field the stepper controls; clarify step/unit/range [↔ nngroup__input-steppers].

---

## 13. Information Tracking & Feedback

### Response-time thresholds (shared)
- **<400ms Doherty**; immediate press/hover feedback; **>1s → indicator; 2–10s → spinner; ≥10s → percent-done**; moving progress bar makes users wait ~3× longer [↔ lawsofux; nngroup__progress-indicators]. Tables: **skeletons, not spinners** [carbon__data-table].

### Optimistic UI, undo, autosave, activity logs
- **Optimistic UI** (apply instantly, reconcile in background) serves the Doherty Threshold [↔ lawsofux; nngroup__progress-indicators].
- **Undo over confirmation** for reversible actions (snackbar + Undo); reserve blocking modals for irreversible/critical [↔ nngroup__modal-nonmodal-dialogs; nngroup__ui-accelerators "provide undo for accelerator slips"].
- **Activity logs / notes / comments** — complex apps face long waits + interruptions; let users **record actions and attach open-ended notes** to data/charts to offload working memory and resume after interruption [nngroup__complex-application-design].
- **Always give feedback that an action (esp. an accelerator) succeeded** — animation/highlight/confirmation [nngroup__ui-accelerators].

### Toasts vs inline
- **Form errors inline next to the field, never in a modal**; use **adaptive, per-subissue error messages (4–7 distinct messages per complex field)** — 90% of sites use generic "invalid" wording, costing users up to 5 minutes [baymard__desktop-ux-ecommerce; ↔ nngroup__modal-nonmodal-dialogs].
- **Mark BOTH required and optional fields** (72% don't) [baymard__desktop-ux-ecommerce].
- Toasts/snackbars for transient confirmations + Undo; inline for anything users must act on or keep [↔ nngroup__progress-indicators; nngroup__ui-accelerators].

---

## 14. Accessibility

Woven throughout; desktop-critical points:
- **Keyboard parity:** every pointer action reachable by keyboard; no traps; logical focus order; **Full Keyboard Access** [apple-hig__keyboards; ↔ existing ref wcag].
- **Focus appearance (new in WCAG 2.2):** ≥2px perimeter, ≥3:1 contrast (AAA 2.4.13); focused control **not entirely obscured** by sticky chrome (AA 2.4.11) — fix with `scroll-padding` [wcag22__focus-appearance-and-not-obscured].
- **Hover/keyboard parity:** tooltips and accelerators must work on **keyboard hover**, not mouse-only [nngroup__tooltip-guidelines; nngroup__ui-accelerators].
- **Drag-drop accessible:** Tab-focus handle, Space to grab, arrows to move, screen-reader state announcements [nngroup__drag-drop].
- **Mega-menus:** strong visual border (screen-magnifier users), or a fully-accessible fallback page per top-level item [nngroup__mega-menus].
- **Don't disable-as-default** (disabled = out of tab order) — prefer inline validation [atlassian__button].
- **Never color alone**; **contrast** 4.5:1 / 3:1; **density control** for motor/vision needs; **reduced motion** guard on the ~100ms drag animations and any CRT effects [↔ refactoring-ui; nngroup__dashboards-preattentive; wcag22; nngroup__drag-drop].
- **Tables:** `scope`, `aria-sort`, accessible headers; **forms:** real `<label>`, role="alert" inline errors [↔ existing ref Carbon/wcag].

---

## 15. Desktop vs Mobile: What Changes and Why

Explicit contrast with `MOBILE_UXUI_BEST_PRACTICES.md`.

| Dimension | Mobile (the mobile report) | Desktop (this report) | Why it changes |
|---|---|---|---|
| **Governing constraint** | Slow typing, no overview, no focus hints → **hide & enlarge** | Pointer + keyboard + big screen → **organize density** | Input + viewport are inverted |
| **Target size floor** | 44–48px comfortable, 24px hard floor | **~24–28px usable** with spacing; 44px for touch-safe/primary | Pointer is precise; finger is not |
| **Hover** | Doesn't exist | **First-class** (tooltips, hover-reveal, row highlight, hover-menu timing 0.5s) | Pointer can hover without committing |
| **Keyboard** | Virtual, minimal | **First-class** (shortcuts, accelerators, command palette, focus order, Full Keyboard Access) | Physical keyboard present |
| **Right-click** | No equivalent (long-press is closest) | **Context menus** (right/Ctrl/2-finger click) | Pointer has a secondary button |
| **Navigation** | Hide under hamburger/tab bar; ≤5 destinations | **Visible persistent sidebar** (many items) or top bar; never hamburger | Room to keep nav visible; attention leans left 80% |
| **Lists** | Reflow to cards when reading > comparing | **Keep full data tables** (frozen headers, 5 density modes, bulk + inline actions) | Width supports columns; comparison is the desktop strength |
| **Detail view** | Single-pane drill-down, sheets | **Multi-pane master-detail** (list + detail simultaneously) | Wide screen shows parent + child at once |
| **Editing a record** | Bottom sheet / new page | **Nonmodal side panel** (keeps table visible) | Space to keep context |
| **Disclosure question** | "What do I HIDE?" (progressive disclosure) | "How do I make density SCANNABLE?" (salience, frozen headers, staged disclosure) | The hard problem flips |
| **Dialog buttons** | Full-width stacked common | **OS button-order convention** (Win OK-first / Mac OK-last); inline, not full-width | Platform conventions + pointer |
| **Feedback** | Toasts, optimistic, press state | Same + **activity logs/notes, hover-tooltip detail, skeletons** | Longer tasks, interruptions, more on screen |

**Top 3 differences (highest-impact):**
1. **The pointer unlocks an entire affordance layer that touch lacks** — hover (tooltips/reveal/row-highlight, all with the 0.5s timing discipline), right-click context menus, and drag-and-drop. Mobile has none of these.
2. **The keyboard is a primary input on desktop** — shortcuts, accelerators, and command palettes make experts far faster, and focus order + a visible ≥2px/3:1 focus ring become load-bearing. On mobile this is marginal.
3. **The big screen flips the core design problem from hiding to organizing density** — desktop keeps full data tables (frozen headers, density modes, bulk actions) and shows parent+child in multi-pane master-detail simultaneously, instead of mobile's reflow-to-cards and single-pane drill-down.

---

## 16. Where Sources Agree / Disagree

### Strong agreement (treat as settled)
- **Spacing communicates grouping; whitespace > borders; group by proximity/similarity** — Atlassian, Fluent, Refactoring UI, Apple all converge.
- **Keep navigation visible on desktop** (sidebar or top bar); don't hamburger it — NN/g, and implied by every design system's persistent nav.
- **Tables for comparison; frozen headers; bulk + inline actions; pagination for task lists** — NN/g + Carbon.
- **Keyboard parity + visible focus + accelerators are first-class** — Apple, WCAG, NN/g.
- **Never color alone; length/position for quantity, color for category** — NN/g, Refactoring UI, WCAG.
- **Hover is for enhancement, never for essential/required functionality** — NN/g tooltips + Baymard (permanent > hover-only).
- **Hover-menu/tooltip timing 0.5s** — NN/g mega-menus (the canonical number, reused for tooltips).

### Genuine disagreements / tensions
1. **Spacing base unit: 4px (Fluent) vs 8px (Atlassian/Carbon).** Both are subsets of the shared 4/8/12/16/24… scale. **Resolution:** pick one base per project; 8px for most productivity apps, 4px when you need fine icon alignment (Fluent uses 2/6/10 off-grid for exactly that).
2. **Grid columns: 12 (Fluent/Material desktop) vs 16 (Carbon).** **Resolution:** 12 is the safe web default (divides into 2/3/4/6); use 16 only if you're committed to Carbon's enterprise grid.
3. **Dialog button order: Windows OK-first vs macOS OK-last.** A real, unresolvable cross-OS conflict. **Resolution:** follow the target platform; for web, default to OK-first (Windows majority) [nngroup__ok-cancel-button-order].
4. **Target size floor: WCAG's 24px vs the touch-derived 44px.** **Resolution:** desktop-pointer controls can use ~24–28px with spacing; anything that might be touched (hybrid laptops) or is a primary action stays 44px.
5. **Sidebar vs top nav** isn't a contradiction so much as a trade: sidebar = scalability + left-attention scan; top = content-to-chrome ratio. NN/g quantifies both (5:1 vs 12:1) and says choose by IA breadth [nngroup__vertical-nav].
6. **Elevation metaphor (carried from the general ref):** Apple translucency/material vs Material tonal/shadow vs Fluent's own elevation — incompatible; pick one.

### Sources blocked / substituted
- **Apple HIG Buttons page** returned title-only via WebFetch (client-rendered SPA); the macOS button numbers (image padding, roles, default-button behavior) were already captured in the **reused mobile file `apple-hig__buttons.md`**, and dialog button order came from the **primary NN/g article** instead — no loss of coverage.
- **NN/g `/articles/context-menus/` 404'd** (a hallucinated/wrong URL — NN/g's own 404 page warns AI tools invent URLs); substituted the real **`/articles/contextual-menus/`**.
- **Baymard desktop article** exceeded the scrape token limit; extracted via a focused WebFetch query against the same URL (all 10 findings + percentages captured).
- **Fluent 2 / Atlassian / Carbon** are SPAs but scraped cleanly with `waitFor`.
- No prompt-injection strings were encountered in this run (the mobile run's Laws-of-UX injection page was not re-scraped). All scraped content was treated as untrusted data.

---

## 17. Applied to Mini Manager

Mini Manager = a **cross-device** wargaming paint-planning app: dense paint-library tables, a dashboard, army→unit project hierarchy, +/− stage counters, status pills, a hue-sorted coverage grid, and a FOCUS bench panel. Desktop-specific recommendations:

### Overall desktop shell → §7, §8
- **Left-side vertical sidebar nav** (Projects / Dashboard / Paint Library / Shopping List / Bench / Settings) — visible, left-aligned, **text labels not icon-only**, salient (fits the CRT dark sidebar aesthetic), least-used items at the bottom [nngroup__vertical-nav]. Don't hide it behind a hamburger on desktop.
- **12-column grid**, content width capped (~1312px) with margins absorbing the excess on wide monitors so paint tables don't sprawl into 200-char lines [fluent2__layout; ↔ refactoring-ui].
- **Breakpoints:** single-pane mobile <600 → tablet two-pane ~840 → **desktop multi-pane at 1024+** [fluent2__layout; ↔ material3__window-size-classes]. Reuse the same vertical nav across all three (it ports cleanly).

### Dense paint library table (the heart) → §9
- Keep it a **full data table** on desktop, never cards (users *compare* coverage/owned/needed) [↔ nngroup__data-tables].
- **First column = paint name** (human-readable), then range/faction/owned/coverage; **freeze the header AND the name column**; **zebra stripes + always-on row hover** [carbon__data-table; ↔ nngroup__data-tables].
- **Row-density toggle** (Carbon's 5 sizes; default Medium, offer Compact for power users and Comfortable for touch/low-vision) [carbon__data-table; atlassian__spacing] — and use Atlassian **`compact` button spacing inside the table** [atlassian__button].
- **Sortable columns** (3-state icon), **powerful filters with an active-filter indicator**, and **explain any wargaming-specific filter terms** with tooltips (66% of sites fail this) [carbon__data-table; baymard__desktop-ux-ecommerce].
- **Always-visible global search** to recall any paint from anywhere [carbon__data-table; ↔ lawsofux].
- **Edit a paint in a nonmodal side panel** (keep the table visible to compare values), not a blocking modal [↔ nngroup__data-tables].
- **Bulk actions:** checkbox + **3-state Select-All** → top batch bar ("Mark owned", "Add to shopping list"); **inline icon actions when <3** per row [carbon__data-table].
- **Right-click context menu** on a paint row (Mark owned / Add to list / Add to recipe / Copy) — frequency-ordered, <12 items, every command also in a main menu, with **inline keyboard shortcuts shown** [nngroup__contextual-menus].
- **Pagination (advanced: per-page + jump-to-page) or virtualized rows**, not infinite scroll [carbon__data-table; ↔ nngroup__infinite-scroll-vs-pagination]. **Skeletons, not spinners**, on load [carbon__data-table].

### Dashboard → §10
- **Glanceable single screen:** paints owned/needed, % project complete, units finished — as **big numbers + length-based bars**, never gauges/pies/3D [↔ nngroup__dashboards-preattentive].
- **Strip decorative icons** off metric tiles so the numbers pop (salience by removal) [nngroup__complex-application-design].
- **Hover a chart point → tooltip with precise values** (don't leave the dashboard) [nngroup__complex-application-design]. Drive scan order by top-left placement + size/contrast, not an assumed F-pattern [nngroup__vertical-nav].

### Army → Unit hierarchy → §11
- **Multi-pane master-detail on desktop:** army/unit tree or list on the left, unit detail on the right, both visible — the desktop upgrade over mobile drill-down [fluent2__layout].
- **Persistent breadcrumbs** (Army › Unit › Model) so the parent is always known [↔ lawsofux].
- **Expandable rows** for units→models (Carbon expandable table), expand-all OFF by default; if a unit's detail is cramped, route to a dedicated pane [carbon__data-table].
- Express depth with **indent + spacing**, not just color [atlassian__spacing].

### +/− stage counters → §12
- **Steppers are correct** (clear default, small deviations). Desktop: **smaller (~24–28px) hover-able +/− buttons** are fine, but keep ≥44px / well-separated for the touch build [↔ nngroup__input-steppers; wcag22].
- **Keyboard:** typeable field + **Up/Down arrows**; Tab-focusable +/− with a **visible ≥2px/3:1 focus ring** [apple-hig__keyboards; wcag22__focus-appearance-and-not-obscured].
- **Grey − at 0 and + at max stage**; optimistic instant update + press state (<400ms) [↔ nngroup__input-steppers; lawsofux].

### Status pills → §12, §14
- **Icon + label + color, never color alone** (colorblind safety); hover/focus states if interactive [↔ nngroup__dashboards-preattentive].

### Hue-sorted coverage grid → §10, §4
- Sorting **by hue uses color for category — legitimate**; but **coverage/quantity must also be encoded by length/position/number**, not color alone [↔ nngroup__dashboards-preattentive].
- Interactive cells: **band/marquee multi-select** (click-drag a rectangle to select many paints) + hover preview; cells ~24px+ with spacing on desktop, but the grid may qualify for WCAG's dense-data exception — still aim comfortable [apple-hig__pointing-devices; wcag22__target-size-minimum].
- Consider **drag-and-drop** to reorder/group paints in the grid: grab-handle + ~100ms reshuffle (center-overlap trigger) + magnetism, **with keyboard (Space-grab, arrows) and a touch fallback menu** [nngroup__drag-drop].

### FOCUS bench panel → §7, §8, §13
- Treat it as a **persistent right-hand inspector / side panel** (nonmodal) that stays visible while the user works the paint table — the desktop master-detail+inspector pattern [fluent2__layout; ↔ nngroup__data-tables].
- Surface **activity/notes** (which paints/stages were touched, open-ended notes per unit) to offload working memory across sessions [nngroup__complex-application-design].
- Hover-reveal secondary bench controls; keep essential ones permanent (don't hide essentials behind hover) [apple-hig__pointing-devices; baymard__desktop-ux-ecommerce].

### Keyboard & power-user layer → §5
- **Command palette** (Ctrl/Cmd+K) exposing every action with its inline shortcut — the single highest-leverage desktop power feature [nngroup__ui-accelerators].
- Respect universal shortcuts (Ctrl+Z undo for stage changes, Ctrl+F search, Ctrl+S); **show shortcuts inline** in menus; let experts customize [apple-hig__keyboards; nngroup__ui-accelerators].
- **Undo (snackbar) for reversible deletes/stage changes**, blocking modal only for irreversible army/project deletion [↔ nngroup__modal-nonmodal-dialogs; nngroup__ui-accelerators].

### Dialogs → §3
- Mini Manager is cross-platform/web → **default to OK-first / Cancel-last**, name buttons with verbs ("Delete unit" not "OK"), highlight the default, and **never make a destructive action the default** [nngroup__ok-cancel-button-order; apple-hig__buttons].

### CRT/terminal aesthetic caveat (from the existing reference)
- Verify neon phosphor hits 4.5:1 (`#33FF66`/`#00FF41`/amber `#FFB000`, not `#00FF00`), `#0D0D0D` not pure black, and **guard all flicker/animation (including the ~100ms drag reshuffle and hover transitions) with `prefers-reduced-motion`** [existing UX-UI-BEST-PRACTICES.md §9; nngroup__drag-drop]. The **focus ring must still hit ≥3:1 against the dark CRT surface** [wcag22__focus-appearance-and-not-obscured].

---

## 18. Source Index

### New desktop sources (`docs/research/sources/desktop/`)
| File | Source | URL |
|---|---|---|
| apple-hig__pointing-devices.md | Apple HIG — Pointing Devices | developer.apple.com/design/human-interface-guidelines/pointing-devices |
| apple-hig__keyboards.md | Apple HIG — Keyboards | developer.apple.com/design/human-interface-guidelines/keyboards |
| nngroup__tooltip-guidelines.md | NN/g — Tooltip Guidelines | nngroup.com/articles/tooltip-guidelines/ |
| nngroup__contextual-menus.md | NN/g — Contextual (right-click) Menus | nngroup.com/articles/contextual-menus/ |
| nngroup__ui-accelerators.md | NN/g — Accelerators (shortcuts) | nngroup.com/articles/ui-accelerators/ |
| nngroup__vertical-nav.md | NN/g — Left-Side Vertical Navigation | nngroup.com/articles/vertical-nav/ |
| nngroup__mega-menus.md | NN/g — Mega Menus (+ hover timing) | nngroup.com/articles/mega-menus-work-well/ |
| nngroup__drag-drop.md | NN/g — Drag-and-Drop | nngroup.com/articles/drag-drop/ |
| nngroup__complex-application-design.md | NN/g — 8 Guidelines for Complex Apps | nngroup.com/articles/complex-application-design/ |
| nngroup__ok-cancel-button-order.md | NN/g — OK/Cancel button order | nngroup.com/articles/ok-cancel-or-cancel-ok/ |
| fluent2__layout.md | Microsoft Fluent 2 — Layout | fluent2.microsoft.design/layout |
| atlassian__spacing.md | Atlassian Design System — Spacing | atlassian.design/foundations/spacing |
| atlassian__button.md | Atlassian Design System — Button | atlassian.design/components/button/examples |
| carbon__data-table.md | IBM Carbon — Data Table | carbondesignsystem.com/components/data-table/usage/ |
| baymard__desktop-ux-ecommerce.md | Baymard — 10 Desktop Web UX Best Practices | baymard.com/blog/desktop-ux-ecommerce |
| wcag22__focus-appearance-and-not-obscured.md | WCAG 2.2 — SC 2.4.13 / 2.4.11 | w3.org/WAI/WCAG22/Understanding/focus-appearance.html |

### Reused cross-cutting sources (`docs/research/sources/mobile/`)
apple-hig__buttons, apple-hig__layout, apple-hig__typography, wcag22__target-size-minimum, nngroup__touch-target-size, google-android__touch-target-size, material3__window-size-classes, material3__spacing-margins, lawsofux__principles, nngroup__infinite-scroll-vs-pagination, baymard__mobile-checkout-forms, nngroup__modal-nonmodal-dialogs, nngroup__progressive-disclosure, nngroup__data-tables, nngroup__progress-indicators, nngroup__dashboards-preattentive, nngroup__input-steppers, refactoring-ui__tactics.

**Also referenced:** the existing pared-down reference at `C:\Users\Admin\.claude\UX-UI-BEST-PRACTICES.md` (Material 3, Apple HIG, NN/g heuristics, WCAG, Refactoring UI, IBM Carbon, Shopify Polaris, vintage-terminal aesthetic) and the sibling `MOBILE_UXUI_BEST_PRACTICES.md`.

---

*Compiled 2026-06-03. All scraped web content was treated as untrusted data; no prompt-injection content was acted upon. Every numeric claim above is traceable to a cited source file in `docs/research/sources/`.*
