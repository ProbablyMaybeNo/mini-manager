# HANDOFF — UI Port (read this first)

**You are continuing a UI/UX transplant.** Goal: build Ross's new Figma UI into the existing
working web app. Most of the strategy + a phase-by-phase checklist already lives in
**`docs/PORT_PLAN.md`** — read that next. This file is the fast cold-start.

**Repo:** `D:\AI-Workstation\mini-manager` · **Branch:** `feat/ui-port` · **Date:** 2026-06-11
**Last commits:** `0ad7848` Phase 1 · `c7a3fb4` Phase 0 · `archive/pre-ui-port` = pre-transplant snapshot.

---

## 🔴 HARD RULES (Ross was emphatic — do not violate)

1. **The new Figma UI IS the app. The old UI does not exist.** NEVER open, read, copy, compare
   against, or "improve toward" an old component. Do **not** use the new design to patch the old
   UI — that pattern burned days. No side-by-side. The old UI is deleted (recoverable on
   `archive/pre-ui-port`, but **never consult it** except to recover a piece of *backend* logic
   that was wrongly trapped in an old component).
2. **Never touch `main`.** It's live production (`miniaturemanager.vercel.app`). All work on
   `feat/ui-port`. Merge only on Ross's explicit sign-off after he reviews a preview.
3. **The golden rule (the contract):** EDIT the **route wrappers** (`src/app/(app|public)/**/page.tsx`),
   the **data provider** (`src/mock/MockProvider.tsx`), the **viewmodel/derive layer**
   (`src/lib/viewmodel/*`, `src/mock/derive.ts`, `src/mock/filterPaints.ts`), and add backend/services
   anywhere new. Do **NOT** edit `src/components/**` or reshape the types in `src/lib/types.ts`
   (additive-only changes to types are allowed). The components are the canonical design system.
4. **Strict TypeScript stays strict.** `tsconfig` has `noUncheckedIndexedAccess` etc. Do not relax
   compiler options — add guards (`arr[i]!` where provably present) instead.

---

## What this is

Two artifacts were married:
- **Old repo (this one) = the home.** Mature headless backend kept 100%: Drizzle (19 tables, Turso/libSQL),
  NextAuth credentials + `src/proxy.ts` session gate, real **CIEDE2000** colour engine
  (`src/lib/tools/match/*`), importers (`src/lib/imports/*`), 10-vendor URL scraper (`src/lib/scrape/*`),
  half-built Stripe (`src/lib/billing/*`), `public/data/paints.json` (7,144 paints), ~22 server actions
  (`src/lib/actions/*`), queries (`src/db/queries/*`), deployed to Vercel.
- **New prototype = design source** at `D:\AI-Workstation\Antigravity\apps\Miniature Management App`
  (a Next 16 clean-room Figma UI: typed contract, `MockProvider`, 91 intent callbacks). It was
  transplanted **verbatim** into this repo. Reference it ONLY to re-pull a presentational component
  if one got corrupted — never to copy old-UI patterns.

Locked decisions (from Ross): **New UI → old repo · full feature parity at launch · payments required at
launch.** Details + gap analysis in `docs/PORT_PLAN.md`.

---

## Architecture you're working inside

- **The contract:** `src/lib/types.ts` — every view-model the UI renders (`Project`, `Recipe`,
  `RecipeSlot`, `Paint`, `CollectionItem`, `SessionStats`, `CalendarEvent`, `ActivityEntry`,
  `MatchResult`, `DashboardSummary`, `LibraryFilter`, `PricingTier`, `NavKey`).
- **Data in:** `(app)/layout.tsx` is an async **server component** → `currentUserId()` (auth gate) →
  `loadAppData(userId)` (`src/lib/viewmodel/loadAppData.ts`) assembles the real `MockData` from
  `src/db/queries/*` via the adapters in `src/lib/viewmodel/*`. The 7,144-paint catalog hydrates
  **client-side** in `AppDataProvider` (`src/mock/MockProvider.tsx`) through the Dexie loader,
  merged with inventory flags. Pages read it via **`useMockData()`** (unchanged hook).
- **Derived values:** `src/mock/derive.ts` (dashboard roll-ups + colour matches over real CIEDE2000)
  and `src/mock/filterPaints.ts`.
