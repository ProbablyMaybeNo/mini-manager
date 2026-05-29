# Mini Manager — Phase 5 Build Plan

Source of truth for the milestone-builder agent. Each unchecked item is a self-contained milestone with scope, patterns, and acceptance criteria. Build top-down. Tick the box when shipped.

**Phase goal (per V2-BUILD-PLAN §11.5):** Recipe portability without a social network. A painter generates a short URL for a recipe, hands it to a friend over text / Discord / IRL via QR, and the friend opens it (no account needed to view), clones it (one tap), and starts using it. Also: a one-shot JSON export of everything the user owns, for backup or future-self peace of mind.

**Ship criterion (V2-BUILD-PLAN):** Ross can share a recipe to a friend's phone via QR and the friend can clone it.

**Already shipped (do not re-run):** none — Phase 5 starts fresh on top of Phase 4. The `recipe.publicSlug` column already exists in the schema (P3.1 added it as nullable unique with the note "Phase 5 will write this") — no migration needed for the slug column itself.

**Remaining (build in this order):**

---

## P5.1 — Public slug actions (generate + revoke) + clone helper

- [x] Build this milestone

**Context.** Two small server actions on top of the existing `recipe.publicSlug` column. `publishRecipe` mints a short URL-safe slug; `unpublishRecipe` clears it. A small helper `generatePublicSlug()` produces a 10-char alphanumeric ID using a custom nanoid alphabet (no ambiguous chars: no `0OIl1`).

**Files to create.**
- `src/lib/recipes/slug.ts` — pure function `generatePublicSlug(): string` using `nanoid` with a custom alphabet of unambiguous lowercase + digits, length 10. ~10^15 keyspace — plenty for v1.
- `src/lib/actions/recipeSharing.ts` — server actions:
  - `publishRecipe({ recipeId })` — if `publicSlug` already set, return it; otherwise generate a unique slug (retry on the rare collision), persist, return. Owner-checked.
  - `unpublishRecipe({ recipeId })` — clear `publicSlug` to null. Owner-checked.
- `src/db/queries/recipes.ts` additions: `getRecipeBySlug(slug)` — no owner filter (this is the public read path). Returns the same nested `RecipeWithZones` shape, or null.

**Files to modify.**
- none beyond the new files.

**Patterns to follow.**
- Same `"use server"` / Zod / `currentUserId()` / `revalidatePath` shape as every other action.
- `publishRecipe` collision-handling: on unique-constraint failure, retry up to 3 times with a fresh slug. Surface a friendly error on persistent failure.
- `getRecipeBySlug` is the ONLY query that bypasses owner check — everything else stays owner-scoped.

