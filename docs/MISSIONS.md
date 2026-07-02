# Mini Manager — Test Missions Log

## FIGMA Rebuild verification (2026-06-09 — `redesign/figma-rebuild`)

Run the full pyramid after each rebuild slice and before calling the redesign done:

```bash
npm run test:verify        # typecheck → unit → integration → e2e missions
npm run test:verify:fast   # skip Playwright (UI still churning)
npm run test:missions      # Playwright qa_*.spec.ts only
```

**New / updated E2E missions for the rebuild:**

| # | Run | Spec | Status |
|---|-----|------|--------|
| M2.* | Collection on `/collection` + legacy redirects | `qa_collections.spec.ts` | 🔄 Updated |
| M3.1 | Project inspector (`?project=`) not `/projects/[id]` | `qa_project_workspace.spec.ts` | 🔄 Updated |
| M6.* | Mobile hamburger nav (replaces bottom tab bar) | `qa_mobile_flows.spec.ts` | 🔄 Updated |
| M7.1 | Import lands on inspector deep-link | `qa_imports.spec.ts` | 🔄 Updated |
| M11 | Focus full page `/focus` | *(pending — add `qa_focus.spec.ts`)* | ⏳ Pending |
| M12 | Dashboard inspector from table row | *(pending)* | ⏳ Pending |

Integration missions (IM*) should stay green while server actions are unchanged.
Unit sentinels under `tests/unit/lib/components/` may need bulk updates as markup
changes — fix or retire assertions that encoded the *old* UI, keep invariants
(touch targets, contrast tokens, a11y contracts).

---

Mission-based test tracker, modelled on the campaign-console QA structure
(`apps/campaign-console-live/docs/MISSION_RUNS_PLAN.md`). Every test is a
**Run** inside a **Mission**. Missions are grouped by layer (E2E /
Integration / Unit) and tagged to the build phase they cover.

**Methodology** (per `docs/TESTING.md`):
- **Unit** — pure functions, node env, <1s. Cascade rules, parsers, filters,
  sort, search ranker, colour maths, markdown, slug.
- **Integration** — server actions against a per-test in-memory libsql
  (`tests/integration/_helpers/testDb.ts`). Ownership + persistence + validation.
- **E2E** — Playwright Mission specs (`qa_*.spec.ts`), one mission per file.
- **Bug workflow** — EXPLORER → REPRODUCER → FIXER. If a bug surfaces, the
  failing test is written/confirmed first, then fixed, then re-verified.

**Headline result (last full run — 2026-07-02, `redesign/v2-hexcode`):**

| Layer | Files | Tests | Result |
|---|---|---|---|
| Unit + Integration (Vitest) | 92 | 1002 pass · 1 fail · 5 skipped | ⚠️ green except 1 pre-existing (unrelated, see below) |
| E2E (Playwright — chromium desktop + chromium-mobile) | 14 | 26 pass | ✅ green (2 consecutive full 23/23 desktop runs + 2 consecutive 3/3 mobile runs) |
| `tsc --noEmit` | — | — | ⚠️ 1 error in `src/app/(app)/tools/wheel/page.tsx` — introduced by a concurrent agent session mid-run (AI-recipe-generation work, untracked `src/lib/recipes/generate.ts` etc.), **not** touched by this campaign; every file this campaign edited typechecks clean |

> **Repo migration note (2026-05-29):** the project was split out of the
> `Antigravity/apps/Paint-planner/app` monorepo into a flat standalone repo.
> The doc was rescued, but the 2026-05-28 *code* fixes (B1, B2, and the markdown
> branch tests) did **not** survive the migration — they were re-applied and
> re-verified here. See Bug Log **B3**.
>
> **Phase 7 (2026-05-30):** Power Imports landed (M7.1). One additional
> migration regression surfaced + fixed during the P7.8 sweep — see Bug Log
> **B4**.
>
> **2026-05-31 session:** full regression after the design-polish + library
> grid-view churn — all green. One real bug found + fixed: a **StatusBar
> hydration mismatch** (server `NET · OFF` vs client `NET · ON`) — see Bug Log
> **B5** — plus a new regression-guard mission **M10** that fails on any
> hydration console error.
>
> **2026-07-02 session (`redesign/v2-hexcode` live-testing handoff):** first
> full E2E run since the v2 HEX.CODE redesign landed — every mission needed
> selector/flow rework (the redesign touched dashboard create, row-click
> navigation, the recipes area, collection, credentials copy, and mobile nav).
> Two genuine app defects found + fixed: a dead `/dashboard?open=<id>` deep
> link (**B7**) and the Next.js dev indicator blocking the mobile "More" tab
> (**B8**). Everything else was test-side drift (**B6, B9–B13**) — the create
> -project mini-form removal (B6) was confirmed a deliberate redesign choice,
> not a regression. The 1 remaining unit fail is the pre-existing, unrelated
> `tests/unit/lib/sw/strategy.test.ts` tripping on the uncommitted
> `public/sw.js` build-id placeholder (flagged at session start, not chased).

