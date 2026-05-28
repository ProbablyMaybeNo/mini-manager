# Mini Manager — Phase 4 Build Plan

Source of truth for the milestone-builder agent. Each unchecked item is a self-contained milestone with scope, patterns, and acceptance criteria. Build top-down. Tick the box when shipped.

**Phase goal (per V2-BUILD-PLAN §11.4):** Tools — four single-purpose colour utilities a painter opens mid-task and hands back into a recipe. Each tool follows the same top-level shape: **input → output → "send to recipe" or "save"**. Wheel and Match are ports from v1 (`../app-src/src/app/wheel/page.tsx`, `../app-src/src/app/match/page.tsx`, `../app-src/src/components/wheel/ColorWheelCanvas.tsx` — ~1080 lines combined); Eyedropper and Gradient are new.

**Ship criterion (V2-BUILD-PLAN):** Any tool can hand its output to a recipe in one click.

**Mix-from-inventory** is explicitly deferred to v2 per the plan.

**Already shipped (do not re-run):** none — Phase 4 starts fresh on top of Phase 3.

**Remaining (build in this order):**

---

## P4.1 — Tools landing page + shared tool shell

- [x] Build this milestone

**Context.** A single `/tools` index page that lists the four tools as cards, plus a shared layout that wraps each tool route. Each tool is one-purpose: input on top, output below, one or more "send → " action buttons at the bottom. The shell handles breadcrumbs, "back to tools", and the common action buttons; tools just plug in their middle content.

**Files to create.**
- `src/app/tools/page.tsx` — server component. Four `<ToolCard />` items (Wheel / Match / Eyedropper / Gradient) with brief blurbs and a phosphor-green active state on hover.
- `src/app/tools/layout.tsx` — server component. Common breadcrumb header `[ ← Tools ] > {tool name}`, page padding, max-width container.
- `src/components/tools/ToolCard.tsx` — single card. Title, blurb, icon glyph, link to `/tools/[id]`.
- `src/components/tools/ToolShell.tsx` — `'use client'`. Layout primitive used inside each tool page: 2-pane on desktop (input pane / output pane), single-scroll on mobile. Renders a sticky footer with `[ Save palette ]` and `[ Send to recipe ]` actions.
- `src/lib/tools/types.ts` — shared types: `ToolPaletteOutput` (the unified shape every tool emits — array of `{ hex, name?, sourcePaintId? }`), `ToolId` union.

**Files to modify.**
- `src/app/tools/page.tsx` is currently a Phase-2 placeholder — replace.
- `src/components/NavRail.tsx` — already has `[T] Tools`. No change.

**Patterns to follow.**
- Tool routes will be `/tools/wheel`, `/tools/match`, `/tools/eyedropper`, `/tools/gradient`. The shell-layout pattern matches what Recipes did in P3.4 — three-pane desktop, tabs mobile, but for Tools it's two-pane.
- The `ToolPaletteOutput` shape is the lingua franca for cross-tool flow (P4.7 wires this into a recipe).

**Acceptance criteria.**
- `npm run typecheck` exits 0.
- `/tools` shows four cards; clicking any navigates to `/tools/[id]` (which 404s for now — tools land in later milestones).
- Breadcrumb on the shell links back to `/tools`.

**Commit message:** `P4.1: tools landing + shared shell`

---

## P4.2 — Color Wheel (port from v1)

- [x] Build this milestone

**Context.** HSL canvas with draggable pickers. Eight harmony modes (complementary, analogous, triadic, tetradic, split-complementary, square, monochromatic, accented analogous). Each generated swatch has a `[ Find in library ]` button that opens the PaintSlotPicker filtered by hex proximity. The v1 implementation at `../app-src/src/app/wheel/page.tsx` + `../app-src/src/components/wheel/ColorWheelCanvas.tsx` is the starting point — port the math; rebuild the UI against the new component vocabulary.

