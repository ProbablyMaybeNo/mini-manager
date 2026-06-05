# UX/UI Dashboard Design

> A focused working reference for redesigning mini-manager's **Dashboard** (`/projects`) and **Focus** (`FocusPanel`) surfaces. Synthesized from dashboard-specific UX literature (ThoughtSpot, UX Pilot, UX Collective / uxdesign.cc, UXPin, Pencil & Paper, NN/g) and grounded in the app's actual code. Retrieved 2026-06-05.
>
> This is a **sibling** to `docs/research/DESKTOP_UXUI_BEST_PRACTICES.md` and `docs/research/MOBILE_UXUI_BEST_PRACTICES.md`. Where those cover general layout, tables, steppers, color, and the CRT aesthetic, **this doc is dashboard-specific**: how to compose a glanceable single-screen overview, choose and de-clutter charts, sequence widgets by importance, and design the "what am I doing right now" Focus surface. Cross-cutting numbers (target sizes, contrast, spacing grid, breakpoints) live in the sibling docs and are not repeated here.

---

## Table of Contents
1. [What this covers & why it matters for mini-manager](#1-what-this-covers--why-it-matters-for-mini-manager)
2. [Quick-reference cheat sheet](#2-quick-reference-cheat-sheet)
3. [Purpose & the 5-second rule](#3-purpose--the-5-second-rule)
4. [Information hierarchy: inverted pyramid + F/Z scan](#4-information-hierarchy-inverted-pyramid--fz-scan)
5. [Widget sizing & grid rhythm](#5-widget-sizing--grid-rhythm)
6. [Data-ink & chart-junk](#6-data-ink--chart-junk)
7. [Glanceability & preattentive attributes](#7-glanceability--preattentive-attributes)
8. [KPIs, deltas & baselines](#8-kpis-deltas--baselines)
9. [Progressive disclosure, filters & drill-down](#9-progressive-disclosure-filters--drill-down)
10. [Empty, loading & error states](#10-empty-loading--error-states)
11. [Responsive / mobile dashboards](#11-responsive--mobile-dashboards)
12. [Accessibility](#12-accessibility)
13. [Terminal-aesthetic fit](#13-terminal-aesthetic-fit)
14. [Applied to mini-manager](#14-applied-to-mini-manager)
15. [Sources](#15-sources)

---

## 1. What this covers & why it matters for mini-manager

A dashboard is a **single-page, at-a-glance** surface users read and act on quickly — the car-dashboard metaphor — NOT a place for open-ended exploration [NN/g via mobile-ref §8; uxpilot; pencilandpaper]. mini-manager has two dashboard-class surfaces that the existing best-practices docs only touch in passing:

- **Dashboard** (`src/app/projects/page.tsx`) — page header + a full-width **PROJECTS** table, then a **Streak / Activity / Calendar** widget trio (`DashboardWidgets.tsx`), then a passive `RecentlyBoughtLine`. It answers *"where do all my projects stand, and am I keeping my rhythm?"*
- **Focus** (`src/components/focus/FocusPanel.tsx`, on `/planner`) — the *"what am I painting right now"* surface: the active project's recipe rendered as a slot palette + per-slot cards, a completion progress bar, a state pill, quick-actions, and per-paint notes. It is a **task dashboard**, not a metric dashboard — its job is to keep one painting session glanceable and frictionless.

The two are different dashboard archetypes (see §3), so they need different rules. This doc distills both.

---

## 2. Quick-reference cheat sheet

| Rule | Value / guidance | Source |
|---|---|---|
| **5-second test** | A user should grasp the dashboard's purpose / find their target metric within **5 s** | uxpilot; uxdesign-b2b |
| **Primary KPIs per dashboard** | **5–7 max** before overload | thoughtspot-bp |
| **Charts per group/section** | **≤ 6** | thoughtspot-bp |
| **Pie chart slice limit** | avoid pies with **> 3–4 slices**; never 3D | uxpilot |
| **Working-memory ceiling** | humans hold **3–5** items at once → don't exceed with density | uxpilot |
| **KPI context layers** | **3** per metric: temporal comparison, target/benchmark, trend (arrow/sparkline) | uxpilot |
| **Attention drop-off** | first item in a row gets most attention; last items often unnoticed | uxpilot |
| **Layout shape** | **Inverted pyramid**: KPIs top → trends middle → granular tables bottom | uxpilot |
| **Scan model** | top-left first, sweep right, drift down-left (F/Z); most-critical → top-left | uxpilot; pencilandpaper |
| **Grid** | 12- or 16-column, **8px** base units | uxpilot (↔ desktop-ref §7) |
| **Row consistency** | charts in a row share a height for a clean grid; vary size only to emphasize | thoughtspot-bp |
| **Color role** | status = red/amber/green; categories = hue; **never color alone** | thoughtspot-bp; pencilandpaper |
| **Chart de-clutter** | drop gridlines/axis when labels give exact values; direct-label over legends; no 3D/gradients/shadows | nngroup-clutter |
| **3 Cs for charts** | **Context · Clutter (remove) · Contrast (emphasize)** | nngroup-clutter |
| **Loading** | skeleton screens mirroring final layout | uxpilot; pencilandpaper |
| **Empty state** | onboarding moment: example + next-step CTA | uxpilot; uxdesign-b2b |
| **Contrast** | 4.5:1 text / 3:1 large-UI; +text labels with color | uxpilot |
| **Curation principle** | "just because you have the data doesn't mean you should show it" | pencilandpaper |

---

## 3. Purpose & the 5-second rule

- **Every dashboard answers one question; every metric traces to a decision.** If a number doesn't inform an action, cut it [uxpilot; uxdesign-b2b]. "Just because you have the data doesn't mean it should be shown" [pencilandpaper].
- **The 5-second test:** a new user should identify the dashboard's purpose — and an experienced one should locate their target metric — **within 5 seconds**. Use it as the acceptance bar for any redesign [uxpilot; uxdesign-b2b].
- **Know which archetype you're designing** — the rules differ [pencilandpaper; uxpilot]:
  - **Operational / monitoring** — live, time-sensitive, "is anything wrong right now"; immediate delivery, minimal interaction.
  - **Analytical / reporting** — decision support, "what changed and why"; supports deeper exploration, filters, export.
  - **Functional / product-homepage** — a contextual hub that orients before deeper navigation.
- **Title + subtitle orient the user.** A clear page title states purpose; a descriptive subtitle says what the data is and what you can do [pencilandpaper]. (mini-manager's Dashboard already does this — `DASHBOARD` + the "workbench at a glance" subtitle.)
- **Avoid vanity metrics** — prioritize actionable ones (progress, what's-next) over raw counts that look impressive but drive no decision [uxpilot].

---

## 4. Information hierarchy: inverted pyramid + F/Z scan

- **Inverted pyramid** is the canonical dashboard layout: **high-level KPIs at top → trend/visual middle → granular tables at the bottom** [uxpilot; pencilandpaper "most global metrics at top, detailed breakdowns at bottom"; thoughtspot-bp "summary top, detail below"].
- **Drive the scan with the F / Z pattern** (left-to-right languages): users sweep across the top, then zig-zag down the left edge — so **the single most critical thing belongs top-left**, and the lower-right is the weakest real estate [uxpilot; pencilandpaper]. (Caveat from the desktop ref: NN/g notes the F-pattern strictly describes *unstructured text*, not chrome — so on a structured dashboard, treat top-left + size + contrast as the levers, don't assume an F will emerge on its own [↔ desktop-ref §10].)
- **Attention drops off across a row** — the first card gets the most looks, trailing items get missed. Put the lead metric first; don't bury the important one on the right [uxpilot].
- **Above-the-fold priority** — the most critical KPIs must be visible without scrolling [thoughtspot-bp; uxdesign-b2b].
- **Group related metrics** (Gestalt proximity / common-region) using spacing, a card boundary, or a background shift — not scattered, not over-bordered [uxpilot; pencilandpaper; thoughtspot-bp]. Each group should be a self-contained, clearly-titled insight section [thoughtspot-bp].
- **Use size, weight, color, and position to signal importance** — make the lead metric big and bold; everything else recedes [thoughtspot-bp; uxpilot; pencilandpaper].

---

## 5. Widget sizing & grid rhythm

- **Grid the whole thing.** 12- or 16-column grid on an 8px base; consistent alignment is what makes a dashboard read as ordered rather than noisy [uxpilot; ↔ desktop-ref §7].
- **Consistent row heights.** Visualizations sharing a row should share a height for a clean grid; use size *variation* sparingly and only to emphasize a key visual [thoughtspot-bp].
- **Standardize card anatomy.** Title top-left, legend bottom-center, deltas in a consistent spot — repeating the same card skeleton reduces cognitive load because users learn it once [pencilandpaper].
- **Section/tab budgets** (when a dashboard grows): ≤ 6 charts per group; ~4–5 groups (~25 visuals) per tab; 5–7 primary KPIs overall [thoughtspot-bp].
- **White space is structural, not decorative.** Balance breathing room against scannability; introduce visual breaks to combat data overwhelm — but don't leave a widget floating in a half-empty box [thoughtspot-bp; pencilandpaper]. (mini-manager already fought this: the `DASH-PROPORTION` pass in `DashboardWidgets.tsx` re-proportioned the trio specifically to kill a floating Streak gap — exactly this rule.)

---

## 6. Data-ink & chart-junk

The Tufte data-ink discipline, restated by NN/g's "3 Cs for better charts" (Context · Clutter · Contrast) [nngroup-clutter]:

- **Maximize data-ink.** Data-ink = elements that carry meaning and can't be removed without changing the message. **Chartjunk** = everything else — and it actively distracts [nngroup-clutter; uxpilot "functional minimalism"].
- **Kill the decoration:** no 3D, gradients, drop-shadows, textures, or ornamental graphics on charts — they distort interpretation and harm usability [nngroup-clutter; uxpilot; thoughtspot-dv]. Avoid Excel/library default styles that obscure meaning [nngroup-clutter].
- **Drop gridlines and the value axis when data labels already give exact numbers**; keep an axis only when users must judge scale without precise figures; reduce gridline frequency to cut noise [nngroup-clutter].
- **Direct-label data series instead of using a legend** — it removes the back-and-forth eye movement *and* helps colorblind users [nngroup-clutter].
- **Match chart to story:** bars = comparison, lines = trends, scatter = correlation, **single big-number card = status** [thoughtspot-bp; uxpilot]. Don't force a chart type onto data that doesn't fit [thoughtspot-bp].
- **The hover test:** a chart must be readable *at a glance without interaction* — include the labels/values needed; treat hover tooltips as enhancement, not the only way to read it [uxpilot; pencilandpaper].

---

## 7. Glanceability & preattentive attributes

- **Glanceable means readable at a glance** — present data simply enough that it's understood instantly; large unparsed data dumps create cognitive intimidation [nngroup via search; uxpilot].
- **Encode magnitude with length (bars) and 2D position (lines)** — the attributes people judge accurately. Avoid area/angle (pie, donut, gauge, radar) and 3D for quick quantitative reading [↔ mobile-ref §8 / desktop-ref §10].
- **Big bold numbers for headline metrics** — prominent typography reads as decisive and is grasped pre-attentively [pencilandpaper; uxpilot "big numbers command attention"].
- **Color is a secondary, categorical cue.** Use a single consistent palette; reserve bright/saturated color for urgent alerts; status uses red/amber/green; **always pair color with an icon, shape, pattern, or label** (~4.5% of users are colorblind) [thoughtspot-bp; pencilandpaper; uxpilot].
- **Salience by removal:** dropping decorative elements can make the real number *more* prominent than adding emphasis would [nngroup-clutter; ↔ desktop-ref §10].

---

## 8. KPIs, deltas & baselines

- **Three context layers per metric** so a number means something: a **temporal comparison** (WoW / MoM %), a **target or benchmark**, and a **trend indicator** (arrow or sparkline) [uxpilot].
- **Always provide a baseline.** A raw number with no comparison (average, target, previous period) can't be interpreted — missing baselines is a top pitfall [pencilandpaper; uxpilot].
- **Show deltas** as % or absolute change vs. a baseline/period, with positive/negative encoded by more than color [pencilandpaper].
- **Pair metrics with what to do next** — actionability: say which segment/field a number is about and the next step, don't just present the figure [uxdesign-b2b].

---

## 9. Progressive disclosure, filters & drill-down

- **Summaries first, details on demand.** Show the overview; reveal granularity via clicks, expansions, drill-downs, and hover tooltips — don't render everything at once [uxpilot; uxdesign-b2b; pencilandpaper]. (Hick's Law: hide advanced options behind a "More" toggle [uxpilot].)
- **Drill paths follow natural hierarchies** — temporal (year→quarter→month), categorical (group→item), geographic — and should keep context [uxpilot; pencilandpaper].
- **Drawer vs. details-page for drill-down:** a **drawer/side panel** shows detail without losing the overview (good when space allows); a **dedicated details page** houses comprehensive, dashboard-like detail [pencilandpaper]. (↔ the desktop ref's nonmodal side-panel rule.)
- **Filters:** present the most useful filters by default, hide secondary ones; offer **global** (whole-page) + **module-level** filters and saved presets; keep filters accessible in a fixed/sticky position while scrolling; show an active-filter indicator [pencilandpaper; uxpilot].
- **Structured flexibility over a blank canvas** — predefined filter categories and presets beat unlimited customization [uxpilot].
- **Personalization where it earns its keep:** drag-to-reorder modules, show/hide sections, and export (CSV) let users fit the dashboard to their workflow — but keep a sensible default [pencilandpaper; uxdesign-b2b].

---

## 10. Empty, loading & error states

- **Empty states are onboarding moments**, not dead ends — explain what goes here, show a populated example or illustration, and give the first-action CTA. For dashboards used infrequently, add orientation cues (tooltips) for users returning after a gap [uxpilot; uxdesign-b2b; pencilandpaper].
- **First-run real estate can host setup steps** that disappear as onboarding completes [uxdesign-b2b].
- **Loading = skeleton screens that mirror the final layout** — keeps users oriented and reads as polished; a missing loading state undermines trust [uxpilot; pencilandpaper].
- **Errors:** plain-language explanation + an actionable recovery path (retry, adjust filters, contact support) [uxpilot].
- **Confirm interactions** with contextual success/error feedback after an action [pencilandpaper].

---

## 11. Responsive / mobile dashboards

- **Ask what users actually need on the go** — don't shrink the desktop dashboard; curate a smaller, decision-relevant subset for mobile [pencilandpaper].
- **Stack, don't cram.** Reflow horizontal chart rows into a vertical stack; reduce data density significantly on small screens; flag charts that genuinely need landscape [pencilandpaper].
- **Load above-the-fold first**, then progressively load the rest [thoughtspot-bp].
- **Reduce label density** on small screens (e.g. quarterly not monthly ticks); push granular labels into hover/tooltip [pencilandpaper].
- (Breakpoints, margins, and the tab-bar→rail→drawer nav ladder are in `MOBILE_UXUI_BEST_PRACTICES.md` §5–6 and `DESKTOP_UXUI_BEST_PRACTICES.md` §7.)

---

## 12. Accessibility

- **Contrast:** 4.5:1 for text, 3:1 for large text / UI components; remain legible at 200% zoom without overlap [uxpilot].
- **Never color alone** — back every color cue with a label, icon, pattern, or texture; this covers red/green status especially [uxpilot; pencilandpaper; thoughtspot-bp].
- **Direct labeling** of chart series doubles as a colorblind aid [nngroup-clutter].
- **Keyboard + screen reader:** full Tab/Shift+Tab/Enter/Esc support; ARIA labels on every interactive element and chart; no keyboard traps [uxpilot].
- **Define jargon/acronyms** inline (tooltips) — don't assume domain knowledge [pencilandpaper].
- (Focus-ring spec, reduced-motion, and dense-data target exceptions are in the sibling docs.)

---

## 13. Terminal-aesthetic fit

The dashboard guidance and mini-manager's CRT/terminal look are highly compatible — both reward minimalism:

- **Functional minimalism IS the terminal aesthetic.** Maximizing data-ink and stripping decoration (§6) aligns naturally with a phosphor-on-black readout. Lean into big mono numbers and length-based bars; resist the urge to add gradients or glow that would count as chartjunk [nngroup-clutter; uxpilot].
- **Phosphor color is categorical, not magnitude.** Green/amber/red phosphors map perfectly to status coding — but per §7/§12, pair them with a glyph or label, and verify each hits 4.5:1 on the `#0D0D0D`-not-pure-black surface (use `#33FF66`/`#FFB000`, not `#00FF00`) [↔ existing UX-UI-BEST-PRACTICES.md §9; uxpilot]. mini-manager's widgets already do this (Streak: green=hot / amber=fragile / muted=broken, with a text unit label).
- **Guard glow/scanline/flicker animation with `prefers-reduced-motion`**, and keep skeleton loaders styled in-theme rather than a generic grey shimmer [↔ existing reference; uxpilot].

---

## 14. Applied to mini-manager

Concrete, surface-tagged recommendations. Each ties to a principle above.

### DASHBOARD — page composition (`src/app/projects/page.tsx`) → §3, §4

- **State the dashboard's one job and pass the 5-second test.** The header/subtitle already do this well; the redesign bar is: *can a returning painter find "what's furthest along / what's stalled / am I on a streak" in 5 seconds?* [§3]
- **Re-sequence to the inverted pyramid.** Today the order is `header → full PROJECTS table → widget trio (Streak/Activity/Calendar) → RecentlyBoughtLine`. The big dense table sits *above* the glanceable summary, which inverts the canonical shape. Consider a **thin KPI strip at the very top** (e.g. *active projects · % avg completion · current streak · models painted this week*) as big-number cards, THEN the table, THEN Activity/Calendar detail [uxpilot; pencilandpaper]. The Streak number specifically is a headline KPI, not a bottom-of-page widget — promote it [§4, §8].
- **Lead metric goes top-left; weakest real estate is bottom-right.** Put the most decision-relevant card (streak or "next up" project) top-left; `RecentlyBoughtLine` is correctly the lowest-priority, lowest item [§4].

### DASHBOARD — PROJECTS table → §4, §6

- The table itself is governed by `DESKTOP_UXUI_BEST_PRACTICES.md` §9 / `MOBILE` §7 (frozen header, human-readable first column, sort, filter, density). The *dashboard-specific* note: a project table IS the "granular tables at the bottom" layer of the pyramid — so it belongs **below** a summary strip, not as the first thing on the page [uxpilot inverted-pyramid].
- The per-row `paletteHexes` swatches and `progressPercent` are good preattentive cues — render progress as a **length-based bar/number**, never as color alone [§6, §7].

### DASHBOARD — Streak / Activity / Calendar trio (`DashboardWidgets.tsx`) → §5, §7, §8

- **Streak** is the strongest glanceable KPI here. Keep the big tabular-nums number; consider adding the **third context layer** — a tiny trend (this-week vs last-week sessions) or the longest-ever streak as a baseline, so the number means something beyond "today" [§8]. The green/amber/muted color discipline is correct; it already pairs color with a text unit label [§7, §12].
- **Activity** is a categorical event stream — the glyph + label + relative-time pattern is solid (color paired with a glyph satisfies "never color alone") [§7, §12]. It's a detail/log surface, so its current placement (lower than a headline KPI would be) is appropriate.
- **Grid rhythm:** the `DASH-PROPORTION` pass already enforces consistent row heights and kills the floating-Streak gap — that's §5 done right. Hold that line: don't let Activity grow taller than the Calendar it sits beside [§5].
- **Calendar** is the right "detail" anchor of the trio (wide, tall, bottom-weighted) — consistent with the pyramid [§4].

### DASHBOARD — empty & loading states → §10

- The `EmptyState` is already a proper onboarding moment (explains what a project is, offers Import + Create CTAs, hints at BattleScribe import) — textbook §10. Keep it.
- The widget cells are async server components; ensure their first paint uses **in-theme skeletons mirroring the card layout**, not a flash of empty cards or a generic spinner [§10].

### FOCUS — `FocusPanel.tsx` → §3 (task-dashboard), §4, §7, §9

- **Treat Focus as an operational/task dashboard, not an analytics one.** Its job: keep ONE session glanceable. The 5-second question is *"which slot do I pick up next, and what paint is it?"* [§3].
- **The "Next" tag + completion bar are the headline.** The first-undone-slot `Next` tag and the `% complete` progress bar are exactly the right preattentive anchors — they should be the most salient things in the panel [§7]. Make sure the active/next slot wins the visual hierarchy over the full slot list (it already gets a distinct green outline — good [§4, §7]).
- **Inverted pyramid within the panel:** header (project · recipe · state pill · completion) = the KPI layer; slot palette = the mid visual; per-slot cards = the granular detail bottom. The current top-to-bottom order matches this [§4].
- **Progressive disclosure of slot detail.** The per-paint note editor renders inline for every paint-backed slot. For long recipes that's a lot of textareas at once — consider collapsing notes to a disclosed/expand-on-demand state per slot so the panel stays glanceable, revealing the editor only for the active slot or on click [§9].
- **Recipe tabs are the right filter pattern** when 2+ recipes are attached — a structured, predefined switch rather than free-form config [§9].
- **State pill = categorical status:** keep it label-led (it already renders value+label segments, not color-only) [§7, §12].
- **Optimistic, in-theme feedback.** The note editor's idle/saving/saved/error `aria-live` status is good interaction feedback per §10 — keep that pattern for any new Focus actions [§10].

### Cross-cutting → §11, §12, §13

- **Mobile Focus + Dashboard:** stack the widget trio vertically (already the `<md` behavior) and curate — on a phone, the headline KPIs + Focus's next-slot matter most; defer the full project table and Activity log [§11].
- **Accessibility:** the progress bar already has correct `role="progressbar"` + aria values; carry that rigor to any new KPI cards (ARIA labels, 4.5:1 phosphor contrast, never color-only) [§12].
- **Aesthetic:** the redesign should ADD restraint, not chrome — big mono numbers, length bars, no decorative glow on data [§6, §13].

---

## 15. Sources

Tags used in citations above. Cross-cutting `↔` references point to the sibling best-practices docs.

| Tag | Source | URL | Status |
|---|---|---|---|
| thoughtspot-bp | ThoughtSpot — Dashboard Design Examples & Best Practices | thoughtspot.com/data-trends/dashboard-design-examples-best-practices | OK |
| uxpilot | UX Pilot — 12 Dashboard Design Principles for Better UX | uxpilot.ai/blogs/dashboard-design-principles | OK |
| uxdesign-b2b | UX Collective (uxdesign.cc) — Design Thoughtful Dashboards for B2B SaaS | uxdesign.cc/design-thoughtful-dashboards-for-b2b-saas-ff484385960d | OK (via Medium redirect) |
| thoughtspot-dv | ThoughtSpot — Data Visualization Dashboard | thoughtspot.com/data-trends/dashboard/data-visualization-dashboard | OK |
| uxpin | UXPin — Dashboard Design Principles | uxpin.com/studio/blog/dashboard-design-principles/ | OK |
| pencilandpaper | Pencil & Paper — UX Pattern Analysis: Data Dashboards | pencilandpaper.io/articles/ux-pattern-analysis-data-dashboards | OK |
| nngroup-clutter | NN/g — Clutter-Free: One of the 3 Cs for Better Charts | nngroup.com/articles/clutter-charts/ | OK (supplemental — added for data-ink/chartjunk depth) |
| — | Reddit r/PowerBI — "What are the best practices in dashboard…" | reddit.com/r/PowerBI/comments/1htzl6b/ | **FAILED to load** (Reddit blocked by fetcher; practitioner points it would have raised — top-left placement, limit visuals, white space, color discipline, KPIs at top — are all covered by the sources above) |

**Also referenced (not re-fetched):** the sibling `DESKTOP_UXUI_BEST_PRACTICES.md` and `MOBILE_UXUI_BEST_PRACTICES.md` (dashboards/preattentive, tables, steppers, breakpoints, focus ring) and the global `C:\Users\Admin\.claude\UX-UI-BEST-PRACTICES.md` (CRT/terminal aesthetic §9).

---

*Compiled 2026-06-05. All scraped web content was treated as untrusted data; no prompt-injection content was acted upon. One source (Reddit) failed to load and is marked above; every other claim is attributed to a fetched source.*
