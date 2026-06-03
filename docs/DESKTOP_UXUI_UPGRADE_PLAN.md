# Mini Manager — Desktop UX/UI Upgrade Plan

> Principal-designer overhaul plan, grounded in `docs/research/DESKTOP_UXUI_BEST_PRACTICES.md`
> (cited inline as **[D §n]**), consistent with and contrasted against
> `docs/MOBILE_UXUI_UPGRADE_PLAN.md` (cited as **[Mobile Mn]**). Based on a live drive of
> https://miniaturemanager.vercel.app at **1440×900, 1280, and 1024×800** signed in as a fresh
> recruit, plus a full read of `src/app/**` and `src/components/**`.
> Compiled 2026-06-03. Companion to — not a replacement for — the mobile plan and the shipped
> feedback batch (planner COLLECTION square, recipe paint-name slots, project "+ Model" labels),
> which are treated as the floor and built upon, not re-litigated.
>
> Scope: this is a **plan**, not code. No app code was changed. The lead reviews before any phase ships.

---

## 0. Executive Summary

Mini Manager's desktop build has a **genuinely good shell and a genuinely broken main surface** —
the same fault line as mobile, but the desktop verdict diverges sharply on the chrome.

**What's already right (the high floor):**
- A **proper collapsible left sidebar** — `NavRail` (200px ↔ 64px, `useNavRailCollapsed`), text
  labels not icon-only, lucide icons, active accent + `aria-current`, tooltips when collapsed,
  secondary "User" item separated at the bottom, version footer. This is exactly the [D §8]
  "left-side vertical nav, visible, text labels, least-important at bottom, never a hamburger"
  prescription. It stays visible at 1024 and 1440. **Best-in-class for this app.**
- The **Library** is close to the [D §9] dense-table ideal: a persistent `FilterRail` sidebar
  (SEARCH / HEX / TYPE / HUE / BRAND / INVENTORY) beside a **virtualized** 9-column paint grid
  (hand-rolled windowing over 7,144 rows at 40px desktop / 64px mobile), an always-visible search
  box, a master-detail `PaintDetailPanel` opened via `?paint=` (the [D §7] nonmodal side-panel
  pattern), and a LIST/GRID toggle.
- The **`ProjectsDashboardTable`** is a real sortable `<table>`: click-to-sort headers (asc/desc,
  default updatedAt DESC), expandable Army→Unit tree with sessionStorage-persisted expansion,
  inline-edit popovers (`InlineCellPopover`).
- **Pointer-density tokens exist:** `.tap-target` floors to **32px on desktop / 44px on mobile**
  (above the [D §2] 24px WCAG floor), and the button scale already ships compact/medium/large
  (28/36/44px) — the [D §3] "go denser, not smaller-than-usable" lever is in place.
- `StageCounter` is a **reference stepper**: optimistic updates, disabled+greyed at min/max with a
  cascade `title` tooltip, B/P/A/S/C keyboard shortcuts with inline `<kbd>` hints, Shift-to-decrement,
  inline `role="alert"` cascade errors. This already satisfies most of [D §12].

