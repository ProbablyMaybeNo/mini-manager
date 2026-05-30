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

**Headline result (last full run — 2026-05-29, standalone repo `D:\AI-Workstation\mini-manager`):**

| Layer | Files | Tests | Result |
|---|---|---|---|
| Unit + Integration (Vitest) | 35 | 369 pass · 1 skipped | ✅ green |
| E2E (Playwright — chromium desktop + chromium-mobile) | 6 | 8 pass | ✅ green |
| `tsc --noEmit` | — | — | ✅ 0 errors |

> **Repo migration note (2026-05-29):** the project was split out of the
> `Antigravity/apps/Paint-planner/app` monorepo into a flat standalone repo.
> The doc was rescued, but the 2026-05-28 *code* fixes (B1, B2, and the markdown
> branch tests) did **not** survive the migration — they were re-applied and
> re-verified here. See Bug Log **B3**.

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

**Mutation coverage applied in M5.1:** isolated browser contexts (Alice vs Bob),
unauthenticated public read, cross-account hop, clone-independence assertion
(new id, source `publicSlug` not carried).

**Project matrix (`playwright.config.ts`):** `chromium` (desktop) runs M1–M5;
`chromium-mobile` (iPhone 12 viewport) runs M6.1–M6.3. Both auto-boot the dev
server with `ALLOW_TEST_AUTH=1` via the `webServer` block.

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
| E2E desktop (M1–M5) | 5 | 5 | 0 | 0 |
| E2E mobile (M6.1–M6.3) | 3 | 3 | 0 | 0 |
| Integration (IM1–IM13) | 13 modules | 13 | 0 (1 test skip in IM7) | 0 |
| Unit (UM1–UM22) | 22 modules | 22 | 0 | 0 |
| **Vitest total** | **35 files** | **369 tests** | **1 test** | **0** |
| Bugs found / fixed | 3 | — | — | 0 open |

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
