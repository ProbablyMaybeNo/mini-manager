# Mini Manager — Testing Guide

A unified framework for agent-driven and human testing across three layers.

| Layer | Tool | What it covers | Speed |
|---|---|---|---|
| **Unit** | Vitest (node env) | Pure functions: scrape parsers, cascade rules, quickAdd parser, kit inference, search ranker, OG/price parsing, paint filters | <1s |
| **Integration** | Vitest (node env) + in-memory libsql | Server actions against a fresh DB per test: project / counter / wishlist / recipe action layers | ~5s |
| **E2E** | Playwright (chromium) | Real-browser Mission flows: Flow 7 / 8 / 9 from V2-BUILD-PLAN | ~10s+ |

Methodology adopted from the campaign-console project — see *Mission structure* §4.

---

## Table of Contents

1. [Quick start](#1-quick-start)
2. [Philosophy](#2-philosophy)
3. [Commands](#3-commands)
4. [Mission structure](#4-mission-structure)
5. [Unit tests](#5-unit-tests)
6. [Integration tests](#6-integration-tests)
7. [E2E tests](#7-e2e-tests)
8. [Bug workflow — EXPLORER → REPRODUCER → FIXER](#8-bug-workflow)
9. [Invariants](#9-invariants)
10. [Mission templates](#10-mission-templates)
11. [Agent quick reference](#11-agent-quick-reference)

---

## 1. Quick start

```bash
# From the repo root
npm test                  # Run unit + integration (Vitest)
npm run test:unit         # Pure-function tests only (<1s)
npm run test:integration  # DB-dependent action tests (~5s)
npm run test:watch        # Unit tests in watch mode
npm run test:ui           # Vitest browser UI
npm run test:coverage     # v8 coverage report → ./coverage/

# E2E (Playwright auto-boots a dev server with ALLOW_TEST_AUTH=1)
npm run test:e2e          # Headless chromium
npm run test:e2e:headed   # See the browser
npm run test:e2e:ui       # Playwright UI runner
npm run test:missions     # Alias for test:e2e (qa_*.spec.ts mission specs)
npm run test:verify       # FIGMA-rebuild gate: typecheck + unit + integration + e2e
npm run test:verify:fast  # Same without Playwright (while UI is in flux)
```

All commands run from the repo root (`D:\AI-Workstation\mini-manager\`).

---

## 2. Philosophy

**Adopted verbatim from the campaign-console project's working methodology:**

- **Test running software.** Every meaningful E2E result comes from interacting with the live app, not from reading source.
- **Refresh to verify persistence.** Any create / edit / delete must survive a `page.reload()` for the test to count as passed.
- **Screenshot or it didn't happen.** Playwright auto-captures on failure (`screenshot: "only-on-failure"`). For exploratory testing, capture on every significant action.
- **Mutations, not just happy paths.** Every mission applies stress mutations — empty input, long strings, double-click, rapid navigation, refresh mid-action, multi-tab.
- **Missions evolve.** New edge cases discovered during a run get added as new missions immediately, not after.

The three layers form a pyramid: **unit tests catch math and parser bugs; integration tests catch action-layer bugs; E2E catches "the UI doesn't actually wire the action through" bugs.** When in doubt, write the test at the lowest possible layer.

---

## 3. Commands

### From the repo root

```bash
# Vitest
npm test                       # both projects
npm run test:unit              # unit project only
npm run test:integration       # integration project only
npm run test:watch             # unit, watch mode
npm run test:ui                # vitest --ui
npm run test:coverage          # v8 coverage

# Playwright
npm run test:e2e               # headless
npm run test:e2e:headed        # visible browser
npm run test:e2e:ui            # playwright --ui

# Filter examples
npm test -- cascade            # only files matching 'cascade'
npm test -- -t "rejects"       # only test names matching 'rejects'
npx playwright test qa_wishlist  # one spec file
npx playwright test --grep "M2.1"  # one mission run
```

### Manual ad-hoc

```bash
# Skip the auto-started dev server (use an already-running one)
PLAYWRIGHT_SKIP_WEBSERVER=1 npm run test:e2e

# Point at a non-default base URL (local dev on a different port)
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3001 npm run test:e2e
```

### Testing against production (`https://miniaturemanager.vercel.app`)

**The Playwright E2E suite does NOT run against production by default — and shouldn't.** Here's why:

The E2E suite uses `tests/e2e/_helpers/auth.ts → signInAs()` which calls `POST /api/test/sign-in`. That route returns **404 in production** because `ALLOW_TEST_AUTH=1` is intentionally unset on Vercel. This is a security feature — no test back-door exists in prod, so a leaked URL can't sign anyone in.

What this means for the test agent:

| Scenario | Approach |
|---|---|
| **Regression suite (M1-M6)** | Always run locally via `npm run test:e2e`. The dev server boots with `ALLOW_TEST_AUTH=1`, all 8 missions work. |
| **Smoke checks against live prod** | Manual / Kapture-style exploratory. Sign in via real magic-link (Resend), then walk Flows 1-9 by hand. |
| **Public-only routes** | Some flows don't need auth and CAN be tested against prod: `/r/[slug]` (public recipe view), the `/sign-in` page itself (rendering only). For those: `PLAYWRIGHT_SKIP_WEBSERVER=1 PLAYWRIGHT_BASE_URL=https://miniaturemanager.vercel.app npx playwright test qa_share_recipe` would test the public-view portion (the auth-required clone step would still fail without test-auth). |
| **Pre-deploy gate** | Run full Vitest + E2E locally before pushing to main. Vercel auto-deploys, so a green local suite is the only gate before something hits production. |

**If a bug shows up in prod that doesn't show up locally:**
1. Reproduce on the live URL via the browser (don't try to make the E2E suite hit prod)
2. Capture: screenshot, browser console, Vercel runtime log entry, the exact URL + steps
3. Add a failing test at the lowest possible layer (unit → integration → E2E, in that priority order) — see `docs/MISSIONS.md` Bug Log format
4. Fix locally, verify the test now passes
5. Push — Vercel auto-deploys, then manually re-verify on prod

**Resend sandbox note:** while in beta (no custom domain on Resend yet), magic-link in prod ONLY delivers to the email registered on Ross's Resend account. Any other email = silent reject (403 from Resend). Don't waste time debugging "magic link didn't arrive" for arbitrary emails on prod.

---

## 4. Mission structure

### What is a Mission?

A Mission is a named, numbered test scenario with:
- A clear goal (what behaviour is being verified)
- A numbered list of **Runs** — specific action sequences
- A **Status** per run: `Pending` / `In Progress` / `Done` / `Fail` / `Skipped` / `Blocked`
- Notes on mutations applied and any failures found

Missions are intentionally broad enough to cover related behaviours but focused enough that one agent can complete a mission in a single session.

### Mission ID conventions

```
M1, M2, M3 …          Top-level missions (e.g. Auth, Wishlist, Recipes)
M1.1, M1.2, M1.3 …    Individual runs within a mission
M11, M12 …            New missions discovered during testing (appended)
```

### Mission tracker

The project's current mission table lives at `docs/MISSIONS.md`. New missions land there with status `Pending`. As an agent runs them, statuses change in place — this is the living record.

### Status lifecycle

```
Pending → In Progress → Done
                      → Fail   (open Evidence Bundle; add FIXER task)
                      → Skipped (reason documented)
                      → Blocked (dependency noted)
```

### Mutation checklist — apply 5+ per mission

- **Inputs:** empty string, very long string (500+ chars), emojis, special chars `<>'";&`, leading/trailing whitespace
- **Clicks:** double-click submit, rapid repeated clicks, click cancel mid-save
- **Navigation:** browser back/forward, refresh during load, refresh immediately after save
- **Multi-tab:** same record open in 2 tabs; edit in both; log out in one tab
- **Timing:** act immediately when UI appears — no artificial pauses

---

## 5. Unit tests

### Location & file convention

```
tests/unit/
├── _shims/
│   └── server-only.ts     ← stub for the `server-only` npm guard
└── lib/
    ├── counters/
    │   └── cascade.test.ts
    ├── quickAdd.test.ts
    ├── scrape/
    │   ├── og.test.ts
    │   └── parsers.test.ts
    └── wishlist/
        └── kitInference.test.ts
```

Each test file mirrors a source file under `src/lib/`. Add new tests by following the same path structure.

### What goes here

Anything pure-functional with no Next.js / DB / fetch dependency:
- Scrape parsers (use cached HTML fixtures in `tests/fixtures/vendors/`)
- Cascade validation rules
- Parsing/inference helpers (quickAdd, kitInference, parsePrice)
- Filter / sort / search rankers
- Pure transformations on Paint / Recipe data

### Adding a new scrape parser test

1. Capture a real product page with a Chrome UA (don't use the bot UA — vendors block it):
   ```bash
   UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
   curl -s -A "$UA" -L "<product-url>" -o tests/fixtures/vendors/<vendor>.html
   ```
2. Add a `describe()` block in `tests/unit/lib/scrape/parsers.test.ts`.
3. Assert title / image / price / currency / vendor / category.

### The `server-only` shim

`src/lib/scrape/*` and `src/db/queries/*` declare `import "server-only"`. Vitest's `vitest.config.ts` aliases the real package to an empty module so tests can import these modules in node env. The shim is at `tests/unit/_shims/server-only.ts`.

---

## 6. Integration tests

### Location & file convention

```
tests/integration/
├── _setup.ts             ← env flags (DATABASE_URL, NODE_ENV, AUTH_SECRET)
├── _helpers/
│   └── testDb.ts         ← makeTestDb() — fresh in-memory libsql + migrations + seeded user
└── actions/
    └── counters.test.ts  ← template for new action tests
```

### What goes here

Server actions that touch the DB. Each test gets its own in-memory libsql instance — total setup is ~30ms per test, so per-test isolation is fine.

### Boilerplate template

Copy this header into a new action test file. Adjust the action import. The three `vi.mock` calls plus `vi.hoisted` are required.

```ts
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb, type TestDb } from "../_helpers/testDb";

const state = vi.hoisted(() => ({
  db: null as TestDb | null,
  userId: "" as string,
}));

vi.mock("@/db/client", () => ({
  get db() {
    if (!state.db) throw new Error("Test DB not initialised in beforeEach");
    return state.db;
  },
}));

vi.mock("@/lib/auth-stub", () => ({
  currentUserId: async () => state.userId,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const { yourActionHere } = await import("@/lib/actions/yourActions");

beforeEach(async () => {
  const { db, userId } = await makeTestDb();
  state.db = db;
  state.userId = userId;
});

afterEach(() => {
  state.db = null;
  state.userId = "";
});

describe("yourActionHere", () => {
  // ... tests
});
```

### What to cover

Every server action should have at minimum:
- Happy path (success returns expected shape + persists in DB)
- Validation failure (zod / app-layer reject returns `{ ok: false, error }`)
- Ownership: a row belonging to user A is not mutable by user B
- Any cross-row constraint the action enforces (e.g. cascade, attach-once)

---

## 7. E2E tests

### Location & file convention

```
tests/e2e/
├── _helpers/
│   └── auth.ts        ← signInAs() + freshTestEmail()
└── qa_wishlist.spec.ts  ← M2 — Wishlist quick-add
```

Mirror the Mission ID in the filename — `qa_wishlist.spec.ts` covers `M2`, `qa_recipes.spec.ts` covers `M3`, etc.

### Auth bypass

The test-only route at `POST /api/test/sign-in` returns 404 unless `ALLOW_TEST_AUTH=1` is set in the env. `playwright.config.ts`'s `webServer` block sets this for you when Playwright launches the dev server. If you run Playwright against a manually-started dev server, restart it with that env var set.

Use the helper rather than re-implementing:

```ts
import { signInAs, freshTestEmail } from "./_helpers/auth";

test("M2.1 — manual entry from quick-add", async ({ page }) => {
  await signInAs(page, freshTestEmail());
  await page.goto("/wishlist");
  // ...
});
```

### Patterns

- **Unique data per test.** Use `freshTestEmail()` and `${Date.now()}-${random}` patterns so reruns don't collide.
- **Role-based selectors.** Prefer `page.getByRole("button", { name: /save/i })` over CSS classes (which the design system may move around).
- **Refresh to verify persistence.** After every save, `page.reload()` and re-assert.
- **Serial describes** (`test.describe.configure({ mode: "serial" })`) only when later tests genuinely depend on earlier state. Default to parallel-safe.

### Cross-account flows

For missions that simulate a second person on a different device (M5.1 share+clone is the canonical case), spawn a fresh `browser.newContext()`:

```ts
test("cross-account clone", async ({ browser }) => {
  const aliceCtx = await browser.newContext();
  const alicePage = await aliceCtx.newPage();
  await signInAs(alicePage, freshTestEmail("alice"));
  // ... publish a recipe in Alice's context

  const bobCtx = await browser.newContext(); // isolated cookies + storage
  const bobPage = await bobCtx.newPage();
  await bobPage.goto(publicUrl); // anonymous public visit
  await signInAs(bobPage, freshTestEmail("bob")); // Bob, not Alice
  // ... Bob clones

  await aliceCtx.close();
  await bobCtx.close();
});
```

The default `{ page }` fixture is enough for single-account tests; reach for `{ browser }` + manual contexts only when you need two distinct sessions inside one mission.

---

## 8. Bug workflow — EXPLORER → REPRODUCER → FIXER

When a mission run produces `Fail`, run the three-phase loop:

### Phase 1: EXPLORER

Identify the bug:
- Screenshot or note exact app state when the failure occurred (Playwright captures one automatically).
- Check the dev-server console + browser console for errors.
- Note the exact steps that triggered it.
- Classify severity: **Critical** / **High** / **Medium** / **Low** (see end of this doc).

### Phase 2: REPRODUCER

Confirm it's reproducible:
- Run the minimal steps that trigger the bug **3 times**.
- Document exact repro rate (e.g. 3/3, 2/3).
- Isolate to the smallest possible sequence of actions.

### Phase 3: FIXER

Fix and verify:
1. Write a **failing test** asserting the correct behaviour (test-first).
2. Apply the fix.
3. Confirm the test now passes.
4. Re-run the full mission that found the bug — must reach `Done`.
5. Run the full test suite — must stay green.

### Evidence Bundle format

Create a folder per bug:

```
docs/bug-YYYYMMDD-HHMM-short-title/
├── bug.md          Summary, severity, root cause
├── steps.md        Exact minimal repro steps (numbered)
├── console.txt     Browser/server console output at time of failure
├── state.json      Relevant DB rows / cookies / URL params
└── screenshots/    Visual evidence
```

`bug.md` template:

```markdown
**Title:** [Short description]
**Mission:** [e.g. M2.3]
**Severity:** Critical / High / Medium / Low
**Repro rate:** 3/3
**Root cause:** [One sentence]
**Fix:** [Commit SHA]
**Test:** [Test file and test name]
```

---

## 9. Invariants

Check these after every meaningful action in an E2E test — a violation is a `Fail`:

| Invariant | How to check |
|---|---|
| No JS console errors | Wrap actions in `page.on("console", ...)` listeners |
| No failed network requests | `page.on("requestfailed", ...)` |
| No stuck spinner > 8s | Default Playwright timeout catches this |
| Data persists after refresh | `await page.reload()` then re-assert |
| No duplicate list items | Count rows after a navigation loop |
| Auth gating correct | Try to GET a protected route as unauth user → expect redirect to /sign-in |
| typecheck passes | `npm run typecheck` exits 0 |

---

## 10. Mission templates

### 10.1 New mission

```markdown
## MN — [Name]

**Goal:** [What behaviour this mission verifies]
**Prerequisite:** [App running, signed in as Test User]

| # | Run | Steps | Status |
|---|-----|-------|--------|
| MN.1 | [Happy path] | [Numbered steps] | Pending |
| MN.2 | [Edge case] | [Numbered steps] | Pending |
| MN.3 | [Mutation] | [E.g. double-click submit] | Pending |

**Mutations to apply:** empty input / long string / double-click / refresh mid-save / multi-tab
**Invariants:** No console errors; data persists after refresh
```

### 10.2 New mission discovered during a run

When a run uncovers an untested scenario, immediately append to `docs/MISSIONS.md`:

```markdown
## M[next] — [Short name] *(discovered during M[source] on YYYY-MM-DD)*

| # | Run | Steps | Status |
|---|-----|-------|--------|
| M[next].1 | [New scenario] | [Steps] | Pending |
```

---

## 11. Agent quick reference

### Run a session

```
1. Pull latest main
2. cd app
3. npm install (only if package.json changed)
4. npm test                 ← unit + integration must all pass first
5. npm run test:e2e         ← run E2E
6. Open docs/MISSIONS.md → find next Pending run
7. Execute → update status → repeat
8. On Fail → open Evidence Bundle → run EXPLORER loop
```

### Add a test for a new bug

1. Add a failing unit test (preferred) or integration test under `tests/`.
2. Confirm it fails: `npm test`.
3. Apply the fix in `src/`.
4. Confirm the test passes: `npm test`.
5. Run typecheck: `npm run typecheck`.
6. Commit with `fix: <description> + regression test`.

### Bug severity guide

| Severity | Definition |
|---|---|
| **Critical** | Data loss, auth bypass, crash on launch, blocks Flow 7/8/9 |
| **High** | Core feature broken, wrong data saved, permission violation |
| **Medium** | Feature partially broken, misleading UI, non-blocking error |
| **Low** | Cosmetic, minor UX inconsistency, console warning only |

---

## Mobile E2E project (P6.8)

Phase 6 shipped a second Playwright project (`chromium-mobile`) that
runs the M6 mission spec against an iPhone-12 device descriptor
(390×844). The desktop `chromium` project ignores
`qa_mobile_flows.spec.ts` and vice versa, so the two projects don't
double-run shared specs.

Run just the mobile project:

```bash
npm run test:e2e -- --project chromium-mobile
```

Run just the desktop project:

```bash
npm run test:e2e -- --project chromium
```

Run both (default — what `npm run test:e2e` does):

```bash
npm run test:e2e
```

The mobile spec covers three missions:

- **M6.1** — bottom tab bar visible, each tab navigates, no
  horizontal scroll on any destination.
- **M6.2** — create a Unit project on mobile, bump Owned + Build,
  reload, verify persistence.
- **M6.3** — library Flow 7 on mobile: open the [ Filters ] drawer,
  search for "Mephiston Red", open the detail panel, verify the
  panel's bottom does not exceed the viewport.

## What's not (yet) wired

- **Component tests** — `@testing-library/react` is not installed. Component logic is currently best covered via E2E. Add if a pure component starts holding non-trivial logic.
- **Visual regression** — no Percy / Chromatic. Playwright `screenshot()` calls are manual.
- **Coverage gates** — coverage is reportable (`npm run test:coverage`) but no minimum threshold is enforced. Revisit when the suite is more mature.
- **CI** — no GitHub Actions workflow yet. Local-first for now.