- **Mutations (your main job now):** every `*View` gets intent callbacks, currently `() => {}` or
  `router.push`. Wire them to the existing server actions in `src/lib/actions/*`.

---

## ✅ Done

- **Phase 0** (`c7a3fb4`): amputated old `src/app/**` (kept `api/`, `auth/signout`, `r/[slug]/clone`)
  + all `src/components/**`; dropped the new UI tree in verbatim; de-contaminated two backend files
  that imported old UI (`techniqueLabel`→`src/lib/recipes/technique.ts`, `FocusSlotView`→
  `src/lib/focus/rollup.ts`); reconciled configs; removed dead old-UI tests.
- **Phase 1** (`0ad7848`): real read paths — viewmodel adapters, `AppDataProvider`/`loadAppData`,
  CIEDE2000 in `derive.ts`. `(app)` routes are now dynamic + render real DB data.
- **Gates currently GREEN:** eslint 0 errors · typecheck 0 · vitest 80 files/861 passed · `next build` OK.

## ▶ Do next (in order)

0. **Runtime-verify Phase 1 first (not yet done):** `npm run db:seed` → `npm run dev` → sign in as
   `dev@local` → confirm real projects/recipes/library render on `/dashboard`, `/library`, etc.
   (Note the seed user resolves to `dev_user__local`. View signed-out landing via `/auth/signout`.)
1. **Phase 2 — mutations.** Wire each route wrapper's callbacks to `src/lib/actions/*`. The full
   per-page callback→action mapping table is in **`docs/PORT_PLAN.md` § Phase 2**. After each mutation,
   `revalidatePath` so `loadAppData` re-reads.
2. **Phase 3 — net-new parity UI** (built from the new kit, never old UI): project create/edit form +
   stage-counter controls, army-list import review screen, events CRUD, palettes browser, paint notes,
   recipe per-slot completion, public `/r/[slug]`, collection manual-add. See PORT_PLAN gap analysis.
3. **Phase 4 — payments** (launch gate): Stripe checkout route + webhook + flip `BILLING_ENFORCED`.
4. **Phase 5 — PWA/SW reconcile.** 5. **Phase 6 — QA + Ross's page-by-page review → merge to main on his OK.**

---

## Verify (keep all green)

```bash
npx tsc --noEmit          # 0 errors required (strict)
npx eslint                # 0 errors (warnings ok); exits 0 when clean
npx vitest run            # 3 projects: unit + integration (node) + ui (jsdom)
npm run build             # next build — see ⚠ SW footgun below before committing after this
```

## ⚠ Gotchas (will bite you)

- **SW stamp footgun:** `npm run build`'s prebuild (`scripts/stamp-sw-build-id.mjs`) **mutates
  `public/sw.js` in place** (replaces `__BUILD_ID__`). NEVER `git add -A` right after a build, or you
  commit a stamped SW and break `tests/unit/lib/sw/strategy.test.ts`. If it happens:
  `git checkout archive/pre-ui-port -- public/sw.js` to restore the template. (Proper fix is the
  Phase 5 Serwist reconcile.)
- **eslint ignores `.claude/**` and `**/.next/**`** (already fixed) — those stale batch-agent
  worktrees are not source. If lint suddenly shows thousands of problems, check the ignore globs.
- **Vercel branch previews redirect to production** — review on **localhost**, not the preview URL.
- **`next dev` locks files** on Windows — if `rm`/edits fail with "device busy", stop the node/next
  processes first.
- **Catalog is client-loaded** (Dexie). On a cold first load `paints` is briefly `[]` — the UI has an
  empty/loading state; that's expected, not a bug.

## Pointers

- `docs/PORT_PLAN.md` — full plan, phase checklists, gap analysis, risks.
- Auto-memory `ui-port-launch-plan` (+ `figma-rebuild-2026-06`, `vercel-preview-redirect`).
- Contract: `src/lib/types.ts` · Adapters: `src/lib/viewmodel/*` · Provider: `src/mock/MockProvider.tsx`
  · Server actions: `src/lib/actions/*` · Queries: `src/db/queries/*` · Schema: `src/db/schema.ts`.