---

## E2E Missions (Playwright `qa_*.spec.ts`)

The live, full-stack missions — the closest analogue to campaign-console's
in-browser runs. Each mints its own session via `signInAs(freshTestEmail())`.

| # | Run | Spec | Phase | Status |
|---|-----|------|-------|--------|
| M1.1 | Library quick-lookup — navigate → search → open detail panel | `qa_library.spec.ts` | P2 | ✅ Pass |
| M2.1 | Collection add — manual paint entry via the "+ PAINT" modal → row appears + persists | `qa_collections.spec.ts` | P2 | ✅ Pass (see B11) |
| M2.2 | Collection — `/collections` (plural) and `/wishlist` permanently redirect to `/collection` | `qa_collections.spec.ts` | P2 | ✅ Pass |
| M3.1 | Project workspace lifecycle (v2 HEX.CODE) — create Army → row opens the FLOW panel → "⤢ Open full page" → back → "+ Add unit" → GO PAINT → FOCUS stepper bump persists | `qa_project_workspace.spec.ts` | P1 / v2 | ✅ Pass (see B6) |
| M4.1 | Tools — landing → colour wheel → "Send to Recipe" routes to the RecipeWorkbench index | `qa_tools.spec.ts` | P4 | ✅ Pass (see B9) |
| M5.1 | Create + share a recipe — "+ NEW" → editor → Save Recipe → select the row in the RecipeWorkbench detail column → "⬡ SHARE LINK" → Bob (fresh, unauthenticated context) reads the public /r/<slug> read-only | `qa_share_recipe.spec.ts` | P5 | ✅ Pass (see B9) |
| M6.1 | Mobile — bottom nav bar visible, all primary tabs + the "More" overflow sheet navigate (iPhone 12 viewport / chromium-mobile) | `qa_mobile_flows.spec.ts` | P6 | ✅ Pass (see B8) |
| M6.2 | Mobile — create Army → FLOW panel → "+ Add unit" → GO PAINT → FOCUS stepper bump persists | `qa_mobile_flows.spec.ts` | P6 / v2 | ✅ Pass (see B6, B13) |
| M6.3 | Mobile — library lookup → detail panel renders without clipping | `qa_mobile_flows.spec.ts` | P6 | ✅ Pass |
| M7.1 | Imports — paste plain-text list → preview tree → apply → land on new Army workspace | `qa_imports.spec.ts` | P7 | ✅ Pass (see B12) |
| M9.3 | Credentials sign-up — create account → land on /dashboard, plus a too-short-password rejection | `qa_credentials_signup.spec.ts` | P9 | ✅ Pass (see B10) |
| M9.4 | Credentials sign-in — sign up → sign out → sign back in lands on /dashboard, plus wrong-password rejection | `qa_credentials_signin.spec.ts` | P9 | ✅ Pass (see B10) |
| M8.1 | Library view-mode toggle — list → grid, open detail panel from a swatch, persists across reload | `qa_library_view_toggle.spec.ts` | P2/P8 | ✅ Pass |
| M10.1 | Hydration / SSR integrity — load /projects, /library, /recipes, /tools; fail on any hydration console error | `qa_hydration.spec.ts` | cross-cutting | ✅ Pass (guards B5) |
| M11.1 | Dashboard PLANNER — tap a day cell on the rail's mini calendar → add-event form → new event shows in UPCOMING | `qa_dashboard_workspace.spec.ts` | v2 | ✅ Pass (see B6) |
| M11.2 | Project PAGE "+ ADD UNIT" → `/dashboard?open=<id>` reopens the INSPECTOR panel → "+ Sub-project" → Unit → flip tabs → PROGRESS stepper bump (army roll-up, commit f012be2) | `qa_dashboard_workspace.spec.ts` | v2 | ✅ Pass (see B6, B7) |
| M12.1 | Project page — "+ Create" mints an attached recipe → editor `?from=<id>` → "‹ back to <project>" return | `qa_project_recipe.spec.ts` | v2 | ✅ Pass (see B6) |
| M12.2 | Project page — "+ Attach" opens RecipePickerDialog → attach an existing recipe → dialog closes | `qa_project_recipe.spec.ts` | v2 | ✅ Pass (see B6) |
| UX-002 | Recipe slot picker — clicking a slot opens the full "Pick & Paint" toolset (wheel/library, match, dropper, layering) and assigns a paint | `qa_ux002_recipe_picker.spec.ts` | v2 | ✅ Pass (see B9) |
| M13.1 | Colour-first recipe generation — wheel "Generate Recipe" → preview dialog (tinted ramps grounded to real paints) → Save → new recipe carries the generated technique notes | `qa_generate_recipe.spec.ts` | v2 | ✅ Pass |

**Mutation coverage applied in M5.1:** isolated browser contexts (Alice vs Bob),
unauthenticated public read, cross-account hop, clone-independence assertion
(new id, source `publicSlug` not carried).

