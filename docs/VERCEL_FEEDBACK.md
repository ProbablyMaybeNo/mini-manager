# Vercel Comment Backlog — triage (2026-06-17)

> 🛑 **SUPERSEDED by `docs/VERCEL_COMMENT_AUDIT.md`.** This doc was built from the live Vercel API's
> "unresolved" flag against the wrong (`feat/ui-port`) branch — most items here are actually ADDRESSED in
> the real build on `main` (the threads were just never clicked "resolve" in Vercel). Use
> `VERCEL_COMMENT_AUDIT.md` (code-accurate: 86 ADDRESSED / 9 PARTIAL / 3 PENDING) as the system of record.
> Kept only for the raw verbatim comment text.

All **89 unresolved** Vercel toolbar comments on the `mini-manager` project, read in full and grouped
by theme.

> ⚠️ **Important:** every comment was left on an **older `main` deployment** (pre-port eras — old UI,
> terminal redesign, and figma-rebuild). **None were made against the current `feat/ui-port` build.**
> So each needs triaging against the new UI. Routes `/projects`, `/planner`, `/wishlist` **do not exist**
> in the ported UI (it uses `/dashboard`, `/collection`). `MM-xx` = IDs already assigned in a prior pass.

**Status legend:** 🟢 ACTIONABLE (clear, just do it) · 🟡 NEEDS DECISION (Ross input) · 🔵 VERIFY (may already
be done in feat/ui-port) · ⚪ LIKELY STALE (superseded route/design) · 🐞 BUG.

---

## ★ Pivotal decisions (blocking correct triage)

- **P-1 — Route/era scope.** Comments on `/projects`, `/planner`, `/wishlist` are on routes the ported UI
  doesn't have. Do their *features* (sub-projects tree, planner, WISHLIST→COLLECTIONS) carry forward into
  the new UI's `/dashboard` + `/collection`, or are those comments archived as superseded?
- **P-2 — WISHLIST → COLLECTIONS.** Big spec (two tables: PAINT + MODEL, defined columns + statuses).
  Is this the canonical direction for the new `/collection` page? (It maps cleanly onto Phase 3.)
- **P-3 — Sub-projects.** Armies → units → models nesting (expand arrows + add affordance). Core data-model
  feature requested repeatedly. Contract already carries `children`; UI affordance missing.
- **P-4 — Small-tweak handling.** ~20 items are "confirm exact colour/size/behaviour" tweaks. Batch them now,
  or let me apply sensible style-guide defaults and you review in the page-by-page pass?
- **P-5 — Tool "not built" comments predate the port.** MM-34 (dropper), MM-35 (stacking/layering),
  MM-53 (wheel) say "port from old app" — but these tools now EXIST in feat/ui-port. Re-verify & close vs treat as rebuild?

---

## A. Landing page `/` — copy & layout (mostly 🟢)
- 🟢 CTA button → **"START FOR FREE"** (two separate comments).
- 🟢 Hero/upgrade copy → "Ready to take your hobbying to the next level? … Founders receive a big discount. Limited availability."
- 🟢 Calendar blurb → "Plan and track your painting progress for upcoming tournaments with deadlines, events, and a built-in calendar."
- 🟢 FOCUS section → title "FOCUS", "Paint recipes, color schemes, notes, techniques, and a timer… maximum productivity when session painting."
- 🟢 Rename a section **"COLLECTION"** → "Plan, manage, and budget your paint and model collections all in one place."
- 🟢 "Project Dashboard – plan and track your painting projects using the mini-manager dashboard."
- 🟢 "Pick your paints and plan your projects. Save them for later or share them with friends."
- 🟢 Library blurb → "Search, filter, track, match, and collect with our growing library of 7,144 paints across all major brands."
- 🟡 "Remove this button for now" / "Remove this section" (which button/section — needs the selector/screenshot).
- 🟡 Logo animation: place the little animation **inside the enlarged logo's screen**, then remove that section (depends on logo enlarge).

