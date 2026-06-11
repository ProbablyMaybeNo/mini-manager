# Mini Manager — UI Port & Launch Plan

**Created:** 2026-06-11 · **Owner:** Ross + Claude · **Branch:** `feat/ui-port` (do NOT touch `main` — prod is live)

## Locked decisions (2026-06-11)

| Decision | Choice |
|---|---|
| Codebase home | **New UI → old repo.** This repo (`D:\AI-Workstation\mini-manager`) stays home; its backend, Turso DB, Vercel project, env, and 7,144-paint catalog are kept. The new prototype's presentation layer is transplanted in and becomes the *only* UI. |
| Launch scope | **Full parity.** Wire every contract seam + the richer features behind it (imports, URL scrape, colour tools, sessions, events, activity, palettes). |
| Payments | **Required at launch.** Finish Stripe checkout + webhook + free-tier enforcement before shipping. |

## The two artifacts

- **Old repo (home):** `D:\AI-Workstation\mini-manager` — mature backend: Drizzle (19 tables), real CIEDE2000 (`src/lib/tools/match/deltaE.ts`), importers (BattleScribe/PDF/text/Groq-LLM), 10-vendor URL scraper, NextAuth credentials + `proxy.ts` session gate, half-built Stripe, ~22 server actions, `public/data/paints.json` (7,144 paints, Dexie cache), Turso + Vercel deploy.
- **New prototype (design source):** `D:\AI-Workstation\Antigravity\apps\Miniature Management App` — clean Figma presentation layer. Typed contract `src/lib/types.ts`, `MockProvider` (sole data boundary), `derive.ts` + `filterPaints.ts` (host-computes seam), 91 intent callbacks, kit primitives, `/gallery` regression surface, Serwist PWA shell.

## Strategy: clean amputation — new UI verbatim, headless backend underneath

**HARD RULE (Ross, 2026-06-11, emphatic):** The new prototype **IS** the entire app. The old UI **does not exist**. NEVER open, reference, compare against, or "improve toward" an old component. Do NOT use the new design to patch/fix the old UI — that failed pattern burned days. No side-by-side. Clean amputation.

Keep **only the old backend** (db, server actions, auth, Stripe, colour engine, importers, scraper, paint catalog — all headless). **Delete** the old `src/app` + `src/components` + UI globals outright (recoverable on `archive/pre-ui-port`, never consulted). Drop the new prototype's presentation tree in **verbatim**, then feed it data underneath via an **adapter** that maps DB rows → the new typed view-model contract, replaces `MockProvider` with a real `AppDataProvider`, wires each callback to existing server actions, and reimplements `derive.ts` over the real `deltaE2000`.

> The new components are the design system, full stop. Net-new parity surfaces (project edit forms, stage counters, import review, events CRUD, palettes browser) are built fresh **from the new kit primitives** — never by porting anything old. `types.ts` is extended **additively only**.

---

## Phase 0 — Setup, archive, design-in-repo spike ✅ DONE (2026-06-11)