**Mutation coverage applied in M7.1:** session-bound import scope (each Run
mints a fresh user), parser metadata visible in preview (parser used +
confidence band), editable-form round-trip (form pre-populated from parsed
tree + applied tree lands as projects).

**Project matrix (`playwright.config.ts`):** `chromium` (desktop) runs M1–M5
+ M7; `chromium-mobile` (iPhone 12 viewport) runs M6.1–M6.3. Both auto-boot
the dev server with `ALLOW_TEST_AUTH=1` via the `webServer` block.

---

## Integration Missions (server actions — in-memory libsql)

One mission per action module. Each asserts creation, mutation, ownership
scoping, and input validation against a fresh per-test DB.

| # | Run (action module) | File | Phase | Status |
|---|---------------------|------|-------|--------|
| IM1 | Stage counters — set / bump / cascade | `counters.test.ts` | P1 | ✅ Pass |
| IM2 | Projects — create / rename / delete / nest | `projects.test.ts` | P1 | ✅ Pass |
| IM3 | Named models — add / stage cascade / delete | `namedModels.test.ts` | P1 | ✅ Pass |
| IM4 | Inventory — set owned count / toggle wishlisted / mark purchased | `inventory.test.ts` | P2 | ✅ Pass |
| IM5 | Mark bought (Flow 9) — new project + existing unit paths | `markBought.test.ts` | P2 | ✅ Pass |
| IM6 | Wishlist — add / resolve kit / remove | `wishlist.test.ts` | P2 | ✅ Pass |
| IM7 | Recipes — create / attach / rename / delete | `recipes.test.ts` | P3 | ✅ Pass (1 skip: cascade-delete placeholder) |
| IM8 | Recipe zones — add / update / delete / reorder | `recipeZones.test.ts` | P3 | ✅ Pass |
| IM9 | Recipe steps — add / update / delete / reorder, paint↔custom-hex exclusivity | `recipeSteps.test.ts` | P3 | ✅ Pass |
| IM10 | Palettes — create / rename / delete | `palettes.test.ts` | P4 | ✅ Pass |
| IM11 | Send palette → recipe (P4 ship criterion) — new recipe + append + validation | `sendToRecipe.test.ts` | P4 | ✅ Pass |
| IM12 | Recipe sharing — publish (idempotent) / unpublish / getRecipeBySlug / clone (deep-copy, "already yours", rename collisions, source-untouched) | `recipeSharing.test.ts` | P5 | ✅ Pass |
| IM13 | Export all user data — top-level keys present, owner-scoped (no cross-user bleed) | `exportData.test.ts` | P5 | ✅ Pass |
| IM14 | Imports — schema round-trip (P7.1) + createTextImport + fetchImportForPreview + applyImport (P7.6, P7.7) | `imports.test.ts` | P7 | ✅ Pass |
| IM15 | Credentials sign-up + sign-in (P9.2) — happy path, duplicate username, weak password, reserved word, casing, no-password legacy guard | `signUp.test.ts` | P9 | ✅ Pass |
| IM16 | Recovery email (P9.5) — add, pending, verify-token round-trip, expired-token cleanup, resend, remove | `recoveryEmail.test.ts` | P9 | ✅ Pass |
| IM17 | Password reset (P9.6) — happy path + enumeration safety (unknown user / no recovery email / unverified email all silently ok) + token consumption + expired + weak-password rejection | `passwordReset.test.ts` | P9 | ✅ Pass |
| IM18 | Finish account migration shim (P9.7) — legacy magic-link account → completes setup, idempotent, preserves pre-existing recoveryEmail | `finishAccount.test.ts` | P9 | ✅ Pass |

---

## Unit Missions (pure functions)

