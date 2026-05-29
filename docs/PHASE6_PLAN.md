# Mini Manager — Phase 6 Build Plan

Source of truth for the milestone-builder agent. Each unchecked item is a self-contained milestone with scope, patterns, and acceptance criteria. Build top-down. Tick the box when shipped.

**Phase goal (per V2-BUILD-PLAN §11.6):** Mobile polish. Every primary flow becomes executable end-to-end on Ross's phone, not just viewable. Plus the three deferred body silhouettes (Vehicle / Monster / Terrain) and the small UI polish items concerns from Phases 3-5 explicitly punted to here.

**Ship criterion (V2-BUILD-PLAN):** Every primary flow (§6 in V2-BUILD-PLAN — Flows 1-9) works on Ross's phone. Lighthouse 90+ mobile, 95+ desktop.

**Already shipped (do not re-run):** none — Phase 6 starts fresh on top of Phase 5. The Infantry silhouette and most filter / list responsive behaviour landed earlier; this phase fills in everything else.

**Remaining (build in this order):**

---

## P6.1 — Mobile bottom tab bar

- [ ] Build this milestone

**Context.** Desktop has a NavRail on the left; mobile (< md breakpoint) currently hides it and offers no replacement. Add a fixed bottom tab bar with the same five primary destinations. User remains accessible via a small avatar in the top-right of every page.

**Files to create.**
- `src/components/BottomTabBar.tsx` — `'use client'`. Five tabs: Projects (`[P]`) / Library (`[L]`) / Recipes (`[R]`) / Tools (`[T]`) / Wishlist (`[W]`). Uses `usePathname()` for active-state highlighting (same `isActive` helper as `NavRail.tsx`). `position: fixed; bottom: 0; left: 0; right: 0`. Respects `env(safe-area-inset-bottom)`. Hidden on `md+` via `md:hidden`.
- `src/components/MobileHeader.tsx` — `'use client'`. Small top bar shown only on `< md`. Mini Manager wordmark on the left, user avatar / `[U]` button on the right linking to `/user`. Replaces the missing NavRail's User access.

**Files to modify.**
- `src/app/layout.tsx` — render `<NavRail />` (desktop, `hidden md:flex` already) AND `<MobileHeader />` and `<BottomTabBar />` (both `md:hidden`). Push the `<main>` content down by `pt-12` on mobile (header height) and `pb-16` (tab bar height).
- `src/components/NavRail.tsx` — no change. The mobile views simply hide it via existing `hidden md:flex`.

**Patterns to follow.**
- Active-state colour: phosphor-green (`var(--color-green)`) on the icon glyph; muted otherwise (`var(--color-fg-muted)`). Matches NavRail's idiom.
- Touch target: each tab is full-width / 5 + 56px tall — well above the 44px minimum.
- No icons-as-glyphs hack: keep the `[P]` / `[L]` / `[R]` / `[T]` / `[W]` bracketed letters per the terminal aesthetic.

**Implementation notes.**
- Safe-area inset for iPhone X-class chins: `padding-bottom: env(safe-area-inset-bottom, 0)`.
- Use `aria-current="page"` on the active tab.

**Acceptance criteria.**
- `npm run typecheck` exits 0.
- On a viewport ≤ 767px, the NavRail is hidden and the bottom tab bar + mobile header are visible.
- On desktop the layout is unchanged (NavRail visible, no mobile chrome).
- Tapping each tab navigates without page reload.
- `aria-current="page"` is set correctly on the active tab.

**Commit message:** `P6.1: mobile bottom tab bar + header`

---

## P6.2 — Vehicle silhouette + zones

- [ ] Build this milestone
- [PAUSED] **Do not run this milestone autonomously.** Ross is hand-creating
  the silhouette SVG artwork — the milestone-builder-generated hand-built path
  data on the existing infantry silhouette didn't meet the quality bar. We'll
  resume P6.2 once Ross delivers the Vehicle SVG (with paths cut along zone
  boundaries per the recipe-mechanic requirement: ≥12 separately-clickable
  `<path data-zone-id="...">` elements). The zone metadata + body-type picker
  scaffolding can still land alongside that drop-in.

