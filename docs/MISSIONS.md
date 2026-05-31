# Mini Manager — Test Missions Log

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

**Headline result (last full run — 2026-05-31, standalone repo `D:\AI-Workstation\mini-manager`):**

| Layer | Files | Tests | Result |
|---|---|---|---|
| Unit + Integration (Vitest) | 52 | 544 pass · 1 skipped | ✅ green |
| E2E (Playwright — chromium desktop + chromium-mobile) | 11 | 15 pass | ✅ green |
| `tsc --noEmit` | — | — | ✅ 0 errors |

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

---

## E2E Missions (Playwright `qa_*.spec.ts`)

The live, full-stack missions — the closest analogue to campaign-console's
in-browser runs. Each mints its own session via `signInAs(freshTestEmail())`.

| # | Run | Spec | Phase | Status |
|---|-----|------|-------|--------|
| M1.1 | Library quick-lookup — navigate → search → open detail panel | `qa_library.spec.ts` | P2 | ✅ Pass |
| M2.1 | Wishlist quick-add — manual entry → row appears | `qa_wishlist.spec.ts` | P2 | ✅ Pass |
| M3.1 | Project workspace lifecycle — create Unit → bump Build stage → persists across refresh | `qa_project_workspace.spec.ts` | P1 | ✅ Pass |
| M4.1 | Tools — landing → colour wheel → "send to recipe" modal opens | `qa_tools.spec.ts` | P4 | ✅ Pass |
| M5.1 | Share + Clone — Alice publishes a recipe → Bob (fresh context) opens the public URL unauthenticated → signs in → clones → lands on his own copy | `qa_share_recipe.spec.ts` | P5 | ✅ Pass (bugs B1, B2 — re-applied after migration, see B3) |
| M6.1 | Mobile — bottom tab bar visible and navigates (iPhone 12 viewport / chromium-mobile) | `qa_mobile_flows.spec.ts` | P6 | ✅ Pass |
| M6.2 | Mobile — create Unit project → bump stage → reload persists | `qa_mobile_flows.spec.ts` | P6 | ✅ Pass |
| M6.3 | Mobile — library lookup → detail panel renders without clipping | `qa_mobile_flows.spec.ts` | P6 | ✅ Pass |
| M7.1 | Imports — paste plain-text list → preview tree → apply → land on new Army workspace | `qa_imports.spec.ts` | P7 | ✅ Pass |
| M9.3 | Credentials sign-up — create account → land on /projects, plus reserved-username rejection | `qa_credentials_signup.spec.ts` | P9 | ✅ Pass |
| M9.4 | Credentials sign-in — sign up → sign out → sign back in lands on /projects, plus wrong-password rejection | `qa_credentials_signin.spec.ts` | P9 | ✅ Pass |
| M8.1 | Library view-mode toggle — list → grid, open detail panel from a swatch, persists across reload | `qa_library_view_toggle.spec.ts` | P2/P8 | ✅ Pass |
| M10.1 | Hydration / SSR integrity — load /projects, /library, /recipes, /tools; fail on any hydration console error | `qa_hydration.spec.ts` | cross-cutting | ✅ Pass (guards B5) |

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
| E2E desktop (M1–M5, M7, M8.1, M9.3–9.4, M10.1) | 12 | 12 | 0 | 0 |
| E2E mobile (M6.1–M6.3) | 3 | 3 | 0 | 0 |
| Integration (IM1–IM18) | 18 modules | 18 | 0 (1 test skip in IM7) | 0 |
| Unit (UM1–UM30) | 30 modules | 30 | 0 | 0 |
| **Vitest total** | **52 files** | **544 tests** | **1 test** | **0** |
| Bugs found / fixed | 5 | — | — | 0 open |

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