- [x] Branch `feat/ui-port` off `main`; old UI snapshotted to `archive/pre-ui-port`.
- [x] Added deps: `@fontsource/{press-start-2p,share-tech-mono,ibm-plex-mono}`, `class-variance-authority`, `tailwind-merge`, testing-library, jsdom, `@vitejs/plugin-react`, `vite-tsconfig-paths`. (SW/Serwist deferred to Phase 5; `src/app/sw.ts` removed for now.)
- [x] Amputated old `src/app/**` (kept `api/`, `auth/signout`, `r/[slug]/clone`) + all `src/components/**`. Dropped new prototype tree in **verbatim**: `src/components/**`, `src/app/(app|public)/**`, `gallery`, new `src/lib/{types,palette,color,cn}.ts`, `globals.css`, `src/mock/**`. New contract owns `src/lib/types.ts`.
- [x] De-contaminated backend: relocated `techniqueLabel`→`src/lib/recipes/technique.ts` and `FocusSlotView`→`src/lib/focus/rollup.ts` (were imported from deleted old UI components).
- [x] Config reconcile: adopted new flat `eslint.config.mjs` (`lint`→`eslint`); extended `vitest.config.ts` with a jsdom `ui` project alongside the node `unit`/`integration` projects; kept old strict `tsconfig` (hardened new code with behavior-preserving guards rather than relaxing `noUncheckedIndexedAccess`).
- [x] Removed 122 dead old-UI tests (structural/microcopy/style/component-path reads that ENOENT'd on deleted source); backend-logic + integration tests retained.
- [x] **Gate GREEN:** typecheck 0 errors · eslint exit 0 · vitest 81 files / 865 passed / 5 skipped · `next build` exit 0 (all routes incl. backend api + proxy).

## Phase 1 — Adapter + data provider (read paths) ✅ DONE (2026-06-11)

- [x] `src/lib/viewmodel/*` mappers (DB → contract): `toProject` (host-rolled status via `displayStatus`, `completionPercent` via `progressPercent`/`aggregateCounters`, swatches via `getProjectPalettesMap`, nested `children`), `toRecipe`/`toRecipeSlot` (slot paint resolved through cached server catalog map + `techniqueLabel`), `toPaint` (catalog + inventory flags + lossy catalog→contract `PaintType` map), `toCollectionItem` (wishlist→collection, status map, cents→price), `toSessionStats` + `streakFromDays`, `toCalendarEvent`, `toActivityEntry` (icon+text+relative-when built here — no lib helper existed), `toMatchResult`.
- [x] `AppDataProvider` (in `MockProvider.tsx`) replaces the mock at `(app)/layout.tsx` (now an async server component): `currentUserId()` gates, `loadAppData(userId)` assembles the real `MockData` from `src/db/queries/*`, catalog hydrates client-side via the Dexie loader + inventory merge. `useMockData()` hook unchanged → pages render real data. `(app)` routes are now ƒ (dynamic).
- [x] Colour fns in `derive.ts` rewired to real **CIEDE2000** (`deltaE2000Hex`); `MatchResult.distanceScore` is now ΔE2000. `deriveDashboardSummary` stays pure over real projects/stats.
- [x] Cleanup surfaced by the strict gate: removed 4 dead old-UI hooks (`src/lib/hooks/*`) + their test; fixed `dexie.ts` empty-interface; **fixed the eslint config** — it was linting stale `.claude/worktrees/*/.next` build output (22k phantom problems → real source is 0 errors / 13 warnings). Restored the `public/sw.js` `__BUILD_ID__` template (Phase 0 had committed a build-stamped copy).
- [x] **Gate GREEN:** eslint 0 errors · typecheck 0 · vitest 80 files / 861 passed / 5 skipped · `next build` exit 0.
- [ ] *Deferred to Phase 2/3:* `filterPaints` still runs client-side over the contract `Paint[]` (works on real merged catalog; server-side search optimization is optional). `loadAppData` fetches full recipes per-nav (fine for now; optimize if recipe counts grow).

> **Footgun for Phase 5:** the prebuild `stamp-sw-build-id.mjs` mutates `public/sw.js` in place — never `git add` after a build, or you commit a stamped (non-template) SW and break `sw/strategy.test.ts`. Real fix = the Serwist SW reconcile.

## Phase 2 — Mutations (callbacks → existing server actions)

Wire each route wrapper. Existing actions already cover almost all of it:

| Page | Callback → action |
|---|---|
| Dashboard | `onOpenProject`→inspector · `onAddProject`→**new form** (`createProject`) · `onUploadArmyList`→**new import screen** · `onAttachRecipe`/`onStartSession`→nav · `onRetry`→refresh |
| Library | `onToggleOwned`/`onStepOwned`→`togglePaintOwnership` · `onToggleWishlist`/`onWishlist`→`togglePaintWishlist` · `onAssignPaint`→`sendPaletteToRecipe`/recipe pick · `onCopyHex`→clipboard · `onFilterChange`/`onClearFilter`→state |
| Recipes | `onCreateRecipe`→`createRecipe` · `onOpenRecipe`→nav · `onAssignProject`→`updateRecipe` · `onShare`→`shareRecipe` |
| Recipe editor | `onChange`→`updateRecipe`+`upsertRecipeSlot`/`deleteRecipeSlot`/`reorderRecipeSlots`+`add/deleteRecipeInspo` · `onSave`/`onBack`→nav · `onShare`→`shareRecipe` |
| Tools | `onSavePalette`→`createPalette` · `onSendToRecipe`/`onAssign`→`sendPaletteToRecipe` · `onUse`→assign · `onImageDropped`→real k-means (`src/lib/tools/eyedropper/*`) |
| Focus | `onLogSession`→`start/stopPaintSession` · `onStepChange`→`bumpProjectCounter`/step-completion · `onAddInspo`/`onRemoveInspo`→`add/deleteRecipeInspo` · `onAddPaint`→slot add |
| Collection | `onAddUrl`→`createWishlistItemFromUrl` (scrape) · `onStatusChange`/`onAssignProject`/`onRemove`→`updateWishlistItem`/`deleteWishlistItem` · `onAttachRecipe` · `onAddPaint`/`onAddModel`→**new manual forms** |
| User/Account | `onSave`→`updateProfile`/`recoveryEmail` · `onChangePassword`→`changePassword` · `onImport`/`onExport`→`exportData`/import · `onSignOut`→NextAuth signOut · `onDensityChange`→pref |
| Public | `onSubmit`→`signInWithCredentials`/`signUpWithCredentials` · reset flow→`passwordReset` · `onChoose`→**Stripe checkout** (Phase 4) |

## Phase 3 — Net-new UI for full parity (the "missing" surfaces)

The prototype's contract is leaner than the DB. Full parity needs these built **in the new kit**:

- [ ] **Project create + edit form** — `onAddProject`/inspector has no editable fields. Need faction, game, `pointsValue`, `targetDate`, priority, status, `notesMd`, reference image. Extend `Project` in `types.ts` (additive) + add an edit form/inspector fields.
- [ ] **Stage-counter controls** — the old core loop is the 7-stage cascade (count ≥ owned ≥ build ≥ prime ≥ paint ≥ base ≥ complete). The new UI only shows a single `completionPercent`. Add per-stage bump controls (Focus and/or inspector) backed by `bumpProjectCounter` + `src/lib/counters/cascade.ts`.
- [ ] **Army-list import review screen** — `onUploadArmyList` is one callback. Need: file/text drop → parse (`src/lib/imports/*`) → preview parsed tree + confidence → edit → apply (`applyImport`).
- [ ] **Collection manual-add forms** — `onAddPaint`/`onAddModel` (PasteUrlBar already covers URL scrape).
- [ ] **Events CRUD** — calendar widgets are display-only; add create/edit/delete on the right rail / calendar (`events` actions).
- [ ] **Palettes browser** — tools save palettes but there's no screen to browse/manage them (`palettes` actions). Add a view (likely under Tools or a `/palettes` route).
- [ ] **Paint notes** — `PaintInfoPanelContent` has no notes field; old app has global per-paint notes (`paintNotes`). Add a field; extend `Paint`/panel.
- [ ] **Recipe per-slot completion** — surface `recipeStepCompletion` toggles in Focus/editor (`toggleStepCompletion`).
- [ ] **Public shared-recipe page** — rebuild `/r/[slug]` (`getPublicRecipe` + `recipeToMarkdown`) in the new design.
- [ ] **Global search** in the shell (`runGlobalSearch`) — optional for v1.

## Phase 4 — Payments (launch gate)

- [ ] Stripe checkout route (`/api/billing/checkout`) for pro_monthly / pro_lifetime / founder.
- [ ] Webhook (`/api/webhooks/stripe`): `checkout.session.completed` → set `plan`, `stripeCustomerId/SubscriptionId`, `planExpiresAt`, `founderClaimedAt`, increment `founder_sold`; `customer.subscription.updated/deleted` → re-stamp/lapse.
- [ ] Flip `BILLING_ENFORCED = true`; enforce limits in `createProject`/`createRecipe`/`createWishlistItem` (`src/lib/billing/enforce.ts`).
- [ ] Wire `PricingView.onChoose` + `SettingsView.onUpgrade` → checkout; show plan + founder seats remaining.
- [ ] Env: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, price IDs. Test mode end-to-end first.

## Phase 5 — PWA / infra reconcile

- [ ] One service worker: keep the repo's deployed SW *or* adopt Serwist (not both). Bring new manifest/icons/`theme_color`.
- [ ] `proxy.ts` allow-list confirmed for new routes: `/`, `/pricing`, `/sign-in`, `/sign-up`, `/r/*`, `/api/auth`, `/api/webhooks/stripe`, `/brand/*`, assets, fonts.
- [ ] Fonts self-hosted via `@fontsource` (no runtime fetch).

## Phase 6 — QA & launch

- [ ] Gates green: `typecheck`, `lint`, `vitest`, `playwright` e2e, `build`.
- [ ] Update Playwright missions to new role-based selectors.
- [ ] Personal page-by-page review vs `docs/redesign-refs/*` + new prototype `docs/figma-refs/*` (Ross's standing review obligation — don't trust agent output).
- [ ] Local preview review (`npm run db:seed`, sign in `dev@local`) — Vercel branch previews redirect to prod, review on localhost.
- [ ] Merge to `main` ONLY after Ross approves the preview. Prod is live.

---

## Gap analysis — what the new design is missing (summary)

| # | Feature (old app has it) | New-UI surface today | Action |
|---|---|---|---|
| 1 | Project metadata (faction/game/points/target date/notes/ref image) | Inspector shows none | Extend `types.ts` + inspector fields |
| 2 | 7-stage counter cascade | Single `completionPercent` | New per-stage controls |
| 3 | Project create/edit | `onAddProject` no-op, no form | New form |
| 4 | Army-list import (BattleScribe/PDF/text/LLM) | One `onUploadArmyList` callback | New import review screen |
| 5 | Events CRUD | Calendar display-only | Add CRUD affordances |
| 6 | Palettes library | Save only, no browse | New palettes view |
| 7 | Paint notes (per-paint global) | No field | Add to paint panel |
| 8 | Recipe per-slot completion | Partial / coarse | Surface toggles in Focus |
| 9 | Public shared recipe `/r/[slug]` | Not in new UI | Rebuild in new design |
| 10 | Global search popover | Not in new shell | Add (optional v1) |
| 11 | Collection manual add | `onAddPaint/Model` no-op | New forms (URL scrape already wired) |

## Risks / watch-items

- **Don't touch `main`** — prod (`miniaturemanager.vercel.app`) is live; all work on `feat/ui-port`, merge only on Ross's sign-off.
- **Vercel preview redirect** — branch previews bounce to prod; review on localhost.
- **Two SW systems** — pick one to avoid cache chaos.
- **7,144-paint `SwatchWall`** — virtualize/window or the library grid will jank.
- **Contract ≠ DB** — the adapter is the only place DB shapes meet the contract; never leak DB rows into components.
- **Stripe is critical-path** (payments-at-launch) — de-risk first with test mode + webhook signature verification.
- **Both repos package-named `mini-manager`, both Next 16 / Tailwind v4** — transplant is framework-compatible, but watch `@/lib/types` and `globals.css` collisions.
</content>
</invoke>