**Context.** Recipe `bodyType = "vehicle"` was reserved in P3.1 but never rendered. Ship the silhouette + zone metadata so a painter can build a Leman Russ / Razorback / Tau Hammerhead recipe.

**Files to create.**
- `src/lib/silhouettes/vehicle.ts` — `VEHICLE_ZONES` constant (mirrors `INFANTRY_ZONES` pattern from P3.3). Twelve zones: hull-primary / hull-secondary / hull-trim / turret / weapon-main / weapon-secondary / tracks-or-wheels / windows-or-vision / decals / engine-vents / metal-details / base.
- `src/components/recipes/VehicleSilhouette.tsx` — `'use client'`. SVG of a 3/4-view tank-style vehicle. Same prop signature as `InfantrySilhouette.tsx`: `{ paintedZones, selectedZoneId, onSelectZone }`. Each zone is a clickable `<path>` with `data-zone-id` and accessible label.

**Files to modify.**
- `src/components/recipes/InfantrySilhouette.tsx` (or a new `Silhouette.tsx` wrapper) — extract the common rendering wrapper so a single `<Silhouette bodyType=... />` chooses the right SVG. The wrapper handles the `paintedZones` / `selectedZoneId` / `onSelectZone` props and dispatches to the body-type-specific SVG.
- `src/components/recipes/RecipeEditorClient.tsx` — switch to `<Silhouette bodyType={recipe.bodyType} ... />`. Remove the "vehicle not supported" guard.
- `src/components/recipes/RecipeHeader.tsx` — bodyType pill becomes editable: tapping it shows a dropdown (infantry / vehicle / monster / terrain). On change: call `updateRecipe({ bodyType })`. **Existing zones are NOT deleted** on body-type change; their `silhouetteZoneId` becomes invalid but the zone name + steps survive — painter manually re-selects silhouette zones if they want them re-anchored.

**Patterns to follow.**
- Same SVG path approach as `InfantrySilhouette.tsx` — inline path data, hand-built, ~600×800 viewBox, total under 8KB.
- Zone fill: muted border when un-painted, swatch hex when in `paintedZones`, glow outline when `selectedZoneId === zone.id`.
- Test in `tests/unit/lib/silhouettes/vehicle.test.ts` — verify zone count + that all zone ids are unique + that the constant array matches the file order.

**Implementation notes.**
- Side-view tank skeleton: hull (chassis), turret on top, main gun, tracks at bottom. Doesn't need to be detailed — readability of zones at 200px wide is what matters, same constraint as Infantry.
- For body-type change, only invalidate `silhouetteZoneId` on zones whose id is not present in the new silhouette's zone metadata. Don't auto-delete content.

**Acceptance criteria.**
- `npm run typecheck` exits 0.
- `npm run test:unit` adds vehicle zone test.
- Creating a recipe with `bodyType: "vehicle"` and opening it renders the vehicle silhouette.
- Clicking any zone fires `onSelectZone` with the right id.
- Changing an existing recipe's body type from infantry to vehicle keeps zone names + steps; previously-anchored `silhouetteZoneId`s revert to null (no crash, no lost data).

**Commit message:** `P6.2: vehicle silhouette + body-type picker`

---

## P6.3 — Monster + Terrain silhouettes

- [ ] Build this milestone
- [PAUSED] **Do not run this milestone autonomously.** Same reason as P6.2 —
  paused on Ross's hand-created SVG art. The Silhouette wrapper component
  from P6.2 is the prerequisite; once that lands with real art, P6.3
  follows the same drop-in pattern for Monster + Terrain.

**Context.** The remaining two deferred body types. Ships together because they share the same pattern as Vehicle (P6.2) — by this point the silhouette wrapper from P6.2 is in place and we're just adding two more SVG modules + zone metadata exports.