| # | Run (module) | File | Phase | Status |
|---|--------------|------|-------|--------|
| UM1 | Progress %, aggregate counters, displayStatus | `lib/progress.test.ts` | P1 | ✅ Pass |
| UM2 | Stage-counter cascade helpers | `lib/counters/cascade.test.ts` | P1 | ✅ Pass |
| UM3 | Named-model stage cascade (applyToggle / labelFor) | `lib/namedModels/cascade.test.ts` | P1 | ✅ Pass |
| UM4 | Quick-add parser (`"Necron Warriors x20"`) | `lib/quickAdd.test.ts` | P2 | ✅ Pass |
| UM5 | Global search ranker | `lib/search.test.ts` | P2 | ✅ Pass |
| UM6 | Paint filters | `lib/paints/filters.test.ts` | P2 | ✅ Pass |
| UM7 | Paint filter URL read/write (search params) | `lib/paints/filterUrl.test.ts` | P2 | ✅ Pass |
| UM8 | Paint sort | `lib/paints/sort.test.ts` | P2 | ✅ Pass |
| UM9 | Scrape dispatcher (vendor routing) | `lib/scrape/dispatcher.test.ts` | P2 | ✅ Pass |
| UM10 | Open Graph fallback parser | `lib/scrape/og.test.ts` | P2 | ✅ Pass |
| UM11 | Vendor parsers (against cached fixtures) | `lib/scrape/parsers.test.ts` | P2 | ✅ Pass |
| UM12 | Scrape util | `lib/scrape/util.test.ts` | P2 | ✅ Pass |
| UM13 | Kit inference | `lib/wishlist/kitInference.test.ts` | P2 | ✅ Pass |
| UM14 | Colour-wheel harmonies | `lib/tools/wheel/harmonies.test.ts` | P4 | ✅ Pass |
| UM15 | Delta E 2000 colour difference | `lib/tools/wheel/deltaE.test.ts` | P4 | ✅ Pass |
| UM16 | K-means dominant-colour clustering | `lib/tools/wheel/kmeans.test.ts` | P4 | ✅ Pass |
| UM17 | Colour interpolation (gradient builder) | `lib/tools/wheel/interpolate.test.ts` | P4 | ✅ Pass |
| UM18 | Closest-paint match (classifyConfidence / findClosestPaints) | `lib/tools/match/find.test.ts` | P4 | ✅ Pass |
| UM19 | Palette validation (normaliseHex / validatePaletteColors) | `lib/palettes/cascade.test.ts` | P4 | ✅ Pass |
| UM20 | Recipe → Markdown formatter (brand/custom-mix/no-paint/notes/footer/empty-zone/whitespace-hex) | `lib/recipes/markdown.test.ts` | P5 | ✅ Pass |
| UM21 | Public slug generator (alphabet, length 10, uniqueness) | `lib/recipes/slug.test.ts` | P5 | ✅ Pass |
| UM22 | Native Web Share helper (capability detect / payload shape) | `lib/share/webShare.test.ts` | P6 | ✅ Pass |
| UM23 | Plain-text army-list parser + confidence + 5 format fixtures (WTC, NewRecruit, Goonhammer, hand-typed, messy) | `lib/imports/textParser.test.ts` | P7 | ✅ Pass |
| UM24 | PDF text extraction (5 MB / 50-page caps, scanned-PDF rejection, corrupt-buffer rejection) | `lib/imports/pdfExtractor.test.ts` | P7 | ✅ Pass |
| UM25 | BattleScribe `.ros` + `.rosz` parser (model-count summation, costs, faction, malformed-XML guard) | `lib/imports/battleScribeParser.test.ts` | P7 | ✅ Pass |
| UM26 | LLM-fallback parser (mocked client; fence stripping, prose salvage, malformed-unit filter, oversized-input gate, missing-key fallback) | `lib/imports/llmFallbackParser.test.ts` | P7 | ✅ Pass |
| UM27 | bcryptjs password helper — hash round-trip, hash mismatch, empty / malformed inputs, salting | `lib/auth/password.test.ts` | P9 | ✅ Pass |
| UM28 | Username + password validators — character rules, length floors, reserved words, normalisation | `lib/auth/validation.test.ts` | P9 | ✅ Pass |
| UM29 | Logo primitive — alt text, src, blend-mode class, responsive default, decorative variant, width override | `lib/components/Logo.test.ts` | P9 | ✅ Pass |
| UM30 | StatusBar — formatTime shape, TONE_COLOR token map, SSR determinism contract (`SSR_NET_STATUS` / `CLOCK_PLACEHOLDER` constants) | `lib/components/StatusBar.test.ts` | P8 | ✅ Pass |

---

## Bug Log (EXPLORER → REPRODUCER → FIXER)

Bugs surfaced during this test campaign, with evidence and resolution.

### B1 — M5.1 selector misses the empty-state create button
- **Mission:** M5.1 (`qa_share_recipe.spec.ts`)
- **Symptom:** 30s timeout — `getByRole("button", { name: /New recipe/i })` never resolved.
- **Explorer:** A fresh account lands on `/recipes` empty state, which renders the
  create affordance as `[ + ] Create your first recipe` (`NewRecipeButton` with a
  custom `label`), not the default `[ + ] New recipe`. Test-side bug, not an app bug.
- **Fixer:** Broadened the selector to `/New recipe|Create your first recipe/i`.
- **Verified:** Recipe now creates; mission advances past step 1.

### B2 — Share-button trigger has no accessible name (a11y)
- **Mission:** M5.1 (`qa_share_recipe.spec.ts`)
- **Symptom:** Timeout — `getByRole("button", { name: /share recipe/i })` never resolved.
- **Explorer:** `ShareButton` rendered `<button title="Share recipe">[ share ]</button>`.
  The accessible name comes from the text content (`[ share ]`); `title` is only a
  tooltip. A screen reader announces "left-bracket share right-bracket" — a real a11y
  defect, and the reason the role+name query failed.
- **Fixer:** Added `aria-label="Share recipe"` to the trigger (app fix,
  `src/components/recipes/ShareButton.tsx`).
