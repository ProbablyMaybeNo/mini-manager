# Mini Manager — Agent Onboarding Prompt

Paste this into Cursor's `.cursorrules`, the system prompt slot of any AI agent, or hand it to a teammate. It contains everything an agent needs to be useful in this repo on day one.

---

## Project: Mini Manager

A wargaming + painting companion. Plans armies, tracks every model from wishlist to complete, builds paint recipes from a 7,128-entry cross-brand library, carries the whole thing on a phone in the hobby store. Built solo by Ross. Currently v2 (rewrite of "Paint Planner Pro").

**Where to find context:**
- `app/docs/V2-BUILD-PLAN.md` — full product spec, all phases, all decisions
- `app/docs/PHASE1_PLAN.md` / `PHASE2_PLAN.md` / `PHASE3_PLAN.md` — milestone-by-milestone build plans (already complete)
- `app/docs/PHASE4_PLAN.md` and forward — upcoming work
- `app/docs/TESTING.md` — testing methodology (Mission-based), test layer guide, copy-paste templates

## Stack (use exactly this — no swaps)

- **Next.js 16** (App Router) · React 19 · TypeScript strict mode
- **Tailwind v4** (CSS-first `@theme` in `app/src/app/globals.css`)
- **Drizzle ORM** + libsql/SQLite (file at `app/data/local.db`)
- **NextAuth.js v5** with magic-link auth (Resend in prod, console-log in dev)
- **Dexie** for IndexedDB client cache (paints catalog)
- **Vitest** (unit + integration) + **Playwright** (E2E) — see `app/docs/TESTING.md`
- **Package manager: npm** — check `package.json` `packageManager` field, never mix
- **Python** for offline scripts: `py -3.13`

## Where things live

```
app/
├── src/
│   ├── app/                   Next.js App Router pages
│   ├── components/            UI components, grouped by domain
│   │   ├── library/           Library page + filters + detail panel
│   │   ├── recipes/           Editor + silhouette + step builder + cards
│   │   ├── wishlist/          List, quick-add, modals
│   │   └── dashboard/         Project list, top wishes, recently bought
│   ├── db/
│   │   ├── schema.ts          Drizzle schema (singular SQL names, plural JS)
│   │   ├── client.ts          singleton libsql client
│   │   └── queries/           server-only query helpers
│   ├── lib/
│   │   ├── actions/           "use server" mutations
│   │   ├── counters/cascade.ts  pure cascade helpers
│   │   ├── namedModels/cascade.ts  pure cascade helpers
│   │   ├── paints/            types, filters, sort, loader, dexie
│   │   ├── recipes/types.ts   shared TS types
│   │   ├── scrape/            vendor parsers + dispatcher + OG fallback
│   │   ├── search/index.ts    global search ranker
│   │   ├── silhouettes/       infantry zone metadata
│   │   ├── wishlist/          kit inference, mark-bought helpers
│   │   ├── auth-stub.ts       currentUserId() (calls NextAuth under the hood)
│   │   ├── progress.ts        progress %, aggregate counters, displayStatus
│   │   └── quickAdd.ts        parseQuickAdd("Necron Warriors x20") → {…}
│   └── proxy.ts               Next 16 proxy (replaces middleware.ts)
├── tests/
│   ├── unit/                  vitest, node env, <1s
│   ├── integration/           vitest + in-memory libsql per test, ~5s
│   ├── e2e/                   Playwright chromium, qa_*.spec.ts
│   └── fixtures/              cached vendor HTML for scrape regression
├── drizzle/                   generated migration SQL
├── public/data/paints.json    static paint catalog (2-3 MB, committed)
└── scripts/export-paints.ts   regenerates paints.json from Webscraper DB
```

## Commands (from `app/` directory)

