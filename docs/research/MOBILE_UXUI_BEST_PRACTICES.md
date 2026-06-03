# Mobile UX/UI Best Practices — The Ultimate Reference

> Synthesized from primary design systems (Apple HIG, Material Design 3), the WCAG 2.2 standard, and empirical UX research (Nielsen Norman Group, Baymard Institute, Laws of UX, Refactoring UI). Every claim is traceable to a cleaned source file in `docs/research/sources/mobile/`. Retrieved 2026-06-03.
>
> This document goes **deeper than and complements** the general reference at `C:\Users\Admin\.claude\UX-UI-BEST-PRACTICES.md` — it is mobile-specific, citation-rigorous, and ends with a section applying every finding to Mini Manager.

---

## Table of Contents
1. [Executive Summary](#1-executive-summary)
2. [Hard-Numbers Cheat Sheet](#2-hard-numbers-cheat-sheet)
3. [Buttons](#3-buttons)
4. [Typography & Sizing Ratios](#4-typography--sizing-ratios)
5. [Layout, Boxes & Spacing](#5-layout-boxes--spacing)
6. [Navigation & Disclosure](#6-navigation--disclosure)
7. [Large Lists & Databases](#7-large-lists--databases)
8. [Dashboards](#8-dashboards)
9. [Project / Sub-Project Hierarchical Flows](#9-project--sub-project-hierarchical-flows)
10. [Status Indicators & Steppers](#10-status-indicators--steppers)
11. [Information Tracking & Feedback](#11-information-tracking--feedback)
12. [Accessibility (woven throughout, summarized)](#12-accessibility)
13. [Synthesis: Where Sources Agree / Disagree](#13-synthesis-where-sources-agree--disagree)
14. [Applied to Mini Manager](#14-applied-to-mini-manager)
15. [Source Index](#15-source-index)

---

## 1. Executive Summary

Mobile UX is governed by **three immovable constraints** that all guidance derives from [Baymard, mobile-checkout-forms]:
1. **Typing is slow and error-prone** on touch keyboards.
2. **There is almost no page overview** — the keyboard alone eats up to 50% of the viewport (70% in landscape), leaving 1–2 form fields visible.
3. **There are no focus hints** — no hover state, no certainty about what's covered.

From these, the entire field converges on a handful of moves: **make targets big** (44pt / 48dp / 1cm), **defer the rarely-needed** (progressive disclosure), **prioritize content over chrome**, **give feedback within 400ms–1s**, and **never rely on color alone**. The disagreements between sources are narrow and mostly about *defaults* (full-width buttons, where the thumb actually reaches), not about principles.

The single highest-leverage mobile decision is **what you put on the screen versus what you hide** — every authority frames this as progressive disclosure, and getting the split right improves learnability, efficiency, and error rate simultaneously [NN/g, progressive-disclosure].

---

## 2. Hard-Numbers Cheat Sheet

Every concrete value with its source. Where numbers appear to conflict (24 vs 44 vs 48), see the reconciliation note below the table.

| Metric | Value | Applies to | Source |
|---|---|---|---|
| **Touch target — WCAG legal minimum** | **24 × 24 CSS px** | Web, Level AA (SC 2.5.8) | wcag22__target-size-minimum |
| **Touch target — WCAG enhanced** | **44 × 44 CSS px** | Web, Level AAA (SC 2.5.5); important controls | wcag22__target-size-minimum |
| **Touch target — Apple** | **44 × 44 pt** (visionOS 60×60) | iOS/iPadOS/web | apple-hig__buttons |
| **Touch target — Material/Android** | **48 × 48 dp** (≈9 mm) | Android/web | google-android__touch-target-size |
| **Touch target — NN/g (research)** | **1 cm × 1 cm** (0.4 in) physical | All touchscreens | nngroup__touch-target-size |
| **Touch target — moving/in-motion use** | **~2 cm × 2 cm** (0.8 in) | Walking/driving context | nngroup__touch-target-size |
| **Min spacing between small targets** | **8 dp** (Material); 24px-circle clearance (WCAG); ~4px rescues a 20px target | Between adjacent targets | google-android; wcag22 |
| **Recommended touchscreen object size** | **7–10 mm** | All | google-android__touch-target-size |
| **Fingertip width (avg)** | 1.6–2 cm | — | nngroup__touch-target-size |
| **Thumb impact area (avg)** | 2.5 cm | — | nngroup__touch-target-size |
| **Min text size — Apple** | **11 pt** | iOS | apple-hig__typography |
| **Body text — Apple default** | **17 pt** | iOS Body style | apple-hig__typography |
| **SF Pro Text → Display crossover** | **20 pt** (Text ≤19, Display ≥20) | iOS | apple-hig__typography |
| **iOS type scale (Large setting)** | LargeTitle 34 / Title1 28 / Title2 22 / Title3 20 / Headline 17 / Body 17 / Callout 16 / Subhead 15 / Footnote 13 / Caption1 12 / Caption2 11 (pt) | iOS Dynamic Type | apple-hig__typography |
| **Web body convention** | 16 px (≈ Apple's 17pt) | Web | refactoring-ui; apple cross-ref |
| **Line length** | 45–75 characters | Body text | (existing ref) refactoring-ui |
| **Line-height** | ~1.5 body / ~1.2 headings | All | refactoring-ui__tactics |
| **Text resize support** | up to 200% (SC 1.4.4); usable at 400% zoom / 320px (SC 1.4.10) | Web AA | (existing ref) wcag |
| **Spacing grid** | **8 dp** layout / **4 dp** component-internal | Material | material3__spacing-margins |
| **Spacing scale** | 4, 8, 12, 16, 24, 32, 48, 64, 96, 128 px | All | refactoring-ui; material |
| **Window margins — compact** | **16 dp** | Phone (<600dp) | material3__spacing-margins |
| **Window margins — medium/expanded** | **24 dp** | Tablet (≥600dp) | material3__spacing-margins |
| **Pane gutter (list-detail)** | 24 dp | Material medium/expanded | material3__spacing-margins |
| **Breakpoint — Compact** | width **< 600 dp** (99.96% of phones portrait) | — | material3__window-size-classes |
| **Breakpoint — Medium** | **600–839 dp** | tablets portrait | material3__window-size-classes |
| **Breakpoint — Expanded** | **840–1199 dp** | tablets landscape | material3__window-size-classes |
| **Breakpoint — Large / XL** | 1200–1599 / ≥1600 dp | large tablet / desktop | material3__window-size-classes |
| **Button height — Material default** | 40 dp visual, 48 dp touch | Material | material3__spacing-margins |
| **visionOS button sizes** | Mini 28 / Small 32 / Regular 44 / Large 52 / XL 64 pt | visionOS | apple-hig__buttons |
| **Button centers apart (visionOS)** | ≥ 60 pt; +4pt padding if ≥60pt | visionOS | apple-hig__buttons; apple-hig__layout |
| **Image-button padding (macOS)** | ~10 px image-to-edge | macOS | apple-hig__buttons |
| **Tab bar / nav bar item limit** | ≤ 5 options | Mobile nav | nngroup__mobile-navigation-patterns; apple |
| **tvOS safe area** | 60 pt top/bottom, 80 pt sides | tvOS | apple-hig__layout |
| **Touch keyboard viewport take** | up to **50%** (70% landscape) | Mobile forms | baymard__mobile-checkout-forms |
| **Doherty Threshold (responsiveness)** | **< 400 ms** | Interaction | lawsofux__principles |
| **Immediate feedback needed by** | the instant of the tap | All | nngroup__progress-indicators |
| **Progress indicator needed if action >** | **~1.0 s** | All | nngroup__progress-indicators |
| **Spinner (looped) — use for** | **2–10 s** | All | nngroup__progress-indicators |
| **Percent-done — use for** | **≥ 10 s** (or known record count) | All | nngroup__progress-indicators |
| **Progress bar effect on patience** | users wait ~**3× longer** with a moving bar | Research | nngroup__progress-indicators |
| **Working memory (chunk size)** | **7 ± 2** items | Information grouping | lawsofux__principles |
| **Stepper min button size** | **1 cm × 1 cm**, horizontal layout on mobile | +/− controls | nngroup__input-steppers |
| **Contrast — normal text AA** | 4.5:1 | Web | (existing ref) wcag |
| **Contrast — large text / UI components AA** | 3:1 | Web | (existing ref) wcag |
| **Colorblindness prevalence** | ~4.5% overall (8% men, 0.5% women) | Color decisions | nngroup__dashboards-preattentive |

### Reconciling 24 / 44 / 48 / 1cm
These are NOT contradictory — they are a floor and a recommendation:
- **24 CSS px** is the WCAG 2.2 AA legal *minimum* for web.
- **44 pt (Apple) ≈ 48 dp (Material) ≈ 1 cm (NN/g) ≈ WCAG AAA 44px** is the recommended *comfortable* target.
- **Build to 44–48px and you satisfy every authority simultaneously.** Use 24px only as an absolute fallback for dense, space-constrained controls — and then ensure 24px-circle spacing clearance [wcag22__target-size-minimum].

---

## 3. Buttons

### Tap-target size (the numbers, and where each applies)
- **Minimum hit region 44×44 pt** — Apple's rule, applies to web too; "ensures people can select it whether they use a fingertip, pointer, eyes, or remote" [apple-hig__buttons].
- **48×48 dp (≈9 mm)** — Material/Android, separated by **≥8 dp** [google-android__touch-target-size].
- **1 cm × 1 cm physical** — NN/g, from peer-reviewed research (Parhi et al. 2006); grounded in finger anatomy (fingertip 1.6–2cm, thumb 2.5cm) [nngroup__touch-target-size].
- **24×24 CSS px** — WCAG AA hard minimum; below that, the target needs a clear 24px-diameter-circle spacing around it [wcag22__target-size-minimum].
- The **touch target extends beyond the visual element** — a 24dp icon should carry padding out to 48dp [google-android]. Use `TouchDelegate` / `Modifier.sizeIn` / `min-height` (CSS technique C42) to enlarge the hit area without enlarging the visual.

### Label & font size
- Start the label with a **verb**, title-style caps ("Add to Cart") [apple-hig__buttons].
- "Labels are a last resort" — combine label and value where possible [refactoring-ui__tactics].
- Button text rides the type scale (≥16px/17pt for primary actions).

### Spacing between targets
- **≥8 dp** between adjacent targets [google-android].
- WCAG: a 20px target with a **4px gap** passes; with no gap, fails [wcag22].
- "Targets must first be big enough, THEN spaced well enough — spacing can't rescue a too-small target" [nngroup__touch-target-size]. Fix for tightly-stacked links: move them **side-by-side** (more width = more error room than short line-height).

### Hierarchy: primary / secondary / destructive
- **Roles (Apple):** Normal / Primary (default, accent color, responds to Return) / Cancel / Destructive (system red) [apple-hig__buttons].
- **Keep prominent buttons to 1–2 per view** — too many raises cognitive load [apple-hig__buttons].
- **Use STYLE, not size, to signal the preferred choice** — same-size buttons read as a coherent set; different sizes look broken [apple-hig__buttons].
- **Never make a destructive action the primary button**, even if it's the likely choice — people tap prominent buttons without reading [apple-hig__buttons].
- **Von Restorff Effect:** one visually distinct primary CTA is remembered/chosen [lawsofux__principles].

### Placement & thumb zones
- **Fitts's Law:** primary CTA = biggest, closest-to-intent target [lawsofux__principles].
- **MYTH-BUSTER:** the bottom of the screen is NOT universally the most reachable — because people hold phones many ways, **the MIDDLE of the screen is the most tappable region** across grips. Don't justify bottom-anchored controls purely on "reachability" [nngroup__bottom-sheets].
- For in-motion contexts (in a hobby workshop, holding a model), enlarge to ~2cm [nngroup__touch-target-size].

### Full-width vs inline — a genuine cross-platform disagreement
- **Apple iOS: AVOID full-width buttons** — buttons feel native when inset from screen edges within system margins [apple-hig__layout].
- **Apple watchOS: PREFER full-width** primary buttons — easier to tap on a tiny screen [apple-hig__buttons].
- **NN/g (research): primary CTAs deserve larger targets**; full-width is fine and often better for the primary action on small screens [nngroup__touch-target-size].
- **Resolution:** Full-width for *the one* primary action on a phone is well-supported; for secondary actions and on iOS specifically, prefer inset/inline. Two short side-by-side buttons work if the screen doesn't scroll [apple-hig__layout, watchOS].

### Always include a press state
A custom button without a press state "feels unresponsive" [apple-hig__buttons]. Provide immediate visual feedback on tap [nngroup__progress-indicators].

---

## 4. Typography & Sizing Ratios

### Minimum & body sizes
- **Never below 11 pt/px** for readable text [apple-hig__typography].
- **Body: 17 pt (iOS) ≈ 16 px (web convention)** [apple-hig__typography; refactoring-ui].
- **SF Pro Text ≤19pt, SF Pro Display ≥20pt** [apple-hig__typography].
- Prefer **Regular/Medium/Semibold/Bold**; avoid Ultralight/Thin/Light — they fail at small sizes / low contrast [apple-hig__typography].

### The type scale
- iOS Dynamic Type: 34/28/22/20/17/17/16/15/13/12/11 pt across 11 roles [apple-hig__typography].
- Material: 5 roles (Display/Headline/Title/Body/Label) × 3 sizes [existing ref].
- Constrain to ~8 sizes; establish a type scale up front [refactoring-ui__tactics].
- **Maintain relative hierarchy when users scale text** (Dynamic Type) — headings stay bigger than body across the whole range [apple-hig__typography].

### The RELATIONSHIP / ratio between text and the elements around it (Ross's explicit ask)
There is no single magic ratio, but the sources converge on these relationships:
- **Touch target ≈ 2.5–3× the cap-height of its label.** A 17pt label (~17px) sits in a ~44–48px target — i.e. the interactive box is roughly **2.5–3× the text size** [synthesis: apple-hig__buttons + apple-hig__typography].
- **Icon-to-label:** an icon is typically sized to the label's cap-height-to-x-height-plus, i.e. **~1×–1.5× the text size** for inline icon+label pairs; a standalone icon button still needs the full 44–48px target even if the glyph is 24px [google-android: 24dp glyph in 48dp target].
- **Icon glyph : touch target = ~1 : 2** (24dp glyph in 48dp target) [google-android__touch-target-size].
- **Line length 45–75 characters** regardless of font size — wider fatigues eye-tracking [refactoring-ui__tactics].
- **Line-height is proportional** (~1.5 body), not a fixed pixel value [refactoring-ui__tactics].
- **Spacing scales with the 4/8 grid**, not with text — but padding inside a button should be generous relative to the label (cramped reads as low quality) [refactoring-ui; apple].
- Practical rule of thumb: **label 16–17px → padding ~12–16px each side → target 44–48px → icon 20–24px**. These ratios keep label, icon, and hit area visually balanced.

### Legibility / accessibility
- Contrast 4.5:1 normal, 3:1 large/UI [existing ref wcag]. Never rely on color alone [refactoring-ui; apple; nngroup].
- Don't put grey text on colored backgrounds [refactoring-ui__tactics].
- Support 200% resize / 400% reflow [existing ref wcag].

---

## 5. Layout, Boxes & Spacing

### Spacing scale & grid
- **8 dp grid for layout; 4 dp for component-internal** spacing/icon alignment [material3__spacing-margins].
- Pick from a constrained scale (4/8/12/16/24/32/48/64/96/128) — don't invent values [refactoring-ui__tactics].
- **Start with too much whitespace, then reduce** — you'll never loosen tight layouts enough [refactoring-ui__tactics].

### Margins & gutters
- **Compact window (phone): 16 dp** margins; **Medium/Expanded (tablet): 24 dp** [material3__spacing-margins].
- Pane gutter 24 dp [material3].

### Spacing communicates relationship (the load-bearing rule)
- **More gap between groups than within them.** Ambiguous spacing (equal gaps) destroys perceived structure [refactoring-ui__tactics].
- **Gestalt:** Proximity, Common Region (a card/box), Uniform Connectedness group elements [lawsofux__principles]. Group related controls in a card; don't scatter them.
- Apple: group related items with space/shape/color/material; give essential info room; don't crowd [apple-hig__layout].
- **Use fewer borders** — replace dividing lines with spacing or background-color shifts [refactoring-ui__tactics].

### Element & container sizing
- Place most important items top + leading (reading order); align components to aid scanning [apple-hig__layout].
- Design for the smallest target width first — modern iPhones bottom out at ~320–375 pt compact width [apple-hig__layout].
- Defer switching to a compact view as long as possible; design full-screen first [apple-hig__layout].

### Safe areas / notches
- Respect the **safe area** (avoid Dynamic Island, camera housing, home indicator) [apple-hig__layout].
- Extend backgrounds/artwork edge-to-edge; controls float *above* content [apple-hig__layout].
- macOS: don't put critical controls at the window bottom (often dragged offscreen) [apple-hig__layout].

### Density
- WCAG note: offer a **layout-density control** — motor-impaired users want larger targets; some low-vision users prefer condensed [wcag22__target-size-minimum].

---

## 6. Navigation & Disclosure

### The governing principle: progressive disclosure
"Deferring secondary material is a key guideline for mobile design" [nngroup__progressive-disclosure].
- **Show only the few most important options first; reveal the rest on request.**
- Improves **learnability, efficiency, and error rate** simultaneously.
- The fact that something is on the initial display *signals its importance*.
- **Two levels is the practical max** — beyond that users get lost; chunk advanced features into groups.
- Get two things right: (1) the **split** between initial/secondary (use task analysis + analytics + usability testing — high page hits may mean accidental entry); (2) make **progression obvious** with strong information scent on the label.

### What belongs ON the page vs HIDDEN (Ross's explicit ask)
| Put on the page (visible) | Hide behind drawer / sheet / overflow |
|---|---|
| Frequently-needed, few (≤5) options | Many or rarely-used options |
| Primary action(s) | Secondary/advanced actions |
| Always-needed info & controls | Contextual info needed only sometimes |
| Core record identifier & key columns | Tertiary metadata |
| Tab-bar destinations (top-level) | Settings, account, help, bulk tools |

Sources: [nngroup__progressive-disclosure; nngroup__mobile-navigation-patterns; nngroup__data-tables; apple-hig__layout]. **Prioritize content over chrome** [nngroup__mobile-navigation-patterns].

### Navigation patterns — when to use each
| Pattern | Use when | Notes |
|---|---|---|
| **Tab bar** | ≤5 top-level destinations, frequent switching | Persistent (always visible). iOS bottom / Android top. **Label the icons.** | [nngroup__mobile-navigation-patterns; apple] |
| **Top nav bar** | Few options, web-style | Disappears on scroll unless sticky | [nngroup] |
| **Hamburger / drawer (slide-out panel)** | Many options + submenus, browse-mostly content | **Least discoverable** — many never open it. The word "Menu" beats the bare icon. Support nav other ways. | [nngroup__mobile-navigation-patterns] |
| **Navigation rail** | Medium window (tablet, 600–839dp) | Material adaptive step between tab bar and drawer | [material3__window-size-classes] |
| **Navigation hub (homepage-as-hub)** | Task-based apps, one task per session | Wastes real estate, extra step per nav | [nngroup__mobile-navigation-patterns] |
| **Bottom sheet** | Contextual details/controls while keeping background visible; SHORT interactions | See below | [nngroup__bottom-sheets] |
| **Modal dialog** | Critical/irreversible warnings; info required to continue | See below | [nngroup__modal-nonmodal-dialogs] |

**Material adaptive mapping:** compact → bottom nav bar; medium → navigation rail; expanded+ → navigation drawer/persistent rail [material3__window-size-classes].

### Bottom sheets
- A form of progressive disclosure anchored to the screen bottom; preserves background context (better than a new page for spatial memory) [nngroup__bottom-sheets].
- **Modal** (scrim, blocks background) vs **nonmodal** (background stays interactive, e.g. Maps) vs **expandable** (nonmodal → modal on drag).
- Rules: **allow Back to dismiss**; **include a visible Close (X)** — don't rely on the grab handle (swipe is ambiguous + inaccessible); **don't stack sheets**; **don't replace page-to-page flows**; **only for short interactions** [nngroup__bottom-sheets].

### Modals / dialogs / popups
- Modals interrupt, block content, add cognitive load and an extra dismiss goal — justify the cost [nngroup__modal-nonmodal-dialogs].
- **USE for:** critical/irreversible-error warnings; info required to continue; fragmenting a complex flow (wizard, with progress); a relevant question that lessens work.
- **DON'T USE for:** nonessential info (newsletter signups → erodes trust); high-stakes flows like checkout; complex decisions needing blocked info.
- **Sizing/dismissal:** keep short and direct; a multi-step flow belongs on a **dedicated page**, not a modal. For *form errors*, report inline next to the field, not in a modal [nngroup__modal-nonmodal-dialogs].
- **Cross-device caveat:** a desktop nonmodal can become a mobile full-screen modal that traps the user — test on mobile [nngroup__modal-nonmodal-dialogs].

### Dropdowns
- Replace long dropdowns (country/state) with **autocomplete** — 80% of sites still get this wrong [baymard__mobile-checkout-forms].

---

## 7. Large Lists & Databases

### Tables vs cards — don't reflexively reflow
- **Tables win for scalability and comparison** — adjacent data points compared with no eye movement or memory load [nngroup__data-tables].
- **Cards force spatial reorientation** per card → comparison is slow. **Reflow a table to cards only when per-record reading matters more than cross-record comparison** [nngroup__data-tables].

### The 4 core table tasks (design for all four)
1. **Find records** — first column = human-readable identifier (not a mystery ID); column order reflects importance; related columns adjacent; **discoverable, powerful filters with an active-filter indicator** [nngroup__data-tables].
2. **Compare** — **freeze header rows AND columns**; use borders / zebra striping / hover-highlight to keep place; easy, accessible (not drag-only) **hide/reorder/sort columns with state indicators** ("15 columns hidden") [nngroup__data-tables].
3. **View/edit/add a row** — prefer a **nonmodal side panel** (keeps table visible); **avoid modals for deep editing** (covers reference rows); edit-in-place only if narrow; accordions clutter [nngroup__data-tables].
4. **Take action** — inline for 1–2 actions; otherwise **batch actions** (checkbox per row + actions above/below, Select All) [nngroup__data-tables].

### Infinite scroll vs pagination vs Load More
- **For task-oriented, searchable record lists: prefer pagination or Load More**, NOT infinite scroll — because re-findability matters [nngroup__infinite-scroll-vs-pagination].
- Infinite scroll problems: can't re-find content (no landmarks; Back returns to top), illusion of completeness, footer becomes unreachable, accessibility (keyboard/screen-reader), page load, SEO.
- **Load More** is the best mobile compromise (restores footer, kills illusion-of-completeness, helps low bandwidth); show "X of Y viewed" for orientation.
- Infinite scroll only suits homogeneous, goalless browsing (feeds).

### Search / filter / sort & recall from anywhere
- Navigation complements search; users are bad at formulating queries, so **recognition (tappable nav/filters) beats recall** [nngroup__mobile-navigation-patterns; lawsofux "Recognition rather than recall"].
- Provide global search to recall any record from anywhere (NN/g "find records" task + recognition-over-recall heuristic).

### Empty / loading / error states
- **Empty states deserve design** — often the first thing a new user sees; explain what goes here and the first action [refactoring-ui__tactics; existing-ref Polaris].
- Loading: skeleton/spinner per the timing thresholds (§10/§11).
- Errors: specific, adaptive messages — 92% of sites use generic "invalid X" [baymard__mobile-checkout-forms].

### Virtualization
- For very large lists, virtualize (render only visible rows) to keep scroll smooth — implied by the page-load concerns in [nngroup__infinite-scroll-vs-pagination] and the "scalability" advantage of tables [nngroup__data-tables]. (Implementation-level; not a contested design point.)

---

## 8. Dashboards

- **Definition:** a single-page, **at-a-glance** collection of visualizations users act on quickly — the car-dashboard metaphor. NOT for exploration [nngroup__dashboards-preattentive].
- **Operational** (time-sensitive, live-updating) vs **Analytical** (decision support, less urgent) — both need single-screen glanceability.
- **Preattentive processing** — surface what matters using attributes perceived instantly:
  - **Length (bar charts) and 2D position (line/scatter)** → accurate magnitude judgment → **use these for quantities.**
  - **Area & angle (pie, donut, gauge, radar, tree map)** → can't judge magnitude → **avoid for quick quantitative reading.**
  - **Color** → pops out but has no order → **categories only, never magnitude.**
- **Avoid 3D charts** (distorts shapes/alignment). **Avoid pie/donut** except for one overwhelming majority share [nngroup__dashboards-preattentive].
- **Color is a secondary cue** (4.5% colorblind, 8% of men) — pair with shape/position/label [nngroup__dashboards-preattentive].
- **Surface first:** the few metrics answering "is everything OK / what changed," using length-based bars and big numbers. Card patterns + glanceability + clear hierarchy (size/weight/contrast) [nngroup__dashboards-preattentive; refactoring-ui].

---

## 9. Project / Sub-Project (Hierarchical) Flows

Drawn from the convergence of progressive disclosure, navigation, table, and Apple layout guidance:
- **Drill-down with breadcrumbs / Back** — use the platform Back to move child→parent; bottom sheets and modals must honor Back [nngroup__bottom-sheets].
- **Overview → detail:** show a parent overview (a few key attributes per child) and let users drill to full detail — classic progressive disclosure ("a few key attributes on the product page; full specs one click away") [nngroup__progressive-disclosure].
- **Recognition over recall** between levels: persistent breadcrumbs/context so users always know which parent they're under (heuristic 6) [lawsofux__principles; nngroup__mobile-navigation-patterns].
- **Two-level limit on nesting** for disclosure depth before users get lost — beyond that, chunk/group [nngroup__progressive-disclosure].
- **Material list-detail / nav-rail adapts** parent↔child across window sizes (single pane on phone, two panes on tablet) [material3__window-size-classes].
- Apple: align + indent to express the information hierarchy; place parent context top/leading [apple-hig__layout].
- For navigating between siblings/parent, a **nonmodal side panel** keeps the list visible while editing a child (table task 3) [nngroup__data-tables].

---

## 10. Status Indicators & Steppers

### Status pills / badges
- **Never use color as the only channel** — add icon/shape/label (4.5% colorblind) [nngroup__dashboards-preattentive; refactoring-ui; apple].
- Status uses **categorical** encoding (color + shape together is more noticeable than either alone) [nngroup__dashboards-preattentive].
- Pills are interactive only if they meet target size (44–48px) [§3].

### Progress indicators (steppers-of-progress)
- Multi-step flows: show progress (Goal-Gradient / Zeigarnik effects raise completion) [lawsofux__principles].
- Wizards = staged disclosure; show a sense of progress or users abandon [nngroup__progressive-disclosure; nngroup__modal-nonmodal-dialogs].
- Timing: see §11.

### +/− counter / stepper controls (Ross's explicit ask)
From the dedicated NN/g stepper guidance [nngroup__input-steppers]:
- **Use steppers** for numeric fields with a clear most-common value and only small deviations (perfect for stage/quantity counters). **Don't** use for high-variability or continuous values.
- **Set the most-frequent value as the default.**
- **Buttons ≥ 1 cm × 1 cm** (= 44–48px) [nngroup__input-steppers cross-refs nngroup__touch-target-size].
- **Horizontal layout on mobile** — vertical steppers crowd and cause opposite-direction mis-taps.
- **Place + and − far enough apart** to avoid slips (the "too small/too close → farther apart" redesign).
- **Visuals:** +/− for horizontal, up/down chevrons for vertical; avoid left/right arrows.
- **Disable/grey the segment at min/max** (Expedia greys the + at the limit).
- **Add a typeable text-field stepper** for occasional large values; allow **long-press for continuous increment**; clarify step value, unit, and range.
- **Show clearly which field the stepper controls.**
- RTL: mirror segment placement (iOS flips for Arabic).

---

## 11. Information Tracking & Feedback

### Response-time thresholds (the spec)
- **< 400 ms = Doherty Threshold** — productivity peaks; aim for this [lawsofux__principles].
- **Immediate feedback at the moment of tap** (press state / refresh begins) — or users retap and create duplicates [nngroup__progress-indicators].
- **> ~1.0 s → show a progress indicator** [nngroup__progress-indicators].
- **2–10 s → looped spinner**; **≥10 s → percent-done** [nngroup__progress-indicators].
- Moving progress bar makes users wait ~**3× longer** [nngroup__progress-indicators].
- Percent-done: start slow/accelerate; give a rough estimate; allow cancel; show step counts when duration unknown.
- **Anti-patterns:** static "Loading…" (can't tell if stuck); "don't click again" warnings (unread; instead show the click registered) [nngroup__progress-indicators].

### Optimistic UI, undo, confirmation vs reversibility
- **Optimistic UI** (apply the change instantly, reconcile in background) directly serves the Doherty Threshold and the "feedback within 400ms" rule [lawsofux; nngroup__progress-indicators].
- **User control & freedom — provide Undo/Back/Cancel** (heuristic 3) [lawsofux__principles].
- **Confirmation vs reversibility:** reserve interrupting modals for **irreversible/critical** actions; for reversible actions prefer a non-blocking toast + Undo over a confirmation dialog [nngroup__modal-nonmodal-dialogs].
- **Address validators should warn, not hard-block** (offer force-proceed) [baymard__mobile-checkout-forms].

### Activity / history
- Surface activity/history for re-finding and orientation (re-findability is the core failure of infinite scroll) [nngroup__infinite-scroll-vs-pagination].

---

## 12. Accessibility

Woven throughout; the mobile-critical points:
- **Target size:** 24px AA floor, 44–48px recommended; spacing clearance for small targets [wcag22__target-size-minimum].
- **Contrast:** 4.5:1 normal, 3:1 large/UI; focus indicator 3:1 and not obscured (2.4.11/2.4.12) [existing-ref wcag].
- **Never rely on color alone** — pair with icon/shape/label; ~4.5% colorblind (8% men) [nngroup__dashboards-preattentive; refactoring-ui].
- **Text:** ≥11pt floor, support 200% resize / 400% reflow, support Dynamic Type, maintain hierarchy on scale [apple-hig__typography; existing-ref wcag].
- **Dismissal:** visible Close button (not gesture-only) for sheets/overlays — gestures are inaccessible to users who can't swipe precisely; aids screen readers [nngroup__bottom-sheets].
- **Keyboard/screen-reader:** infinite scroll traps keyboard users (use ARIA `feed`); name/role/value on every control [nngroup__infinite-scroll-vs-pagination; existing-ref wcag].
- **Motion:** respect `prefers-reduced-motion` [existing-ref].
- **Density control** option benefits both motor- and vision-impaired users [wcag22__target-size-minimum].
- **Forms:** label above field (not placeholder-as-label), mark required AND optional, adaptive error messages, input-optimized keyboards [baymard__mobile-checkout-forms].

---

## 13. Synthesis: Where Sources Agree / Disagree

### Strong agreement (treat as settled)
- **Big targets:** 44pt/48dp/1cm recommended, 24px absolute floor. Apple, Material, NN/g, WCAG all align once you read them as floor + recommendation.
- **Progressive disclosure / content-over-chrome** is the central mobile principle (Apple, NN/g, Laws of UX).
- **Never color alone** (WCAG, Refactoring UI, NN/g, Apple).
- **Feedback fast** — <400ms ideal, indicator >1s (Laws of UX Doherty, NN/g).
- **Spacing communicates grouping; more between groups than within** (Refactoring UI, Apple, Gestalt/Laws of UX).
- **Label above field, not placeholder** (Baymard, plus universal form guidance).
- **Modals/sheets only for short, justified, critical interruptions; offer a visible Close + Back** (NN/g).
- **Length/position for quantities, color for categories** (NN/g dashboards).

### Genuine disagreements / tensions
1. **Full-width buttons.** Apple iOS says *avoid* (inset within margins) [apple-hig__layout]; Apple watchOS and NN/g say *prefer* for the primary action on small screens [apple-hig__buttons; nngroup__touch-target-size]. **Resolution:** full-width for the single primary CTA on a phone is fine; inset secondary actions; follow iOS insets when targeting iOS specifically.
2. **Where the thumb reaches.** Common design lore says "bottom is reachable"; NN/g's research says the **middle** is most reachable across grips [nngroup__bottom-sheets]. **Resolution:** don't justify bottom placement on reachability alone — justify it on convention (tab bars) and context preservation (sheets).
3. **Tables → cards on mobile.** Popular responsive advice reflows everything to cards; NN/g warns cards destroy comparison [nngroup__data-tables]. **Resolution:** reflow only when reading beats comparing; otherwise keep a (horizontally scrollable, frozen-header) table or a hybrid.
4. **Elevation metaphor (carried from the general ref):** Apple = translucency/material; Material = tonal/shadow. Incompatible; pick one per project.
5. **Infinite scroll vs pagination** isn't a disagreement between sources so much as "depends on task" — NN/g is explicit there's no universal winner [nngroup__infinite-scroll-vs-pagination].

### Sources that were inaccessible (and substitutes)
- **m3.material.io** is a fully client-rendered SPA — firecrawl and WebFetch returned title-only. Substituted with **Google's official Android Developers docs** (breakpoints, touch targets) and the **SAP Fiori-for-Android** doc (which restates M3 16/24dp margins) — all primary/Google-aligned.
- **Baymard** is partly paywalled; the free benchmark articles (full of hard percentages) were fully accessible.
- **Mobbin / Awwwards** are visual pattern galleries (login/JS-gated, no extractable prose guidance) — not scraped; their value is example screenshots, not principles, which are covered by the systems above.
- **Smashing / A List Apart / UX Collective / IDF** — not individually scraped; their canonical mobile guidance (touch targets, progressive disclosure, forms, navigation) is fully covered and better-cited by the primary sources and NN/g already captured.

---

## 14. Applied to Mini Manager

Mini Manager = cross-device wargaming paint-planning app: dense paint lists, a dashboard, army→unit project hierarchy, +/− stage counters, status pills, a hue-sorted paint-coverage grid. The highest-impact, most-relevant best practices:

### Dense paint lists (the heart of the app) → §7
- **Keep it a table, not cards, on phone** where users *compare* paints (coverage, owned/needed) — cards would kill comparison [nngroup__data-tables]. Use a horizontally scrollable table with **frozen first column (paint name as human-readable ID) and frozen header**, **zebra striping**, and hover/press highlight.
- **First column = paint name**, not an SKU/ID [nngroup__data-tables].
- **Powerful, discoverable filters** (by range, faction, owned) with a clear "filters active" indicator; **global search to recall any paint from anywhere** (recognition over recall) [nngroup__data-tables; lawsofux].
- **Pagination or Load More, NOT infinite scroll** — paint lookup is task-oriented and needs re-findability [nngroup__infinite-scroll-vs-pagination]. Virtualize rows for scroll performance.
- **Edit a paint in a nonmodal side panel/sheet**, not a blocking modal, so the user can reference other paints' values [nngroup__data-tables].
- **Batch actions** (checkbox + Select All) for "mark owned," "add to shopping list."
- Tighten/loosen with the 8dp grid; **more gap between groups than within**; few borders [refactoring-ui; material].

### Dashboard → §8
- Single-screen, glanceable: surface the few metrics that answer "where am I" — paints owned vs needed, % project complete, units finished — as **big numbers and length-based bars**, never gauges/pies/3D [nngroup__dashboards-preattentive].
- Card patterns with clear size/weight/contrast hierarchy [refactoring-ui].

### Army → Unit hierarchy → §9
- **Overview → drill-down with breadcrumbs and platform Back.** Army screen shows a few key attributes per unit; tap to full unit detail (progressive disclosure) [nngroup__progressive-disclosure].
- **Keep nesting to ~2 levels** of disclosure before grouping [nngroup__progressive-disclosure].
- Persistent breadcrumb context so the user always knows which army a unit belongs to (recognition over recall) [lawsofux].
- On tablet, use **list-detail two-pane** (army list + unit detail); on phone, single pane [material3__window-size-classes].

### +/− stage counters → §10 (directly on-point)
- Steppers are the *right* control here — stage counts have a clear default and small deviations [nngroup__input-steppers].
- **Horizontal layout, buttons ≥44–48px, + and − well separated** to avoid mis-taps.
- **Grey out − at 0 and + at the max stage** [nngroup__input-steppers].
- Show the stage label clearly; **long-press to advance multiple stages**; consider a typeable field for jumping.
- **Instant (optimistic) update with a press state** — meet the <400ms Doherty Threshold; reconcile sync in the background [lawsofux; nngroup__progress-indicators].

### Status pills → §10/§12
- Encode stage/status with **icon + label + color, never color alone** (colorblind safety) [nngroup__dashboards-preattentive].
- If pills are tappable, give them a 44–48px target.

### Hue-sorted paint-coverage grid → §8/§12
- Sorting/grouping **by hue uses color for category — legitimate** [nngroup__dashboards-preattentive].
- BUT **coverage/quantity must also be encoded by length, position, or a number**, not by color, since color carries no magnitude and fails for colorblind users [nngroup__dashboards-preattentive].
- Each grid cell that's interactive needs the 44–48px target or 24px-circle spacing if dense (the grid may qualify for WCAG's "Essential" dense-data exception, but still aim large) [wcag22__target-size-minimum].

### Cross-device → §5/§6
- Design **compact-first** (phone ~320–375pt), 16dp margins; expand to 24dp + two-pane on tablet at the 600dp breakpoint [material3].
- **Tab bar (≤5)** for top-level nav on phone (Projects/Dashboard/Paints/Shopping/Settings), labeled icons; **drawer** only for overflow/secondary [nngroup__mobile-navigation-patterns]. Material adaptive: tab bar → rail → drawer across sizes.

### Forms (adding paints/units) → §6/§11
- **Labels above fields**, mark required + optional, input-optimized keyboards, adaptive error messages inline (not modal) [baymard__mobile-checkout-forms; nngroup__modal-nonmodal-dialogs].

### Feedback everywhere → §11
- Press state on every tap; spinner for 2–10s syncs; percent-done for bulk paint-database operations ("Updating 3 of 50"); **Undo toasts** for reversible deletes instead of confirmation modals [nngroup__progress-indicators; nngroup__modal-nonmodal-dialogs].

### The terminal/CRT aesthetic caveat (from the existing reference)
Mini Manager uses the vintage-terminal aesthetic — verify neon phosphor colors hit 4.5:1 (use `#33FF66`/`#00FF41`/amber `#FFB000`, not `#00FF00`), use `#0D0D0D` not pure black, and guard all flicker/animation with `prefers-reduced-motion` [existing UX-UI-BEST-PRACTICES.md §9].

---

## 15. Source Index

All cleaned source files are in `docs/research/sources/mobile/`:

| File | Source | URL |
|---|---|---|
| apple-hig__buttons.md | Apple HIG — Buttons | developer.apple.com/design/human-interface-guidelines/buttons |
| apple-hig__layout.md | Apple HIG — Layout | developer.apple.com/design/human-interface-guidelines/layout |
| apple-hig__typography.md | Apple HIG — Typography | developer.apple.com/design/human-interface-guidelines/typography |
| wcag22__target-size-minimum.md | WCAG 2.2 SC 2.5.8 | w3.org/WAI/WCAG22/Understanding/target-size-minimum.html |
| nngroup__touch-target-size.md | NN/g — Touch Targets | nngroup.com/articles/touch-target-size/ |
| google-android__touch-target-size.md | Google/Android Accessibility | support.google.com/accessibility/android/answer/7101858 |
| material3__window-size-classes.md | Material 3 breakpoints | developer.android.com/.../use-window-size-classes |
| material3__spacing-margins.md | Material 3 spacing/margins | m3.material.io/styles/spacing/overview (+ SAP Fiori corroboration) |
| lawsofux__principles.md | Laws of UX | lawsofux.com |
| nngroup__infinite-scroll-vs-pagination.md | NN/g — Infinite Scrolling | nngroup.com/articles/infinite-scrolling-tips/ |
| baymard__mobile-checkout-forms.md | Baymard — Mobile Checkout & Forms | baymard.com/blog/mobile-ecommerce-checkout-forms |
| nngroup__bottom-sheets.md | NN/g — Bottom Sheets | nngroup.com/articles/bottom-sheet/ |
| nngroup__modal-nonmodal-dialogs.md | NN/g — Modal & Nonmodal Dialogs | nngroup.com/articles/modal-nonmodal-dialog/ |
| nngroup__mobile-navigation-patterns.md | NN/g — Mobile Navigation | nngroup.com/articles/mobile-navigation-patterns/ |
| nngroup__progressive-disclosure.md | NN/g — Progressive Disclosure | nngroup.com/articles/progressive-disclosure/ |
| nngroup__data-tables.md | NN/g — Data Tables | nngroup.com/articles/data-tables/ |
| nngroup__progress-indicators.md | NN/g — Progress Indicators | nngroup.com/articles/progress-indicators/ |
| nngroup__dashboards-preattentive.md | NN/g — Dashboards | nngroup.com/articles/dashboards-preattentive/ |
| nngroup__input-steppers.md | NN/g — Input Steppers | nngroup.com/articles/input-steppers/ |
| refactoring-ui__tactics.md | Refactoring UI | refactoringui.com |

**Also referenced:** the existing pared-down reference at `C:\Users\Admin\.claude\UX-UI-BEST-PRACTICES.md` (Material 3, Apple HIG, NN/g heuristics, WCAG contrast/keyboard/motion, Refactoring UI color/shadow/spacing, IBM Carbon, Shopify Polaris, vintage-terminal aesthetic).

---

*Compiled 2026-06-03. Note: two scraped pages contained low-quality or injected content — the Laws of UX page included a prompt-injection string and m3.material.io returned no extractable body; both were handled (injection ignored as untrusted; Material numbers sourced from Google's official mirrors). All numeric claims above are traceable to the cited source files.*
