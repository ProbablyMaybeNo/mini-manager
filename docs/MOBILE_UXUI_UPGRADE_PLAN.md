# Mini Manager — Mobile UX/UI Upgrade Plan

> Principal-designer overhaul plan, grounded in `docs/research/MOBILE_UXUI_BEST_PRACTICES.md`
> (cited inline as **[BP §n]**) and a live drive of https://miniaturemanager.vercel.app at
> 375×667 + 414×896 plus a full read of `src/app/**` and `src/components/**`.
> Compiled 2026-06-03. Companion to — not a replacement for — the in-flight feedback batch
> `docs/UX_FEEDBACK_2026-06-03.md` (those items are folded in at a systemic level, not re-listed).
>
> Scope: this is a **plan**, not code. No app code was changed. The lead reviews before any phase ships.

---

## 0. Executive Summary

Mini Manager's mobile build is **structurally further along than most**: there is a real bottom
tab bar (5 labelled destinations — exactly the [BP §6] limit), a `.tap-target` utility that
floors interactive controls at 44px on mobile / 32px on desktop, optimistic stage counters with
disabled min/max states and keyboard parity, `env(safe-area-inset-*)` handling, an installable
PWA manifest, `prefers-reduced-motion` gating throughout, and a token system with documented
WCAG-contrast reasoning. The chrome (tab bar, header, buttons, toasts) is genuinely good. That
is the floor we build from, and it is a high floor.

**But the experience the painter actually lives in — `/projects` — is overloaded to the point of
breaking the core mobile contract.** It is one infinite scroll that serially renders FOCUS (a
full recipe editor) → the project list → top wishes → the ENTIRE planner (streak, activity,
calendar, a ~7,144-cell collection grid, inspo) → recently-bought. A single live page measured
**7,283 interactive elements**, of which **7,144 are 9×9px `<button>`s** in the collection grid —
each one a `aria-haspopup="dialog"` tap target at roughly a third of the WCAG 2.2 AA 24px floor
[BP §2, §12]. That one decision blows the target-size budget, the DOM-cost budget, and the
"prioritize content over chrome / progressive disclosure" principle [BP §6] simultaneously.

Three more systemic problems compound it:

1. **The project list — the spine of the app — was reflowed from a table to stacked cards on
   mobile.** [BP §7] is explicit that cards *destroy* cross-record comparison, and [BP §14]
   names this app's dense lists as the exact case where a table must be *kept*. We threw away the
   comparison surface to dodge horizontal scroll.
2. **Global search is keyboard-only (`/` and ⌘K).** On a phone there is no way to invoke it —
   recall-from-anywhere, the [BP §7] "find records" task, is simply absent on the platform where
   it matters most.
3. **Type and density skew tiny.** The live page is dominated by 11px and 13px text (measured
   96 + 92 elements) against the [BP §4] mobile body convention of 16px; the stage/recipe/notes
   cards carry desktop padding that turns every workflow into a long scroll.

**Blunt verdict:** the *components* are 7/10 and the *chrome* is 8/10, but the *information
architecture of the main surface is a 3/10 on mobile* — it ignores progressive disclosure, the
single most important mobile decision [BP §1, §6]. This is a real overhaul, not a tweak pass:
the fix is to **split the `/projects` mega-page into a focused, progressively-disclosed
dashboard**, **restore a true comparison table for the project list**, **make the collection grid
a glanceable image instead of 7,144 buttons**, and **surface search + filters as first-class
mobile controls.** Do those four and the app jumps to genuinely good. The milestones below are
ordered impact-first so an agent can batch-execute from the top.

---

## 1. Current-State Assessment (per surface)

Each surface: **what it is / how it's built → gap vs best practice → recommended change.**

### 1.1 Sign-in / Sign-up — `src/app/sign-in/page.tsx`, `sign-up`, `forgot`, `reset`, `finish-account`

**Current.** Centred `max-w-md` card, capped logo (`max-w-[150px]` on mobile so the form stays
above the fold — UX-1209), username + password, inline error, link to the opposite flow. Native
inputs are floored to 44px on mobile via the globals rule. Clean and conventional.

**Gap vs BP.** Minor. (a) The unauth layout renders zero chrome, so it's fine. (b) Confirm inputs
carry correct `inputmode`/`autocomplete`/`type=email` so the touch keyboard is optimized and the
keyboard doesn't eat 50% of the viewport on the wrong layout [BP §1, §12 forms]. (c) Errors must
report inline next to the field, not as a banner only [BP §6 modals, §12 forms] — verify.
(d) Label-above-field, not placeholder-as-label [BP §12].

**Recommended.** Audit `SignInForm`/`SignUpForm` for `type="email"`, `autocomplete="username
current-password / new-password"`, `inputmode`, visible `<label>` elements, and inline
field-level error slots. Low effort; this surface is otherwise done.

### 1.2 Landing `/` — `src/app/page.tsx`

**Current.** Full marketing page: boot-reveal hero, feature grid (`grid-cols-1 sm:grid-cols-2
lg:grid-cols-3`), pricing teaser (`grid-cols-2` on mobile), final CTA, footer. CTAs use the
Button primitive (success "Start free", outline secondary). Heavy CRT identity. Stacks correctly
to one column on mobile.