**Files to create.**
- `src/lib/silhouettes/monster.ts` — `MONSTER_ZONES`. Twelve zones: hide-primary / hide-secondary / scales-or-fur / horns-or-teeth / claws / eyes / belly-or-underside / wings / muscle-tone / tongue-or-mouth / spikes-or-frills / base.
- `src/lib/silhouettes/terrain.ts` — `TERRAIN_ZONES`. Twelve zones: stone-primary / stone-trim / metal-details / wood / vegetation / dirt-or-ground / weathering-wash / debris / windows-or-glass / paint-chipping / rust / base.
- `src/components/recipes/MonsterSilhouette.tsx` — generic large creature outline (think Hierodule / Carnifex). Same prop signature as Infantry / Vehicle.
- `src/components/recipes/TerrainSilhouette.tsx` — ruined building / hill outline. Same prop signature.

**Files to modify.**
- The `<Silhouette bodyType=... />` wrapper from P6.2 — dispatch the two new body types.
- `src/components/recipes/InfantrySilhouette.tsx` — no change (just confirms the wrapper signature is followed).

**Patterns to follow.**
- Same SVG idiom as Infantry / Vehicle. Hand-built path data; under 8KB each.
- Tests: `tests/unit/lib/silhouettes/{monster,terrain}.test.ts` — zone counts + uniqueness + canonical order.

**Implementation notes.**
- Monster: side-view with head left, tail right, four limbs visible.
- Terrain: 3/4-view of a ruined column-and-arch.
- Both deliberately generic — painter associates their specific kit to the closest zone.

**Acceptance criteria.**
- `npm run typecheck` exits 0.
- Creating a recipe with each of the three new body types renders the correct silhouette.
- Switching between all four body types on an existing recipe works (no crashes, no lost zone names).

**Commit message:** `P6.3: monster + terrain silhouettes`

---

## P6.4 — Mobile-first layouts: per-flow audit

- [ ] Build this milestone

**Context.** Walk the five primary surfaces on a real phone viewport (375px wide). Fix anything that's awkward to use with a thumb. This is a polish milestone, not a re-architecture — most layouts already collapse correctly; this is the "actually try it" pass.

**Files to modify.**
- `src/components/library/FilterRail.tsx` — confirm bottom-sheet drawer on mobile, fix sticky positioning + close affordance.
- `src/components/recipes/RecipeEditorClient.tsx` — confirm the desktop three-pane → mobile three-tab transition (Body / Zones / Notes) actually works; fix the swatch tap-target sizes if they're too small.
- `src/components/recipes/PaintSlotPicker.tsx` — confirm the popover lands within viewport on mobile and isn't clipped by the bottom tab bar (z-index + bottom-offset).
- `src/components/wishlist/WishlistTable.tsx` + `WishlistDetailDrawer.tsx` — confirm the row → drawer transition on mobile.
- `src/components/StageCounter.tsx` — confirm the `+` / `−` buttons are ≥ 44px on mobile (CSS class `tap-target` already ensures this; verify the column stack on narrow viewports).
- `src/components/dashboard/RecentlyBoughtLine.tsx` + `src/components/wishlist/TopWishesPanel.tsx` — confirm the dashboard panels don't overflow at 375px.

**Patterns to follow.**
- `@media (max-width: 767px)` is the contract. Anything above is desktop. The Tailwind `md:` breakpoint defaults to 768px — match it.
- Where a layout currently uses a fixed pixel offset (e.g. `top-12`), use `safe-area-inset-top` on iPhone X-class headers.
- Audit checklist for each surface:
  - Can every interactive element be tapped without zoom?
  - Does scrolling reach every action?
  - Is the bottom tab bar overlapping content? If so, add `pb-20` to the affected layout.
  - Does the page render without horizontal scroll?

**Implementation notes.**
- Don't add new components in this milestone. Only fix existing ones.
- Take a screenshot of each fix and add it to `app/docs/MOBILE_AUDIT.md` so future polish passes can compare.

**Acceptance criteria.**
- `npm run typecheck` exits 0.
- A manual smoke run on a 375×812 viewport (Chrome DevTools "iPhone X") of each primary surface produces no horizontal scroll, no clipped content, and every interactive element is tappable.
- `app/docs/MOBILE_AUDIT.md` exists with before/after notes per surface.