```bash
# Dev
npm run dev                 # localhost:3000 (auto-magic-link console URL on sign-in)
npm run typecheck           # tsc --noEmit, the CI gate
npm run db:generate         # create a migration after schema.ts changes
npm run db:migrate          # apply migrations
npm run db:export-paints    # regenerate public/data/paints.json from Webscraper

# Tests
npm test                    # unit + integration (~600ms total)
npm run test:unit
npm run test:integration
npm run test:watch          # unit watch
npm run test:e2e            # Playwright (auto-boots dev with ALLOW_TEST_AUTH=1)
npm run test:coverage       # v8 coverage report
```

## Conventions (non-negotiable)

- **Strict TypeScript.** No `any`. No `@ts-ignore`. Zero typecheck errors before claiming work is done.
- **Server-first.** Server components are the default. Mark `'use client'` only when interactivity needs it (event handlers, state, refs).
- **`"use server"` files export ONLY async functions.** This is a Next 16 build error if violated. Pure helpers go in a sibling `lib/<domain>/cascade.ts` (precedent: `lib/counters/cascade.ts`, `lib/namedModels/cascade.ts`).
- **Server actions:** `"use server"` at top, Zod-validate input, call `currentUserId()` from `@/lib/auth-stub`, return `ActionResult<T>` (success+data or ok:false+error), `revalidatePath` for affected routes.
- **Drizzle schema:** singular SQL names (`user`, `project`, `recipe`), plural JS const exports (`users`, `projects`, `recipes`). nanoid(16) PKs via the `id()` helper.
- **Tailwind v4:** use the design tokens in `globals.css` (`var(--color-green)`, `var(--color-cyan)`, `var(--color-amber)`, etc.). No arbitrary hex. Glow only on active states and headers. IBM Plex Mono for chrome, Plex Sans for prose.
- **Touch targets:** `.tap-target` class. 44px on mobile, 32px on desktop.
- **No new dependencies without flagging.** Phase 2 deliberately skipped `culori` / `react-window` / `linkedom` in favour of inline implementations. Keep the surface tight.
- **Commit only locally.** Ross reviews before pushing. Never `git push` autonomously.
- **No comments explaining what the code does** — only WHY when non-obvious (a hidden constraint, a workaround, a known gotcha).

## Auth in dev

- Sign in by submitting any email at `/sign-in`. The magic-link URL prints to the dev server console with a bracketed `┌─ MINI MANAGER · MAGIC LINK ─` header. Click the URL.
- Tests use `POST /api/test/sign-in` (404 unless `ALLOW_TEST_AUTH=1`) — see `tests/e2e/_helpers/auth.ts`.

## Testing methodology (read `app/docs/TESTING.md` in full)

Three layers:

- **Unit** — pure functions. Cascade rules, parsers, filters, sort, search ranker, OG, vendor parsers (against cached HTML).
- **Integration** — server actions against a per-test in-memory libsql. Boilerplate template in `tests/integration/actions/counters.test.ts`.
- **E2E** — Playwright Mission specs (`qa_*.spec.ts`). One mission per file. Use `signInAs(page, freshTestEmail())` to mint a session.

**Mission methodology** — every test is a Run inside a Mission (M1.1, M2.3, etc.). Bugs follow EXPLORER → REPRODUCER → FIXER with an Evidence Bundle. Mutations (empty input, long string, double-click, refresh mid-save, multi-tab) apply on every E2E mission.

**The cardinal rule:** if a bug surfaces, write the failing test first, then fix, then verify.

## What's shipped vs what's next

| Phase | Status | What's in |
|---|---|---|
| 1 — Project spine | ✅ done | Auth, projects, stage counters, named models, sub-project nesting |
| 2 — Library + Inventory + Wishlist | ✅ done | Paint catalog table, inventory marks, wishlist with 12-vendor URL paste scraper, global `/` search |
| 3 — Recipes | ✅ done | Recipe editor, infantry silhouette, step builder, paint slot picker, attach to project/named model |
| 4 — Tools | ✅ done | Colour wheel, cross-brand match, image eyedropper, gradient builder |
| 5 — Sharing | ✅ done | Short URLs, QR, Markdown export, JSON export, clone-to-my-recipes |
| 6 — Mobile polish | ✅ done | Vehicle/monster/terrain silhouettes, bottom tab bar, native share, zone palette presets |
| 7 — Power Imports | ✅ done | Paste / PDF / BattleScribe `.ros` + `.rosz` import → preview tree → apply → new Army workspace. Heuristic text parser + LLM-fallback (Anthropic Haiku 4.5) for messy lists. |
| 8 — Community | deferred | Public browse, influencer technique guides |

