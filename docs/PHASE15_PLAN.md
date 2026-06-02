# Phase 15 — Mobile Excellence + FOCUS Completion

Ross's 2026-06-02 priority post-BrushForge competitive analysis. BrushForge is mobile-only; Mini Manager has cross-device (web → phone/tablet/desktop) as a genuine differentiator. **Plus** Ross flagged that FOCUS shipped as a display, not a companion — workflow features from the original brief are missing. This phase closes both gaps.

**Status:** PLANNED, 2026-06-02.

## Resolved decisions

- **No native app shell** (Capacitor / React Native). PWA gives 90% of "feels like an app" benefit at 5% the cost. App Store submission is Phase 20+.
- **Web-first stays.** Don't compromise desktop polish chasing mobile gains.
- **Offline-first goal:** matches BrushForge's pitch. Service worker caches library + projects for offline access.
- **FOCUS panel = painting companion, not static display.** Painter using it at the bench should be able to advance state, track progress, mark steps done without leaving the panel.

## Milestones (build in this order)

### P15.0 — FOCUS completion (FIRST — small, high-leverage) ✅

Close the gap between the FOCUS panel we shipped (recipe + notes + stopwatch + multi-recipe tabs) and the painting companion Ross described in the original brief.

- **Current-slot indicator.** When a slot is "active" (most recently interacted with OR explicitly selected), render with a distinct visual treatment — outline + "▶ WORKING ON" label. One slot at a time. Persist active-slot in URL `?focusSlot=<slotId>` so it survives reload.
- **Step done-checkbox per recipe step.** Each step in the active slot's step list gets a checkbox. Persists to a new `recipe_step_completion` table keyed by `(user_id, step_id)` so done state is per-painter (not global). Done steps render visually muted; the next undone step gets a subtle "NEXT" tag.
- **Inline quick-action buttons in the FOCUS header.**
  - `+ Paint` — bumps `paintCount` on the focused project (cascade-safe, uses existing `bumpCounter` action).
  - `+ Prime` — bumps `primeCount` if Build > Prime.
  - `Advance slot` — marks current slot's steps all done + advances active-slot to the next undone slot.
- **Project state pill in FOCUS header.** Mini stage breakdown: "12 BUILT · 8 PRIMED · 3 PAINTED · 0 COMPLETE." Single-row, mono-caps, tight density. Updates optimistically.
- **Recipe completion %.** Compute as `done_steps / total_steps` across all slots in the active recipe. Render as a thin progress bar across the FOCUS panel header background or as a small "67% COMPLETE" indicator.
- Tests: persistence, active-slot URL state, done-step persistence, project-pill rollup math.
- **Acceptance:** painter at the bench can tick steps as they apply paint, see their progress, and bump stage counters without scrolling away from FOCUS.
- **Shipped 2026-06-02 (P15.0 feature commit).** 1587 → 1618 passing (+31), 1 skipped, typecheck clean. Surface: `recipe_step_completion` table + migration `0014_gifted_omega_flight.sql` (per-painter done-state keyed `(user_id, step_id)`, FK-cascade on user + step), `src/db/queries/stepCompletion.ts` (`getCompletedStepIds`), `src/lib/actions/stepCompletion.ts` (`setStepCompletion` toggle + `advanceSlot` bulk-complete-and-advance — owner-gated, Zod-validated), `src/lib/focus/rollup.ts` (`projectStatePill` + `recipeCompletionPercent` pure helpers), `FocusQuickActions` (+Paint / +Prime via shared `bumpCounter` / Advance slot — solid success+warning, no cyan), `SlotActivator` (writes `?focusSlot`), `StepCompletionCheckbox` (optimistic per-step toggle), `FocusPanel` (active-slot outline + ▶ WORKING ON label, per-step checkbox in active slot, done-step muting + NEXT tag, project-state pill, thin completion progress bar). Active slot persists via `?focusSlot`, falls back to first slot with an undone step.

### P15.1 — PWA install (manifest + service worker + icons) ✅