**Commit message:** `P6.4: mobile layout audit + per-surface fixes`

---

## P6.5 — Native share sheet + camera eyedropper

- [ ] Build this milestone

**Context.** Two mobile-platform integrations that make the app feel native: the Web Share API for "Share recipe" (so it pops the OS share sheet — Messages / WhatsApp / Discord — instead of opening a copy modal), and `getUserMedia` for live camera sampling in the Eyedropper.

**Files to create.**
- `src/lib/share/webShare.ts` — pure helper `nativeShare({ title, text, url }): Promise<boolean>`. Wraps `navigator.share` with a feature-detect; resolves `true` if the share dialog completed (or was cancelled — they're indistinguishable per spec), `false` if the API isn't supported.
- `src/components/tools/eyedropper/CameraSampler.tsx` — `'use client'`. `getUserMedia({ video: true })` → renders the stream in a `<video>` with a fixed crosshair → on tap, samples a 5×5 pixel patch under the crosshair → returns the median colour. Fallback: hidden if `navigator.mediaDevices` is undefined.

**Files to modify.**
- `src/components/recipes/ShareModal.tsx` — on a device that supports `navigator.share`, the modal opens with a `[ Share via... ]` button at the top that calls `nativeShare(...)`. The four existing sections (URL / QR / Markdown / JSON) remain available below for desktop / fallback use.
- `src/components/tools/eyedropper/EyedropperClient.tsx` — add `[ Use camera ]` button next to the drop-zone on mobile; clicking it mounts `<CameraSampler />`. Sampled colours append to the palette (max 6, same as the k-means flow).

**Patterns to follow.**
- Feature-detect at module level, not inside the component, so unsupported devices never see the affordance.
- `getUserMedia` requires HTTPS in production — works on `localhost` for dev. Document this in the milestone notes.
- Don't request the camera until the painter taps the button; respect privacy.

**Implementation notes.**
- The 5×5 sample reduces noise vs sampling a single pixel; use a median-per-channel (not mean) to ignore outlier pixels at the crosshair edge.
- Camera permission denial: catch the `NotAllowedError` and surface a friendly inline message.
- Don't try to support live video colour streaming — single-tap sample is plenty for v1.

**Acceptance criteria.**
- `npm run typecheck` exits 0.
- On Chrome desktop, the Share modal still opens with the four sections; no Web Share button.
- On iOS Safari (or Chrome dev tools mobile emulation), the Share modal shows the `[ Share via... ]` button and triggers the native share sheet.
- On a device with camera, the Eyedropper `[ Use camera ]` button mounts the sampler and a tap appends a colour to the palette.
- Permission denial shows a friendly message; the rest of the eyedropper still works (drop / paste image).

**Commit message:** `P6.5: web share API + camera eyedropper`

---

## P6.6 — Polish concerns from Phases 3-5

- [ ] Build this milestone

**Context.** The catch-up milestone for small UX debts flagged across earlier phases:

- **Zone reorder UI** (P3 concern) — the `reorderZones` server action exists but the editor only supports delete + re-add. Add a drag handle.
- **`window.prompt` for palette save** (P4 concern) — replace with a proper `<dialog>` named-prompt.
- **Step notes hidden below `lg`** (P3 concern) — surface notes in a tappable expand on narrower viewports.
- **Per-recipe OG image** (P5 plan deferred) — render a tiny palette-strip OG image for shared recipe URLs so Discord / Twitter unfurls look right.

**Files to create.**
- `src/components/tools/PaletteSaveDialog.tsx` — `'use client'`. Replaces `window.prompt`. Named field + save / cancel.
- `src/app/r/[slug]/opengraph-image.tsx` — Next.js dynamic OG image route. Renders the recipe's palette strip + name on a 1200×630 canvas. Uses `next/og`.

**Files to modify.**
- `src/components/recipes/ZoneList.tsx` — add HTML5 drag handles to each zone row; on drop, call `reorderZones` (existing P3.2 action).
- `src/components/recipes/StepRow.tsx` — make the notes input always present on mobile via an inline expand-on-tap below the step's main row.
- The four tool clients (`WheelClient` / `MatchClient` / `EyedropperClient` / `GradientClient`) — swap `window.prompt(...)` for `<PaletteSaveDialog />`.

**Patterns to follow.**
- Drag-and-drop: HTML5 native API, same idiom as P3.5's step reorder. No `react-dnd`.
- OG image: `next/og`'s `ImageResponse` is the standard. Pull only the recipe palette + name from the DB; don't render zones / steps (the image is too small to read them anyway).

**Implementation notes.**
- For OG: cache `Cache-Control: public, max-age=3600`. Recipes change rarely.
- Mobile step notes: a small disclosure caret next to the technique label expands the row to show the notes input.

**Acceptance criteria.**
- `npm run typecheck` exits 0.
- Dragging a zone in the editor reorders it; the new order persists.
- Saving a palette opens the new dialog (not `window.prompt`).
- A shared recipe URL produces an Open Graph image showing the palette + name.
- Step notes are tappable / visible on iPhone-X-class viewports.

**Commit message:** `P6.6: zone reorder + palette dialog + OG image + mobile notes`

---

## P6.7 — Performance pass: bundle size + Lighthouse

- [ ] Build this milestone

**Context.** Run Lighthouse against the production build and fix the biggest hits. Aim: 90+ mobile, 95+ desktop. Document the numbers before/after.

**Files to create.**
- `app/docs/PERFORMANCE_AUDIT.md` — table of Lighthouse scores per primary route before / after the audit. Include the 3-5 biggest issues found and how they were fixed.

**Files to modify.**
- `src/app/library/page.tsx` — confirm paint catalog is lazy-loaded on the client (Dexie cache hit avoids the 2-3MB fetch on second view).
- `next.config.ts` — enable `images.formats: ["image/webp"]` and any other easy wins.
- Component imports across `src/app/tools/*` — verify per-tool code isn't bundled into the shared layout (dynamic import the heavy bits if not already).

**Patterns to follow.**
- Build via `npm run build`, serve via `npm run start`, audit via `npx lighthouse <url> --preset=desktop` and `--form-factor=mobile`.
- Focus on the V2-BUILD-PLAN flows: `/`, `/library`, `/projects`, `/recipes`, `/tools/eyedropper` (heaviest).
- Acceptable targets: TBT < 200ms, CLS < 0.1, LCP < 2.5s on simulated 4G.

**Implementation notes.**
- The eyedropper k-means + canvas processing is the hottest CPU path on mobile. If TBT is breaching, move it into a Web Worker.
- 7,128-entry paints.json is ~2-3MB uncompressed. Confirm Next's static gzip is serving the compressed version.

**Acceptance criteria.**
- `npm run typecheck` exits 0.
- Lighthouse mobile score ≥ 90 on `/`, `/library`, `/projects`, `/recipes/[id]`.
- Lighthouse desktop score ≥ 95 on the same routes.
- `app/docs/PERFORMANCE_AUDIT.md` contains before/after numbers + the 3-5 biggest fixes applied.

**Commit message:** `P6.7: lighthouse pass — mobile 90+, desktop 95+`

---

## P6.8 — Mobile E2E suite (Playwright mobile viewports)

- [ ] Build this milestone

**Context.** Lock the mobile flows down with a Playwright project that runs against an iPhone-X viewport. The ship criterion ("every primary flow works on Ross's phone") needs a regression guard.

**Files to create.**
- `tests/e2e/qa_mobile_flows.spec.ts` — three top-level missions:
  - **M6.1** — sign in → bottom tab bar visible → tap each tab → no horizontal scroll on any page.
  - **M6.2** — create a Unit project from `/projects/new` on mobile → land in workspace → bump Owned + Build → reload → verify persistence.
  - **M6.3** — library Flow 7 on mobile (3 taps): from `/library` filter to a paint → detail panel renders without clipping.

**Files to modify.**
- `playwright.config.ts` — add a second project named `chromium-mobile` using `devices["iPhone 12"]`. The existing `chromium` project stays as the desktop suite.
- `app/docs/TESTING.md` — append a short section on the mobile project (`npm run test:e2e --project chromium-mobile`).

**Patterns to follow.**
- Reuse `signInAs()` / `freshTestEmail()` from `tests/e2e/_helpers/auth.ts`.
- For multi-viewport tests, prefer `test.use({ viewport: ... })` over hard-coded resizes.

**Implementation notes.**
- Don't go wild on selectors — most of the existing role-based selectors already work on mobile because the markup is the same.
- If a test breaks because a mobile layout hides an element, the right fix is usually a `scrollIntoView` on the locator, not a sleep.

**Acceptance criteria.**
- `npm run typecheck` exits 0.
- `npm run test:e2e -- --project chromium-mobile` passes all three M6.x missions.
- The existing `chromium` desktop project still passes.

**Commit message:** `P6.8: mobile E2E project + 3 mission specs`

---

## Phase 6 ship checklist

After P6.8 lands, before declaring Phase 6 done:

- Ross runs every primary flow (V2-BUILD-PLAN §6, Flows 1-9) on his actual phone — not the emulator — and confirms each works thumb-only.
- Lighthouse mobile ≥ 90, desktop ≥ 95 across `/`, `/library`, `/projects`, `/recipes/[id]`, `/tools/eyedropper`.
- All Phase 6 milestones tick green in this file.
- No regressions in Phases 1-5 flows (`npm test && npm run test:e2e`).
- The four body silhouettes (Infantry / Vehicle / Monster / Terrain) all render cleanly when a recipe of that type opens.

**Deferred to later phases (do NOT build in Phase 6):**
- **Pull-to-refresh** on lists → Phase 7 or polish.
- **Long-press "more" menus** → Phase 7 or polish.
- **PWA installability + offline-first** → post-launch.
- **Barcode scanner for inventory add** → v2 (per V2-BUILD-PLAN §12).
- **Community / public browse** → Phase 7.
- **Influencer technique guides** → Phase 7.

---

## Conventions for milestone-builder

Same as PHASE1-5_PLAN.md:

- **Commit only locally; do NOT push.** Ross reviews before pushing.
- **Pre-commit:** `npm run typecheck` 0 errors. Refuse to commit if it fails.
- **Pre-commit:** if the milestone added source under `src/lib/` or `src/lib/actions/`, also run `npm test` and commit only if green. **CRITICAL — stage new test files INTO the same commit as the feature they test.** Phase 4 leaked 6 files → housekeeping commit `26d01ce`; Phase 5 surfaced 4 more Phase-4 orphans → housekeeping commit `3afc0c3`. Don't add a third entry to that chain.
- **Plan-tick chores are OPTIONAL.** Phase 5 split feature + plan-tick into two commits per milestone (16 commits for 8 milestones). Prior phases bundled the plan tick INTO the feature commit (1 commit per milestone, cleaner history). Bundling is preferred; if you ship the chore separately for clarity, name it consistently (`chore: tick PHASE6_PLAN P6.X`).
- **New dependencies** flagged in commit body. Phase 6 may or may not add deps — there's no required new one in the plan. Keep the surface tight per established practice.
- **No `any`. No `@ts-ignore`.** Strict mode mandatory.
- **`"use server"` files export ONLY async functions.** Pure helpers go in `src/lib/<domain>/<name>.ts`. Phase 1, Phase 3 both shipped this bug; don't be the third.
- **Server-side first.** Mobile chrome (BottomTabBar, MobileHeader) needs `'use client'` for `usePathname`; everything else stays server.
- **Match existing patterns.** Read neighbouring silhouette / component files before introducing new ones.
- **Tailwind v4 syntax.** CSS-first `@theme`. Use existing tokens — no arbitrary hex.
- **Halt and report** if a milestone has an architectural decision the plan doesn't cover. Do not guess.
