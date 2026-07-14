# Launch Build List — The Mini Mainframe

**Source:** synthesis of `docs/LAUNCH_READINESS_REPORT.md` (multi-agent audit, 2026-07-14) + Hermie's independent review (2026-07-14), with every claim re-verified against live prod and the working tree on 2026-07-14.

**Verdict: both audits agree — NO to public traffic today, YES achievable in one focused build.** Nothing here is a rebuild. The gating set is 3 env vars, ~5 code fixes, and 3 operational gates.

**How to run this:** batches are ordered by dependency. B0 must land first (it unbreaks the test runner). B1 is Ross-only (Vercel dashboard). B2–B3 gate go-live. B4–B5 should ship in the same push. B6 is first-week, non-gating.

---

## B0 — Repo hygiene (blocks every other batch)

The audit pass left the repo in a worse state than it found it. Fix this before any agent touches code, or the test gate is unrunnable.

- [ ] **Revert the damaged lockfile.** `git checkout -- package-lock.json && npm ci`. The audit's `npm install` (run on Linux) **stripped 461 lines** of platform-specific optional deps from `package-lock.json`. On Windows the unit runner now dies with `MODULE_NOT_FOUND` on the rolldown native binding — `npm run test:unit` cannot execute at all. This is a *present breakage*, not a "review before committing" caveat.
- [ ] **Fix the service-worker stamp workflow.** `scripts/stamp-sw-build-id.mjs` does a blind global string-replace on the **source** `public/sw.js`, so any local `npm run build` permanently destroys the `__BUILD_ID__` placeholder and dirties the tree — which is what fails `tests/unit/lib/sw/strategy.test.ts`. It also rewrites the token *inside the doc comments*, corrupting the very documentation that says "the literal token must stay exactly `__BUILD_ID__`" (it now reads `20260714054720`). **Fix:** keep the in-place stamp (Next snapshots `/public` during build, so it must run pre-build), but have the script cache the original contents and restore the placeholder in a `postbuild` hook; and scope the replace to the `BUILD_ID` assignment line, not the whole file. Restore `public/sw.js` from git now.
- [ ] **Replace the broken lint script.** `next lint` was removed in Next 16 — `npm run lint` currently errors with `Invalid project directory provided, no such directory: .../lint` and lints **zero files**. `eslint@9` + `eslint-config-next@16` are already installed but **there is no `eslint.config.*` file at all**. Add a flat config, change the script to `eslint .`, fix what it surfaces, and **add a lint step to CI** (`.github/workflows/` currently has none).
- [ ] **Deal with the dirty working tree before branching.** `feat/project-faction-wargame` has **zero commits vs `main`** — the faction/wargame work (`src/lib/wargameSuggestions.ts`, `projects.ts`, `appData.ts`, `types.ts`, `ProjectPageClient.tsx`, +4) exists only as uncommitted working-tree changes. Commit it to its branch or stash it; launch work must start from a clean `main`.

---

## B1 — Prod origin (Ross, Vercel dashboard — not an agent task)

**This is the single highest-priority item. Re-verified live today:**
- `GET https://www.mini-mainframe.com/dashboard` (signed out) → `307 → https://miniaturemanager.vercel.app/sign-in` → **`404 DEPLOYMENT_NOT_FOUND`**
- Every gated response sets `__Secure-authjs.callback-url=https%3A%2F%2Fminiaturemanager.vercel.app` → cookies are host-scoped, so a session minted on the preview host never carries back to `www`.
- Every password-reset and verify-email link is built from that same dead host → all mail links 404.