- **Verified:** M5.1 passes end-to-end; accessible name now "Share recipe".

### B3 — Migration regression: B1/B2 + markdown tests dropped in the standalone split
- **Mission:** M5.1 + UM20 (`qa_share_recipe.spec.ts`, `lib/recipes/markdown.test.ts`)
- **Symptom (2026-05-29):** First full run in the new standalone repo failed M5.1
  at the exact B1 point (`/New recipe/i` timeout); `markdown.test.ts` was back to
  4 tests. The repo split carried `MISSIONS.md` but not the 2026-05-28 code fixes.
- **Explorer:** Confirmed the M5 surface itself is unchanged post-P6.9 (empty-state
  label `[ + ] Create your first recipe` and `ShareButton` still mounted in
  `RecipeHeader`) — so it was a lost-diff regression, not new drift.
- **Fixer:** Re-applied all three: the M5.1 selector, the `ShareButton` `aria-label`,
  and the markdown brand-less / whitespace-hex branch tests.
- **Verified:** 8/8 E2E pass; Vitest 369 pass · 1 skip; `tsc` 0 errors.

### B4 — M5.1 publish disabled by `isUnnamed` guard on a brand-new recipe
- **Mission:** M5.1 (`qa_share_recipe.spec.ts`)
- **Symptom (2026-05-30, mid-Phase 7 verification):** Alice creates a recipe,
  opens the share modal, but `[ publish ]` is permanently disabled — the
  `getByRole("button", { name: /^\[ publish \]$/i }).click()` step exhausts the
  30s retry window. Suite was claimed green at the start of Phase 7 but B3's
  recovery sweep didn't touch this path.
- **Explorer:** Page snapshot shows the recipe lands as "Untitled recipe" with
  an empty `<input>`. `ShareModal` (P5) gates publish behind `!isUnnamed`,
  defined as `recipeName.trim() === "" || recipeName.trim() === "Untitled
  recipe"` — a deliberate UX guard so painters can't ship anonymous recipes.
  The test predates that guard: it skipped naming the recipe and relied on a
  pre-guard ShareModal version, hence the failing click.
- **Fixer:** Test-side. Filled the "Recipe name" textbox between landing on
  `/recipes/<id>` and opening the share modal, then blurred to trigger the
  autosave (the recipe name auto-saves on blur per P3.2 `renameRecipe`).
- **Verified:** Full E2E suite 9/9 green (M1.1, M2.1, M3.1, M4.1, M5.1,
  M6.1–3, M7.1).

### B5 — StatusBar hydration mismatch: server `NET · OFF` vs client `NET · ON`
- **Mission:** M10.1 (`qa_hydration.spec.ts`) — new regression guard.
- **Symptom (2026-05-31):** Full E2E run stayed green, but the dev-server log
  emitted a React hydration error at `StatusBar.tsx:114` — server rendered the
  NET segment as `OFF` (`--status-danger`), the browser hydrated it to `ON`
  (`--status-ok`). Hydration mismatches silently discard the server HTML and
  re-render on the client (flicker + perf cost) and never fail an assertion, so
  the rest of the suite never noticed.
- **Explorer:** `useNetStatus` initialised state from
  `typeof navigator !== "undefined" && !navigator.onLine`. Modern Node (the
  Next 16 server runtime) exposes a **global `navigator` whose `onLine` is
  `undefined`**, so the guard passes and `!undefined` is `true` → server renders
  `OFF`. The browser's real `navigator.onLine` is `true` → `ON`. Same latent
  class in `useClock` (server clock ≠ client clock to the second).
- **Fixer:** App fix in `src/components/StatusBar.tsx`. Render deterministic
  first-paint values that server + client agree on (`SSR_NET_STATUS = "ON"`,
  `CLOCK_PLACEHOLDER = "--:--:--"`), then correct to the real connectivity /
  time inside `useEffect` after mount. Locked with a unit "SSR determinism
  contract" (UM30) + the M10.1 console-error guard.
- **Verified:** 15/15 E2E green, no hydration line in the server log; Vitest
  544 pass · 1 skip; `tsc` 0 errors.

---

### B6 — E2E create-project helper needed updating for the v2 HEX.CODE flow (suite-wide)
- **Mission:** M3.1, M3.2, M11.*, M12.1/2 (`qa_project_workspace`, `qa_dashboard_workspace`, `qa_project_recipe`) + M6.2 (`qa_mobile_flows`)
- **Not a regression.** Confirmed with Ross: combining create + rename into the
  project's own panel (dropping the separate RF-8 Name/model-count mini-form) was
  a **deliberate v2 redesign decision** — the old form was redundant with the
  panel/page content once the project already exists. This entry documents the
  test-side rework, not an app defect.
- **Symptom (2026-07-02, first e2e run on `redesign/v2-hexcode`):** the shared
  `addProject(name, count)` helper timed out at the `+ New Project` click — the
  old Name mini-form never appears anymore.