## B. Dashboard `/dashboard` (new UI)
- 🟡 **MM-50** enlarge sidebar logo so "MINI-MANAGER" is legible (currently 72×72 → ~120×120? widen nav?). [size]
- 🟡 **MM-49** each tracker-box total its own colour. [needs colour↔box mapping]
- 🟡 **MM-47** clicking a calendar day opens **+Date** form pre-filled with that date. [ties MM-15/events]
- 🟡 **MM-46** popup date-picker on the date field. [native vs custom-styled]
- 🟡 **MM-45** colour-code activity entries (neon green/cyan/pastel yellow/purple/red). [needs type↔colour mapping]
- 🟡 **Sub-projects (P-3):** projects missing the expand arrow for sub-projects; no way to add units→army or models→unit (3 comments).
- 🟡 "How can the user track their project's progress?" (open question → progress UI).
- 🟢/🟡 **Events scheduling (P-2 adjacent):** section below calendar with **+Date** → popup to enter events/tournaments/deadlines → appear as coloured calendar tags + in "Upcoming Events" ticker + hover tooltip. (= Phase 3 Events CRUD.)

## C. Collection `/collection` + `/wishlist` (superseded route) — MAJOR
- 🟡 **WISHLIST → COLLECTIONS (P-2):** replace WISHLIST with COLLECTIONS holding **two tables**:
  - **PAINT COLLECTION:** thumbnail, name, company, vendor, cost, type (Contrast/wash/acrylic/varnish/glaze/enamel…), status (WISHLIST/OWNED/HOLD), delete-X.
  - **MODEL COLLECTION:** thumbnail, name, game, army, price, project dropdown (assign), status (WISHLIST/OWNED/BUILT/PRIMED/PAINTED/BASED/COMPLETE), delete-X.
  - Both: name hyperlinks to the uploaded source URL (auto or manual). Add manually or via URL auto-upload.
- 🐞 **MM-36** with "model" selected, pasting a URL adds to the **paint** table not the model table.
- 🟡 **MM-40** paste-to-populate only works for supported store domains → surface which stores (helper text/tooltip), flag unsupported links. [needs store list]
- 🟡 **MM-39** paint/model toggle styling: inactive = no fill + purple border/text; active = pastel-purple fill. [active label black or white?]
- 🟡 Collection **stats overview bar** at bottom: paints owned, total spent; models built/primed/painted/based/complete (or owned+complete), total spent.
- 🟡 Filters: simplify to **models / paints**; statuses **Wishlist / Purchased / Hold**; make Filter a **per-table button** (right of each table header) opening that table's filter panel.
- 🟡 "Add button is terrible — match other button styles."
- 🟡 "UI/UX terrible: table tops cut off, too short, no vertical/horizontal scroll unless many items; project dropdown ugly; wishlist dropdown more vibrant; make title+image the focus; URL → small 'link' column that opens the source."
- 🟡 "RECIPE" column on paints table (lists recipes a paint is attached to).
- ⚪ Vague removals: "Remove this from the paint table", "No idea what this is, lets remove it." [need selector]

## D. Library `/library`
- 🟡🐞 **MM-19** wishlist button → **yellow**; **click does nothing** (functional bug — define behaviour); clarify the owned-counter (label "Owned: N" / tooltip / icon?).
- 🟡 **MM-20** enlarge sidebar nav logo for legibility (dup theme w/ MM-50). [size + nav width]
- 🟡 Fit the entire colour map within the side panel (no scroll).

## E. Recipes `/recipes` + `/recipes/[id]`
- 🟡 **MM-51** enlarge recipe-table swatches so paint names are readable; clicking a recipe paint opens a **side panel** with old recipe-creator tools (wheel, match, filterable library, dropper, layering) to edit colours inline. [size + big port; = MM-25]
- 🟡 **MM-25** rebuild the old recipe-creation slide-out ("Pick a paint" panel): colour wheel, colour-match, filterable paint library. [needs old-version ref; big port]
- 🟡 **MM-28** clicking a recipe-table row opens that recipe. [full page `/recipes/<id>` vs drawer]
- 🐞 **MM-24** recipe-name input loses focus after each keystroke (re-mount bug).
- 🟡🐞 **MM-26** pasted inspiration image URL doesn't render (likely image-host allowlist). [which domain?]
- 🟡 **MM-52** make this + button neon green; rule: **all + buttons neon green except wishlist**. [this one vs global sweep]
- 🟡 Recipe detail: squares bigger w/ paint name centred (black/white) + layer at bottom; too much empty space; borders too thick; swap blocky pixel image for higher-res.