**Files to create.**
- `src/app/tools/wheel/page.tsx` — server shell + client child.
- `src/components/tools/wheel/WheelCanvas.tsx` — `'use client'`. Canvas-based HSL wheel; draggable pickers; emits the selected swatches upward via callback.
- `src/components/tools/wheel/WheelClient.tsx` — `'use client'`. Owns the picked-hex state, the harmony mode, the saved-palette UI. Wraps `<WheelCanvas />` and `<HarmonyPicker />` and the swatch list.
- `src/components/tools/wheel/HarmonyPicker.tsx` — `'use client'`. 8-button bar to switch harmony mode.
- `src/components/tools/wheel/SwatchActions.tsx` — `'use client'`. Per-swatch row: hex / copy / `[ Find in library ]` (opens `<PaintSlotPicker />` from P3.5 in a popover) / `[ Pin ]` (locks the swatch so harmonies recompute around it).
- `src/lib/tools/wheel/harmonies.ts` — pure functions: `complementary(hue)`, `analogous(hue, spread)`, `triadic(hue)`, `tetradic(hue, angle)`, `splitComplementary(hue, spread)`, `square(hue)`, `monochromatic(hue)`, `accentedAnalogous(hue)`. Each returns an array of hex strings (compose with the picked HSL's saturation + lightness).

**Files to modify.**
- `src/lib/tools/types.ts` (from P4.1) — extend if needed.
- Reuse `<PaintSlotPicker />` from `src/components/recipes/PaintSlotPicker.tsx` — its filter-driven library popover IS the "find in library" UX.

**Patterns to follow.**
- Pure functions in `src/lib/tools/wheel/harmonies.ts` MUST be unit-tested (see P4.8).
- Canvas drawing in `<WheelCanvas />` uses HSL → RGB inline (no external colour lib unless explicitly approved).
- Maintain the v1 aesthetic: black background, phosphor-green outer ring labels, draggable picker shows a small crosshair.

**Implementation notes.**
- Pick is a 2D coord on the HSL disk: angle = hue, radius = saturation. Lightness is a separate slider below the canvas.
- Mobile: canvas size capped at `min(viewport-width − 32px, 400px)`. Touch events for picker drag.
- The "find in library" affordance reuses the recipe step's `<PaintSlotPicker />` so the painter sees the same UX everywhere.

**Acceptance criteria.**
- `npm run typecheck` exits 0.
- `/tools/wheel` loads with a default red pick at 0°, complementary harmony, two swatches.
- Switching harmony mode updates the swatch count + positions.
- Dragging the pick rotates harmonies around the wheel live (no flicker).
- Clicking `[ Find in library ]` on a swatch opens the PaintSlotPicker filtered to that hex.

**Commit message:** `P4.2: color wheel + 8 harmony modes`

---

## P4.3 — Cross-brand Match (ΔE2000)

- [x] Build this milestone

**Context.** Paste a hex or pick a paint; see the top N closest paints across every brand with ΔE2000 distance and a traffic-light confidence (green < 2, amber < 5, grey ≥ 5). v1 had a working version at `../app-src/src/app/match/page.tsx` (~465 lines) — port the math; rebuild the UI.

**Files to create.**
- `src/app/tools/match/page.tsx` — server shell + client child.
- `src/components/tools/match/MatchClient.tsx` — `'use client'`. Top-of-page input (hex input + colour swatch preview + "or pick a paint from the library" button). Below: results table with brand / line / name / hex / ΔE / traffic dot / `[ Use ]` action.
- `src/components/tools/match/MatchResultsRow.tsx` — single row component, mono table style.
- `src/lib/tools/match/deltaE.ts` — pure functions: `hexToLab(hex) → { L, a, b }` (sRGB→XYZ→Lab D65), `deltaE2000(a, b) → number`. No external colour lib (port from v1 if it's already inline, otherwise implement from the CIEDE2000 spec).
- `src/lib/tools/match/find.ts` — `findClosestPaints(targetHex, paints, opts) → MatchResult[]`. Sorted ascending by ΔE2000. Defaults to top 50 results.

**Files to modify.**
- `src/lib/tools/types.ts` — add `MatchResult = { paint: Paint; deltaE: number; confidence: "high" | "medium" | "low" }`.

**Patterns to follow.**
- `deltaE.ts` is the **only** new colour-science module; everything else uses it. Unit-test it against the published CIEDE2000 reference pairs.
- The library catalog is loaded via the existing `loadPaints()` from `src/lib/paints/loader.ts` — server passes the JSON in, client filters.
- "Use" on a row pipes the chosen paint into the (Phase 4.7) send-to-recipe flow — for this milestone, the action is a placeholder that copies the hex to clipboard + shows a toast.

**Implementation notes.**
- Confidence buckets: ΔE < 2 → green (perceptually identical); ΔE < 5 → amber (close); otherwise grey.
- Allow filtering results by brand multi-select (so "show me only Vallejo matches" works).
- Result count: default top 50, paginate beyond.

**Acceptance criteria.**
- `npm run typecheck` exits 0.
- Pasting `#0E4A8A` into the match input shows Citadel Macragge Blue at or very near the top with ΔE close to 0.
- The CIEDE2000 implementation matches the canonical test pairs (covered by unit tests in P4.8).
- Filtering to "Vallejo" only shows Vallejo rows.

**Commit message:** `P4.3: cross-brand ΔE2000 match`

---

## P4.4 — Palette schema + save-palette action

- [ ] Build this milestone

**Context.** Free-floating saved colour sets. Tools emit them; Recipes consume them. A Palette is an array of hexes (optionally pinned to paint ids). Lives separately from Recipes; not project-scoped.

**Files to create.**
- `src/db/schema.ts` additions:
  ```
  palette (sqliteTable "palette")
    id (nanoid)
    ownerId (fk → users.id, cascade)
    name (text, not null)
    source (text enum: "manual" | "wheel" | "eyedropper" | "match" | "gradient")
    colorHexes (text, JSON-encoded array of #RRGGBB strings)
    paintIds (text, JSON-encoded array of nullable paint ids — same length as colorHexes)
    createdAt / updatedAt
  -- Index on (ownerId)
  ```
  Add the new relation on `usersRelations`.
- `src/db/queries/palettes.ts` — `listPalettes(userId)`, `getPalette(userId, id)`.
- `src/lib/actions/palettes.ts` — server actions:
  - `createPalette(input)` — `{ name, source, colorHexes, paintIds? }`; Zod-validated; sets the JSON-encoded columns.
  - `deletePalette(id)` — ownership-checked.
  - `renamePalette(id, name)`.
- New Drizzle migration via `npm run db:generate`.

**Files to modify.**
- `src/lib/tools/types.ts` — `ToolPaletteOutput` already shares this shape; reuse.
- The four tool clients (from P4.2 / 4.3 / 4.5 / 4.6) gain a `[ Save palette ]` button that calls `createPalette`. Wire that in their respective milestones; this milestone just lands the data layer.

**Patterns to follow.**
- JSON-encoded text columns instead of separate rows is deliberate — palettes are read-and-write whole; no per-row queries.
- Always validate `colorHexes` is a non-empty array of well-formed `#RRGGBB` strings; reject otherwise.
- `paintIds` length must match `colorHexes` length when supplied; otherwise null-fill.

**Acceptance criteria.**
- `npm run typecheck` exits 0.
- Migration applies cleanly.
- Throwaway `createPalette({ name: "Test", source: "wheel", colorHexes: ["#0E4A8A","#33FF66"] })` round-trips.

**Commit message:** `P4.4: palette schema + save actions`

---

## P4.5 — Image Eyedropper

- [ ] Build this milestone

**Context.** Drop a reference image (or paste from clipboard); the tool extracts 6 dominant colours via k-means and shows each with the three closest paints across all brands. Future Phase 6 polish adds live camera sampling via `getUserMedia`.

**Files to create.**
- `src/app/tools/eyedropper/page.tsx` — server shell + client child.
- `src/components/tools/eyedropper/EyedropperClient.tsx` — `'use client'`. Drop-zone (`onDrop` / `onPaste`), preview, extracted-palette row, per-swatch closest-paints subrow.
- `src/components/tools/eyedropper/DropZone.tsx` — `'use client'`. Accepts file drop / clipboard paste / file picker fallback. Validates: jpg/png/webp/gif, max 10MB.
- `src/lib/tools/eyedropper/kmeans.ts` — pure functions: `extractDominantColors(imageData, k = 6) → string[]`. K-means++ initialisation, RGB space, 12 iterations max, sample at most 30,000 pixels (random subsample for big images so we don't lock the main thread).
- `src/lib/tools/eyedropper/sample.ts` — `imageToPixels(blob: Blob) → Promise<Uint8ClampedArray>`. Uses `createImageBitmap` + offscreen canvas.

**Files to modify.**
- Reuse `findClosestPaints` from P4.3 for the per-swatch matches.

**Patterns to follow.**
- All k-means math is pure-function, deterministic given a seeded RNG (seed via a hash of the image data). Unit-test in P4.8.
- DON'T add a heavy image-processing dep. Native canvas + Uint8ClampedArray is plenty.
- Browser `EyeDropper` API (the per-pixel native picker) is a stretch — note in the milestone but defer to Phase 6 if it adds friction.

**Implementation notes.**
- For images > 1MP, subsample to ~30k pixels via random index — k-means is sensitive to bias from systematic strides (e.g. sky pixels).
- Editable palette: clicking a swatch removes it; clicking blank space adds a sampled hex from the cursor's pixel.
- `[ Save as palette ]` (uses P4.4) and `[ New recipe from palette ]` (uses P4.7) are both available.

**Acceptance criteria.**
- `npm run typecheck` exits 0.
- Dropping a known reference image extracts 6 colours; the closest-paint subrow shows recognisable matches (e.g. a Mephiston-Red-dominant image returns Mephiston Red in the top 3 for that swatch).
- Clipboard paste of a copied image works (Chrome/Edge tested).
- Files > 10MB are rejected with a friendly error.

**Commit message:** `P4.5: eyedropper — k-means image dominant colours`

---

## P4.6 — Gradient Builder

- [ ] Build this milestone

**Context.** Painter picks base + shadow + highlight; gets a 3-7 step interpolated gradient and the closest paint per step. Used for transition planning.

**Files to create.**
- `src/app/tools/gradient/page.tsx` — server shell + client child.
- `src/components/tools/gradient/GradientClient.tsx` — `'use client'`. Three hex inputs (base / shadow / highlight) with side-by-side previews; step-count slider (3-7); rendered ramp; per-step paint match.
- `src/components/tools/gradient/RampDisplay.tsx` — `'use client'`. Single horizontal bar split into N segments; per-segment hex label below + closest-paint name.
- `src/lib/tools/gradient/interpolate.ts` — `buildRamp({ base, shadow, highlight, steps }) → string[]`. Walks Lab-space: split N steps between shadow → base → highlight (each half gets `floor(N/2)` rounded). Lab-space interpolation gives more perceptually-even ramps than RGB.

**Files to modify.**
- Reuse `hexToLab` from P4.3 (`src/lib/tools/match/deltaE.ts`) — already does sRGB → Lab.
- Reuse `findClosestPaints` from P4.3 for the per-step paint match.

**Patterns to follow.**
- Pure `buildRamp` function unit-tested in P4.8.
- Step count is bound to a number input (no overshoot beyond 3-7).

**Implementation notes.**
- Default base = Macragge Blue, default shadow = a dark variant, default highlight = a light variant — so first paint is immediately useful.
- The painter expects "base in the middle" — render order: shadow on the left, base in the middle, highlight on the right.
- Optional `[ Add midtone ]` later — out of scope for v1.

**Acceptance criteria.**
- `npm run typecheck` exits 0.
- Default state renders a 5-step blue gradient with sensible paint matches.
- Increasing the step count to 7 doesn't shift the visual positions of base / shadow / highlight — they remain anchored.
- `[ Save as palette ]` works (uses P4.4).

**Commit message:** `P4.6: gradient builder — 3-7 step Lab ramps`

---

## P4.7 — Send-to-recipe cross-tool flow

- [ ] Build this milestone

**Context.** Every tool can hand its output to a recipe in one click — the V2-BUILD-PLAN ship criterion for Phase 4. A `<SendToRecipeModal />` opens from any tool's footer action and lets the painter pick a target recipe + zone + insert position; OR create a new standalone recipe from the palette.

**Files to create.**
- `src/components/tools/SendToRecipeModal.tsx` — `'use client'`. Two tabs:
  - **Add to existing recipe** — combobox of the user's recipes → combobox of zones (or `[ Add new zone ]`) → insert position (append / replace selected step).
  - **New recipe from palette** — name input → creates an empty recipe + one zone called "Palette" + one step per palette colour (technique defaults to basecoat; `customColorHex` set when no paint match; `paintId` set when there's a sub-2-ΔE match).
- `src/lib/actions/sendToRecipe.ts` — server action `sendPaletteToRecipe({ paletteHexes, targetRecipeId?, targetZoneId?, newRecipeName? })`. Validates, decides which branch, calls into the existing P3.2 zone/step actions.

**Files to modify.**
- All four tool clients (`WheelClient`, `MatchClient`, `EyedropperClient`, `GradientClient`) gain a `[ Send to recipe ]` footer button (currently the placeholder slot from P4.1).

**Patterns to follow.**
- "Empty palette" guard: send-to-recipe is disabled when the tool has no swatches.
- Match tool sends a single-paint result (1-element palette).
- After successful send, the modal closes + the painter gets a confirmation flash with a `[ Open recipe ]` link.

**Acceptance criteria.**
- `npm run typecheck` exits 0.
- Wheel: pick triadic, hit `[ Send to recipe ]`, pick "new recipe", name it; lands on `/recipes/[id]` with three steps prefilled.
- Eyedropper: drop image, extract 6 colours, send to an existing recipe's existing zone → six steps appended in order.
- Match: clicking `[ Use ]` on a result sends just that paint to a chosen recipe step.

**Commit message:** `P4.7: send-to-recipe cross-tool flow`

---

## P4.8 — Tool unit tests + smoke E2E

- [ ] Build this milestone

**Context.** Lock the colour-science maths down before they rot. The math modules from this phase are pure functions — perfect for unit tests.

**Files to create.**
- `tests/unit/lib/tools/wheel/harmonies.test.ts` — assert each harmony returns the expected hue offsets relative to the input (complementary = +180, triadic = +120 / +240, etc.).
- `tests/unit/lib/tools/match/deltaE.test.ts` — assert `hexToLab` matches the published sRGB → Lab D65 reference; assert `deltaE2000` matches the published CIEDE2000 reference test pairs (Sharma et al. — at least 5 of the 34 published pairs).
- `tests/unit/lib/tools/eyedropper/kmeans.test.ts` — given a synthetic image with three blocks of colour, k=3 returns those three colours.
- `tests/unit/lib/tools/gradient/interpolate.test.ts` — assert ramp anchors (shadow/base/highlight) sit at predictable positions; assert N-step monotonicity in L*.
- `tests/e2e/qa_tools.spec.ts` — M4.1: navigate /tools → wheel → drag pick → trigger send-to-recipe → modal opens. Smoke-level. (Per TESTING.md: mission-discovery patterns get added on first surface).

**Files to modify.**
- `app/docs/MISSIONS.md` (if it exists yet) — add M4.x entries.

**Patterns to follow.**
- The `_shims/server-only.ts` alias in `vitest.config.ts` already handles any `import "server-only"` in tool modules. No new shimming needed.
- Reuse the `signInAs()` / `freshTestEmail()` helpers in `tests/e2e/_helpers/auth.ts`.

**Acceptance criteria.**
- `npm test` passes; total test count increases by the new tests.
- `npm run test:e2e` passes; M4.1 added.
- CIEDE2000 implementation matches published reference pairs to within ΔE < 0.01.

**Commit message:** `P4.8: tools test coverage + first tool E2E`

---

## Phase 4 ship checklist

After P4.8 lands, before declaring Phase 4 done:

- Ross opens each of the four tools, plays with each for 5 minutes, can articulate what painter problem each one solves.
- Ross does the V2-BUILD-PLAN ship criterion end-to-end: open Wheel → pick a harmony → `[ Send to recipe ]` → recipe step created.
- `npm run typecheck` exits 0.
- All Phase 4 milestones tick green in this file.
- No regressions in Phase 1/2/3 flows (run the full E2E suite + spot-check Library, Wishlist, Project workspace, Recipe editor).

**Deferred to later phases (do NOT build in Phase 4):**
- **Mix-from-inventory** → v2.
- **Live camera eyedropper** (`getUserMedia`) → Phase 6.
- **Native browser EyeDropper API** for per-pixel picking → Phase 6 stretch.
- **Saved-palette browse page** → Phase 5 (sharing-related) or Phase 6 polish.

---

## Conventions for milestone-builder

Same as PHASE1/2/3_PLAN.md:

- **Commit only locally; do not push.** Ross reviews before pushing.
- **Pre-commit:** `npm run typecheck` 0 errors. Refuse to commit if it fails.
- **Pre-commit (NEW from Phase 3 onward):** if the milestone added source under `src/lib/` or `src/lib/actions/`, also run `npm test` (unit + integration) and commit only if green.
- **New dependencies** flagged in commit body. Phase 2 + 3 deliberately skipped culori / react-window / linkedom — keep the surface tight.
- **No `any`. No `@ts-ignore`.** Strict mode mandatory.
- **Match existing patterns.** Read neighbouring files before introducing new ones.
- **Tailwind v4 syntax.** CSS-first `@theme`. Use existing tokens — no arbitrary hex.
- **Server-side first.** Default to server components. `'use client'` only when interactivity needs it.
- **"use server" files export ONLY async functions.** Pure helpers go in a sibling `lib/<x>/cascade.ts` or `lib/<x>/<name>.ts`. Phase 1 and Phase 3 both shipped this bug — don't be the third.
- **Halt and report** if a milestone has an architectural decision the plan doesn't cover. Do not guess.