- `public/manifest.json` with name, short_name="Mini Manager", start_url=/projects, display=standalone, theme color, background color.
- App icons (192×192, 512×512, 180×180 apple-touch). Generate from existing wordmark or paint-can glyph.
- Service worker registration in root layout: cache app shell for offline.
- iOS "Add to Home Screen" meta tags + apple-touch-icon.
- Lighthouse PWA audit should pass installability check.
- **Shipped 2026-06-02 (P15.1 feature commit).** 1618 → 1629 passing (+11), 1 skipped, typecheck clean. Surface: `public/manifest.json` (name/short_name="Mini Manager", start_url=/projects, display=standalone, theme_color #050607 = layout viewport, background_color #0a0a0a = --color-bg; 192/512 "any" + 512 maskable icons), real PNG rasters under `public/icons/**` generated from `public/brand/logo.png` via extended `scripts/gen-icons.mjs` (sharp, no new dep — also emits a 10%-safe-zone maskable variant), minimal `public/sw.js` (app-shell precache + network-first navigations w/ offline fallback; passes through all non-GET + cross-origin + authed-data requests — offline reads deferred to P15.4), `ServiceWorkerRegistrar` client component (prod-only, registers /sw.js after load), root layout `metadata` (manifest + appleWebApp.capable + apple-touch-icon) wiring. Icons are real committed rasters — no follow-up rasterize step needed.

### P15.2 — Touch-target sweep app-wide ✅

- Audit every interactive element for ≥44×44 (Apple HIG) and ≥24×24 (WCAG 2.5.8).
- Common offenders: small icon buttons, sort chevrons, inline cell triggers, segmented control sub-buttons.
- Tests: visual regression pins on the surfaces touched.
- **Shipped 2026-06-02 (P15.2 feature commit).** Tests +17 (16 new pins in `tests/unit/lib/components/p15_2_touchTargets.test.ts` + 1 updated `viewModeToggle.test.ts` assertion), typecheck clean, full suite green (1685 passing / 1 skipped). **14 interactive elements across 10 components** brought up to the shared `tap-target` floor (44px mobile / 32px desktop, defined in `globals.css` — reused, not re-invented). Fixes: shared `InlineCellPopover` trigger + menu rows (cascades to every status/type/priority inline cell on the projects dashboard); sort-header triggers in `ProjectsDashboardTable` + `RecipesTable` (bare text buttons had only line-height as a hit-box); inline recipe-cell trigger (×2 desktop/mobile); `StepCompletionCheckbox` FOCUS label expanded around the 20px box (hit-area grows, visual unchanged); `RecipeTabs` FOCUS segmented tabs; `ViewModeToggle` segmented sub-buttons (bespoke 28px → tap-target); `ImportClient` mode tabs; `MatchResultsRow` reseed swatch (first grid track widened 24px→44px to host a 44px hit-box over a 20px chip, ring cue moved to the inner chip); `StepRow` paint-slot trigger; `PaintDetailPanel` copy-hex + harmony swatches. Already-compliant surfaces verified and left untouched (StageCounter `CounterButton`, SwatchActions copy/pin, HarmonyPicker radios, SendToRecipeModal tabs/close, disclosure caret per R7-011, MobileHeader avatar). **Flagged for a layout decision (not forced):** StepRow drag-handle `≡` glyph stays `aria-hidden` with a narrow visual footprint — the whole row is the `draggable` surface so the handle isn't itself a focusable control; giving it a real 44px grab affordance is a planner-grid concern better handled in the planner grid-swap milestone.

### P15.3 — Mobile audit + page-by-page polish ✅

- Walk every primary surface at 375×667 (iPhone SE/13 mini), 414×896 (iPhone Pro Max), 768×1024 (iPad portrait).
- Surfaces: `/projects`, `/projects/[id]`, `/library`, `/wishlist`, `/recipes`, `/recipes/[id]`, `/tools/match`, `/tools/gradient`, `/tools/wheel`, `/tools/eyedropper`, `/pricing`, `/user`, `/sign-in`, `/sign-up`.
- Findings → focused commits per surface. Tests INTO each commit.
- Driven by data from a fresh ux-auditor mobile-only run.
- **Shipped 2026-06-02 (non-grid set).** Worked the Round 12 backlog `ux-audit/findings_v12.json` top-down by severity. Landed UX-1201 (`.btn-sm`/`.btn-md` floor to 44px on coarse pointers — the single highest-leverage CTA fix), UX-1204 (expanded hit areas: /user brand-filter rows `tap-target w-full`, library owned/★ toggles fill their cell; FOCUS checkbox already done in P15.2), UX-1205 (/user FREE caps aligned to the /pricing locked truth: 1 project · 1 recipe · 3 wishlist), UX-1206 (eyedropper React #418 hydration mismatch — post-mount gated the camera feature-detect), UX-1207 (eyedropper empty-state copy made layout-agnostic), UX-1208 (DELETE PROJECT switched to the solid `variant="danger"` Button; confirm modal already existed), UX-1209 (auth hero capped at 150px on mobile so the form clears the fold), UX-1211 (sub-AA separator dots lifted to `--color-fg-muted` + aria-hidden), UX-1212 (`mobile-web-app-capable` + `viewport-fit=cover`), UX-1214 (FOCUS per-paint note "shows everywhere" helper), UX-1215 (library switches to a stacked card layout below 768 — supersedes UX-910; virtualiser sizes rows per breakpoint), UX-1216 (recipe colour picker now a bottom sheet on mobile). **Grid set (UX-1202/1203/1210) owned by the parallel planner agent; UX-1213 font-preload deferred to a perf pass.** Tests: +48 (1775 → 1823 passing, 1 skipped), typecheck clean. New sentinels in `tests/unit/lib/components/p15_3_mobilePolish.test.ts`; UX-910 + delete-button detail-page tests updated to the new intent.

### P15.4 — Offline reads via service worker ✅

- Service worker intercepts library JSON + project read endpoints.
- Cache-then-network strategy: serve cached data immediately, refresh in background.
- "Offline mode" indicator in the StatusBar (NET·ON dot turns amber with "OFFLINE — cached data" tooltip).
- Write actions queue locally and replay on reconnect (stretch — could defer to Phase 19 if too involved).
- **Shipped 2026-06-02 (P15.4 feature commit).** 1744 → 1775 passing (+31), 1 skipped, typecheck clean. **What gets cached vs passed through:** the offline read is the public, static, cross-user-identical paint catalog `/data/paints.json` (stale-while-revalidate — serve the cached copy instantly, refresh in the background, only ever store a full `200`). **Everything else stays pass-through** (P15.1 safety preserved + extended): non-GET writes, cross-origin, `Range` requests (206 partials — caching them would poison the cache and the loader Range-peeks the catalog header), `Authorization`-bearing requests, and all `/api/**` (authed data / session / mutations). Authed **project/dashboard reads render as HTML navigations** → kept network-first with an offline fallback and **never cached** (would risk leaking one user's authed HTML). No safe cross-user authed JSON read endpoint exists to SWR-cache, so we deliberately cache only the public catalog — conservative by design. **Write-queue + replay deferred** (stretch, out of scope per this milestone; revisit Phase 19). Surface: `public/sw.js` extended (2 caches — `mm-shell-v1` + `mm-data-v1`; `staleWhileRevalidate` helper; rule-ordered fetch handler), `src/lib/sw/strategy.ts` (pure, unit-tested `routeRequest` decision table the SW mirrors at runtime), `StatusBar` offline indicator (NET `OFF` tone flipped red→**amber** `--status-warning` via new `NET_TONE`/`NET_LABEL` maps — offline is degraded-but-usable, not a dead-end; label reads "OFFLINE", tooltip "OFFLINE — cached data … changes won't save until you reconnect"). Tests: 19 SW routing/safety assertions (`tests/unit/lib/sw/strategy.test.ts`) + StatusBar offline-state + no-raw-hex sentinels. `ServiceWorkerRegistrar` unchanged — registration already correct.

### P15.5 — Mobile Round 12 audit

- Fresh ux-auditor pass against live deploy in mobile-only mode.
- Verify P15.0 → P15.4 landed correctly; surface any regressions.
- Verdict on "is mobile launch-ready as the primary experience?"

## Out of scope

- Native app shell (Capacitor/React Native) — Phase 20+
- App Store submission — Phase 20+
- Push notifications — Phase 20+ (requires real backend)
- Camera integration / photo capture — handled in Phase 16 F.2 (photo-to-palette)
- Recipe step-done dependencies (linked / required-order) — could be Phase 17+; v1 is independent toggles per step
