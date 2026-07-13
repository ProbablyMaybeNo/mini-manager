# Gallery / Moat — Build Batch

A checklist for the milestone-builder. Work milestones **in order, one per run**.
Tick a box only when its PR is open and green.

## Conventions (read first)
- Node 24 / npm 11 (matches CI). If deps are missing: `npm ci`.
- **Validate with `npm run build`** — it runs typecheck + ESLint via Next's
  integration. `next lint` is broken in this repo; do NOT use it.
- `next build` stamps `public/sw.js` with a build id → run
  `git checkout public/sw.js` after every build so `sw/strategy.test.ts` stays
  green.
- TS strict, zero type errors. Match neighbouring file patterns; no new
  abstractions, no mock data.
- SQLite tables are **singular** (`recipe`, `user`). Drizzle schema in
  `src/db/schema.ts`; generate migrations with `npm run db:generate`.
- **Git flow:** branch per milestone (`feat/…` or `fix/…`), commit (end message
  with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`),
  push, **open a PR to `main`, then STOP — do NOT merge.** Ross merges after CI.
- **Halt and report** if a milestone needs a design decision or tests fail —
  don't guess on UX.

---

## M1 — "Most Popular" gallery sort  ✅
Give the gallery a real popularity signal, then sort by it.
- Add `cloneCount` to the `recipe` table: `integer("clone_count").notNull().default(0)`
  in `src/db/schema.ts`; `npm run db:generate` for the migration.
- In `src/lib/actions/recipeSharing.ts` → `cloneRecipeFromSlug`: after a
  successful clone, increment the **source** recipe's `cloneCount` by 1 (the
  recipe the slug points to — NOT the new copy). Best-effort; never fail the
  clone if the increment errors.
- Expose `cloneCount` on `GalleryRecipeCard` in
  `src/db/queries/recipes.ts` (`listPublishedRecipes` — add to the interface at
  ~line 773 and the `out.push`).
- `src/app/(app)/gallery/GalleryBrowser.tsx`: extend `SortKey` to
  `"newest" | "oldest" | "popular"`; add a **Popular** `SortChip`; popular sorts
  by `cloneCount` desc, tie-break `updatedAt` desc.
- Acceptance: build green; cloning a card bumps the source's count; Popular
  chip reorders the grid.

## M2 — Upfront Download-vs-Post choice in the share card  ✅
Make the two share intents unmistakable in
`src/components/recipe/ShareCardComposer.tsx`. Presentation only — reuse the
existing `handleDownload` and `handleSubmit`; do not change their behaviour.
- Restructure the footer action row into two clearly-labelled, equally-weighted
  paths, each with a one-line helper (`label-osd text-fg-dim`):
  - **Download card** — "Save the PNG to post anywhere yourself."
  - **Post to gallery** — "Publish it to the Mini Mainframe community gallery."
    (keep the existing `recipeId`-present guard — hidden for the imageless /
    unsaved-recipe entry points).
- Use the kit `Button`. Keep the "Submitted for review" success state + the
  "goes live after an admin approves" note.
- Acceptance: both actions visible with helper text; download + submit still
  work; build green.

## M3 — "Your cards" submission status  ✅  (halt for Ross if the status shape is unclear)
Let a signed-in painter see the status of cards they've submitted.
- Inspect `src/lib/actions/gallerySubmissions.ts` + the gallery* columns in
  `src/db/schema.ts` for the submission status field (pending review / listed /
  rejected).
- Add a query for the current user's submitted recipes + status, and render a
  compact **"Your cards"** strip at the top of the signed-in gallery
  (`src/app/(app)/gallery/page.tsx`), above the community grid — name + a status
  chip each. Keep it minimal; skip entirely when the user has no submissions.
- Acceptance: a user who submitted a card sees its status; nothing renders for
  users with no submissions; build green.

## M4 — /pricing horizontal overflow at 320px (MUX-010)  ⬜
- At 320px viewport width, `/pricing` scrolls ~4px horizontally. Find the
  offending element (likely a fixed min-width / padding on a tier card, chip, or
  price row) and make it reflow within 320px — no body horizontal scroll.
- Verify the fix holds at 320px and doesn't regress ≥360px.
- Acceptance: no horizontal scroll at 320px on `/pricing`; build green.