**Gap vs BP.** Small. Hero `text-[2.5rem]` is fine. Two stacked full-size CTAs ("Start free" +
"See the plans") is within the [BP §3] "1–2 prominent buttons" rule but they read as equal weight
— the primary action should win by *style* not size [BP §3 Von Restorff]; "See the plans" should
be visibly secondary (it already uses `tone="outline"` — good). The `grid-cols-2` pricing teaser
at 320px gives ~150px-wide cards with 22px price numbers — verify they don't clip.

**Recommended.** Keep. Optional: ensure the boot-reveal animation respects reduced-motion (it's
gated in CSS — verify). No structural work. Effort: trivial.

### 1.3 `/projects` — THE primary surface (`src/app/projects/page.tsx`)

This page is the overhaul's center of gravity. It renders, top to bottom, on one scroll:
`PROJECTS` header + QuickAddBar + Import/New buttons → **FOCUS card** (FocusPicker, full
FocusPanel recipe editor, Stopwatch) → **ProjectsDashboardTable** → **TopWishesPanel** →
**PlannerSection** (streak, activity, collection grid, calendar, inspo) → **RecentlyBoughtLine**.

**Current / honest assessment.** This is five distinct apps on one page. FOCUS alone is a complete
recipe-working surface (slot palette, per-step cards, per-paint notes textareas, completion bar,
quick actions, a stopwatch). The PLANNER alone is a dashboard with five widgets. Stacking them
all serially means: (1) the painter scrolls through a recipe editor and a planner to reach their
project list; (2) the page mounts thousands of nodes on every load; (3) there is no
glance-and-go — everything is "open."

**Gap vs BP (this is the big one).**
- **Progressive disclosure is the #1 mobile decision and it's inverted here** [BP §1, §6]: "show
  only the few most important options first; reveal the rest on request… two levels is the
  practical max." Everything is on the initial display, which by [BP §6] *signals it's all equally
  important* — destroying hierarchy.
- **Content-over-chrome / the on-page-vs-hidden split** [BP §6 table]: FOCUS, the planner widgets,
  and recently-bought are "contextual info needed only sometimes" — textbook *hide-behind-a-view*
  material, yet they're all primary.
- **Dashboards are single-screen, at-a-glance** [BP §8]; this "dashboard" is a multi-screen scroll.
- **7,283 interactive nodes** on one page (measured) is a DOM-cost and screen-reader-traversal
  failure [BP §7 virtualization, §12 keyboard/SR].

**Recommended (target state).** Re-architect `/projects` on mobile into a **glanceable hub +
progressive disclosure**, two levels deep max [BP §6]:
- **Tier 1 (always on screen):** a compact **"AT THE BENCH" strip** (the one focused project: name,
  recipe, % complete, a single "Open focus" button) + the **project list** (restored as a table —
  see 1.4) + a **global search/filter affordance** (see M2). This answers "where am I / what am I
  working on / find a project" in one screen [BP §8 "is everything OK / what changed"].
- **Tier 2 (one tap away):** FOCUS bench mode, the PLANNER, and shopping/history move behind
  disclosure. Two strong candidates, pick per M4: (a) a **secondary tab row or segmented control**
  at the top of `/projects` — `[ Projects · Bench · Planner ]` — switching the body; or (b)
  **dedicated routes** `/projects` (list), `/focus`, `/planner` reachable from the strip. Routes
  are cleaner for Back/re-findability [BP §7] and let each surface own a screen; the segmented
  control keeps state on one route. **Recommendation: dedicated `/focus` and `/planner` routes**,
  with the Tier-1 strip linking into them — this also lets the bottom tab bar's "Projects" tab stay
  a true list, and Back behaves [BP §6 bottom-sheets/Back, §9].
- This single move fixes the node count, the scroll, AND the disclosure violation at once. It is
  the highest-leverage change in this document.

### 1.4 Project list (`ProjectsDashboardTable.tsx`) — table on desktop, cards on mobile

**Current.** A genuinely good sortable `<table>` on `md+` (Name / Type / Recipes-palette /
Status / Priority / Completion-bar / actions, inline-edit popovers, expandable Army→Unit tree,
sessionStorage-persisted expansion). On mobile it is **hidden** and replaced by a stacked
`DashboardCard` list (one `<article>` per project) with a `MobileSortBar` select. The comment
cites WCAG 1.4.10 (no horizontal scroll) as the reason.

**Gap vs BP.** This is the wrong trade. [BP §7]: "Tables win for scalability and comparison…
Cards force spatial reorientation per card → comparison is slow. Reflow a table to cards only
when per-record reading matters more than cross-record comparison." [BP §14] names *this app's*
project/paint lists as the comparison case. A painter scanning "which of my 12 projects is least
finished / highest priority" cannot compare across stacked cards. WCAG 1.4.10 does **not** forbid
horizontal scroll inside a *bounded, labelled data region* — it forbids it for the page. [BP §7]
explicitly endorses "a (horizontally scrollable, frozen-header) table or a hybrid."

**Recommended.** Replace the mobile card stack with a **mobile-tuned comparison table**:
- A **frozen first column = project Name** (the human-readable identifier [BP §7 task 1]) +
  horizontally-scrollable Status / Priority / Completion columns. Freeze header row too [BP §7 task 2].
- Use **zebra striping + a press-highlight** to hold the eye across rows [BP §7 task 2].
- Keep the **expand chevron** for Army→Unit drill-down inline in the frozen column [BP §9].
- Keep inline-edit via popover but fix edge-clipping (see M3) — or move row-edit to a **nonmodal
  bottom sheet** that keeps the table visible [BP §7 task 3, §6 bottom-sheets].