**Implementation notes.**
- Custom nanoid alphabet (in `slug.ts`): `"abcdefghijkmnopqrstuvwxyz23456789"` (33 chars; no 0/1/l/o). 10-char id → ~33^10 ≈ 1.5×10^15 combinations.
- `revalidatePath(`/r/${slug}`)` after publish/unpublish so the public view picks up changes.
- Don't expose the slug in the recipe's standard JSON response unless `publicSlug` is non-null and the caller is the owner (or it's the public path).

**Acceptance criteria.**
- `npm run typecheck` exits 0.
- `npm run test:unit` adds a `generatePublicSlug` test (chars in alphabet only, length 10, no two consecutive calls return the same value across 100 iters).
- `npm run test:integration` adds tests for `publishRecipe` (persists + idempotent on second call) and `unpublishRecipe`.
- A throwaway probe shows the generated slug appears in the DB and `getRecipeBySlug` round-trips.

**Commit message:** `P5.1: public slug actions + slug helper`

---

## P5.2 — Public recipe view at `/r/[slug]`

- [ ] Build this milestone

**Context.** Anyone with a slug URL can view a published recipe — no account required. Owner-checked routes (e.g. `/recipes/[id]`) are NOT affected. The view is read-only — no edit, no add-zone, no toggle. Painter who didn't author it sees `[ Clone to my recipes ]` as the primary CTA.

**Files to create.**
- `src/app/r/[slug]/page.tsx` — server component. Calls `getRecipeBySlug`; 404 if not found. Renders the recipe statically — name, body type pill, zones with swatches, steps with paint pills (read-only), notes, footer with `[ Clone to my recipes ]` and `[ Open Mini Manager ]` links.
- `src/components/recipes/PublicRecipeView.tsx` — server component that takes the nested recipe shape and renders the read-only view. Reuses `<RecipePaletteStrip />`, `<TechniqueLabel />`, and as much of the recipe editor's display layer as can be split out without dragging in client-only code.
- `src/app/r/layout.tsx` — minimal public layout. No NavRail (NavRail is auth-only). Just a small "Mini Manager" wordmark in the top-left and a `[ Sign in ]` button in the top-right.

**Files to modify.**
- `src/proxy.ts` — extend the matcher exclusion to allow `/r/*` through unauthenticated. The matcher is currently `"/((?!sign-in|api/auth|api/test|_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)).*)"`; add `r/` to the alternation.
- `src/components/recipes/AttachedRecipeSummary.tsx` or sibling — if it shares a "render a recipe read-only" subcomponent, refactor that into a standalone server component the public view can reuse. Don't duplicate rendering logic.

**Patterns to follow.**
- The view MUST render server-side (no client-component dependency in the read path) — both for SEO and so the URL renders correctly when a friend opens it on a slow phone.
- Use `<Link>` for the sign-in / sign-up / clone CTAs.
- Open Graph meta tags on the page: `og:title` = recipe name, `og:description` = first 200 chars of notes (or a default), `og:image` = a static "Mini Manager" placeholder (no per-recipe palette OG image for v1).

**Implementation notes.**
- Cache strategy: `export const dynamic = "force-dynamic"` for now — recipes can be updated by the author at any time. Revisit when usage justifies caching.
- 404 page: server-renders a friendly "This recipe was unpublished or never existed" with a `[ Back to Mini Manager ]` link.
- Body type only `"infantry"` ships in v1; render a fallback message for anything else.

**Acceptance criteria.**
- `npm run typecheck` exits 0.
- A published recipe is viewable at `/r/[slug]` in a private/incognito window without signing in.
- `view-source:` shows the recipe content in the HTML (server-rendered, not hydrated).
- Unpublishing the recipe makes the URL return 404 within ~1s.

**Commit message:** `P5.2: public recipe view at /r/[slug]`

---

## P5.3 — Clone to my recipes (the cross-account hop)

- [ ] Build this milestone

**Context.** The friend opens `/r/[slug]`, taps `[ Clone to my recipes ]`. If signed-in: clones immediately and redirects to `/recipes/[newId]`. If signed-out: kicks to `/sign-in?return_to=/r/[slug]?clone=1` and clones automatically after the magic-link sign-in completes.

**Files to create.**
- `src/lib/actions/recipeSharing.ts` (extend the file from P5.1) — add `cloneRecipeFromSlug({ slug })`:
  - Looks up recipe by slug (via `getRecipeBySlug`).
  - Validates currentUserId.
  - Deep-copies: new recipe row (same name + " (cloned)" suffix, bodyType, notesMd; standalone; null attachments; **new** id; **null** publicSlug). Then for each zone: new zone with new id, same name + silhouetteZoneId; then for each step: new step with new id, same technique/paintId/customColorHex/notesMd.
  - Returns the new recipe id.
- `src/app/r/[slug]/clone/route.ts` — POST handler that calls `cloneRecipeFromSlug` and returns the new recipe URL. Used by the public view's clone button via a small client component.
- `src/components/recipes/CloneButton.tsx` — `'use client'`. Posts to the clone route; on success, calls `router.push(`/recipes/${newId}`)`. On 401, redirects to `/sign-in?from=...&clone=1`.

**Files to modify.**
- `src/app/sign-in/page.tsx` — after successful sign-in, if `clone=1` and `from=/r/[slug]` are in the query, POST the clone route automatically before final redirect.
- `src/proxy.ts` — `/api/r/*` (if used) also needs to bypass the matcher; OR keep the clone route inside `/r/[slug]/clone/route.ts` which is already matcher-excluded via the `/r/*` rule from P5.2.

**Patterns to follow.**
- Clone is atomic — wrap the recipe + zones + steps inserts in a single libsql transaction. On any failure, rollback the whole thing.
- "Already yours" detection: if the recipe's `ownerId` already matches `currentUserId`, return `{ ok: false, error: "This is already your recipe" }` and link to the existing one.
- Don't carry the source's `publicSlug` — the clone is private to the new owner.

**Implementation notes.**
- Renamed clone: `"Salamanders Power Armor"` → `"Salamanders Power Armor (cloned)"`. If the cloned name already exists for the user, append `" (cloned 2)"`, etc.
- The "auto-clone after sign-in" requires the sign-in page to honour a `clone=1` query param when the magic link is consumed. Set this as a session-stash before the redirect — see NextAuth's `callbackUrl` for the natural carrier.

**Acceptance criteria.**
- `npm run typecheck` exits 0.
- Signed-in user clicks `[ Clone ]` on `/r/[slug]` → lands on `/recipes/[newId]` with a verbatim copy.
- Signed-out user clicks `[ Clone ]` → kicked to sign-in → after magic-link click → lands on `/recipes/[newId]` (auto-cloned).
- Owner clicking their own slug's clone button gets the "already yours" message + link.

**Commit message:** `P5.3: clone recipe from public slug`

---

## P5.4 — Share modal: URL + QR + Markdown + JSON

- [ ] Build this milestone

**Context.** The unified "Share" affordance in the recipe editor. Triggered from the recipe header. Modal with four sections (URL / QR / Markdown / JSON) — painter picks the format that fits where they're sharing.

**Files to create.**
- `src/components/recipes/ShareModal.tsx` — `'use client'`. Native `<dialog>` (project convention — no modal library). Four sections vertically stacked:
  - **Short URL** — input (read-only) showing `https://miniaturemanager.app/r/<slug>` + `[ Copy ]` + `[ Regenerate ]` + `[ Unpublish ]`. If unpublished, shows `[ Publish ]` instead.
  - **QR Code** — renders a QR PNG/SVG of the URL. Re-renders when the URL changes. `[ Download PNG ]`.
  - **Markdown** — `<textarea>` (read-only) with the formatted Markdown. `[ Copy ]`. Format documented in P5.5.
  - **JSON** — `<details>` with the raw recipe JSON for the determined nerd. `[ Copy ]`, `[ Download .json ]`.
- `src/components/recipes/ShareButton.tsx` — `'use client'`. Small `[ Share ]` button in the recipe header. Opens `<ShareModal />`.

**Files to modify.**
- `src/components/recipes/RecipeHeader.tsx` — add `<ShareButton />` next to the existing `[ Delete recipe ]` icon.

**Patterns to follow.**
- The modal is one component; the four sections are inline, not separate tabs (avoids the tab-state complexity for v1).
- Clipboard copy via `navigator.clipboard.writeText` with a small "Copied!" inline toast (2s timeout).
- QR sub-component delegated to P5.7's QR generator helper.

**Implementation notes.**
- The "Publish" button on an unpublished recipe calls `publishRecipe` from P5.1 and updates the modal UI optimistically; the share URL field appears once the slug is set.
- Markdown + JSON sections are derived client-side from the in-memory recipe (no server round-trip needed for those formats).

**Acceptance criteria.**
- `npm run typecheck` exits 0.
- Clicking `[ Share ]` on an unpublished recipe shows the modal with a `[ Publish ]` CTA; clicking it generates the URL inline.
- Copy buttons put the right content on the clipboard (verify via Playwright permissions: clipboard read).
- Regenerate produces a new slug; the QR + URL update without modal close.

**Commit message:** `P5.4: share modal — URL + QR + Markdown + JSON`

---

## P5.5 — Markdown export formatter

- [ ] Build this milestone

**Context.** Reddit-friendly recipe Markdown. Painters paste this into r/minipainting, Discord, or a notes app. The format is **headings per zone**, **ordered list per step**, **paint name + hex inline**, plus a small "Made with Mini Manager" footer with the public URL.

**Files to create.**
- `src/lib/recipes/markdown.ts` — pure function:
  ```ts
  interface MarkdownInput {
    recipe: { name: string; bodyType: string; notesMd: string | null };
    zones: ReadonlyArray<{
      name: string;
      steps: ReadonlyArray<{
        technique: TechniqueKey;
        paintName?: string;
        paintBrand?: string;
        hex: string;
        notesMd: string | null;
      }>;
    }>;
    publicUrl?: string;
  }
  function recipeToMarkdown(input: MarkdownInput): string;
  ```
  Output (sketch):
  ````
  # Salamanders Power Armor

  *A Mini Manager recipe*

  ## Power Armor — Primary

  1. **Basecoat** — Citadel Caliban Green `#0F4A33`
  2. **Wash** — Army Painter Strong Tone `#3A2618`
  3. **Layer** — Citadel Warpstone Glow `#1F8044`
  4. **Edge highlight** — Vallejo Magic Green `#5ACC74`

  *Two thin coats on the basecoat.*

  ## Trim — Gold

  1. **Basecoat** — Citadel Retributor Gold `#9C7B2A`
  2. **Wash** — Citadel Reikland Fleshshade `#A33000`
  ...

  ---
  [Made with Mini Manager](https://miniaturemanager.app/r/abc123)
  ````

**Files to modify.**
- `src/components/recipes/ShareModal.tsx` (from P5.4) — consume `recipeToMarkdown(...)`.

**Patterns to follow.**
- Pure function — unit-tested in P5.8 against a known recipe → known markdown.
- No external dep — string templating is fine for Markdown.
- Technique enum → display name via the existing `<TechniqueLabel />` mapping (extract the label function alongside the component if it isn't already pure).

**Implementation notes.**
- Steps with `customColorHex` (no paint pinned) render as `**Glaze** — Custom mix \`#FF66CC\``.
- Per-step `notesMd` is rendered as italic on the next line under the step.
- The footer link is omitted if no `publicUrl` is supplied (e.g. recipe is unpublished).

**Acceptance criteria.**
- `npm run typecheck` exits 0.
- `npm run test:unit` adds a `recipeToMarkdown` test that snapshots the output against a known recipe.
- The Markdown section of the Share modal contains correctly-formatted text.
- Pasting into a Markdown renderer (Reddit / GitHub / Discord) yields readable formatted output.

**Commit message:** `P5.5: recipe → Markdown formatter`

---

## P5.6 — JSON export of all user data

- [ ] Build this milestone

**Context.** A single button on the User settings page that downloads `mini-manager-export-{date}.json` containing everything the user owns: projects, named models, recipes (with zones + steps), palettes, inventory entries, wishlist items. Versioned schema so future-self can re-import.

**Files to create.**
- `src/app/user/page.tsx` — currently a placeholder; add a `[ Export all my data ]` button section.
- `src/lib/actions/exportData.ts` — server action `exportAllUserData()`. Owner-scoped. Returns a structured JSON blob with a top-level `__exportVersion: 1` field. Each section is an array of plain objects (Drizzle row shapes, not the joined `WithZones` shapes — re-derivable on import).
- `src/components/user/ExportButton.tsx` — `'use client'`. Click → calls the action → receives JSON → uses `URL.createObjectURL(new Blob(...))` to trigger a browser download. Filename: `mini-manager-export-{YYYYMMDD}.json`.

**Files to modify.**
- none beyond the new files. Re-import (the inverse) is **not** in scope for Phase 5 — the export is a one-way safety net for now.

**Patterns to follow.**
- The action returns plain JSON-able objects (no Date instances — convert to ISO strings).
- Top-level schema:
  ```jsonc
  {
    "__exportVersion": 1,
    "__exportedAt": "2026-06-...",
    "projects": [ ... ],
    "namedModels": [ ... ],
    "recipes": [ ... ],
    "recipeZones": [ ... ],
    "recipeSteps": [ ... ],
    "palettes": [ ... ],
    "inventoryEntries": [ ... ],
    "wishlistItems": [ ... ]
  }
  ```
- DO NOT include user / session / account / verificationToken rows — those are auth internals.

**Implementation notes.**
- Don't include the paint catalog (it's the public static `paints.json`, not user data).
- Be careful with timestamp_ms columns — convert to ISO strings in the export to avoid silent precision loss when re-importing.
- File size cap: don't worry about it for v1 — a typical user is under 100KB JSON.

**Acceptance criteria.**
- `npm run typecheck` exits 0.
- `npm run test:integration` adds a test: seed a user with a recipe + two projects + a wishlist item → call `exportAllUserData()` → assert all rows appear with the expected fields.
- Clicking `[ Export ]` on `/user` triggers a browser download.
- The downloaded JSON parses cleanly and contains the expected top-level keys.

**Commit message:** `P5.6: JSON export of all user data`

---

## P5.7 — QR code generator (inline, low-dep)

- [ ] Build this milestone

**Context.** Inline QR rendering for the Share modal. Painters scan from a friend's phone. No external CDN; render SVG directly so it scales crisply.

**Files to create.**
- `src/components/recipes/QrCode.tsx` — `'use client'`. Renders an SVG QR code of a given string. Internally uses the `qrcode` package (small, well-tested, no fonts). Props: `text: string`, `size?: number`, `bg?: string`, `fg?: string`. Default: 256px, transparent bg, fg = `var(--color-fg)`.

**Files to modify.**
- `src/components/recipes/ShareModal.tsx` (from P5.4) — plug `<QrCode />` into the QR section.
- `package.json` — add `qrcode` (~50KB, MIT, the de-facto standard). **Flag in commit body.**

**Patterns to follow.**
- Use `qrcode.toString(text, { type: "svg" })` to render — string output, no canvas.
- Set `<svg viewBox="...">` so the size prop just CSS-resizes; no re-render needed when the modal resizes.
- Error correction level `M` — good balance for URLs (~15% damage tolerance).

**Implementation notes.**
- `[ Download PNG ]` button: convert the SVG to a Blob via `URL.createObjectURL(new Blob([svgString], { type: 'image/svg+xml' }))` → trigger download with `download` attribute. Skip PNG conversion (browser-side rasterisation is fiddly); SVG is fine for paint-shop printing.
- For dark-mode default: use the green token (`var(--color-green)`) as `fg` only on hover; default to plain `var(--color-fg)` to stay scan-friendly.

**Acceptance criteria.**
- `npm run typecheck` exits 0.
- The QR section of the Share modal renders an SVG. Scanning it with a real phone resolves the public URL.
- The `[ Download ]` button delivers an `.svg` file that opens correctly.

**Commit message:** `P5.7: inline QR code generator`

---

## P5.8 — Tests + smoke E2E

- [ ] Build this milestone

**Context.** Lock down the share + clone flow with unit + integration + E2E tests.

**Files to create.**
- `tests/unit/lib/recipes/slug.test.ts` — `generatePublicSlug` returns 10-char alphanumeric using only the custom alphabet; 100 iterations produce 100 distinct values.
- `tests/unit/lib/recipes/markdown.test.ts` — `recipeToMarkdown` snapshot test against a known fixture recipe.
- `tests/integration/actions/recipeSharing.test.ts` — `publishRecipe` persists + idempotent; `unpublishRecipe` clears; `cloneRecipeFromSlug` deep-copies (zones + steps); "already yours" path returns error; cross-user clone works.
- `tests/integration/actions/exportData.test.ts` — `exportAllUserData()` includes all the expected top-level keys; respects owner scope (doesn't bleed other users' rows).
- `tests/e2e/qa_share_recipe.spec.ts` — M5.1: sign in as Alice → create a recipe → publish → copy URL → sign in as Bob in a fresh context → open the URL → see the public view → click `[ Clone ]` → land on Bob's `/recipes/[newId]` with the recipe content.

**Files to modify.**
- `app/docs/TESTING.md` — minor update under "Adding a new E2E mission" to note the `browser.newContext()` pattern used for cross-account clone tests.

**Patterns to follow.**
- The E2E test uses `browser.newContext()` for Bob so the two users have isolated cookies/localStorage — same pattern campaign-console-live uses in `qa_release.spec.ts`.
- Use the existing `signInAs()` + `freshTestEmail()` helpers.
- The clone test verifies the cloned recipe is independent: edit Bob's clone → confirm Alice's original is unchanged.

**Acceptance criteria.**
- `npm test` passes; total count increases by the new unit + integration tests.
- `npm run test:e2e` passes; M5.1 added.
- Clone test verifies: independent IDs, same content, source publicSlug NOT carried into the clone.

**Commit message:** `P5.8: share + clone test coverage`

---

## Phase 5 ship checklist

After P5.8 lands, before declaring Phase 5 done:

- Ross runs the V2-BUILD-PLAN ship criterion end-to-end on his phone:
  1. Open one of his recipes on desktop
  2. Hit `[ Share ]`, `[ Publish ]`, `[ Copy URL ]`
  3. Pick up his phone, paste the URL into the browser, see the recipe
  4. (Optional friend test) Send the QR to a friend's phone; they scan, see, clone.
- `npm run typecheck` exits 0.
- All Phase 5 milestones tick green in this file.
- No regressions in Phases 1-4 flows (run the full E2E suite + spot-check Library / Wishlist / Project workspace / Recipe editor / Tools).
- One full JSON export round-trip — open the file, eyeball it, confirm it contains a project + a recipe + a wishlist item.

**Deferred to later phases (do NOT build in Phase 5):**
- **JSON re-import.** v2 territory — Phase 5 exports are one-way.
- **Public recipe browse** (find others' shared recipes) → Phase 7 (Community).
- **Per-recipe OG image** (palette-strip thumbnail for nicer Discord/Twitter unfurls) → Phase 6 polish.
- **Custom domain shortener** (e.g. `mm.app/r/abc123` instead of full domain) → post-launch.
- **Anti-abuse on clone** (rate limit, abuse reporting) → Phase 7.

---

## Conventions for milestone-builder

Same as PHASE1/2/3/4_PLAN.md:

- **Commit only locally; do NOT push.** Ross reviews before pushing.
- **Pre-commit:** `npm run typecheck` 0 errors. Refuse to commit if it fails.
- **Pre-commit:** if the milestone added source under `src/lib/` or `src/lib/actions/`, also run `npm test` and commit only if green. **CRITICAL — stage the new test files into the same commit so they don't get orphaned.** Phase 4 had 6 test files leak out of their commits; the housekeeping commit `26d01ce` cleaned that up. Don't repeat.
- **New dependencies** flagged in commit body. Phase 5 will add `qrcode` (~50KB, MIT) — flag it.
- **No `any`. No `@ts-ignore`.** Strict mode mandatory.
- **`"use server"` files export ONLY async functions.** Pure helpers go in `src/lib/<domain>/<name>.ts`. Phase 1 and Phase 3 both shipped this bug; don't be the third.
- **Server-side first.** The public recipe view especially MUST be server-rendered for SEO / social unfurls.
- **Match existing patterns.** Read neighbouring files before introducing new ones.
- **Tailwind v4 syntax.** CSS-first `@theme`. Use existing tokens — no arbitrary hex.
- **Halt and report** if a milestone has an architectural decision the plan doesn't cover. Do not guess.