## Critical gotchas (from real bugs we've hit)

- **EG-style OG metadata.** Vendor `og:title` / `og:image` are often broken; per-vendor parsers can't blindly delegate to `parseOpenGraph`. Always test parsers against a cached real product page in `tests/fixtures/vendors/`.
- **`"use server"` + sync export = build error.** Phase 1 and Phase 3 both shipped this bug; both were extracted to `lib/<x>/cascade.ts`. Watch for it whenever you add helpers near actions.
- **Next 16 = `proxy.ts` not `middleware.ts`.** Renamed; runtime is nodejs (not edge); allows database session lookups. The matcher excludes `/sign-in`, `/api/auth`, `/api/test`, `/_next/static`, `/_next/image`, common static extensions.
- **libsql client/node vs client.** Always import from `@libsql/client/node` — Turbopack will pull the web variant otherwise, which rejects `file:` URLs.
- **Turbopack workspace root.** `next.config.ts` pins `turbopack.root: path.resolve()` because the parent monorepo has sibling `package-lock.json` files that confuse it.
- **Zod `.default()` and input types.** Action input types should be `z.input<typeof schema>` so callers can omit defaulted fields. Use `z.infer<>` for the output type (post-validation).

## Working style

- Ross is a builder with high IQ, ADHD, dyslexic — fast thinker. Typos are noise. Direct communication only. No filler, no preamble.
- Lean optimistic on the project's chances, but never invent facts or pre-empt failure.
- Three similar lines beats a premature abstraction. Don't add error handling, fallbacks, or validation for scenarios that can't happen. Trust internal framework guarantees; validate at system boundaries only.
- For UI changes, run the dev server and try the feature in the browser before claiming done.

## When you hit a wall

- Build error? Check the `"use server"` rule first.
- Vendor scraper returning garbage? Add a fixture in `tests/fixtures/vendors/<vendor>.html`, write a parser test, then fix the parser.
- Action breaking? Mock pattern is in `tests/integration/actions/counters.test.ts`.
- UI flow you need to test end-to-end? Copy `tests/e2e/qa_project_workspace.spec.ts`.

## Responding to Vercel preview comments — the only correct loop

If you act on a Vercel toolbar comment, **a fix is not "done" until it is live in production `main`.** A preview deploy is NOT shipped. The historical failure mode in this repo: an agent committed to a throwaway `claude/*` branch, replied "✅ Fixed — preview READY", and resolved the thread — but the branch never merged, so `miniaturemanager.vercel.app` never changed. The comment looked handled; the app was untouched.

Do exactly this, in order:

1. Make the change on a normal feature branch (`fix/...`, `feat/...`) — never leave work on a random `claude/<name>` preview branch as the final state.
2. `npm run typecheck` + `npm run test:unit` locally (0 type errors).
3. Open a PR to `main`. Let the CI gate run (`.github/workflows/ci.yml`: typecheck → unit → integration → build, plus Playwright E2E). **Wait for green.**
4. Merge to `main`. Confirm the **production** deploy (target `production`, aliased to `miniaturemanager.vercel.app`) reaches state `READY` for your commit SHA.
5. ONLY THEN reply on the thread, referencing the **`main` commit + PR number + prod deploy** (not a preview URL), and resolve it.

Never resolve a thread on the strength of a preview build. "Fixed on a preview branch" = not fixed. Check the current design system before re-applying an old request — tokens/variants move (e.g. green CTAs use `Button variant="add"`, not a bespoke `success` variant).

Welcome to Mini Manager. Read `app/docs/V2-BUILD-PLAN.md` once, then go.