**The blunt verdict:** the chrome is **8/10**, the Library is **7/10**, the project table is **7/10**
— but `/projects`, the surface the painter lives in, is a **3/10 on desktop, and arguably worse than
on mobile**. A live measurement at **1440×900** returned **7,284 interactive nodes, 7,145 sub-24px
targets, and 7,144 `aria-haspopup="dialog"` cells** on a single page — the identical overload the
mobile plan flagged, ported verbatim to desktop. And on the wide canvas it is *more* wasteful: the
FOCUS recipe editor, the project table, and TOP WISHES are all crammed into a left-hugging
single column inside `max-w-7xl`, leaving **the entire right two-thirds of a 1440px screen as empty
black space** above the PLANNER. The desktop's defining affordance — a wide canvas for **multi-pane
master-detail** [D §7, §11] — is completely unused. Desktop also has **zero** of the three
desktop-only input layers [D §4, §5]: no command palette (search is `/`-only, never Cmd/Ctrl+K, and
it's search-not-commands), no right-click context menus anywhere in the app, no row/cell bulk select.

**This is a real overhaul, not a tweak pass.** The five highest-leverage moves all exploit the wide
canvas and the pointer+keyboard the desktop has and mobile doesn't:
1. **Re-architect `/projects` into a multi-pane master-detail workspace** (list left, focus/detail
   right) instead of a single-column scroll of five stacked apps.
2. **Make the project list a true master-detail surface** — click a project → detail opens in the
   right pane, table stays visible.
3. **Turn the Library into a full data table**: sortable headers with `aria-sort`, **density modes**,
   **bulk select + batch-action bar**, **right-click context menu**, Name-first column order.
4. **Add a real command palette (Cmd/Ctrl+K)** exposing every action with inline shortcuts — the
   single highest-leverage desktop power feature [D §5].
5. **Collapse the 7,144-button collection grid into one glanceable canvas** (shared with mobile M4)
   and demote destructive actions out of prominent slots.

Milestones below are ordered impact-first so a milestone-/ui-builder can batch-execute from the top.

---

## 1. Current-State Assessment (per desktop surface)

Each surface: **current state + honest assessment → gap vs [D §n] → concrete component recommendation.**

### 1.1 Sign-in / Sign-up / forgot / reset / finish-account

**Current.** Centred `max-w-md` card on a chrome-less unauth layout, capped logo, username +
password, inline error, cross-link. Clean and conventional; the [D §3] note that **full-width
buttons are the desktop exception used for login forms** is correctly applied here.

**Gap vs [D].** Minor and shared with mobile [Mobile 1.1]. (a) Confirm `type="email"`,
`autocomplete="username / current-password / new-password"`, visible `<label>` above field
(not placeholder-as-label) [D §13 forms]. (b) Errors must report **inline next to the field**, not
banner-only [D §13]. (c) [D §3] dialog/button order is N/A (single CTA). (d) **Focus ring** must hit
≥2px / ≥3:1 against the dark CRT card [D §3, §14].

**Recommended.** Audit `SignInForm`/`SignUpForm`/`ResetPasswordForm` for input semantics + inline
error slots + a visible focus ring on the dark surface. Low effort; otherwise done. *(No desktop
divergence from mobile here — auth is intentionally single-column on both.)*

### 1.2 Landing `/` — `src/app/page.tsx`

**Current.** Marketing page: boot-reveal hero, feature grid (`sm:grid-cols-2 lg:grid-cols-3`),
pricing teaser, final CTA, footer. CRT identity. Reflows cleanly to multi-column on desktop.

**Gap vs [D].** Small. (a) On very wide monitors confirm the content **caps its width** (~1312px
[D §7]) and centres rather than stretching to 200-char lines [D §6 line length 45–75ch]. (b) Primary
CTA should win by **style not size** — "Start free" (success) over "See the plans" (outline) is
correct [D §3 Von Restorff]. (c) Boot-reveal animation gated by `prefers-reduced-motion` [D §14].

**Recommended.** Keep. Verify max-width cap on the hero/feature band at ≥1440px and the reduced-motion
guard. Effort: trivial.

### 1.3 `/projects` — THE primary surface (`src/app/projects/page.tsx`) — the center of gravity

**Current / honest assessment.** A single `max-w-7xl` left-aligned column stacking, top to bottom:
PROJECTS header + QuickAddBar + Import/New → **FOCUS** card (FocusPicker + full FocusPanel recipe
editor + Stopwatch) → **ProjectsDashboardTable** → **TopWishesPanel** → **PlannerSection** (COLLECTION
grid, ACTIVITY, STREAK, CALENDAR, INSPO) → RecentlyBoughtLine. Measured live at 1440×900: **7,284
interactive nodes / 7,145 sub-24px targets / 7,144 dialog-trigger cells.** The right two-thirds of the
screen above the PLANNER is empty.

**Gap vs [D] (this is the big one — and it's a *desktop-specific* failure on top of the shared one):**
- **The wide canvas is wasted.** [D §7, §11] make multi-pane master-detail "the defining desktop
  layout" — a wide screen affords list + detail (+ inspector) visible at once. Mini Manager instead
  stacks five surfaces in one narrow left column. This is the inverse of the desktop mandate:
  mobile's job is "what do I hide"; desktop's is "how do I organize density across the canvas" [D §1].
- **Dashboards are single-screen, at-a-glance** [D §10]; this "dashboard" is a multi-screen vertical
  scroll, and the FOCUS recipe editor on top of it is not a glanceable widget at all.
- **7,284 nodes** is a DOM-cost + screen-reader-traversal failure [D §9 virtualization, §14].
- **No command palette / no Cmd-K** to jump anywhere from this hub [D §5].

**Recommended (target state) — a desktop master-detail workspace, not a scroll:**
Re-architect `/projects` at ≥1024 into **two/three panes** [D §7 "re-architect", §11]:
- **Left pane (master):** the project list/tree (the `ProjectsDashboardTable`, see 1.4), with the
  QuickAddBar + filter/search above it. Persistent, always visible.
- **Right pane (detail/inspector):** context-driven. Default = the **FOCUS bench** (FocusPanel +
  Stopwatch) for the focused project — a persistent right-hand inspector [D §7, §11, the Mini Manager
  "FOCUS bench panel" recommendation]. Selecting a different project in the left pane swaps the right
  pane to that project's detail without a full navigation.
- **PLANNER becomes its own route `/planner`** (a true single-screen [D §10] dashboard), reachable
  from the NavRail or a hub tile — *not* stacked under the workspace. This mirrors the mobile split
  [Mobile M4] for consistency, but where mobile uses **separate routes because it has one pane**,
  desktop keeps **FOCUS in-pane** (it has room) and only sends the PLANNER out to its own screen.
- Below the x-large breakpoint (and on tablet 1024) the panes can stack/collapse the inspector,
  reusing the mobile single-pane behaviour — same NavRail throughout.

This single move fixes node count, the wasted canvas, the disclosure/glanceability violation, AND
sets up the master-detail pattern the rest of the plan leans on. **Highest-leverage desktop change.**

### 1.4 Project list (`ProjectsDashboardTable.tsx`)

**Current.** A genuinely good sortable `<table>` (Name / Type / Recipes-palette / Status / Priority /
Completion-bar / actions). Click-to-sort headers toggling asc/desc (default updatedAt DESC), a
`MobileSortBar` fallback `<select>`, expandable Army→Unit tree (sessionStorage-persisted), inline-edit
via `InlineCellPopover`. Name is the first data column (correct [D §9 human-readable identifier]).

**Gap vs [D].**
- **Not master-detail.** Clicking a project name **navigates to a full new page** (`/projects/[id]`),
  blowing away the table. [D §7, §11] want the detail in a **right pane with the list still visible**
  so the painter can compare/jump between projects. This is the core desktop upgrade the table is
  missing.
- **No `aria-sort`** on the sortable headers (sort state is visual only) [D §9, §14].
- **No bulk select** — no checkbox column, no 3-state Select-All, no batch-action bar [D §4, §9
  "checkbox-per-row + Select-All (3 states) → batch bar"]. A painter can't multi-select projects to
  re-status/archive.
- **No right-click context menu** on rows [D §4 "right-click / context menus"].
- **No density toggle** [D §6, §9 "5 row heights, expose a density toggle"].
- **No frozen header** when the (eventually multi-pane) table scrolls [D §9].
- Inline-edit popover (`InlineCellPopover`) is absolute-positioned — verify it **flips** near the
  pane/viewport edge so it doesn't clip [D §8 popovers].

**Recommended.** Wire row-select to the right detail pane (1.3) instead of a hard navigation. Add
`aria-sort` to headers. Add a checkbox column + 3-state Select-All + a top batch-action bar
(Re-status / Set priority / Archive) [D §9]. Add a per-row **right-click context menu** (Open / Set
focus / Mark status / Attach recipe / Delete) — frequency-ordered, <12 items, every command also
reachable from a row action or main menu, with inline shortcut hints [D §4]. Add a density toggle
(Comfortable/Compact) [D §9]. Freeze the header row. **Second-highest-leverage move.**

### 1.5 FOCUS panel (`src/components/focus/FocusPanel.tsx`, `FocusPicker`, `Stopwatch`, `StepCompletionCheckbox`)

**Current.** A strong bench surface: project+recipe header, completion bar, quick actions, recipe
tabs (2+ attached), a slot-swatch palette, per-slot step cards with 48px swatches, a per-step done
checkbox (`StepCompletionCheckbox`), per-paint note textareas, a Stopwatch. Optimistic save-on-blur.

**Gap vs [D].** (a) As a *section of /projects* it violates the multi-pane mandate (1.3); as a
**persistent right-hand inspector** it's exactly the [D §7, §11] desktop pattern — promote it there.
(b) The step-done checkbox should clear the [D §2] target floor (≥24px desktop, the app's 32px
`.tap-target`). (c) [D §13] "activity logs / notes to offload working memory across interruptions" —
the per-paint notes do this; surface a per-session activity strip in the inspector too. (d) Note
textarea text should ride ≥14px [D §6].

**Recommended.** Mount FocusPanel + Stopwatch as the **default right inspector pane** in the
re-architected `/projects` (1.3). Floor the done-checkbox via `.tap-target`. Add hover-reveal for
secondary bench controls but **keep essential ones permanent** [D §4 "never hover-only for essentials"].
Keep the optimistic model — it already nails [D §13 Doherty <400ms].

### 1.6 Project detail `/projects/[id]` — Army→Unit→Model, color scheme, attach-recipe, aggregated stages

**Current.** Breadcrumb (`← Projects > Name`), a prominent **red DELETE PROJECT button top-right**,
big title + type chip + count + status, **+ MODEL** button (feedback batch landed), **ColorSchemeBox**
(swatch + `+ ADD PAINT`), an empty-state, **ROSTER** OwnedCounter, **STAGES** StageCounter (the +/-
spine, excellent), a bottom action row (`+ MODEL`, `SHOP FOR THIS`). Single left-hugging column.

**Gap vs [D].**
- **Destructive action given top-right prominence** [D §3]: "Never make a destructive action the
  default/primary — people activate prominent buttons without reading." DELETE PROJECT is the most
  visually prominent control on the page. Demote to an overflow menu / page-bottom **danger-outline**.
- **Single-column on a wide canvas.** The STAGES rows stretch full-width so the +/- steppers sit
  ~1100px from their labels — a Fitts's-law + association problem [D §11 "express hierarchy with
  alignment/indent + spacing"; D §7 "cap content width"]. The Army→Unit→Model hierarchy is not shown
  as a **tree beside the detail** [D §11 master-detail].
- **No breadcrumb depth** beyond two levels — [D §11] wants persistent Army › Unit › Model so the
  parent is always known.
- **Empty-state copy is generic** ("Add a unit, model, or piece of terrain…") even on a Unit-type
  where the only valid child is a Model — should be context-aware [D §11 mental model].
- `StageCounter` − and + sit **adjacent** at the right edge; [D §12] notes the pointer lets them be
  small but they should still be clearly separated/associated to the field.

**Recommended.** Demote DELETE to overflow/danger-outline [D §3]. Adopt a **two-pane layout**: left =
Army→Unit→Model tree with breadcrumb; right = the selected node's ColorScheme + Roster + Stages
[D §11]. Cap the stages width so the stepper stays near its row [D §7]. Make empty-state copy
context-aware. Persistent full breadcrumb [D §11]. Keep the StageCounter; add a typeable value field
+ Up/Down arrow support for big jumps [D §12].

### 1.7 `/library` — `LibraryPageClient`, `FilterRail`, `LibraryTable`, `PaintDetailPanel`

**Current (strong).** Persistent left `FilterRail` (SEARCH / HEX / TYPE-icon filters / HUE chips /
BRAND checklist / INVENTORY) + a virtualized 9-column grid (swatch / Brand / Line / Name / SKU / Type /
Hex / Own / ★) with `role="grid"`/`row`/`gridcell`, `aria-rowcount`/`colcount`, a frozen header strip
(rendered outside the scroll container), hover highlight, master-detail `PaintDetailPanel` via
`?paint=`, LIST/GRID toggle. This is the closest surface to the [D §9] ideal.

**Gap vs [D].**
- **Columns are Brand-first, not Name-first** [D §9 "first column = human-readable identifier"]. The
  paint name is what a painter recalls and compares — it should lead (after the swatch).
- **Headers are not sortable** — no click-to-sort, no 3-state sort icon, no `aria-sort` [D §9
  "sortable columns, 3 states, sort icon on hover for others"].
- **No density toggle** — Carbon ships 5 row heights; [D §6, §9] say expose one. Power users want
  Compact; touch/low-vision want Comfortable.
- **No bulk select** — no checkbox column, no 3-state Select-All, no batch bar ("Mark owned",
  "Add to shopping list") [D §4, §9].
- **No right-click context menu** on a paint row [D §4: Mark owned / Add to list / Add to recipe / Copy
  hex — frequency-ordered, shortcuts inline, also in a main menu].
- **No zebra striping** (only hover + bottom border) [D §9 "zebra + always-on hover to keep place"].
- **Inline Own/★ toggles are ~13px checkboxes** in `InventoryControls compact` — verify ≥24px hit
  region with spacing [D §2, §3 "hit region extends beyond the visual"].
- **No sortable/filter `aria-sort`/active-filter indicator** beyond the rail; surface an **active-filter
  count/indicator** and explain wargaming-specific filter terms with tooltips [D §9; Baymard].
- **Skeletons, not spinners,** on the (already-fast) load [D §9].
- LIST/GRID toggle uses a **cyan-filled** active state (reads as a primary CTA / breaks the no-cyan
  rule) [D §3 "selection by style, not a primary look"].

**Recommended.** Reorder columns to **swatch · Name · Brand · Line · Type · Hex · Own · ★** [D §9].
Make headers sortable with a 3-state icon + `aria-sort` (re-sort the virtualized array). Add a
**density toggle** (drives `ROW_HEIGHT_DESKTOP`) [D §9]. Add a checkbox column + 3-state Select-All +
batch bar [D §9]. Add a row **right-click context menu** [D §4]. Add zebra striping. Floor the
Own/★ targets. Add an active-filter indicator + term tooltips. Reskin the LIST/GRID + FILTERS active
state off cyan [D §3]. **Third-highest-leverage move** (the table is the heart of the app [D §17]).

### 1.8 `/wishlist` — `WishlistFilters`, `WishlistTable`, `QuickAddBar`, `WishlistDetailDrawer`

**Current.** Header + quick-add bar (paste URL / type), then `WishlistFilters` (STATUS chips /
CATEGORY chips / VENDOR select), then MODELS / PAINTS sections; a `WishlistDetailDrawer` for detail.

**Gap vs [D].** On desktop there's room to keep filters **visible in a left rail** like Library
(don't make the desktop user re-open a sheet) [D §8 "show on desktop: always-visible search/filters"].
Active chips are **cyan-filled** [D §3 no-cyan]. The two lists (MODELS/PAINTS) could be a single
dense table with a category column for cross-comparison [D §9]. The detail drawer is the right
[D §7] nonmodal pattern — keep it but make it a right pane on wide screens.

**Recommended.** On ≥1024, render `WishlistFilters` as a **persistent left rail** (match Library)
with an active-filter indicator; turn MODELS/PAINTS into one sortable dense table (status / category /
vendor / price columns) with bulk select → batch "Mark purchased" [D §9]. Reskin chips off cyan.
Keep the detail drawer as a right pane. Medium effort.

### 1.9 `/recipes` (list, `RecipesTable`) + `/recipes/[id]` (editor, `RecipeEditorClient`)

**Current — list.** `RecipesTable` — clean. **Current — editor (driven live):** breadcrumb
(`← Recipes > Name`) + **four prominent top-right CTAs** (SAVE TO LIBRARY green, ASSIGN TO PROJECT
green with ▾, **SHARE RECIPE cyan-filled**, DELETE red), an "ATTACHED · SPACE MARINES →" chip, a
**SLOTS / NOTES SegmentedControl with the active tab cyan-filled**, then a two-column body (RECIPE
SLOTS left with slot boxes labelled BASECOAT + an ADD COLOR custom-hex slot; RECIPE NOTES right), then
STEPS · SLOT 1 with a single-line step row (drag handle + layer select + color chip + paint select +
note + ×) and ADD STEP.

**Gap vs [D].**
- **Four same-weight prominent CTAs** [D §3 "keep prominent buttons to 1–2 per view; never make a
  destructive action prominent"]. DELETE sits in the prominent cluster; SHARE is cyan.
- **SegmentedControl active tab is cyan-filled** — reads as a primary CTA for a selection state [D §3].
  On desktop there's room to **show SLOTS and NOTES side-by-side** (the editor already does!) and drop
  the segmented control entirely on wide screens [D §8 "desktop has room to prefer inline"].
- **Slot still labelled by zone name** ("BASECOAT") rather than the pinned paint name [D §9
  human-readable identifier] — coordinate with the feedback-batch paint-name landing.
- **"ADD COLOR" custom-hex slot** persists — the paints-only rule from the feedback batch should
  remove it.
- **Step row is a single line** — fine on the wide desktop canvas (this is a place desktop legitimately
  diverges from mobile's two-line reflow [Mobile 1.9]); just ensure the paint `<select>` doesn't
  truncate at the narrow pane width and add a **brand filter** in the paint picker [D §8].

**Recommended.** Reduce to **one** prominent CTA (autosave/Save); move Assign/Share to a secondary
ghost row or overflow; **Delete → danger-outline at the bottom** [D §3]. On ≥1024 drop the
SegmentedControl and keep SLOTS + NOTES as two panes; reskin any active selection off cyan [D §3].
Land paint-name slot labels + remove the custom-hex add. Add the brand filter to the picker [D §8].

### 1.10 +/- stage counters (`StageCounter.tsx`, `OwnedCounter`, `CounterButton`)

**Current (the best-built part).** Optimistic, disabled+greyed at min/max with a cascade `title`
tooltip, B/P/A/S/C shortcuts + inline `<kbd>`, Shift-to-decrement, inline `role="alert"` errors. The
desktop `.tap-target` gives ~32px buttons — correctly denser than mobile's 44px [D §12 "pointer lets
+/− be smaller (~24–28px)"].

**Gap vs [D].** Narrow. (a) **− and + are adjacent** at the row's right edge [D §12 keep them
associated to the field / well-placed]. (b) **No typeable value field** — for a 30-model unit, +1×30
is painful; [D §12] wants "the field is a text input (type a value); Up/Down arrows increment". (c)
The shortcut `<kbd>` hints are great; ensure they also appear in any future command palette [D §5].

**Recommended.** Make the value **click-to-type** with Up/Down arrow increment [D §12]. Add a small
gap between − and +. Keep everything else — it's a reference implementation. (No spacing change needed
for touch since desktop is pointer-precise; keep the 44px floor on the mobile build [D §12].)

### 1.11 `/tools/*` — index + eyedropper / gradient / match / wheel

**Current.** Tools index = a clean card-per-tool navigation hub [D §8]. Sub-tools (eyedropper,
gradient, match, wheel) are task utilities with canvases and result rows.

**Gap vs [D].** (a) Eyedropper copy may be desktop-worded already (drop/⌘V) — on desktop that's
correct, so this is where desktop legitimately keeps the hints mobile hides [Mobile 1.11]. (b) The
wheel/gradient canvases are pointer-native — confirm **cursor signals** (crosshair for precise pick,
pointing-hand for swatches) [D §4 cursors] and **keyboard operability** of every picker [D §5, §14].
(c) Confirm one prominent CTA per tool, no cyan [D §3]. (d) `SendToRecipeModal`/`PaletteSaveDialog`
should follow [D §3] OK-first button order + verb labels.

**Recommended.** Add cursor signifiers on the canvas tools; verify keyboard pickers + focus rings;
audit modal button order/labels. Low-medium effort.

### 1.12 `/pricing`

**Current.** Tier cards (Free / Pro Monthly / Pro Lifetime "BEST VALUE" / Founder), big mono prices,
feature checklists, amber verify-email CTAs, seats-remaining line. Reads well on desktop.

**Gap vs [D].** Minimal. On a wide screen the four cards should sit in a **responsive multi-column
row** (they reflow well [D §7]); the "BEST VALUE" tier should win by salience [D §10 size/contrast].
"CURRENT PLAN" already uses label+outline (not color-alone) [D §12]. Verify max-width cap so cards
don't sprawl on 1920px [D §7].

**Recommended.** Keep; confirm multi-column layout + width cap at ≥1440. Trivial.

### 1.13 `/user`

**Current.** Single-column settings stack: PLAN summary, `RecoveryEmailCard`, `ChangePasswordCard`,
`LibraryBrandFilterCard` (~40-brand checklist), `ExportButton`, `SignOutButton`, delete account.

**Gap vs [D].** On desktop a **two-column settings layout** (nav list left / section content right, or
a 2-up card grid) uses the canvas better than one long scroll [D §7, §11 local sub-nav]. The
~40-brand checklist is a [D §8] disclosure miss — collapse behind a "Brand filter (N selected)"
disclosure or relocate to the Library FilterRail (its natural home). Delete-account = the [D §3]
danger-outline + confirm-modal case.

**Recommended.** Two-column settings on ≥1024 with a left section list; collapse/relocate the brand
filter; verify recovery-email inline errors [D §13]. Low-medium effort.

### 1.14 PLANNER — `PlannerSection` (COLLECTION grid + ACTIVITY + STREAK + CALENDAR + INSPO)

**Current.** Five widgets. The **COLLECTION grid** (`HeatSinkGridClient`) renders **every catalog
paint (~7,144) as a hue-sorted cell, each an interactive `<button aria-haspopup="dialog">`** — the
source of the page's 7,144 dialog triggers and ~7,145 sub-24px targets (measured live). Calendar,
streak, activity, inspo are reasonable cells. The feedback batch made COLLECTION a square hero.

**Gap vs [D] (severe on the grid).**
- **7,144 sub-24px interactive targets** [D §2, §14] — even with WCAG's dense-data exception, [D §17]
  says "still aim comfortable," and a 7,144-node a11y tree is a screen-reader catastrophe.
- A dashboard is **at-a-glance, NOT for exploration** [D §10]. Color encodes hue (category —
  legitimate [D §10]), but the field should be a **glanceable image**, not an interactive grid; the
  owned/wanted **count + length bar** already encode magnitude correctly [D §10].
- As a section of `/projects` it compounds 1.3; on its own `/planner` route it can be a real
  single-screen dashboard [D §10].

**Recommended (shared with mobile M4).** Render the spectrum as **one static canvas / CSS gradient
field with a sparse owned/wishlist dot overlay** — one element, not 7,144 [D §10, §9 virtualization,
§2/§14 target size]. Drill-in/gap-fill becomes a sane interaction: click the grid → a **nonmodal side
panel** (desktop) / sheet with the filtered, searchable paint list (reuse the Library table) to mark
owned/wanted [D §7]. Keep brand-filter chips + count + bar. Move the whole PLANNER to its own
`/planner` route as a single-screen [D §10] dashboard; let users **hover a chart/streak point →
tooltip with precise values** [D §10]. **Desktop divergence:** mobile uses a bottom sheet for gap-fill;
desktop uses a **persistent right side panel** so the field stays visible while filling [D §7].

### 1.15 Global chrome — `NavRail`, `MobileHeader`, `GlobalSearch`, `StatusBar`

**Current.** `NavRail` (excellent, see §0). `MobileHeader` is mobile-only (`hidden md:flex` is on the
NavRail; the header is the small-screen counterpart). `GlobalSearch` is a `/`-triggered overlay
searching **paints + wishlist only** — no Cmd/Ctrl+K, no command actions, no inline shortcuts, no
visible trigger in the NavRail. `StatusBar` (SYS/NET/TIME) runs across the top.

**Gap vs [D].**
- **No command palette** [D §5 "the strongest desktop accelerator surface… combines search +
  recognition-over-recall + inline shortcuts; the single highest-leverage desktop power feature"].
  The existing GlobalSearch is search-only and bound to `/` — it should be **upgraded to Cmd/Ctrl+K**
  (the universal binding [D §5 "never override universal shortcuts"]) and extended with **navigation +
  action commands** (Go to Library, New project, Set focus, Mark owned, Toggle density…) each showing
  its **inline shortcut** [D §5].
- **No visible search/command trigger** in the NavRail — discoverability of `/`-only is poor [D §5
  "available yet ignorable; reveal via a visible affordance"].
- **No global keyboard map** beyond `/` and the StageCounter's B/P/A/S/C — universal Ctrl+F (find),
  Ctrl+Z (undo stage changes), Ctrl+K should be wired [D §5].

**Recommended.** Add **Cmd/Ctrl+K** (keep `/` as an alias) to open the palette; extend it from a
paint/wishlist search into a **command palette** with a Commands section (navigation + frequent
actions) showing inline `<kbd>` shortcuts [D §5]. Add a **visible search/command button** at the top of
the NavRail [D §5]. Wire universal shortcuts (Ctrl+Z undo, Ctrl+F focus the active list's search)
[D §5]. **Fourth-highest-leverage move.**

---

## 2. Cross-Cutting Findings (systemic desktop themes)

| Theme | Evidence (live + code) | [D] cite |
|---|---|---|
| Wide canvas wasted — no master-detail | `/projects` & `/projects/[id]` single `max-w-7xl` column; right ⅔ empty at 1440 | §1, §7, §11 |
| Project detail is a hard navigation, not a pane | row name → `/projects/[id]` full page | §7, §11 |
| No command palette / Cmd-K | `GlobalSearch` is `/`-only, search-not-commands | §5 |
| No right-click context menus anywhere | zero `onContextMenu` in `src/**` | §4 |
| No bulk select / Select-All / batch bar | absent in Library + Projects + Wishlist tables | §4, §9 |
| Library not fully a data table | Brand-first columns, no sort/`aria-sort`, no density toggle, no zebra | §9 |
| 7,144 micro-target dialog cells on /projects | measured 7,144 `aria-haspopup="dialog"` @1440 | §2, §10, §14 |
| Destructive actions given prominence | project DELETE top-right; recipe DELETE in CTA cluster | §3 |
| Cyan on selection/CTA | recipe SegmentedControl active, SHARE, Library LIST/GRID, chips | §3 + project rule |
| `aria-sort` missing on sortable tables | Projects table sorts but no `aria-sort` | §9, §14 |
| No density control | nowhere (token system supports it) | §6, §9 |
| Focus ring on dark CRT unverified | many custom controls; CRT surface | §3, §14 |

**Strengths to preserve (do not regress):** the collapsible `NavRail`, the virtualized Library +
FilterRail + master-detail `PaintDetailPanel`, the sortable expandable `ProjectsDashboardTable`, the
`StageCounter`/`CounterButton`, the `.tap-target` 32/44 system, `prefers-reduced-motion` gating, the
contrast-reasoned token system, the tools navigation hub.

---

## 3. Prioritized, Milestone-Structured Plan

Ordered **impact-first**. Each milestone is independently batch-executable. Effort: S (<½ day),
M (½–2 days), L (2–5 days). Impact 1–5 (5 = transformative). Acceptance-gated; every milestone must
finish `tsc`-clean with `npm test` green per the project's strict-TS standard.

**Consistency note with mobile.** The mobile plan split `/projects` into `/projects`/`/focus`/`/planner`
routes *because mobile has one pane*. Desktop **keeps FOCUS in a pane** (it has the width) and only
sends PLANNER to its own route — same `/planner` route, same NavRail, divergent layout. Build the
shared route (`/planner`) once; render it single-pane on mobile and as a single-screen dashboard on
desktop. M-numbers below intentionally map onto the mobile M-numbers where the work is shared.

---

### D1 — Desktop shell & layout foundations · Effort M · Impact 4

The substrate every later pane relies on. No IA semantics change — layout + tokens + a11y hygiene.

**Steps**
1. **Width caps + breakpoints.** Adopt the [D §7] desktop breakpoints (x-large 1024–1365 / xx-large
   1366–1919 / xxx-large ≥1920) and **cap content** (~1312px [D §7]) with margins absorbing the excess
   so nothing sprawls into 200-char lines [D §6]. Replace ad-hoc `max-w-7xl` on `/projects` with a
   workspace grid (see D2).
2. **Density control.** Add a global **Comfortable/Compact** density toggle (in `/user` and the
   command palette) driving table row heights + card padding [D §6, §9]; default Comfortable.
3. **Focus-ring pass.** Ensure every interactive control has a **≥2px / ≥3:1** focus ring against the
   dark CRT surface, not obscured by sticky chrome (`scroll-padding`) [D §3, §14].
4. **`aria-sort` + table semantics.** Add `aria-sort` to the Projects table headers and prep the
   Library grid for sortable headers (D3) [D §9, §14].

**Acceptance.** Content capped + centred at 1920; density toggle flips row heights + padding app-wide;
visible focus ring on every control at 3:1 on the CRT surface; `aria-sort` present on sortable headers;
`tsc`/tests green.

**Rationale:** [D §6, §7, §9, §14]. Cheap, broad, unblocks the panes and tables.

---

### D2 — `/projects` master-detail workspace · Effort L · Impact 5

The headline desktop overhaul: stop stacking five apps in one column.

**Steps**
1. **Two/three-pane workspace** at ≥1024 [D §7 "re-architect", §11]: left = project list/tree
   (`ProjectsDashboardTable`) + QuickAddBar + search/filter; right = **inspector pane** defaulting to
   the **FOCUS bench** (FocusPanel + Stopwatch). Optional third inspector column on xxx-large.
2. **Move PLANNER to its own `/planner` route** (built in D6) — remove `PlannerSection` from
   `/projects`. Add it to the NavRail.
3. **Selecting a project** in the left pane updates the right pane (focus/detail) **without a full
   navigation** [D §7, §11]; "Set focus" pins it as the default inspector.
4. **Collapse below x-large:** at 1024 allow the inspector to dock/collapse; reuse mobile single-pane
   stacking below `md`. Same NavRail throughout.
5. **Re-measure:** total interactive nodes on `/projects` must drop >90% (the 7,144 grid leaves with
   PLANNER; target <300).

**Acceptance.** `/projects` at 1440 shows project list (left) + FOCUS inspector (right), no PLANNER,
no recipe editor stacked below; selecting a project swaps the inspector without navigation; `/planner`
exists in the NavRail; node count <300 (re-measured); `tsc`/tests green.

**Rationale:** [D §1, §7, §10, §11]. Exploits the wide canvas; fixes glanceability, node count, and
wasted space together.

---

### D3 — Library full data table · Effort L · Impact 5

Make the heart of the app a complete [D §9] data table.

**Steps**
1. **Reorder columns** to swatch · **Name** · Brand · Line · Type · Hex · Own · ★ [D §9 identifier-first].
2. **Sortable headers** with a 3-state icon (unsorted/asc/desc) + `aria-sort`; sort the virtualized
   array; sort icon on hover for inactive columns [D §9].
3. **Density toggle** wired to `ROW_HEIGHT_DESKTOP` (Comfortable 40 / Compact 32) [D §6, §9].
4. **Bulk select:** checkbox column + **3-state Select-All** header + a top **batch-action bar**
   (Mark owned / Add to shopping list / Add to recipe) that appears when rows are selected [D §4, §9].
5. **Right-click context menu** on a paint row (Mark owned / Add to list / Add to recipe / Copy hex) —
   frequency-ordered, <12 items, also reachable via row actions/main menu, inline shortcuts [D §4].
6. **Zebra striping** + keep always-on hover [D §9]; floor Own/★ hit regions to ≥24px [D §2].
7. **Active-filter indicator** + tooltips on wargaming-specific filter terms [D §9; Baymard]. Keep
   the master-detail `PaintDetailPanel`. **Skeletons, not spinners**, on load [D §9].

**Acceptance.** Name leads; every column sorts with `aria-sort`; density toggle changes row height;
checkbox + 3-state Select-All drive a batch bar; right-click opens a context menu also reachable by
keyboard; zebra + hover present; `tsc`/tests green.

**Rationale:** [D §4, §9, §17]. The desktop's signature strength, finally fully exploited.

---

### D4 — Command palette & keyboard layer · Effort M · Impact 5

Add the desktop power layer mobile can't have.

**Steps**
1. **Cmd/Ctrl+K** opens the existing `GlobalSearch` overlay (keep `/` as alias) — the universal
   binding [D §5].
2. **Extend search → command palette:** add a **Commands** section (Go to Projects/Library/Recipes/
   Tools/Wishlist/Planner, New project, Set focus, Mark paint owned, Toggle density, Open settings)
   alongside the paint/wishlist hits, each showing its **inline `<kbd>` shortcut** [D §5].
3. **Visible trigger** at the top of the NavRail (search/command button) for discoverability [D §5].
4. **Universal shortcuts:** Ctrl+Z (undo last stage change — pairs with D5 undo), Ctrl+F (focus the
   active list's search). Show shortcuts inline in any context menus from D3 [D §5].

**Acceptance.** Cmd/Ctrl+K opens the palette on every authed page; a Commands section navigates +
runs actions with visible shortcuts; NavRail trigger present; Ctrl+Z undoes a stage change; `tsc`/
tests green.

**Rationale:** [D §5]. "The single highest-leverage desktop power feature" [D §17].

---

### D5 — Project flows, recipe action discipline, hierarchy · Effort L · Impact 4

Demote destructive actions, exploit width, fix hierarchy. **Builds on the shipped feedback batch.**

**Steps**
1. **Project detail two-pane** at ≥1024: left = Army→Unit→Model tree + persistent breadcrumb; right =
   selected node's ColorScheme + Roster + Stages [D §11]. Cap stages width so the stepper stays near
   its row [D §7].
2. **Demote DELETE PROJECT** to an overflow/page-bottom **danger-outline**; confirm with a modal
   (OK-first, verb label "Delete project") [D §3].
3. **Recipe editor action discipline:** one prominent CTA (autosave/Save); Assign/Share → secondary
   ghost row or overflow; **Delete → danger-outline at bottom** [D §3]. On ≥1024 drop the SLOTS/NOTES
   SegmentedControl and keep both as panes [D §8]; reskin active selection + SHARE off cyan [D §3].
4. **Context-aware empty-state/add-child copy** (Unit → "+ Model") [D §11].
5. **StageCounter:** add click-to-type value + Up/Down arrows; small gap between − and + [D §12].

**Acceptance.** Project detail shows tree + detail side-by-side at 1440; no destructive action in a
prominent slot anywhere; ≤1 prominent CTA per recipe view; no cyan on selection/CTA; empty-state copy
is context-aware; stepper accepts typed values + arrow keys; `tsc`/tests green.

**Rationale:** [D §3, §7, §8, §11, §12].

---

### D6 — `/planner` single-screen dashboard + glanceable collection grid · Effort L · Impact 5

Shared with mobile M4; desktop renders it as a single-screen [D §10] dashboard.

**Steps**
1. **`/planner` route** rendering the five widgets as a single-screen dashboard on a 12-col grid
   [D §10]: big numbers + length bars, salience by top-left placement + size/contrast (no F-pattern
   assumption), strip decorative icons so numbers pop [D §10].
2. **Collection grid → one glanceable canvas** (static gradient field + sparse owned/wishlist dots) —
   one element, not 7,144 [D §10, §9, §2/§14].
3. **Gap-fill = persistent right side panel** (desktop divergence from mobile's sheet [D §7]) with the
   filtered/searchable paint list (reuse the D3 Library table) to mark owned/wanted; keep brand chips +
   count + bar [D §10].
4. **Hover-to-reveal precise values** on streak/activity/calendar points via tooltip [D §10].
5. Calendar cells get a ≥24px (pointer) hit region [D §2].

**Acceptance.** `/planner` fits one screen at 1440 (no multi-screen scroll); collection grid is ≤a
handful of elements (re-measure: not thousands); gap-fill opens a right side panel; hover tooltips show
precise values; `tsc`/tests green.

**Rationale:** [D §2, §7, §9, §10, §14].

---

### D7 — Wishlist & user as desktop layouts · Effort M · Impact 3

**Steps**
1. **Wishlist:** persistent left filter rail (match Library) with active-filter indicator; MODELS/
   PAINTS → one sortable dense table (status/category/vendor/price) with bulk select → "Mark
   purchased" [D §9]; detail drawer → right pane; reskin chips off cyan [D §3].
2. **User:** two-column settings on ≥1024 (left section list / right content); collapse/relocate the
   brand filter; verify inline recovery-email errors [D §13]; delete-account = danger-outline + modal
   [D §3].
3. **Pricing:** confirm multi-column tier row + width cap at ≥1440 [D §7, §10].

**Acceptance.** Wishlist filters persistent + table sortable + bulk "Mark purchased"; user settings
two-column with collapsed brand filter; pricing multi-column capped; no cyan on selection; `tsc`/tests
green.

**Rationale:** [D §3, §7, §9, §13].

---

### D8 — Pointer affordances, feedback & accessibility polish · Effort M · Impact 3

The desktop affordance layer + WCAG 2.2.

**Steps**
1. **Tooltips** on every unlabeled icon (StatusBar glyphs, type-icon filters, NavRail when collapsed —
   already done), **0.5s reveal**, mouse **and** keyboard hover, positioned not to block content [D §4].
2. **Cursor signifiers** on the wheel/gradient/eyedropper canvases (crosshair / pointing-hand / open-
   closed-hand for any drag) [D §4]; keyboard operability + focus on all pickers [D §5].
3. **Right-click parity** wherever D3/D5 add context menus — identical content from right/Ctrl/2-finger
   click, every command also in a menu, disable (grey) irrelevant items rather than hide [D §4].
4. **Undo over confirmation** (snackbar + Undo) for reversible deletes/stage changes; blocking modal
   only for irreversible project/army deletion [D §13]; **skeletons** on table loads [D §9].
5. **Never-color-alone** audit on status pills / collection dots / completion bars (icon/shape/label)
   [D §10, §12]; **dialog button order** OK-first + verb labels across all modals [D §3].
6. **Reduced-motion** guard on hover transitions + any drag reshuffle + CRT effects [D §14].

**Acceptance.** Axe/Lighthouse a11y pass on `/projects`, `/projects/[id]`, `/planner`, `/library`,
`/recipes/[id]`; no target-size or color-only failures; tooltips/context menus keyboard-reachable;
reduced-motion respected; `tsc`/tests green.

**Rationale:** [D §3, §4, §9, §10, §12, §13, §14].

---

**Build order:** D1 (foundations, start now) → D2 + D3 + D4 (the three big canvas/table/keyboard
moves; D3 and D4 are independent of D2 and can run in parallel) → D5 + D6 → D7 → D8. Impact-first;
every milestone acceptance-gated and `tsc`/test-clean.

---

## 4. Desktop vs Mobile: What Diverges and Why

Explicit contrast with `MOBILE_UXUI_UPGRADE_PLAN.md`. The two plans share the *diagnosis* of
`/projects` (overloaded; 7,144-button grid) but prescribe **opposite layout treatments** because the
governing constraints invert [D §15].

| Dimension | Mobile plan ([Mobile Mn]) | Desktop plan (this doc) | Why it diverges |
|---|---|---|---|
| **`/projects` split** | Three **routes** `/projects`/`/focus`/`/planner` — one pane, so each surface owns a screen | **Master-detail workspace**: list + FOCUS inspector in **one view**; only PLANNER leaves to `/planner` | Desktop has width for two panes [D §7, §11]; mobile has one |
| **Project list** | Frozen-first-column **horizontally-scrollable** table (reflow concession) | **Full multi-column table → master-detail**: click a row, detail opens in the right pane, list stays visible | Width supports all columns + a second pane; comparison is the desktop strength [D §9, §11] |
| **Editing a record** | Nonmodal **bottom sheet** | **Nonmodal side panel / right pane** keeps the table visible | Desktop keeps context beside, not below [D §7] |
| **Collection gap-fill** | Tap grid → **bottom sheet** | Click grid → **persistent right side panel** | Desktop keeps the field visible while filling [D §7] |
| **Search** | Add a **tap trigger** (search was keyboard-only, unreachable) | Upgrade to a **command palette (Cmd/Ctrl+K)** with action commands + inline shortcuts | Keyboard is first-class on desktop, marginal on mobile [D §5] |
| **Context menus** | None (no right-click) | **Right-click menus** on Library + project rows | Pointer has a secondary button [D §4] |
| **Bulk actions** | Deferred / minimal | **Checkbox + 3-state Select-All + batch bar** on every table | Width + pointer make multi-select natural [D §4, §9] |
| **Density** | 44px floor everywhere; tighten padding | **32px floor + a Comfortable/Compact density toggle**; denser tables | Pointer is precise → can go denser [D §2, §6] |
| **Step/recipe rows** | Reflow to **two-line cards** so nothing truncates | **Single-line rows kept** (the canvas fits them) | Width removes the truncation pressure [D §8] |
| **Eyedropper/tool copy** | Rewrite **touch-first** ("tap to choose a photo") | **Keep desktop hints** (drop/⌘V) + add cursor signifiers | Platform fit inverts [D §4] |
| **Disclosure question** | "What do I **hide**?" (progressive disclosure) | "How do I make density **scannable** across panes?" | The hard problem flips [D §1, §15] |

**Top 3 desktop-vs-mobile divergences (highest-impact):**
1. **`/projects` becomes multi-pane master-detail on desktop, not three separate routes.** Mobile
   splits the mega-page into routes because it has one pane; desktop keeps the project list and the
   FOCUS bench **visible together** and only exports the PLANNER. (D2 vs Mobile M4.) [D §7, §11, §15]
2. **The project + paint lists stay full multi-column data tables with a side-by-side detail pane,**
   where mobile reflows to a frozen-column horizontal-scroll table and a bottom sheet. Desktop keeps
   comparison + context simultaneously. (D3/D5 vs Mobile M3.) [D §9, §11]
3. **Desktop adds an entire pointer+keyboard affordance layer mobile cannot have** — a Cmd/Ctrl+K
   command palette with inline shortcuts, right-click context menus, bulk select, and denser tables
   with a density toggle. On mobile these are absent or marginal. (D3/D4 vs Mobile M2.) [D §4, §5, §15]

---

## 5. The 5 Highest-Leverage Desktop Moves

1. **`/projects` master-detail workspace** (D2): list left + FOCUS inspector right, PLANNER to its own
   route — exploits the wide canvas, kills the single-column waste, and drops the page from 7,284
   interactive nodes to <300. [D §1, §7, §10, §11]
2. **Project list → master-detail** (D2/D5): selecting a project opens detail in the right pane with
   the table still visible, instead of a hard navigation that blows the list away. [D §7, §11]
3. **Library full data table** (D3): sortable headers + `aria-sort`, **density modes**, **bulk select +
   batch-action bar**, **right-click context menu**, Name-first column order, zebra striping — the
   desktop's signature strength, finally fully exploited on the heart of the app. [D §4, §9, §17]
4. **Command palette (Cmd/Ctrl+K)** (D4): upgrade the `/`-only paint search into a real command palette
   with navigation + action commands and inline shortcuts — the single highest-leverage desktop power
   feature. [D §5]
5. **Glanceable collection grid + destructive-action discipline** (D6/D5): collapse the 7,144-button
   grid into one canvas with a side-panel gap-fill, and demote DELETE PROJECT / recipe DELETE out of
   prominent slots into danger-outline + Undo. [D §2, §3, §10, §14]

---

## 6. Applied to Mini Manager (wargaming paint app specifics)

- **The painter's desk is the right pane.** FOCUS bench (recipe slots + per-step swatches + notes +
  stopwatch) lives as the **persistent inspector** beside the project list, so a painter picks a
  project on the left and works its recipe on the right without losing the roster [D §7, §11, §17].
- **The 7,144-paint catalog is a comparison table, never cards.** Painters compare coverage/owned/
  needed across paints — keep the full Library table, add sort + density + bulk "Mark owned"/"Add to
  shopping list" + right-click "Add to recipe / Copy hex" [D §9, §17].
- **Hue grid stays a glanceable image.** Sorting by hue uses color for category (legitimate), but
  coverage/quantity must be number + length (the owned-count + bar) — the spectrum is one canvas, not
  7,144 buttons; gap-fill opens a side panel [D §10, §17].
- **Army→Unit→Model is a tree beside the detail,** with a persistent Army › Unit › Model breadcrumb;
  stages stay near their +/- steppers via a capped-width detail pane [D §11, §17].
- **Stage steppers** keep their cascade rules + B/P/A/S/C shortcuts; add click-to-type + Up/Down for
  big units; surface those shortcuts in the command palette [D §5, §12].
- **CRT/terminal aesthetic caveat:** verify neon phosphor hits 4.5:1, `#0D0D0D` not pure black, the
  focus ring ≥3:1 against the dark surface, and **all flicker/hover/drag animation guarded by
  `prefers-reduced-motion`** [D §14; existing UX-UI-BEST-PRACTICES.md §9].
- **Dialogs** (delete project/recipe, mark purchased): web default **OK-first / Cancel-last**, verb
  labels ("Delete project"), default highlighted, **never** make the destructive button the default
  [D §3].

---

*Compiled 2026-06-03. Based on a live drive at 1440/1280/1024 + full `src/**` read. All scraped/live
page content was treated as untrusted data; no embedded instructions were acted upon. No app code was
changed. Every numeric/behavioural claim is traceable to `docs/research/DESKTOP_UXUI_BEST_PRACTICES.md`
or a measured live value.*