- Surface **filter + the active-filter indicator** and the **global search** above the table
  [BP §7 task 1] (M2).
- Order columns by importance, related columns adjacent [BP §7 task 1].
- This is the second-highest-leverage move.

### 1.5 FOCUS panel (`src/components/focus/FocusPanel.tsx`, `FocusPicker`, `Stopwatch`)

**Current.** A strong bench surface: project + recipe header, project-state pill, recipe
completion bar, quick actions, recipe tabs (when 2+ attached), a slot-swatch palette (`w-16 h-16`
boxes), per-slot step cards with 48px paint swatches, a per-step done checkbox (20×20 — see gap),
and per-paint note textareas. Optimistic save-on-blur with a polite status line.

**Gap vs BP.** (a) The **step-done checkbox renders at 20×20px** (measured) — below the 24px AA
floor and far below the 44px recommendation [BP §2, §3, §12]; it needs the `.tap-target` wrapper
the rest of the app uses. (b) As a *section of /projects* it violates disclosure (1.3); as its
*own screen* it's well-designed. (c) The slot palette + per-step swatches + per-paint notes is a
lot of vertical real estate — fine on a dedicated screen, suffocating mid-page. (d) Note textareas
are `text-2xs` (11px) — below body convention for an editable field [BP §4].

**Recommended.** Promote FOCUS to its **own `/focus` route** (per 1.3). Floor the done-checkbox
to 44px. Bump note textarea text to ≥14px. Keep the optimistic model — it already nails [BP §11
optimistic UI / Doherty <400ms].

### 1.6 Project detail `/projects/[id]` — Army→Unit→Model, color scheme, attach-recipe

**Current.** Breadcrumb (`← Projects > Name`, truncates) + a prominent **red DELETE PROJECT
button top-right**, big title, type chip + count + status, `+ ADD UNIT`, **ColorSchemeBox**
(swatch + `+ ADD PAINT`), progress table (for containers), **Roster** OwnedCounter, **Stages**
StageCounter (the +/- spine), action row (`+ Add unit`, `+ Wishlist`). Counters are excellent
(see 1.10).

**Gap vs BP.**
- **Destructive action given top-right prominence** [BP §3]: "Never make a destructive action the
  prominent button… people tap prominent buttons without reading." DELETE should be demoted
  (overflow menu / bottom of page / smaller danger-outline).
- **"+ ADD UNIT" terminology** when viewing a Unit (folds in C1): the mental model is Army→Unit→
  **Model**; a Unit contains models, not units. The button + empty-state copy must say "+ Model".
- **ColorSchemeBox doesn't match the recipe-slot format** (folds in C2): per [BP §9] persistent,
  consistent representation across levels aids recognition-over-recall — the same paint should look
  the same in the recipe editor and the project's scheme box. Make it slots with paint-name +
  layer (depends on B1/B4 landing).
- **`+ Wishlist` is an unlabelled deep-link** (folds in C3) — unclear scent [BP §6 "strong
  information scent on the label"]. Relabel "Shop for this" or fold into an overflow.
- **Breadcrumb truncation** loses the parent context that [BP §9] requires for drill-down
  ("persistent breadcrumbs so users always know which parent they're under").
- Heavy card padding → long scroll; counters could be denser.

**Recommended.** Demote DELETE to an overflow / page-bottom danger-outline. Make the add-child
button context-aware (Unit → "+ Model"). Rebuild ColorSchemeBox to the shared slot component (see
M5). Relabel/disclose `+ Wishlist`. Make the breadcrumb a two-line or middle-truncated full path
that keeps the Army name visible [BP §9]. Tighten card padding to the 8/4 grid (M1).

### 1.7 `/library` — `src/app/library/page.tsx`, `LibraryPageClient`

**Current.** Header + count + a **FILTERS** button (cyan-filled), a LIST/GRID `View` toggle, then
a virtualized-feeling paint list: swatch + name (first column, truncates) + brand + owned-circle +
star + hex chip. ~7,144 paints. This is close to the [BP §7] ideal: paint name as the
human-readable identifier, filters disclosed behind a button, owned/wishlist inline actions.

**Gap vs BP.**
- **No search box on the page** [BP §7 "global search to recall any paint from anywhere",
  recognition-over-recall]. Filters help but you can't type a paint name. (Global ⌘K exists but is
  keyboard-only — see M2.)
- **Name column truncates** ("507a Admiralty Dark …") — the identifier must stay readable [BP §7].
- **FILTERS / active View use cyan-filled buttons** — violates the project's no-cyan-on-buttons
  rule and the [BP §3] style discipline (and the active GRID/LIST toggle reads as a primary CTA).
- **Owned-circle + star + hex are tiny** adjacent targets — verify ≥24px with spacing [BP §3, §12].
- Confirm **Load More / pagination, not infinite scroll** for re-findability [BP §7]; if infinite,
  add an ARIA `feed` and a "X of Y" readout [BP §7].

**Recommended.** Add an always-visible **search field** at the top of the list (M2). Let the name
wrap to two lines or widen the column. Reskin FILTERS + the View toggle to outline/ghost (no cyan,
[BP §3] use style for selection state — e.g. filled-neutral active chip). Confirm
list-virtualization + Load-More. Floor the inline owned/star targets.