- **Explorer:** "+ New project" (`DashboardClient.handleAddProject`, roster-header
  icon button, accessible name **"New project"**) now calls
  `createProject({ name: "New Project", type: "Army", count: 0 })`
  **immediately** and opens the project's editable **INSPECTOR** panel
  (`ProjectPanelStack` → `ProjectWorkspaceBody`'s DETAILS section, which carries
  the "Name" field) — no mini-form. Separately, a plain row click no longer
  navigates at all (the earlier "PP-1" contract) — it opens a *different*
  overlay, the Army/Unit **FLOW panel** (`ProjectFlowPanel`, `role="dialog"`),
  which has no rename field; reaching the full project PAGE now goes through
  that panel's "⤢ Open full page" affordance. There is also no UI path left to
  set an arbitrary model count at creation — an Army's total now **rolls up**
  from its Units (commit f012be2), each created via "+ Add unit" with a fixed 1
  model, so missions needing a non-zero count add a Unit rather than passing a
  `count` argument.
- **Fixer (test-side):** Reworked `addProject(page, name)` in all four specs to:
  click "New project" (exact match — disambiguates from the "+ NEW PROJECT" text
  button, which also substring-matches) → wait for the INSPECTOR's "Name" field
  → fill + blur (commits via `updateProjectName` on blur) → confirm the
  `Manage <name>` row → close via "Close project inspector" (desktop) / "Back"
  after expanding the mobile DETAILS section (`ProjectBottomSheet`, where DETAILS
  starts collapsed below `md`). Added a matching `openProjectPage(page, name)`
  helper (click the row → `role="dialog"` FLOW panel → "⤢ Open full page" →
  `/projects/<id>`). Rewrote M3.1/M6.2's FOCUS-bench assertions to create a Unit
  first (0/1 → 1/1) instead of asserting a top-level count the UI can no longer
  set. Rewrote M11.2 around the real `/dashboard?open=<id>` deep link (see B7)
  and the INSPECTOR's tab-strip drill-down instead of the old page-based
  "+ Sub-project" flow.
- **Verified:** M3.1, M3.2, M11.1, M11.2, M12.1, M12.2, M6.2 all green.

### B7 — `/dashboard?open=<id>` deep link from the project PAGE was unwired (app fix)
- **Mission:** M11.2 (`qa_dashboard_workspace.spec.ts`)
- **Severity:** High — a core "add sub-project from the project page" entry
  point was a dead end.
- **Explorer:** `ProjectPageClient`'s "+ ADD UNIT" header button and "+ Add
  Sub-Project" footer button both `router.push(\`/dashboard?open=${project.id}\`)`.
  `DashboardClient` only ever read `searchParams.get("tour")` — the `open` param
  was never consumed, so clicking either button silently landed on a plain
  dashboard with nothing open. `updateProjectCount` (a would-be model-count
  setter) is similarly unreferenced by any component — confirmed dead, left
  alone (out of scope; no UI currently needs it since counts roll up from Units).
- **Reproducer:** 3/3 — every visit to `/projects/<id>` → "+ ADD UNIT" → lands on
  `/dashboard` with no panel open, param silently dropped.
- **Fixer:** `src/app/(app)/dashboard/DashboardClient.tsx` — added a second
  `useEffect` mirroring the existing `tour=create` handler: reads
  `searchParams.get("open")`, feeds it into the same `openId` state the create
  flow already uses (which requires no extra plumbing — `DashboardView`'s
  `openProjectId` effect just needs the id to resolve in the already-loaded
  tree, true here since the project already exists), then strips the param via
  `router.replace("/dashboard")`.
- **Verified:** M11.2 now drives "+ ADD UNIT" → the INSPECTOR panel reopens on
  the right project, scrolled to SUB-PROJECTS with "+ Sub-project" visible.

### B8 — Next.js dev indicator overlaps the mobile bottom-nav "More" tab (app fix)
- **Mission:** M6.1 (`qa_mobile_flows.spec.ts`)
- **Severity:** Medium — blocks a primary mobile nav control in dev (this
  affects Ross testing on a real phone against the dev server too, not just CI).