## F. Focus `/focus`
- 🟡 **MM-23** add **+Focus** picker to choose an army/unit/model/warband/terrain to focus on, plus **Remove Focus** button. [top-level only or nested? single or multi? persist across sessions?]
- 🟡 **MM-21** PROGRESS panel auto-updates to the focused project. [metric: % painted / count / other — blocked on MM-23]
- 🟡 **MM-22** swap the recipe-box / label order. [confirm final order + what "etc." covers]

## G. Tools `/tools/*`
- 🔵 **MM-34** dropper "not built — port from old app." **Now exists** in feat/ui-port (k-means real, wiring stubbed). VERIFY & rescope to "wire it" (LAUNCH_PLAN B3).
- 🔵 **MM-35** stacking "port + add colour-layering section." Layering tool **now exists** (glaze/undercoat). VERIFY coverage vs the requested layering spec.
- 🟡 **MM-53** colour wheel rebuild to match old features in new UI. Wheel exists but basic. [needs old-version ref + must-have list]
- 🟡 **MM-29** wheel "CLOSEST PAINTS" panel not useful. [improve w/ brand+match% + clickable-to-recipe, or remove]
- 🟡 **MM-30** add colour-harmony modes to the Match tool (analogous/complementary/split-comp/triadic). [which + list closest paints per hue?] (Note: the **Wheel** tool already does harmonies.)
- 🟡 **MM-31** Match bars: add "NN% color match" label at bar end + recolour **neon green**. [confirm score direction]
- 🟡 **MM-33** Match ASSIGN button → pastel purple; make it a **dropdown of all recipes** to pick target (instead of navigating). [confirm: lists every recipe, adds in place]
- 🟡 Change body font app-wide to terminal/mono (IBM Plex Mono / JetBrains Mono). [cross-cutting — see I]
- 🛠️ Tool thumbnails: "find cooler visuals" — **already picked up by a Claude Code task (t_038cdb76)**, PR pending.

## H. `/projects` + `/planner` (⚪ SUPERSEDED ROUTES — confirm via P-1)
- ⚪ `/projects`: calendar way smaller; a section smaller+scrollable; solid progress bar like "GOLDEN STANDARD" ref; remove a whole section (add later); is the text bar needed if there's a NEW PROJECT button; trackers → keep only title + number (e.g. `[ACTIVE PROJECTS 01]`), colour-coded (active=green, completion=yellow, streak=purple, time=cyan/red); centre titles & "0m"; numbers only (01,02…); one border thicker than others; background solid black; remove a redundant section; PURCHASED → **OWNED** neon green; project name white (read by TYPE); progress = centred percentage only; "more stylistic, refer to moodboard / figma group 20".
- ⚪ `/planner`: "right idea but not enough — see figma group 21 progress bars"; "needs a fundamental full UI redesign"; INSPO section smaller (thumbnails → double-click popup overlay, click-outside to close); separate the **stopwatch** into its own section; add a **Log** button that submits time to a dashboard section totalling time per project.
- ⚪ logo bigger so "mini-manager" legible (×2, like login page).
- ⚪ font: more terminal/retro/cool, less "arcade"; wants shadow/outline/stylistic; Ross **added fonts to Windows**.

## I. Cross-cutting style (apply once, app-wide)
- 🟡 **Terminal/mono font** across the whole app (IBM Plex Mono / JetBrains Mono); something stylistic w/ shadow/outline, not blocky arcade. Ross installed fonts on Windows — confirm which.
- 🟡 **Style-guide palette** (neon green, neon cyan, pastel yellow, purple, red) applied consistently: trackers, activities, + buttons (green except wishlist=yellow), match bars (green).
- 🟢 Borders too thick in several places; prefer solid-black backgrounds; replace blocky/low-res pixel images with cleaner ones.