### 1.8 `/wishlist` — `src/app/wishlist/page.tsx`

**Current.** Header + a quick-add bar (paste URL / type), then **a tall stack of filters**:
STATUS chips (Wishlist/Purchased/Hold), CATEGORY chips (All/Any/Box/Bits/Paint/Tool/Terrain/Other),
a VENDOR `<select>`, then MODELS / PAINTS sections. At 375px the filters + header consume the
**entire first viewport** — content is below the fold.

**Gap vs BP.** The filter block is "many options shown up-front" — the opposite of progressive
disclosure [BP §6]. The Library already solved this with a **FILTERS button**; wishlist should
match. Active chips are cyan-filled (no-cyan rule). The two-row chip grid also has tightly-stacked
targets [BP §3 spacing].

**Recommended.** Collapse STATUS/CATEGORY/VENDOR behind a **FILTERS button + active-filter count
badge** [BP §7 active-filter indicator], identical pattern to Library, so the list is the first
thing on screen. Keep the quick-add bar visible (it's the primary action). Reskin active chips
off cyan. Verify the MODELS/PAINTS empty states explain the first action [BP §7 empty states].

### 1.9 `/recipes` (list) + `/recipes/[id]` (editor)

**Current — list.** Clean cards: name link + body-type chip + slot/step count + **ASSIGN** (green)
and **SHARE** (amber) buttons. "1 slots / 1 steps" grammar bug.

**Current — editor (`RecipeEditorClient` + children).** Top stack of **four prominent buttons**
(SAVE TO LIBRARY green, ASSIGN TO PROJECT green, SHARE RECIPE **cyan**, DELETE red), then a
**SLOTS / NOTES** SegmentedControl (mobile), then "COLOR SLOTS · N" with slot boxes labelled by
**zone name** ("BASECOAT") + an "ADD COLOR" custom-hex slot, then "STEPS · SLOT n" with a cramped
horizontal step row (drag handle + layer select + color chip + truncated paint select + ×) and a
note field, then ADD STEP.

**Gap vs BP.**
- **Four prominent same-weight buttons at the top** [BP §3]: "keep prominent buttons to 1–2 per
  view"; SHARE is cyan (no-cyan rule); DELETE (destructive) sits in the prominent cluster
  ([BP §3] never make destructive prominent). The painter sees a wall of CTAs before the recipe.
- **Slot labelled by zone name, not the pinned paint name** (folds in B1) — the paint is the
  identifier the painter counts [BP §7 human-readable first column].
- **Custom-hex "use this colour" add path** (folds in B2) — paints-only is the rule; remove it.
- **"COLOR SLOTS" → "RECIPE SLOTS"** (B4); **redundant Notes tab/box** (B5); **Steps-vs-Slots
  data model** (B6 — flagged structural, not auto-built).
- **Cramped step row** at 375px: 5 controls on one line, the paint select truncates to "C…".
  Violates [BP §3 spacing — targets must be big enough then spaced] and [BP §5 don't crowd].
- **No brand filter in the add-slot paint picker** (folds in B3) [BP §6 dropdowns → filters].

**Recommended.** Collapse the top action cluster: keep **one** prominent CTA (context: SAVE or
the implicit autosave), move ASSIGN/SHARE/DELETE into an **overflow menu or a secondary
ghost/outline row** [BP §3]; DELETE to danger-outline at the bottom. Reflow the step row to a
**two-line card** on mobile (paint name + swatch on line 1, layer + actions on line 2) so nothing
truncates [BP §5]. Land the B-batch labels/format. Add the brand FilterChip to the paint picker.
Fix "1 slots/steps" pluralization. Reskin SHARE off cyan.

### 1.10 +/- stage counters (`StageCounter.tsx`, `OwnedCounter`, `CounterButton`)

**Current.** **The best-built part of the app.** Optimistic updates, horizontal −/+ buttons with
`.tap-target` (≈44px), disabled + greyed at min/max with an explanatory `title` ("BUILD can't
exceed OWNED — bump Owned first"), keyboard shortcuts (B/P/A/S/C, Shift to decrement), inline
cascade-error alert, a one-line cascade explainer. This maps almost 1:1 to [BP §10 input steppers].

**Gap vs BP.** Narrow, per [BP §10]: (a) **+ and − sit adjacent** at the right edge — [BP §10]
warns to "place + and − far enough apart to avoid slips"; add a gap or split them to opposite ends
of the row. (b) **No long-press for continuous increment** and **no typeable field for big jumps**
[BP §10] — for a 30-model unit, tapping +1 thirty times is painful. (c) The value sits in the
middle and the buttons at the right; [BP §10] "show clearly which field the stepper controls" —
it's OK but a tighter visual binding helps.

**Recommended.** Add spacing/separation between − and +. Add **long-press = repeat** and a
**tap-the-number-to-type** affordance for large counts [BP §10]. Keep everything else — it's a
reference implementation.

### 1.11 `/tools/*` — index + eyedropper / gradient / match / wheel

**Current.** Tools **index** is a clean navigation-hub: large card per tool (icon + title +
description + chevron) — exactly [BP §6 navigation hub] for task-based utilities. **Eyedropper**:
big drop zone, full-width green **USE CAMERA** button (the mobile path), file/clipboard,
empty-state copy. Good.

**Gap vs BP.** (a) A stray **"← TOOLS" back chip at the very top of the Tools index** (you're
already on the index) — confusing scent. (b) Eyedropper copy is **desktop-worded** ("DROP IMAGE
HERE", "paste from clipboard ⌘V") on a touch device where you *tap to pick* and use the camera
[BP §6 information scent / platform fit]. (c) Verify each tool's primary button is one prominent
CTA, no cyan.

**Recommended.** Remove the redundant back chip on the index (keep it only on sub-tool pages).
Make eyedropper copy touch-first ("Tap to choose a photo · or use the camera"); keep the desktop
hints behind a fine-pointer media query or as secondary text. Quick wins.

### 1.12 `/pricing`

**Current.** Single-column stacked tier cards (Free / Pro Monthly / Pro Lifetime "BEST VALUE" /
Founder), big mono price numbers, check-list features, amber "VERIFY EMAIL TO UPGRADE" CTAs,
seats-remaining line. Reads well on mobile.

**Gap vs BP.** Minimal. Big numbers + clear hierarchy is [BP §8]-correct. "CURRENT PLAN" uses a
green outline marker (good — not color-alone, it has the label [BP §10, §12]). The four cards are
a long scroll; consider a sticky "current plan" anchor, but not required.

**Recommended.** Keep. Optional: condense feature lists on the non-recommended tiers. Trivial.

### 1.13 `/user`

**Current.** Long single-column settings stack: PLAN summary, recovery-email form, **LIBRARY BRAND
FILTER** (a long checkbox list of ~40 brands shown fully expanded), backup/export, sign-out, delete
account.

**Gap vs BP.** The fully-expanded ~40-brand checkbox list is a [BP §6] disclosure miss — it should
be collapsed behind a "Brand filter (N selected)" disclosure or moved to where it's used (Library).
Otherwise a conventional settings page.

**Recommended.** Collapse the brand-filter list behind a disclosure with a selected-count, or
relocate it to the Library FILTERS sheet (its natural home). Group the form sections with the 8dp
rhythm. Verify recovery-email errors are inline [BP §12]. Low-medium effort.

### 1.14 PLANNER — collection grid + calendar + streak + activity + inspo (`src/components/planner/**`)

**Current.** A 5-widget dashboard. The **COLLECTION grid** (`HeatSinkGridClient`) renders **every
catalog paint (~7,144) as a hue-sorted pixel cell, each an interactive `<button
aria-haspopup="dialog">`** at ~4–9px, with a sparse owned/wishlist dot overlay, a brand-filter
chip row, and a per-cell gap-fill popover (correctly a bottom sheet on mobile). The **calendar**
day cells measure 37×48px. Streak/activity/inspo are reasonable cells.

**Gap vs BP (severe on the grid).**
- **7,144 sub-24px interactive targets** [BP §2, §12]: even with WCAG's "Essential" dense-data
  exception, [BP §14] says "still aim large." A 4px button is unusable by touch and a screen-reader
  catastrophe (7,144 `dialog` triggers in the a11y tree).
- The painter's own brief (A1/A2) says the markers should be **approximate, at-a-glance** — i.e.
  the grid should be a **glanceable image**, not an interactive field. That matches [BP §8]
  exactly: a dashboard is "an at-a-glance collection… NOT for exploration"; color encodes
  *category* (hue) which is legitimate [BP §8, §14], but **magnitude/coverage must be a number or
  length** — the owned-count readout + thin bar already do this (good).
- **Calendar day cells 37px wide** — under the 44px recommendation [BP §2]; tap-to-add-event slips.

**Recommended.**
- **Make the spectrum field non-interactive by default** — render it as a static canvas / CSS
  gradient field (or a single `<img>`/`<canvas>`) with the sparse owned/wishlist dots painted on,
  i.e. **one element, not 7,144** [BP §8 at-a-glance, §7 virtualization]. Drill-in/gap-fill moves
  to a *separate*, sane interaction: tap the whole grid → opens a **bottom sheet** [BP §6] with the
  *filtered, searchable* paint list (reuse Library list) to fill gaps — not 7,144 individual
  targets. This is the third-highest-leverage move and directly satisfies A1/A2.
- Keep the brand-filter chips and the owned/wanted count + bar (length-encoded magnitude — correct
  [BP §8]).
- Floor calendar day cells toward 44px (or accept the dense-grid exception but enlarge the *tap
  region* via padding while keeping the visual compact [BP §3 "touch target extends beyond the
  visual element"]).
- This work coordinates with the in-flight A-batch (planner agent) — see §3 note.

### 1.15 Global chrome — header, tab bar, search, status bar

**Current.** `MobileHeader` (h-12 fixed): "MINI MANAGER" wordmark (links to /projects) + an "● ON"
status pill + a 32px user avatar. `BottomTabBar`: 5 labelled icon tabs, 56px min-height, active
accent — [BP §6]-correct. `StatusBar` on top. `GlobalSearch` bound to `/` + ⌘K only.

**Gap vs BP.**
- **No mobile search trigger** [BP §7] — the single biggest chrome gap (M2).
- The **"● ON" status pill** eats scarce header width and carries near-zero user value — chrome
  over content [BP §6].
- The header has **no contextual title / back affordance** — every screen says "MINI MANAGER";
  [BP §9] wants parent context visible. (Detail pages have in-body breadcrumbs, but the fixed
  header is generic.)

**Recommended.** Add a **search icon button in the header** (44px) that opens the existing
GlobalSearch overlay [BP §7]. Drop or shrink the "ON" pill to reclaim width. Optionally show the
current section name in the header for orientation. M2.

---

## 2. Cross-Cutting Findings (the systemic themes)

| Theme | Evidence | BP cite |
|---|---|---|
| Disclosure inverted on `/projects` | 5 apps on one scroll; 7,283 nodes | §1, §6, §8 |
| List reflowed table→cards, killing comparison | `ProjectsDashboardTable` mobile branch | §7, §14 |
| 7,144 micro-targets in the collection grid | measured 9×9px ×7,144 `<button>` | §2, §8, §12 |
| Search is keyboard-only | `GlobalSearch` bound to `/`+⌘K, no mobile trigger | §7 |
| Type skews tiny | measured 96×11px + 92×13px; little 16px | §4 |
| Destructive actions given prominence | project DELETE top-right; recipe DELETE in CTA cluster | §3 |
| Cyan on selection/CTA buttons | FILTERS, GRID/LIST, SHARE RECIPE, active chips | §3 + project rule |
| Filter blocks shown un-disclosed | wishlist filters, user brand list | §6 |
| Inline-edit popover can clip at screen edge | `InlineCellPopover` absolute, no flip | §6 |
| Counters lack long-press / type-to-jump / ±-spacing | `StageCounter` | §10 |

**Strengths to preserve (do not regress):** the `.tap-target` system, optimistic counters,
reduced-motion gating, safe-area handling, the 5-tab bar, the Library filter-disclosure pattern,
the tools navigation-hub, the eyedropper camera path, contrast-reasoned tokens.

---

## 3. Prioritized, Milestone-Structured Plan

Ordered **impact-first**. Each milestone is independently batch-executable. Effort: S (<½ day),
M (½–2 days), L (2–5 days). Impact 1–5 (5 = transformative).

**Coordination note:** the in-flight `UX_FEEDBACK_2026-06-03.md` agents own `planner/**`,
`recipes/**`, `projects/**` disjointly. **M3, M4, M5 below overlap those dirs** — sequence them
*after* the feedback batch lands (or have the same agent extend the batch). M1/M2/M6/M7 are
largely independent and can start immediately.

---

### M1 — Foundations: tokens, type scale, density, target audit  · Effort M · Impact 4 ✅ SHIPPED

> **Shipped 2026-06-03:** FocusPanel paint-note textarea floored to ≥14px (was 11px); verified the named sub-24px controls (FOCUS step-done checkbox, library inventory toggles, view toggle, calendar cells) already carry `.tap-target`/≥44px floors from prior sweeps; added `targetSizeAudit.test.ts` regression net (type-floor + tap-target guards). Card-padding 8/4 rhythm already enforced in `globals.css` `.card`.

The substrate every later phase relies on. No IA change — pure systemic hygiene.

**Steps**
1. **Type floor.** Audit every `text-2xs` (11px) and `text-xs` (13px) usage on *body/editable*
   content (not pure chrome labels). Raise editable fields + primary reading text to **≥14px**,
   body prose toward **16px** [BP §4 "body 17pt ≈ 16px web"]. Keep 11px for true chrome/caps
   labels only (the token comment already says "chrome labels only" — enforce it). Files:
   `globals.css` token usage audit, `FocusPanel` note textarea, table cell text, planner cells.
2. **Spacing rhythm.** Normalize card padding to the **8dp grid** (`p-3`/`p-4`), "more gap between
   groups than within" [BP §5]; reduce the desktop-sized padding on mobile cards (Card
   `bodyClassName`, project-detail cards, stage rows) to shorten scroll. Prefer spacing over
   borders [BP §5 "use fewer borders"].
3. **Target audit + lint.** Sweep for interactive elements missing `.tap-target`: the **FOCUS
   step-done checkbox (20px)**, **calendar day cells (37px)**, **library owned/star inline
   toggles**, **collection cells** (resolved structurally in M4). Add a dev-time check
   (Playwright assertion or a script) that flags any `button/a/input` < 24×24 outside
   known-exception regions [BP §2, §12].
4. **Density control (optional, A11y+).** Consider a layout-density toggle in `/user` [BP §5, §12
   "offer a layout-density control"] — defer if scope-tight.

**Acceptance**
- No editable/body text < 14px on mobile; chrome caps may stay 11px.
- Every interactive control ≥ 24×24 (≥44 for primary) or documented exception; automated check green.
- Card padding on the 8/4 grid; `tsc` clean; `npm test` green.

**Rationale:** [BP §2, §4, §5, §12]. Cheap, broad, unblocks everything.

---

### M2 — Navigation & IA: mobile search + filter disclosure + header  · Effort M · Impact 5

Restores recognition-over-recall and content-over-chrome.

**Steps**
1. **Mobile search trigger.** Add a **44px search icon button to `MobileHeader`** that opens the
   existing `GlobalSearch` overlay (it already has `setOpen`); also add a tappable trigger to the
   top of `/library`. Keep ⌘K/`/` for desktop. [BP §7 "global search to recall any record from
   anywhere," recognition-over-recall].
2. **Always-visible Library search field.** Add a text input at the top of the Library list
   (filters paint name/brand client-side) — typing is faster than chip-hunting for a known paint
   [BP §7].
3. **Filter disclosure parity.** Collapse the **wishlist** STATUS/CATEGORY/VENDOR block and the
   **/user** brand list behind a **FILTERS button + active-count badge** (reuse Library's pattern)
   [BP §6, §7 active-filter indicator].
4. **Reclaim header width.** Remove/shrink the "● ON" pill; optionally show section context
   [BP §6, §9].
5. **No-cyan + selection-by-style.** Reskin FILTERS, GRID/LIST toggle, active filter chips, and
   SHARE RECIPE off cyan-fill; express *selected* state with a neutral/amber fill + label, not a
   primary-CTA look [BP §3 "use style not size," project rule].

**Acceptance**
- Search reachable by tap on every authed screen; opens the overlay; returns a result.
- Wishlist + user filters collapsed by default with a working active-count badge.
- No cyan-filled buttons; selection states pass [BP §3]; `tsc`/tests green.

**Rationale:** [BP §6, §7, §3]. Search alone is a step-change for a 7,144-paint app.

---

### M3 — Lists & data tables: restore the comparison table  · Effort L · Impact 5

The spine of the app. **Sequence after the projects feedback batch.**

**Steps**
1. **Replace the mobile card stack** in `ProjectsDashboardTable` with a **frozen-first-column,
   horizontally-scrollable table**: Name (frozen, human-readable [BP §7 task 1]) | Status |
   Priority | Completion-bar | (Type/Recipes scroll into view). Freeze the header row [BP §7 task 2].
2. **Zebra striping + press-highlight** to hold place across rows [BP §7 task 2].
3. **Keep the expand chevron** in the frozen column for Army→Unit drill-down [BP §9]; persist
   expansion (already done via sessionStorage).
4. **Row editing → nonmodal bottom sheet** (or fix the popover to flip away from the screen edge):
   tapping a row's Status/Priority opens a bottom sheet with a visible Close (X) + Back-dismiss
   [BP §6 bottom-sheets, §7 task 3 "nonmodal side panel keeps the table visible"]. Fixes the
   `InlineCellPopover` edge-clip.
5. **Filter + active-filter indicator + search** above the table [BP §7 task 1] (lands with M2).
6. Keep the `MobileSortBar` (sort is a [BP §7 task 2] need) but align its control styling to M2.

**Acceptance**
- Mobile shows a scrollable table with frozen name column + frozen header; two projects' Status +
  Completion are comparable without vertical scrolling between them.
- Row edit opens a dismissible (X + Back) bottom sheet that doesn't clip at the viewport edge.
- Drill-down + sort + filter all work at 320–414px; `tsc`/tests green.

**Rationale:** [BP §7, §9, §14]. Reverses the single worst list decision.

---

### M4 — Dashboard / PLANNER: glanceable collection grid + /projects split  · Effort L · Impact 5

The `/projects` re-architecture + the 7,144-button fix. **Coordinate with the planner A-batch.**

**Steps**
1. **Split `/projects` into Tier-1 hub + Tier-2 routes** (per 1.3): `/projects` = bench strip +
   project table + search/filter; introduce **`/focus`** (the FocusPanel) and **`/planner`** (the
   widget dashboard) as their own routes, linked from the Tier-1 strip and reachable via Back
   [BP §1, §6, §8, §9]. Move `FocusPanel` + `Stopwatch` and `PlannerSection` off the projects page.
2. **Collection grid → one glanceable element.** Render the hue-sorted spectrum as a **static
   canvas/CSS gradient field with a sparse owned/wishlist dot overlay** — *not* 7,144 buttons
   [BP §8 at-a-glance, §7 virtualization, §2/§12 target size]. Satisfies A1 (tiny pixels) + A2
   (approximate markers) by design.
3. **Gap-fill as a sane interaction:** tap the grid → a **bottom sheet** [BP §6] with the
   filtered/searchable paint list (reuse Library list) to mark owned/wanted — replacing per-cell
   `dialog` triggers. Keep the brand-filter chips + the owned/wanted count + length bar
   [BP §8 length-for-magnitude].
4. **Calendar cells** toward 44px tap region (pad the hit area, keep the compact visual)
   [BP §3, §2].
5. **Apply A3 layout** (collection as hero square, calendar demoted) within `/planner` — already
   started in `PlannerSection`; finish it on the dedicated route.

**Acceptance**
- `/projects` first viewport on a phone = bench strip + project table (+ search); no recipe editor
  or planner inline. Total interactive nodes on `/projects` drop by >90% (re-measure; target < 300).
- `/focus` and `/planner` exist, are linked, and Back returns to `/projects`.
- Collection grid renders as ≤ a handful of elements (not thousands); tapping it opens a
  dismissible gap-fill sheet; owned/wanted counts + bar intact.
- `tsc`/tests green.

**Rationale:** [BP §1, §6, §7, §8, §9, §12]. The headline overhaul; fixes disclosure, node-count,
target-size, and dashboard-glanceability together.

---

### M5 — Recipe & Project flows: shared slot component, action discipline, hierarchy copy · Effort L · Impact 4

**Sequence after the recipes + projects feedback batches** (heavy overlap with B/C items).

**Steps**
1. **Shared "RecipeSlot" component** rendering a paint as **swatch + paint-name + layer-at-bottom**,
   used identically in the recipe editor *and* the project ColorSchemeBox [BP §9 consistent
   representation across levels; folds in B1, B2, B4, C2]. Paints-only (no custom-hex add).
2. **Action discipline on the recipe editor:** reduce the four top CTAs to **one prominent**
   (Save/autosave); move Assign/Share into an **overflow** or secondary outline row; **Delete →
   danger-outline at the page bottom** [BP §3]. Same for project-detail **DELETE** (demote from
   top-right) [BP §3].
3. **Step row reflow** to a two-line mobile card so the paint select never truncates [BP §5].
4. **Brand FilterChip in the add-slot paint picker** [BP §6 dropdowns→filters; folds in B3].
5. **Context-aware add-child:** Unit view → **"+ Model"** button + empty-state copy [BP §9 mental
   model; folds in C1]. Relabel/disclose **`+ Wishlist`** → "Shop for this" [BP §6 scent; folds
   in C3].
6. **Breadcrumb** keeps parent (Army) visible via middle-truncation/two-line [BP §9].
7. Fix "1 slots/steps" pluralization.

**Acceptance**
- A pinned paint looks identical in recipe editor + project scheme box (swatch + name + layer).
- ≤1 prominent CTA per recipe/project view; no destructive action in a prominent slot; no cyan.
- Step row + breadcrumb never truncate critical text at 375px; "+ Model" shows on Unit views.
- `tsc`/tests green. (B6 Steps-vs-Slots data-model decision stays a separate design call —
  do **not** collapse the schema blind.)

**Rationale:** [BP §3, §5, §6, §9].

---

### M6 — Forms & feedback  · Effort M · Impact 3

**Steps**
1. **Input optimization** across auth + add forms: `type=email`, `inputmode`, `autocomplete`,
   visible labels-above-field, inline field-level errors (not banner-only) [BP §1, §12].
2. **Touch-first copy:** eyedropper "Tap to choose a photo / use the camera" (gate desktop
   "drop/⌘V" hints on fine-pointer) [BP §6 scent].
3. **Feedback timing:** press-state on every custom tap; spinner for 2–10s ops; percent/step
   readout for bulk paint ops ("Updating 3 of 50"); **Undo toasts** for reversible deletes instead
   of confirm modals where safe [BP §11]. (Toast system already exists.)
4. **Stepper polish (`StageCounter`):** separate − and + (gap or opposite ends), **long-press =
   repeat**, **tap-number-to-type** for large counts [BP §10].

**Acceptance**
- Forms use correct keyboards/labels; errors inline. Eyedropper copy is touch-first.
- Reversible deletes offer Undo; long-running ops show progress. Counter ± spaced + long-press +
  type-to-jump work. `tsc`/tests green.

**Rationale:** [BP §10, §11, §12, §6].

---

### M7 — Accessibility & polish  · Effort M · Impact 3

**Steps**
1. **Contrast pass** on neon-on-dark per surface (the tokens are reasoned, but verify cyan/green/
   amber text + the new chip styles hit 4.5:1 / 3:1) [BP §4, §12].
2. **Never-color-alone audit** on status pills, the collection dots, completion bars — ensure each
   carries icon/shape/label, not hue only [BP §8, §10, §12]. (StatusPill already labels — verify.)
3. **Sheets/overlays:** every bottom sheet + the GlobalSearch overlay has a visible Close (X) and
   Back-dismiss; no gesture-only dismissal [BP §6, §12].
4. **Screen-reader:** the de-buttoned collection grid exposes one labelled summary, not 7,144
   nodes; any remaining list uses ARIA `feed`/`list` correctly [BP §7, §12].
5. **Reduced-motion + 200%/400% reflow** spot-check across the new routes [BP §4, §12].
6. **Focus-visible** indicators (3:1, not obscured) on the new search button, sheets, table rows
   [BP §12].

**Acceptance**
- Axe/Lighthouse a11y pass on `/projects`, `/focus`, `/planner`, `/library`, `/recipes/[id]`;
  no target-size or color-only failures; reflow OK at 320px/400%; `tsc`/tests green.

**Rationale:** [BP §4, §6, §7, §8, §10, §12].

---

## 4. The 5 Highest-Leverage "Serious Overhaul" Moves

1. **Split `/projects` into a glanceable Tier-1 hub + `/focus` + `/planner` routes** (M4). Fixes
   the inverted progressive disclosure that is the single most important mobile decision, and
   collapses a 7,283-node page. [BP §1, §6, §8, §9]
2. **Restore a real comparison TABLE for the project list on mobile** (frozen first column,
   horizontal scroll), replacing the comparison-killing card stack (M3). [BP §7, §14]
3. **Turn the 7,144-button collection grid into one glanceable image with a bottom-sheet gap-fill**
   (M4) — satisfies the painter's own A1/A2 brief *and* the target-size/dashboard rules. [BP §2, §8, §12]
4. **Give search a first-class mobile trigger** + collapse un-disclosed filter blocks (M2) —
   restores recognition-over-recall on a 7,144-paint catalog. [BP §6, §7]
5. **Enforce action discipline + a shared paint-slot component** across recipe/project surfaces
   (M5): one prominent CTA, destructive demoted, paint-name-not-zone-name, consistent slot across
   levels. [BP §3, §9]

---

*Build order: M1 → M2 (independent, start now) → M3/M4/M5 (after the in-flight feedback batch, or
extend it) → M6 → M7. Impact-first; every milestone is acceptance-gated and `tsc`/test-clean.*