- **Explorer:** `next.config.ts`'s `devIndicators: { position: "bottom-right" }`
  (from an earlier fix, DOP-016/MUX-013, that stopped the dev/preview badge
  compositing over the desktop sidebar's "REPORT AN ISSUE" text) puts the same
  circular "N" badge exactly where the persistent bottom-nav's "More" tab sits
  on phone-width viewports (MUX-001) — there's no corner safe on both
  breakpoints. Screenshot evidence: the badge visibly sits on top of the "More"
  label at 390px width.
- **Reproducer:** 3/3 — `navigateViaMore`'s retry-click loop exhausts its 30s
  budget because every click lands on the (non-navigating) dev-tools badge, not
  the "More" button underneath it.
- **Fixer:** `next.config.ts` — `devIndicators: false` (Next 15.1+ supports
  disabling it outright). Dev-only chrome; never shipped to production, so this
  has no production impact.
- **Verified:** M6.1 green; the badge is gone from both breakpoints in dev.

### B9 — Recipes area rebuilt as the RecipeWorkbench 3-pane master-detail (test-side)
- **Mission:** M4.1, M5.1, UX-002 (`qa_tools`, `qa_share_recipe`, `qa_ux002_recipe_picker`)
- **Explorer:** `/recipes` now renders `RecipeWorkbench` (Figma 28:4) — a 320px
  LIST column (h1 text "RECIPES <count>", not "RECIPE") + an inline DETAIL
  column that populates in place when a list row is clicked (no navigation to
  `/recipes/<id>`). "+ NEW" (unconditional, no more "+ Create your first
  recipe" empty-state variant) still routes to the dedicated `/recipes/new`
  editor page (`RecipeEditorClient`/`RecipeEditorView`, unchanged: "RECIPE
  EDITOR" h1, "Recipe name" field), whose save button is now "Save Recipe" (not
  "Save") and returns to `/recipes`. The WORKbench's own detail column has an
  independent "⬡ SHARE LINK" share affordance (distinct casing/glyph from the
  editor page's "⛓ Share Link" — both call the same `publishRecipe` action).
  List rows are one `<button>` whose accessible name concatenates the recipe
  name AND its "Used in N projects · M steps" meta line, so exact-name matching
  breaks. Separately, the slot-picker dialog (`RecipePaintPicker`) is titled
  "Pick & Paint", not "Pick a paint", and its trigger button reads "+ Add Step"
  (was "+ Add slot").
- **Fixer (test-side):** Updated heading assertions to `/^RECIPES/`; M5.1 now
  clicks "+ NEW" → saves via "Save Recipe" → selects the saved row by a
  name-prefix regex (not `exact: true`) → publishes via the workbench's "⬡
  SHARE LINK" (no more navigating into `/recipes/<id>`). UX-002 now opens "+ Add
  Step" and asserts the "Pick & Paint" dialog title.
- **Verified:** M4.1, M5.1, UX-002 all green.

### B10 — Credentials auth screens renamed + an SSR hydration race under load (test-side)
- **Mission:** M9.3, M9.4 (`qa_credentials_signup`, `qa_credentials_signin`)
- **Explorer:** `AuthView`'s boot-line copy changed — sign-up now leads with an
  h1 "Create account" (was "NEW USER REGISTRATION"), sign-in with "Sign in"
  (was "AWAITING CREDENTIALS"). Separately, under heavy 8-worker parallel dev
  -server load, filling + submitting the form before React attaches its
  `onSubmit` listener falls through to the plain `<form>` element's native GET,
  reflecting the fields onto the URL (`/sign-up?username=...&password=...`),
  losing all typed state, and hanging the test on a redirect that never comes —
  a real (if narrow, automation-speed-only) robustness gap, not something a
  real user is likely to hit at normal click cadence. 100% reliable serially
  (~1s); only flaked under full parallel runs.
- **Fixer (test-side):** Updated the boot-line assertions to the new headings.
  Added a `waitForHydration()` probe (both spec files) that toggles "Reveal
  characters" (UX-015, itself worth covering) and waits for the password field
  to actually flip to `type=text` before filling the form — proves the page is
  interactive first, cheaply, without `waitForLoadState('networkidle')`. The
  probe's own click is retried the same way every other "guards a pre-hydration
  click" spot in this suite already does. Also bumped the create-account round
  trip's budget (bcrypt hashing is deliberately slow) to 45–60s to absorb
  legitimate load, mirroring the MM-test-1 precedent elsewhere in this doc.
- **Verified:** M9.3, M9.4 green across repeated full-suite runs (2 consecutive
  23/23 desktop passes with 8 workers).

### B11 — Collection page rebuilt as a spreadsheet-style table (test-side)
- **Mission:** M2.1 (`qa_collections.spec.ts`)
- **Explorer:** The "+ Add paint" trigger button is gone — `CollectionTable`'s
  section header now reads "+ PAINT" (there's also a dashed "+ Add paint row"
  ghost-row at the table's bottom; both call the same `onAddPaint`). The
  `PromptDialog` itself is unchanged ("Add paint" title, `prompt-value` input).
  Separately, `CollectionTable` mounts BOTH the <900px card list and the ≥md
  table simultaneously (CSS toggles which is visible), so a newly-added row's
  name text exists twice in the DOM, tripping `exact: true` strict-mode.
- **Fixer (test-side):** Updated the add-button selector to `/^\+ PAINT$/i`;
  scoped the persisted-row assertion to `.last()` (the desktop table copy,
  which DOM-order-wise renders after the mobile card list).
- **Verified:** M2.1, M2.2 green.

### B12 — Dashboard import trigger button text shortened (test-side)
- **Mission:** M7.1 (`qa_imports.spec.ts`)
- **Explorer:** The dashboard's trigger button now reads "⬆ Upload Army" (the
  "List" suffix was dropped); the slide-out panel it opens keeps the fuller
  "Upload Army List" title, so only the trigger-button selector needed
  broadening.
- **Fixer (test-side):** `/Upload Army List/i` → `/Upload Army/i` for the
  trigger button; the panel's own selector (`/Upload Army List/i`) was already
  correct and unchanged.
- **Verified:** M7.1 green.

### B13 — Mobile roster card nests an interactive PriorityDropdown (test-side)
- **Mission:** M6.2 (`qa_mobile_flows.spec.ts`)
- **Explorer:** Below `md`, `ProjectsTable` renders each project as a stacked
  card (title row → type/priority/time meta row → progress bar), all inside ONE
  `role="button" aria-label="Manage <title>"` region. The meta row's
  `PriorityDropdown` is a nested interactive control **by design** — so
  priority is changeable without opening the project. A plain Playwright
  `.click()` targets the element's geometric center, which on this vertically
  -stacked card lands on that dropdown (near the card's vertical midpoint), not
  the card body — reproduced live (opened a "MED ▲ / HIGH" priority popup
  instead of the FLOW panel).
- **Fixer (test-side):** `.click({ position: { x: 12, y: 12 } })` — aims at the
  card's top-left title corner, which is never inside the nested dropdown's
  bounding box, regardless of card height (variable per project's meta
  content). Not an app defect: nesting the dropdown is intentional, real
  fingertip taps land wherever the user actually touches, not a computed
  center.
- **Verified:** M6.2 green.

## Coverage gaps closed this campaign

New tests written to fill phase gaps the build left behind:

| Phase | Added | File |
|---|---|---|
| P2 | Inventory action tests | `integration/actions/inventory.test.ts` |
| P2 | Mark-bought (Flow 9) tests | `integration/actions/markBought.test.ts` |
| P1 | Named-model cascade unit tests | `unit/lib/namedModels/cascade.test.ts` |
| P2 | Filter-URL unit tests | `unit/lib/paints/filterUrl.test.ts` |
| P3 | Recipe zones / steps action tests | `integration/actions/recipeZones.test.ts`, `recipeSteps.test.ts` |
| P4 | Palette validation + closest-match unit tests | `unit/lib/palettes/cascade.test.ts`, `unit/lib/tools/match/find.test.ts` |
| P4 | Palettes + send-to-recipe action tests | `integration/actions/palettes.test.ts`, `sendToRecipe.test.ts` |
| P5 | Markdown brand-less + whitespace-hex branches | `unit/lib/recipes/markdown.test.ts` |

---

## Summary counts

| Mission group | Runs | Pass | Skip | Fail |
|---|---|---|---|---|
| E2E desktop (M1.1–M12.2, M8.1–8.2, UX-002) | 23 | 23 | 0 | 0 |
| E2E mobile (M6.1–M6.3) | 3 | 3 | 0 | 0 |
| Integration | 35 files | 393 | 5 | 0 |
| Unit | 57 files | 609 | 0 | 1 (pre-existing, unrelated — `sw/strategy.test.ts`) |
| **Vitest total** | **92 files** | **1002 tests** | **5 tests** | **1 test (pre-existing, unrelated)** |
| Bugs found / fixed this campaign (2026-07-02) | 8 (B6–B13) | — | — | 0 open |

**2026-07-02 campaign detail:** B6 (create-project flow — confirmed intended,
test-side rework), B7 (`/dashboard?open=<id>` dead link — **app fix**), B8
(Next.js dev indicator blocking the mobile "More" tab — **app fix**), B9
(RecipeWorkbench redesign — test-side), B10 (auth heading rename +
hydration-race hardening — test-side), B11 (Collection page rebuild —
test-side), B12 (import trigger button text — test-side), B13 (mobile roster
card click-position — test-side). See the Bug Log above for each entry.

---

## Known untested surfaces (non-blocking)

Browser-only / read-only code not covered by the layered suite — none block a
phase ship criterion:

- `src/lib/eyedropper/sample.ts` — canvas pixel sampling (browser-only).
- `src/components/recipes/QrCode.tsx` — SVG render (verified via M5.1 visually).
- `src/app/r/[slug]/clone/route.ts` — POST route handler (exercised end-to-end by M5.1).
- Most of `src/db/queries/recipes.ts` read helpers — exercised indirectly via E2E.

---

## How to use this log

- **Run a layer:** `npm test` (unit+integration), `npm run test:e2e` (Playwright).
- **Re-run one mission:** `npx playwright test qa_share_recipe` (or any spec stem).
- **On a FAIL:** open a Bug Log entry (B-series), capture the EXPLORER finding,
  write/confirm the failing test, fix, re-verify, flip Status to ✅ Pass.
- **New mission:** add a row in the relevant layer table; tag its phase; for E2E
  apply the mutation checklist (empty input, long string, double-click, refresh
  mid-save, multi-tab/context).