- [ ] Vercel **Production** env: `AUTH_URL=https://www.mini-mainframe.com`, `NEXT_PUBLIC_APP_URL=https://www.mini-mainframe.com`, `AUTH_TRUST_HOST=true`.
- [ ] **Reassign the production domain alias off the dead deployment.** (Hermie's notes omit this step — the env vars alone may not be enough.)
- [ ] Redeploy from a **fresh git push**. A Vercel "Redeploy" reuses the stale env-var snapshot — this has already bitten this project once.
- [ ] *(agent-doable)* Add `NEXT_PUBLIC_APP_URL` to `.env.production.example` + `DEPLOY.md`; the runbook is also missing 5 env-var groups the live app reads (Stripe ×5, Blob, Anthropic, `MM_ADMIN_EMAILS`) and still documents removed magic-link auth.
- [ ] **Re-verify after deploy:** signed-out `GET /dashboard` → 307 to `www/sign-in` (200), and send one real reset email and click it.

---

## B2 — Launch-blocking code fixes

- [ ] **Un-gate the OG/Twitter image routes.** `src/proxy.ts:106` excludes only by *file extension*, but Next serves OG images at extensionless routes (`/opengraph-image-<hash>`). Verified live with a Twitterbot UA: apex `308` → www `307` → dead host → **404**. Every link posted to Reddit/Discord/X/Facebook/iMessage unfurls with **no image** — on the primary growth channel. Add `opengraph-image|twitter-image` to the negative-lookahead. **This fix is independent of B1.** Note: platforms cache OG data for days-to-weeks, so anything posted before the fix stays image-less.
- [ ] **Make `/verify-email` public.** Verified live: `307 → dead host`. Add to **both** `isPublicPath()` (`proxy.ts:26`) **and** the matcher (`:106`). Same for `/user/verify-recovery`. The page validates its token server-side and needs no session.
- [ ] **Un-gate `/api/extension/*`.** Verified live: `307 → sign-in` before the route's own Bearer auth runs — the extension has never worked end-to-end. Add `api/extension` to the matcher. Add an e2e test that sends only a Bearer header.
- [ ] **Fix password reset (permanent-lockout dead-end).** `requestPasswordReset` (`passwordReset.ts:66`) only issues a link when `users.recoveryEmail` **and** `recoveryEmailVerified` are set — **columns signup never populates** (signup writes `users.email`). The user sees "if that account exists, a link is on its way," nothing sends, and their data is stranded. **Fix:** issue the reset against `users.email` directly. ⚠️ **Do not gate it on `emailVerified`** — the majority who never clicked the verify link would stay locked out. (Hermie's note says "look up `users.email`" but misses this trap.)
- [ ] **Revoke other sessions on password reset/change.** `passwordReset.ts:143`, `changePassword.ts:89` — a stolen cookie currently survives a reset for up to 30 days.
- [ ] **Lock the gallery image path (moderation bypass + SSRF).** `submitRecipeToGallery` validates `imageUrl` as bare `z.string().trim().url().max(2048)` (`gallerySubmissions.ts:96`) — no host allowlist. A signed-in **free** user can serve a clean mini during the moderation fetch, then swap to arbitrary content for every visitor (TOCTOU), defeating the exact moderation gate the feature is marketed on, on an all-ages page. **Hermie's fix is incomplete — all four parts are needed:**
  1. Reject any `imageUrl` whose host isn't `*.public.blob.vercel-storage.com` — reuse the existing `isProxiableBlobUrl` from `src/lib/shareCard/imageSrc.ts` (the blob-proxy route was already deliberately SSRF-locked; the gallery path just didn't reuse it). Bind to the `imagePathname` the client already passes.
  2. Apply the same allowlist inside `fetchImage` (`src/lib/ai/imageModeration.ts:137`).
  3. Render `cardImageUrl` through the blob-proxy at **all three** sinks: `GalleryBrowser.tsx:166`, `AdminGalleryReview.tsx:71`, `r/[slug]/opengraph-image.tsx:42`.
  4. `r/[slug]/opengraph-image.tsx:40` is a **second, stronger SSRF** — it embeds fetched bytes into a public OG image. Hermie's notes miss this one.

---

## B3 — Operational gates (you launch blind without these)

Hermie files these as "this week." They belong **before** public traffic: B1/B2 are only observable in prod, and a day-1 fire is currently invisible *and* has no inbox to report it to.

- [ ] **Error monitoring.** No `instrumentation.ts`, zero matches for `sentry|datadog|captureException|@vercel/otel`. The only error surface is 17 `console.error` calls into ephemeral Vercel logs with no alert rule. Add Sentry (or `@vercel/otel` + Log Drains) + **one** alert rule on error-rate, `/api/billing/webhook`, and `submitRecipeToGallery`.
- [ ] **A reachable support / data-rights email.** Verified: `grep -rEi "mailto:|support@|contact@|@mini-mainframe|@hrumf" src/` → **zero matches**, yet `privacy/page.tsx:41` tells users to "contact the operator at the email listed on the site." The only inbound channel requires being signed in — unreachable to exactly the users locked out by the reset bug. GDPR also requires a reachable controller contact. Publish it in the footer + legal pages + `/sign-in` + the reset page; accept anonymous feedback.
- [ ] **Cap the "capped" beta.** `plans.ts:39 BILLING_ENFORCED=false` makes every advertised cap inert, and there is **no** rate limit on signup, `/api/recipe/ai`, or gallery-submit (the only grep hits for `rateLimit|turnstile|captcha` are *comments*). Anthropic, Groq, and Vercel Blob spend are open to anyone with an account, in a loop, against your keys. Add: a per-user daily quota on `/api/recipe/ai` + gallery-submit (a DB counter is enough), an IP rate-limit on the signup action, and invisible Turnstile on `/sign-up`. **Independent of `BILLING_ENFORCED`.**
- [ ] **Verify the prod FK cascade.** `src/db/client.ts` never issues `PRAGMA foreign_keys = ON`, but `deleteAccount` relies entirely on `ON DELETE CASCADE`. Local file-DB cascades correctly; **prod is remote Turso over `libsql://`** — a different enforcement path and a known SQLite/libSQL divergence point. If it's OFF, "delete my account" deletes one row, returns `{ok:true}`, and orphans every project/recipe row. **Fix:** add the `PRAGMA` on connection init (harmless if already on) **or** run one throwaway-account deletion against prod and confirm zero orphaned rows.

---

## B4 — SEO base + landing conversion (cheap, ship in the same push)

- [ ] **www/apex canonical.** Live origin is `www` (apex 308s to it), but `metadataBase` (`layout.tsx:8`), sitemap `BASE` (`sitemap.ts:3`), robots `BASE`/`Host:`/`Sitemap:` (`robots.ts:3`) all name the **apex** — verified live, all 6 sitemap `<loc>` entries 308-redirect and GSC will flag every one as "Page with redirect." Point all three at `https://www.mini-mainframe.com` and add `alternates.canonical` per public page. *(This also fixes the og:image host automatically.)*
- [ ] **Sitemap: add the content, drop the utilities.** `/gallery` (200, public, keyword-rich) and every published `/r/<slug>` recipe card are **absent** — your only fresh, ever-growing UGC surface, orphaned. Make `sitemap.ts` async and append `/gallery` + `listPublishedRecipes()` (~10 lines, reuses an existing query). **Remove `/sign-in` + `/sign-up`** (verified present today) and set `robots: { index: false }` on them.
- [ ] **Homepage rewrite for query-led terms.** Verified: the live landing HTML contains **zero** occurrences of `wargame`, `warhammer`, `citadel`, `vallejo`, `army painter`, or `pile of shame`. Keep the CRT brand mark; add a **visible** keyword sub-headline beneath it, rewrite `<title>`/meta, and weave terms into the FEATURE blurbs.
  - Title: `Miniature Painting Tracker & Paint Collection Manager · Mini Mainframe`
  - Subhead: `A miniature painting tracker for wargamers: manage your paint collection, recipes, armies, backlog, colour matches, and hobby sessions in one place.`
- [ ] **Structured data.** Zero JSON-LD anywhere → ineligible for rich results. Add `WebApplication` + `FAQPage` on the homepage (the FAQ answers double as keyword copy) and `BreadcrumbList` on `/gallery` + `/r/`. **Do not** use `Recipe`/`HowTo` schema (food-semantic) and **no `aggregateRating`** — fabricating reviews violates Google policy.
- [ ] **Get the CTA above the fold.** "Start for Free" sits at y=893px at 1366×768; the header exposes only "Sign in" — the wrong door for a new visitor. Cap the hero illustration (~40vh) **and** add a persistent "Start for Free" to `PublicHeader`.
- [ ] **Add a "See the gallery (no signup)" hero CTA.** The fastest "wow" in the product — one-click Clone on a fully-populated recipe — is currently invisible: the hero links to `/sign-up` 3× and the gallery 0×. Also add it to the empty dashboard / `/recipes` / `/collection` states.

---

## B5 — Instrument the growth loop (you get one launch spike; measure it)

- [ ] **Stamp `mini-mainframe.com` inside the share-card raster** (~15 lines, both DOWNLOAD and SUBMIT share `renderCardPng`). Today the exported card's only brand element is the wordmark — no URL, no QR. Every posted card should be a route back. Use static text so it also covers the `recipeId == null` DOWNLOAD path.
- [ ] **Add the missing events.** The 12 existing events (`landing_view` → `public_recipe_shared`) are a good funnel skeleton, but **card downloads are completely invisible** and the moat loop fires nothing. Add: `share_card_downloaded` (client — the priority), `gallery_view`, `recipe_card_view`, `recipe_cloned`, `gallery_submit_started`, `gallery_submit_completed`, `tool_match_completed`, `tool_result_saved`, `extension_token_created`, `billing_checkout_started`, `billing_checkout_completed`.

---

## B6 — First week (not gating)

- [ ] **Optimistic UI on Status/Type/Priority** (`useOptimistic`, drop `disabled={pending}`) — kills the #1 perceived-latency complaint *and* the intermittent permanent hang. Ship **with** the next two or none of them behave.
- [ ] **Delete the six `router.refresh()` calls** (both host pages are `force-dynamic`; the POST already re-renders) — collapses ~19 `loadAppData` batches per click to 1.
- [ ] **Swap the 35 `revalidatePath("/projects")` → `/dashboard`** (`/projects` is a 308, not a page). Latent today, becomes a real staleness bug the moment `router.refresh()` goes.
- [ ] **Library mobile virtualization** — one CSS line, `min-h-0` on `AppShell.tsx:31`. At 390px the library renders **7,152 DOM nodes in a 28,333px page**; at 1440px it renders 849.
- [ ] **iOS input zoom** — form controls are 13px (`globals.css:156`), starting with the sign-in field. Raise to ≥16px on inputs/select/textarea only. Do **not** lock `maximum-scale` (WCAG 1.4.4).
- [ ] **HTTP security headers** — prod returns only HSTS. Add CSP (**report-only** first — the app uses inline styles), `X-Frame-Options`/`frame-ancestors`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`.
- [ ] **Tighten `next/image` `remotePatterns`** off the `'**'` wildcard (verified open image proxy: `/_next/image?url=https://picsum.photos/64` → `200`). ⚠️ Will break the intentional pasted-reference-image feature unless routed through a same-origin proxy at the same time.
- [ ] **Fail the admin allowlist closed** — `allowlist.ts:19` has a hard-coded `FALLBACK_ADMIN_EMAIL` and no `emailVerified` check. Confirm `MM_ADMIN_EMAILS` is set in prod (zero-code mitigation), then fail closed when unset.
- [ ] **`saveRecipe` slot truncation** — deletes all slots before re-inserting with no transaction and no snapshot (`saveRecipe.ts:70`); a mid-loop Turso failure empties the recipe. `cloneRecipe` already does manual rollback — copy that pattern.
- [ ] **Double-click `+ New Project` creates duplicates** (`DashboardClient.tsx:59`) — reproduced 1→3 rows from one double-click, on a first-session action.
- [ ] **GW collection URL auto-fill fires a false green "Added" toast** — GW 301s to `warhammer.com` which returns 405 to the scraper (Cloudflare). Adding the hostname does **not** fix it. Show an honest "couldn't auto-read — enter details below" state, or drop GW from the advertised list.
- [ ] **A11y trio** — link form errors to fields (`aria-describedby` + `aria-live`); drop `role="listitem"` from the 841 native `<button>` swatches; give footer links a persistent underline (2.11:1 colour-only today).
- [ ] **Stripe webhook idempotency** + write the Founder seat counter (it has no writer anywhere — "100 of 100 remaining" never decrements and seat #101 can be sold). Add a webhook integration test; the only checkout e2e is `describe.skip`.

---

## Content (Ross — not an agent task)

- [ ] **Seed the gallery with 8–15 real painted-model photo cards** through the live submit flow. All 8 current seed cards render as abstract swatch strips (`cardImageUrl` null). "Painted model + exact recipe" *is* the pitch and the moat; a cold visitor currently sees colour bars that look like a spreadsheet. This fixes moat-visibility, share-worthiness, and activation in one move.
- [ ] **Pin down the free-forever tester promise.** The pricing page's "testers who give feedback keep their account free forever" needs: who qualifies, what counts as feedback, a deadline, and what "free forever" includes. Suggested: *"Early tester offer: create an account during the public beta and send useful feedback from inside the app. We'll mark your account free-for-life before paid plans switch on."* ⚠️ This is entangled with the pending free-vs-paid tier reset — **Ross's decision, not an agent's.**

---

## Deferred (with reasons — do not let an agent "fix" these)

- **`npm audit` high: `drizzle-orm <0.45.2`** (installed: 0.36.4). The advisory is SQL-identifier escaping; `grep` finds **no `sql.identifier` / `sql.raw` usage anywhere in `src/`** — no user-controlled identifiers reach the ORM, so there is no reachable exposure. The upgrade is a **breaking** 0.36 → 0.45 jump. Schedule it post-launch as its own PR. Never run `npm audit fix --force` here — it proposes a nonsense Next downgrade.
- **2 moderate postcss** — transitive via `next`'s bundled copy; resolves when Next bumps. No action.
- **Programmatic paint SEO** (`/paint/[brand]/[slug]`, `/paint-conversion/[a]-to-[b]`) — the **single biggest organic lever** the product has: 7,144 paints in `public/data/paints.json`, currently gated behind auth and robots-disallowed, while a competitor already ranks per-paint pages off this exact data (your own rows carry `sourceUrl: minimatch.app/paint/...`). Real, large, and **L effort** — it deserves its own project, not a launch batch. Every new route must be added to `isPublicPath`/matcher **and** kept out of robots Disallow **and** added to a sharded sitemap.

---

## The gate before you drive traffic

Re-verify **live**, after the redeploy — do not skip:

1. Signed-out `GET /dashboard` → 307 to `www/sign-in` (200), not the vercel.app host.
2. `curl -I` the og:image URL → `200 image/png`; then run the X / Facebook / LinkedIn card debuggers to bust their caches.
3. Send a real password-reset email and click the link.
4. Attempt a gallery submit with an off-host `imageUrl` → rejected.
5. Delete a throwaway account → confirm zero orphaned rows.
6. Re-run the full gate: `typecheck`, `test:unit`, `test:integration`, `build`, key Playwright smoke.
