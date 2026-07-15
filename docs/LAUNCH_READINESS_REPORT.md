# Launch Readiness Report — The Mini Mainframe

**VERDICT: NO — not yet, but this is a NO measured in one focused day, not weeks.**

*Date: 2026-07-14 · Audited commit: `d1bf80a` (production build of `main`, byte-identical to the deployed site) · Method: parallel multi-dimension audit (perf, security, SEO, UX desktop/mobile, a11y, bugs, build-health, automations, growth, signup-funnel) with independent adversarial verification of every non-trivial finding — driven against the live production build and, for infra/SEO/security claims, against live prod `www.mini-mainframe.com`.*

---

## 1. Verdict

**NO — hold the launch until the blocker set below is fixed and re-verified live.** Five app-breaking problems survived independent verification against production, two of them true blockers, and *none* requires a rebuild. Right now, on the real domain: any signed-out user hitting a bookmark/deep-link/expired session (or Googlebot, or a crawler) 307-redirects to a **dead** `miniaturemanager.vercel.app` that returns `404 DEPLOYMENT_NOT_FOUND`; password-reset **and** email-verification are broken two different ways (the reset never fires because it reads a column signup never fills, and every mail link is built from that same dead host), so account recovery and the verify→free-forever signup hook dead-end for everyone; and the headline public gallery can be made to display arbitrary/attacker-swapped images on an all-ages page by any signed-in free user. On top of the app-breakers, the completeness pass surfaced that you would be **launching blind**: no error monitoring, no reachable support/data-rights contact, and a "capped" beta whose caps are switched off with no rate limits — so a day-1 fire is invisible and unbounded Anthropic/blob spend is open to anyone. The good news dominates the effort math: three of the app-breakers are a single Vercel env change plus a redeploy, the other two are one-line-to-medium code fixes, and the operational gates are hours of work each. Fix the gating set, add the three operational gates, seed the gallery with real photos, re-verify live — and this flips to YES the same night.

**What is genuinely solid** (so you can trust the "NO measured in hours" framing): the data layer is trustworthy — *every* "slow" perf finding was verified to still **save correctly**, zero data loss or corruption anywhere in the corpus; the team already ships the right patterns (blob-proxy SSRF-locked to the blob host, optimistic UI in `ModelCounterGrid`, correct Stripe signature verification, sound extension-token crypto) and the fixes are mostly "extend an existing good pattern to one more call site"; rendering/SEO fundamentals are healthy (landing HTML fully server-rendered, single `<h1>`, indexable); the perf floor is fine (warm TTFB ~155–210ms, region-pinned `pdx1`, HSTS present); and test discipline is real (~448 integration + 685/686 unit passing, CI runs typecheck/unit/integration/build/e2e). This reads as a well-built app with a few sharp, config-shaped edges — not a shaky one.

---

## 2. Launch blockers (must fix before go-live)

Ordered. **B = app-breaking, O = operational go/no-go gate surfaced by the completeness pass.** Everything here is S or M effort.

### B1 — [BLOCKER · S] The prod origin resolves to a dead Vercel deployment
**One root cause, three symptoms** — this is the single highest-priority item in the report.
- **Symptom A (re-auth dead-end):** `curl -I https://www.mini-mainframe.com/dashboard` (signed-out) → `307 Location: https://miniaturemanager.vercel.app/sign-in?from=%2Fdashboard`, which returns `404 DEPLOYMENT_NOT_FOUND`. Reproduced identically for `/collection`, `/recipes`, `/admin/gallery`, any unknown URL, and Googlebot. `/sign-in` on `www` is itself 200 — only the redirect *host* is wrong.
- **Symptom B (split-brain cookies):** every gated response sets `__Secure-authjs.callback-url=https%3A%2F%2Fminiaturemanager.vercel.app`. Cookies are host-scoped, so a user who signs in on the preview host gets a session that never carries back to `www` — the branded domain looks permanently signed-out.
- **Symptom C (dead email links):** the three mail-link builders use `NEXT_PUBLIC_APP_URL ?? AUTH_URL ?? localhost`. `NEXT_PUBLIC_APP_URL` is undocumented and almost certainly unset; `AUTH_URL` is the dead host. Verified: `https://miniaturemanager.vercel.app/sign-in/reset` and `/verify-email` both return **404**. So every password-reset and verification link is a dead 404 — and `issueSignupEmailToken` fires on **every** signup (`signUp.ts:148`), so every new tester's verify link dead-ends.

**Root cause:** `src/proxy.ts:73` builds the redirect from `req.nextUrl.origin`; under NextAuth's `auth()` wrapper that origin resolves to the pinned `AUTH_URL` / production alias, which is the deleted preview deployment. **Files:** `src/proxy.ts:73`, `src/lib/auth/passwordReset.ts:29`, `recoveryEmail.ts:27`, `signUp.ts:164`.
**Fix:** In Vercel **Production** set `AUTH_URL=https://www.mini-mainframe.com`, `NEXT_PUBLIC_APP_URL=https://www.mini-mainframe.com`, `AUTH_TRUST_HOST=true`; **reassign the production domain alias off the dead deployment**; add `NEXT_PUBLIC_APP_URL` to `.env.production.example` + `DEPLOY.md`; redeploy from a **fresh git push** (a Vercel "Redeploy" reuses the stale env snapshot — proven in project history). **Re-verify before opening signups:** signed-out `GET /dashboard` → 307 to `www/sign-in`; send one real reset email and click it.
*Resolves the security "off-brand bounce / split-brain" high and the build-health "canonical app URL → vercel.app emails" high — same root.*

### B2 — [BLOCKER · M] Gallery moderation is bypassable → arbitrary/explicit images on the public gallery (+ blind SSRF)
`submitRecipeToGallery` validates `imageUrl` only as `z.string().url().max(2048)` — no blob-host allowlist, no binding to the user's uploaded blob. It moderates the URL, auto-publishes on a Claude "pass," and the gallery renders it raw. A signed-in **free** user can point `imageUrl` at their own host, serve a clean mini during the moderation fetch, then swap to arbitrary content for every visitor (TOCTOU) — defeating the exact moderation gate the feature is marketed on, on an all-ages page. The same unguarded `fetch` is a blind SSRF, and a **second** untrusted server-side fetch at `r/[slug]/opengraph-image.tsx:40-42` embeds fetched bytes into the public OG image (stronger SSRF).
**Files/sinks:** `src/lib/actions/gallerySubmissions.ts:94-179`; `src/lib/ai/imageModeration.ts:137-152` (`fetchImage`); render sinks `GalleryBrowser.tsx:166`, `AdminGalleryReview.tsx:71`, `r/[slug]/opengraph-image.tsx:42`.
**Fix:** Reject any `imageUrl` whose host isn't `*.public.blob.vercel-storage.com` (reuse `isProxiableBlobUrl` from `src/lib/shareCard/imageSrc.ts`) in `submitRecipeToGallery`; ideally verify the pathname matches a gallery-cards blob this user owns; apply the same allowlist inside `fetchImage`; render `cardImageUrl` through `/api/blob-proxy` (or `next/image` with a locked `remotePattern`) at **all three** sinks. Closes the swap-TOCTOU and both SSRF paths.

### B3 — [HIGH · S · gating] Social/link unfurls show no preview image
`og:image`/`twitter:image` serve at extensionless routes (`/opengraph-image-<hash>`) that the proxy matcher (`src/proxy.ts:106`) only excludes by file extension, so `auth()` gates them and they 307 to the dead host → 404. Reproduced live with a Twitterbot UA. Every homepage link posted to Reddit/Discord/X/Facebook/iMessage unfurls with title + text but **no hero image** — directly on your primary growth channel. (Gallery `/r/` card images already work — `r/` is matcher-excluded. Only the homepage/landing OG is broken, which is the link you post most.) Aggravator: platforms cache OG data for days-to-weeks, so links posted before the fix stay image-less until manually re-scraped.
**Fix (self-sufficient, one line):** add `opengraph-image|twitter-image` to the `src/proxy.ts:106` negative-lookahead — once excluded, `auth()` never runs and no redirect happens (this fix does **not** depend on B1). Verify `curl` → `200 image/png`, then run the X/FB/LinkedIn card debuggers.

### B4 — [HIGH · M · gating] Password reset is a permanent-lockout dead end for every credentials signup
Two separate defects strand the user, both must be fixed:
- **Reset never fires:** signup writes `users.email` and stamps `users.emailVerified`; `requestPasswordReset` only issues a link when `users.recoveryEmail` **and** `recoveryEmailVerified` are set — **different columns** signup never populates. The user sees the reassuring "if that account has a verified recovery email, a reset link is on its way," nothing sends, and their data is stranded. `src/lib/auth/passwordReset.ts:66`.
- **Even a fired link is dead** until B1 (built from the dead host).

**Fix:** issue the reset against the mandatory, format-validated `users.email` **directly** (not gated on `emailVerified`, or the majority who never clicked the verify link stay locked out), or copy `email → recoveryEmail` when the signup verification link is consumed. Ships with B1 so the resulting link resolves.

### O1 — [HIGH · ~1hr] No error monitoring or alerting exists anywhere → you launch blind
`Glob src/instrumentation*.ts` → none. Grep for `sentry|datadog|captureException|onRequestError|@vercel/otel` → zero source matches. The only runtime error surface is 17 `console.error` calls writing to ephemeral Vercel logs with **no alert rule**. This is the meta-gate: B1 and B2 are only observable in prod, and with no error tracking a day-1 regression of exactly that class surfaces only via user complaints — and there is no support inbox to complain to (O2).
**Fix:** add `instrumentation.ts` with Sentry (or `@vercel/otel` + Vercel Log Drains) and one alert rule on error-rate + on `/api/billing/webhook` and `submitRecipeToGallery`.

### O2 — [MEDIUM · S] No reachable support / data-rights contact; locked-out users are stranded
`privacy/page.tsx:41` says "contact the operator at the email listed on the site"; grep for `mailto:|support@|contact@|@mini-mainframe|@hrumf` across `src/` → **no matches** — there is no email anywhere. The only inbound channel is the in-app "Report an Issue" form, which requires being signed in (anonymous posts are dropped unless `NOTION_TOKEN` is set) and lives inside the app shell — unreachable to the exact users who need it most (the B4 lockout victims). GDPR also requires a reachable controller contact for rights requests.
**Fix:** publish a real support/privacy email in the footer + legal pages; accept anonymous feedback; add a "contact support" link on `/sign-in` and the reset page.

### O3 — [MEDIUM · M] The "free capped beta" ships with caps disabled and no rate limits — resource-uncapped
`plans.ts:39 BILLING_ENFORCED=false` makes every advertised free cap inert. There is **no** rate limit on signup, `/api/recipe/ai`, or gallery-submit (grep for `rateLimit|throttle|turnstile|captcha` → only comments), and no per-user AI/blob quota. So the beta has no cap on the things that cost money or invite abuse: Anthropic calls (open to every signed-in user in a tight loop against your key), Groq calls (import LLM fallback), Vercel Blob, and scripted account creation. "Capped" is not backed by any enforced limit.
**Fix (independent of `BILLING_ENFORCED`):** per-user daily quota on `/api/recipe/ai` + gallery-submit (a simple DB counter is enough), an IP rate limit on the credentials signup action, and Cloudflare Turnstile (invisible) on `/sign-up`. *(If you truly must ship without the quota, at minimum watch the Anthropic/Blob dashboards manually on day 1 — but adding the counter is cheaper than the risk.)*

### O4 — [MEDIUM · S · verify] Prod account-deletion FK cascade is unverified
`src/db/client.ts` never issues `PRAGMA foreign_keys = ON`, yet `deleteAccount` relies entirely on `ON DELETE CASCADE`. An empirical libSQL probe confirmed *local* file-DB cascades correctly, but prod uses **remote Turso over `libsql://`** — a different enforcement path, and FK-default behavior is a known SQLite/libSQL divergence point. If it's OFF in prod, `db.delete(users)` deletes one row, returns `{ok:true}` ("account deleted"), and **orphans every project/recipe/collection row** — an erasure failure that reports success. `recipeStepCompletion` cascades transitively (slot→recipe→user), needing enforcement even more.
**Fix (cheap + definitive):** add `PRAGMA foreign_keys = ON` on connection init (harmless if already on), **or** run one prod smoke — create a throwaway account with a project, delete it, confirm zero orphaned `projects` rows for that `ownerId` — before you tell anyone "delete removes your data."

**Not gating, but do it in the same push (content, not code):** seed the gallery with **8–15 real painted-model photo cards** through the live submit flow. Today all 8 seed cards render as abstract swatch strips (`cardImageUrl` null), and the "painted model + exact recipe" proof is the entire pitch and the SEO landing content. See §9.

---

## 3. The path to YES (ordered checklist)

**Pre-launch — gate go-live on all of these:**
1. ☐ **[S] Fix the prod origin (B1).** Set `AUTH_URL` / `NEXT_PUBLIC_APP_URL` / `AUTH_TRUST_HOST` in Vercel Production, reassign the production domain alias, **push a fresh git build**. Clears B1's three symptoms + the security split-brain + the email-host death.
2. ☐ **[S] Un-gate the OG image routes (B3).** Add `opengraph-image|twitter-image` to `src/proxy.ts:106`.
3. ☐ **[M] Lock the gallery submit path (B2).** Host-allowlist `imageUrl` in `submitRecipeToGallery` + `fetchImage`; render card images through the blob-proxy/locked `next/image` at all three sinks.
4. ☐ **[M] Make password reset work (B4).** Issue the reset against `users.email` directly.
5. ☐ **[~1hr] Add error monitoring (O1)** + one alert rule.
6. ☐ **[S] Publish a support/privacy email (O2)** in footer + legal pages; add it to `/sign-in` + reset page; accept anonymous feedback.
7. ☐ **[M] Add signup rate-limit + per-user AI/gallery daily quota + Turnstile (O3).**
8. ☐ **[S] Verify prod FK cascade (O4)** — one throwaway-account deletion, or add `PRAGMA foreign_keys = ON`.
9. ☐ **[content] Seed 8–15 real photo cards** in the gallery.
10. ☐ **[S] Re-verify live after redeploy (do not skip):** signed-out `GET /dashboard` → 307 to `www/sign-in` (200); `curl` the og:image URL → `200 image/png` + card debuggers; send a real reset email and click it; attempt a gallery submit with an off-host `imageUrl` and confirm rejection; delete a throwaway account and confirm no orphaned rows.

**Fix in the first week (not gating):**
- **[M] Optimistic UI on Status/Type/Priority** (`useOptimistic` + drop `disabled={pending}`) — one fix kills the #1 perceived-latency complaint *and* the intermittent permanent-hang. §5 P1.
- **[M] Remove the redundant `router.refresh()`** from mutation handlers, paired with targeted `revalidatePath("/dashboard")` — kills the ~19× `loadAppData` amplification per click. §5 P2–P3.
- **[S] Library mobile virtualization** — `min-h-0` on `AppShell.tsx:31`. §5 P4.
- **[M] Collection URL auto-fill** — stop the false "Added" toast + hostname-named row when GW scrape returns nothing; drop GW from the advertised list or route it through a headless/API path. §4.
- **[S] Fail the admin allowlist closed** — no hard-coded fallback; require `emailVerified`/DB role; confirm `MM_ADMIN_EMAILS` is set in prod. §7.
- **[S] HTTP security headers** (CSP report-only, `X-Frame-Options`/`frame-ancestors 'none'`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`; `includeSubDomains` on HSTS). §7.
- **[S] Tighten `next/image` `remotePatterns`** off the `'**'` wildcard + same-origin proxy for pasted reference images. §7.
- **[S] Mobile input font-size ≥16px** on form controls (iOS focus-zoom on the sign-in field). §8.
- **[M] Correctness batch** — invalidate sessions on password change/reset; add `/verify-email` + `/api/extension/*` to proxy exclusions; snapshot-and-restore recipe slots in `saveRecipe`; fix the `+New Project` double-submit. §4.
- **[S] Instrument the loop** (`CardDownloaded`/`CardSubmittedToGallery`/`RecipeCloned`) + **stamp `mini-mainframe.com` inside the share-card raster.** §9.
- **[S] SEO quick wins** — `metadataBase`/sitemap/robots → `www`; add `/gallery` + `/r/` slugs to the sitemap; rewrite homepage `<title>`/meta + visible keyword sub-headline. §6.
- **[S] Fix `npm run lint`** (broken `next lint` → ESLint 9 flat config) + add lint to CI; add a webhook plan-grant integration test. §4/§7.

---

## 4. Bugs & broken things

### Blockers / launch-gating (detailed in §2)
- **B1** Prod origin → dead `miniaturemanager.vercel.app` (re-auth 404, split-brain cookies, dead email links).
- **B2** Gallery moderation bypass + SSRF.
- **B3** OG image routes gated → blank unfurls.
- **B4** Password reset never fires (reads `recoveryEmail`, not `email`).

### High (fix in the first week)
- **Collection URL auto-fill silently fails for Games Workshop** — the #1 advertised brand. Pasting a GW paint URL creates a row literally titled `games-workshop.com` with brand/type/price all `—`, and fires a **green "Added" success toast** (worse than silence). GW 301s to `warhammer.com` which returns **405** to the scraper UA (Cloudflare) — unscrapable by simple `fetch`; note adding `warhammer.com` to `gw.ts` hostnames alone does **not** fix it (the fetch fails before any parser runs). `src/lib/scrape/parsers/gw.ts:9`, `src/lib/wishlist/scrapeInsert.ts:58`, `collection/page.tsx:144`. **Fix:** honest "couldn't auto-read — enter details below" state; drop GW from the advertised list or route via headless/API.
- **Intermittent permanent hang on Status/Type/Priority** (~3–5% of changes) — controls stay disabled showing the stale value until page reload; data is safe (F5 shows the write landed). Rides on the same code as P1/P2. `ProjectWorkspaceBody.tsx:310-320`, `ProjectPageClient.tsx:656-662`. Subsumed by the P1+P2 fix.
- **Library grid virtualization defeated on mobile** — see §5 P4 / §8.

### Medium (correctness / first-session friction)
- **`saveRecipe` deletes all slots before re-inserting, no transaction** (`saveRecipe.ts:70-101`) — a partial failure (bad hex, or a transient Turso insert error mid-loop against remote DB) truncates or empties the saved recipe with no rollback and no pre-delete snapshot; the action reports an error but the data is already lost. `cloneRecipe` already does manual rollback — copy that pattern. **Fix:** snapshot slots and restore on any failure, or persist the new set before deleting the old.
- **Double-click `+ New Project` creates duplicates** (`DashboardClient.tsx:59`) — `useTransition`'s pending flag is discarded, the CTA is never disabled; reproduced 1→3 rows from one double-click on the empty-state CTA (a first-session action). **Fix:** capture `creating` and thread `disabled` to all create buttons + an early-return guard (native double-click fires ~15ms apart, faster than the disabled re-render).
- **Email-verification link dead-ends at `/sign-in` for signed-out visitors** (`proxy.ts` isPublicPath + matcher omit `/verify-email`) — reproduced `307 → /sign-in?from=…`. The page validates the token server-side and needs no session. `/user/verify-recovery` same class. **Fix:** add both to `isPublicPath()` + matcher exclusions. *(Distinct from B1: B1 makes the link's host dead; this makes even a correct-host link bounce when signed out.)*
- **Password change/reset does not revoke other sessions** (`passwordReset.ts:143-158`, `changePassword.ts:89-95`) — a stolen session cookie survives a reset for up to 30 days. **Fix:** `db.delete(sessions).where(eq(sessions.userId,userId))` on reset (then re-mint); on change-password, exclude the current token.
- **Browser-extension API is unreachable** (`proxy.ts:104-108` matcher omits `api/extension`) — Bearer-token requests 307 to `/sign-in` before the route's own auth runs; reproduced. Extension add/preview has never worked end-to-end. Zero user impact today (not on the Web Store) but will 307-break whenever it ships. **Fix:** add `api/extension` to the matcher exclusions + an e2e test with only a Bearer header.
- **Full-page project view (`/projects/[id]`) can't edit granular model progress** — the `ModelCounterGrid` (Built/Primed/Painted/Completed steppers, the thing that moves completion %) renders only in the dashboard inspector; on the full page both add buttons silently `router.push('/dashboard?open=…')`. It is **not** read-only (status/type/priority/notes/target-date all edit inline via the same server actions) — the defect is the missing stepper + the bounce, a cross-view inconsistency. **Fix:** render `ModelCounterGrid` on the full page for leaf nodes, or make the add buttons open an inline dialog.
- **Stripe webhook has no idempotency and never writes the Founder seat counter** (`billing/webhook/route.ts:60-121`; `founderCounter.ts` has no writer anywhere) — a replayed `checkout.session.completed` re-stamps `founderClaimedAt` and resets `planExpiresAt`; the "100 of 100 remaining" scarcity never decrements and seat #101 can be sold. Signature verification itself is correct (raw-body `constructEvent`, forged POST → 400), and the core plan-grant is reliable. Note `schema.ts:1375` falsely documents an atomic bump that doesn't exist. **Fix:** persist processed `event.id` (unique constraint, no-op replays); pre-check `founder_sold` at checkout-session creation (refusing inside the webhook is too late — payment already captured) and increment there.
- **No executed test covers the live Stripe checkout route or webhook** — the only checkout e2e is `describe.skip`, the billing-limit integration tests are `skipIf(!BILLING_ENFORCED)` (the 5 observed skips). Stripe is live in prod; a checkout/webhook regression would ship uncaught. **Fix:** webhook-handler integration test (signed event → plan written) + a checkout-route unit test per priceKey.

### Low (hygiene — verified but not adversarially re-confirmed unless noted)
- `+ ADD UNIT` label hard-coded on the full project page regardless of node type. *(unverified)*
- Vercel Analytics `/_vercel/insights/script.js` 404 on the local/self-hosted build only — the sole recurring console error app-wide; confirm prod serves it. *(unverified)*
- Roster columns clip with no scroll cue when the inspector is open at 1440px. *(unverified)*
- Recipes SYS banner uses `–` (en-dash) vs the spaced em-dash elsewhere — the worst cosmetic finding in the app. *(unverified)*
- `markBoughtAsNewProject` enforces looser containment than `createProject` (can create a Unit under a Warband/Unit) — depth cap still holds, no corruption. *(unverified)*
- `35 revalidatePath("/projects")` target a 308 redirect (no `page.tsx`); today masked by `router.refresh()`, becomes a real staleness bug once P2 lands. See §5 P3. *(confirmed, latent)*
- `buildRecipesByPaintTitle` (`collections.ts:116-121`) is a dead cross-tenant full-table scan (no WHERE) — one import from a prod incident. *(unverified — delete or scope it)*

---

## 5. Performance

**None of these are launch blockers** — the app saves correctly and loses no data everywhere. Every item is perceived-latency, scaling headroom, or infra-cost polish. The one the beta will *feel* on day one is the dropdown lag, so it leads. Ordered by user-felt-impact ÷ effort.

### P1 — The Status/Type/Priority dropdown lag (no optimistic UI) — the #1 reported complaint, confirmed
Pick `PAINTED` from STATUS and the menu closes, the control greys out, and it **keeps showing the old value** (`WISHLIST`) for the entire server round-trip. TYPE and PRIORITY grey out too because all three share one pending flag. Reads as "it didn't save," so people click again.

**Measured (Playwright, prod build):**
- Local, warm, **zero-latency SQLite** — click → new value painted: **median 46ms, max 64ms**; the label changes *only* at round-trip completion (never synchronously). This is a hard **lower bound**.
- CDP latency emulation: **+100ms RTT → 572ms**, **+200ms RTT → 1,057ms** — the ~2× RTT growth proves a serial two-hop waterfall (server action, then a second `router.refresh()` RSC refetch).
- **Prod floor:** `/gallery` (one DB query) warm TTFB **155–195ms**; `/dashboard` runs `auth()` + the ~16-statement `loadAppData` batch, strictly worse. Realistic felt delay: **~0.6–1.1s warm, multiple seconds cold.**

**Root cause:** the `Listbox` renders `selected.label` off a server prop (`Listbox.tsx:55-56`); every caller passes `value={project.status}` + `disabled={pending}` from one shared `useTransition` (`ProjectWorkspaceBody.tsx:460-495`, `ProjectPageClient.tsx:676-707`, `PriorityDropdown.tsx:40-48`), and the handlers `await action()` then `router.refresh()` inside the same transition, so `isPending` — and the stale value — persists until the whole RSC refetch commits. `grep useOptimistic src/` → **0 hits**, though the pattern is used correctly in `ModelCounterGrid` and `detach()`.

**A worse intermittent symptom rides on this** (see §4 High): ~3–5% of the time the `?_rsc=` refresh is one of the aborted requests from P2, `isPending` never clears, and `disabled={pending}` bricks all three controls until reload.

**Fix (M):** wrap the project view-model in `useOptimistic` (preferred over bare `useState` because `router.refresh()` runs in the same transition), apply the picked value synchronously before awaiting, and **drop `disabled={pending}` from the Listboxes**. Do it in all three files. **Honest caveat:** this is optimistic *masking*, not a speedup — derived UI (progress strip, roster status text, completion %) still lags the round-trip because the save isn't faster. That's correct UX and fully resolves the complaint; P2 is what actually reduces the work.

### P2 — Every mutation fires an 18-request `router.refresh()` RSC storm
One status change on `/dashboard` = **1 server-action POST + 18 `?_rsc=` requests** across all 9 sidebar routes (`NavLinks.tsx:40` default-prefetch), + 6–10 `net::ERR_ABORTED`, network busy ~1,540ms. The page is also rendered **twice** (POST response already carries the fresh tree, then `router.refresh()` refetches the same render). **Corrected framing:** the visible edit updates on the POST (~400ms) — the storm is background prefetch and does **not** block the DOM. The real harm is **server-side amplification**: one click ≈ **19 RSC renders = 19 `loadAppData` batches against Turso = 19 Vercel invocations**, several aborted — capping infra headroom/cost at beta scale. Six `router.refresh()` sites (`ProjectWorkspaceBody.tsx:318/395`, `ProjectPageClient.tsx:160/660`, `PriorityDropdown.tsx:45`, `ProjectsTable.tsx:61`).
**Fix (M):** delete `router.refresh()` — both host pages are `force-dynamic`, so the POST already re-renders. **Must be paired with P3**, which `router.refresh()` is currently masking.

### P3 — `revalidatePath("/projects")` targets a 308 redirect, not a page
`/projects` → 308 → `/dashboard`; there is no `projects/page.tsx`. **35** actions call `revalidatePath("/projects")`, only **8** call `/dashboard` (`imports.ts:406` even revalidates a non-route `/projects/import`). Zero cost today (masked by `router.refresh()`), but the moment P2 lands, mutations stop refreshing the dashboard and stale counts appear within the 30s `staleTimes.dynamic` window. **Fix (S):** swap `/projects` → `/dashboard` (`projectMeta.ts` already does this). **Ship with P2 or neither behaves.**

### P4 — Library virtualization defeated on mobile (biggest bang-for-buck)
At 390px, `/library` renders **7,152 `<button>` nodes** in a **28,333px-tall** page with no bounded inner scroll container (whole document scrolls, so `react-virtual` renders every paint). At 1440px: **849 nodes**, bounded 900px scroller — virtualization works. Root cause: `AppShell.tsx:23` root is `flex h-dvh flex-col md:flex-row`; on mobile the content column at `:31` is a main-axis flex child with default `min-height:auto` and no `min-h-0`. Slow first paint, jank, memory pressure, elevated tab-crash risk on the primary platform's 2nd-of-5 browse tab. **Fix (S, one CSS line):** add `min-h-0` to the content column at `AppShell.tsx:31`; re-measure (target: a few dozen nodes).

### P5–P7 — Redundant DB work
- **P5 (S):** `loadAppData` reads the `recipe` table **3×** and `recipe_slot` **2×** per request (`appData.ts:366-399`) — collapse into one query. Lowest-risk win; ship independently.
- **P6 (L):** `loadAppData` runs the full ~16-statement batch on **every** `(app)` route including `/library`/`/tools`/`/user` which render none of it; `listAllProjects`/`listPaintCollection`/`listModelCollection` are unbounded. **Correction:** do **not** strip it from `/collection` (it reads `data.collectionPaints/…` and would silently fall back to demo fixtures) — only `/library`/`/tools`/`/user` are safe. And App Router does not re-run the layout on soft sibling navigation; the real re-run triggers are hard loads + `router.refresh()` (which P2 removes). **Fix:** slice per-route, land P5's de-dup, add pagination.
- **P7 (M):** `/recipes` throws away `loadAppData`'s bulk-loaded slots, then does `Promise.all(summaries.map(loadEditorRecipe))` = **3N** round-trips (`recipes/page.tsx:20-33`). **Corrections:** the 3N run *concurrently* (connection pressure, not serial RTT) and the client receives each recipe **once**, not twice. **Fix:** extend `listRecipesForTable` to carry `technique+paintId+notesMd`; drop the per-recipe loop + duplicate `loadProjectsForPicker`.

### P8–P12 — Bundle & infra
- **P8 (M):** zero code-splitting app-wide (`grep next/dynamic` → 0). `html-to-image` (~42KB gz) ships eagerly to `/recipes` before any share modal opens, and is emitted as a **duplicate** chunk. **Fix:** `next/dynamic({ssr:false})` on `ShareCardComposer`/`AiRecipeDialog`/`ArmyImportPanel`/color-picker panels. *(Note: headline route-JS numbers are uncompressed; real win is parse/execute on mobile CPUs.)*
- **P9 (M):** all hot routes `force-dynamic` vs remote Turso; the **Turso primary region is not asserted anywhere in the repo**. **Correction:** the 12 loaders run in `Promise.all` (~2–3 hop depth, not a 16× serial multiplier). **Fix:** confirm Turso primary == `pdx1`; adopt embedded replicas (libSQL sync) so reads are function-local.
- **P10 (M):** prod cold start **~1.4–2.2s** on a dynamic route (`x-vercel-cache: MISS`), then ~155–210ms warm. **Correction:** cutting `router.refresh()` does **not** shrink cold start (one-time per-container boot); the levers are Fluid Compute / a warming cron + the P9 region check. Usually absorbed by the session's first navigation.
- **P11 (S):** hot columns unindexed — `wishlist_item(owner_id,kind,date_added)`, `recipe(is_listed,updated_at)`. Negligible now; add composite indexes before growth. *(unverified)*
- **P12 (S):** delete/scope the dead `buildRecipesByPaintTitle` all-tenant scan. *(unverified)*

**Sequencing:** ship **P1+P2+P3 together** (they interlock), then **P4** (one line), then **P5**, then **P9's region check**. Everything else is scaling headroom.

---

## 6. SEO & discoverability

**The site will get indexed. It will rank for almost nothing you care about, and its two best organic assets are switched off.** Two items are launch-gating and covered above (B1 dead redirect host = §2; B3 blank OG image = §2). Everything else here is post-launch upside — but the programmatic paint surface is the largest organic lever the product has and it's indexed nowhere.

**What works today:** `/`, `/pricing`, `/gallery`, `/sign-in`, `/sign-up`, `/privacy`, `/terms` are 200 on `www`, server-rendered, on-topic, crawlable. Root `layout.tsx` OG/Twitter metadata is decent. You are **not** invisible to Google.

**What's under-built (fix in week 1):**

1. **www vs apex split-brain.** Live origin is `www` (apex 308→www), but `robots.txt` `Host:`, the `Sitemap:` directive, all 6 sitemap `<loc>`, `metadataBase`, and the og:image URL all name the **apex** — every sitemap URL 308-redirects, GSC will flag all 6 as "Page with redirect," and there is no `<link rel=canonical>` anywhere. Not fatal (the 308 is itself a canonical signal), but cheap to fix. **Fix:** set `metadataBase` (`layout.tsx:8`), sitemap `BASE` (`sitemap.ts:3`), robots `BASE` (`robots.ts:3`) to `https://www.mini-mainframe.com`; add `alternates.canonical` per public page. Changing `metadataBase` also fixes the og:image host automatically.
2. **The gallery and every `/r/<slug>` recipe card are absent from the sitemap** — your only fresh, keyword-rich, ever-growing UGC surface, orphaned. `/r/` pages render unique content ("Khorne Berzerkers — Brass & Blood") but their titles/descriptions carry no keywords and the twitter:title falls back to the global brand string. **Fix:** make `sitemap.ts` async, append `/gallery` + `listPublishedRecipes()` → `${BASE}/r/${slug}` (~10 lines, reuses an existing query); give `generateMetadata` keyword titles + a per-recipe `twitter` object + canonical.
3. **The homepage contains none of its target terms.** Grep of live landing HTML: `wargame`=0, `warhammer`=0, `citadel`=0, `vallejo`=0, `army painter`=0, `pile of shame`=0. The only visible `<h1>` is `sr-only`. **Fix:** query-led `<title>`, keyword-bearing meta, a **visible** keyword sub-headline under the CRT logo (keep the branding), weave terms into the FEATURE blurbs. *(sr-only h1 is fine for SEO — this is a visible-content/conversion fix, and a fresh domain ranks slowly regardless, so frame as compounding upside not a day-1 channel.)*
4. **Zero structured data** anywhere → ineligible for rich results. **Fix:** `WebApplication` + `FAQPage` JSON-LD on the homepage (the FAQ answers double as keyword copy), `BreadcrumbList` on `/gallery` + `/r/`. **Do not** use `Recipe`/`HowTo` schema (food-semantic / retired) and **no `aggregateRating`** (you have no real reviews — fabricating one violates Google policy).
5. **`/tools/*` is publicly usable (200 signed-out) but robots-**`Disallow`**'d and sitemap-absent** — reachable but undiscoverable. But the signed-out tool UX is a dead-end (§8): Save/Send-to-Recipe silently 307s to `/sign-in`, discarding work. **Decision:** fix the signed-out UX *first*, then un-disallow + add to sitemap; if not ready by launch, keep disallowed — don't send Google to a broken shell.
6. **`/sign-in` + `/sign-up`** are in the sitemap with identical generic `<title>`. **Fix:** drop them from the sitemap + `robots: index:false`.

### Keyword → page map (the build list — almost none of these pages exist)
Landing pages: static/ISR, ~600–900 words, `<h1>` = the query, a real screenshot, an internal link to sign-up, a small FAQ. Brand trademarks used nominatively (kept out of `<title>` to protect the char budget).

| Target term(s) | Page (URL) | Status | Title tag |
|---|---|---|---|
| miniature painting tracker · mini painting app | `/` | **REWRITE** | Miniature Painting Tracker & Paint Collection Manager · Mini Mainframe |
| miniature wargame project tracker · wargame manager | `/miniature-wargame-project-tracker` | **CREATE** | Miniature Wargame Project Tracker · Mini Mainframe |
| paint collection manager · miniature paint inventory | `/paint-collection-manager` | **CREATE** | Paint Collection Manager & Paint Inventory · Mini Mainframe |
| warhammer painting tracker · army painting tracker | `/warhammer-painting-tracker` | **CREATE** | Warhammer Army Painting Tracker · Mini Mainframe |
| paint recipe manager | `/paint-recipes` hub + optimize `/gallery` | **CREATE** | Paint Recipe Manager — Save & Share Schemes · Mini Mainframe |
| hobby backlog · pile of shame tracker | `/pile-of-shame-tracker` | **CREATE** | Pile of Shame & Hobby Backlog Tracker · Mini Mainframe |
| citadel/vallejo/army painter conversion · "X equivalent in Y" | `/paint-conversion` hub → programmatic (§below) | **CREATE** | Paint Conversion Charts: Citadel, Vallejo, Army Painter · Mini Mainframe |
| miniature paint colour matcher · citadel to vallejo converter | `/tools/match`, `/tools/wheel` | **EXPOSE** (robots-blocked today) | Miniature Paint Colour Matcher · Mini Mainframe |

### The programmatic-SEO engine (the biggest lever — currently at zero)
You own two auto-generatable, legitimately-unique surfaces, both 100% un-indexed: the **7,144-paint cross-brand catalog** (`public/data/paints.json`, gated + client-side into robots-disallowed `/library`) and the **gallery of recipe cards**. Your own paint rows carry `sourceUrl: minimatch.app/paint/...` — a competitor already ranks per-paint pages off *this exact data*.

- **`/paint/[brand]/[slug]`** (static/ISR): swatch + hex + brand + type; a **computed "closest equivalents in other brands"** table (convert every hex to CIELAB, ΔE-match the nearest paint per other brand — unique per page, run at build time); "used in these recipes" links that thicken as the gallery fills; `BreadcrumbList` + `Product`-ish JSON-LD.
- **`/paint-conversion/[brandA]-to-[brandB]`**: full ΔE-matched tables — start with Citadel/Vallejo/Army Painter/Scale75/Reaper/Pro Acryl (~10–15 directional pairs), not all 31×30.
- **Sitemap without a 50k blowout:** shard with `generateSitemaps()` by brand into a sitemap index; quality-gate on `hexConfidence` (skip `low`).
- **Anti-thin discipline:** every page carries unique computed match data; roll out in tranches watching GSC Coverage; enrich via the "used in recipes" section.
- **New routes must be added to `isPublicPath`/matcher AND kept out of robots Disallow AND added to the sitemap** — or they inherit `/library`'s gating.

**Launch-day SEO checklist (after B1/B3 ship):** verify the property in **Google Search Console** (DNS TXT at IONOS, where DNS lives — add both `www` and apex, or a Domain property), submit `www/sitemap.xml`, repeat for Bing, Request-Index the homepage + `/gallery` + `/pricing`, run the **Rich Results Test** (confirm `WebApplication`+`FAQPage`, no `aggregateRating`), and confirm the gallery is seeded with real photo cards before driving traffic.

---

## 7. Security

**What's exposed (fix as listed):**
- **[BLOCKER] Gallery moderation bypass + SSRF** — §2 B2.
- **[HIGH · gating] AUTH_URL / split-brain / dead email links** — §2 B1. Split-brain: session cookie set on the preview host never carries to `www`; looks broken/phishy on day 1.
- **[MEDIUM] No HTTP security headers** — `curl` prod returns only HSTS (`max-age=63072000`, no `includeSubDomains`/`preload`); **no** CSP, `X-Frame-Options`/`frame-ancestors`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`. **Correction to impact:** destructive mutations are App-Router server actions with a same-origin Origin/Host check, so cross-origin frames can't silently invoke them — realistic clickjacking is UI-redress only. Still add the headers (CSP **report-only** first — the app uses inline styles). **Fix:** `headers()` block in `next.config.ts`.
- **[MEDIUM] No rate limiting on auth + AI** — §2 O3. Credential-stuffing on sign-in (bcrypt cost 10 slows the hash, not the request rate); unbounded `/api/recipe/ai` loop against your Anthropic key (cheap `claude-haiku-4-5`, but uncapped). Live: authed `POST /api/recipe/ai {}` cleared auth + the (inert) Pro gate and reached body validation with no throttle.
- **[MEDIUM] Wildcard `next/image` `remotePatterns`** (`hostname:'**'` for both http+https, `next.config.ts:47`) → open image-optimization proxy. Live: `GET /_next/image?url=https://picsum.photos/64` → `200 image/jpeg` — anyone can burn Vercel's metered optimizer/egress and serve arbitrary third-party images from your branded origin. SSRF is **blind** (optimizer returns only decodable images — no body exfil). **Fix caveat:** tightening to the blob host will break the intentional pasted-reference-image feature unless you simultaneously route pasted URLs through a validated same-origin proxy or a plain `<img>`.
- **[MEDIUM] Admin gate keys on an unverified, user-settable email with a hard-coded fallback** (`allowlist.ts:19,31` — `FALLBACK_ADMIN_EMAIL='ross@beaconhobbies.com'`, no `emailVerified` check). If `MM_ADMIN_EMAILS` is unset in prod **and** that email isn't already registered, an attacker can self-signup into gallery-moderation admin. Doubly conditional; blast radius = gallery moderation only. **Fix:** confirm `MM_ADMIN_EMAILS` is set (zero-code mitigation), fail closed when unset, require `emailVerified` or key off a stable user id / DB role.
- **[LOW] Stripe webhook no idempotency** — §4. Not attacker-forgeable (needs a Stripe-signed event); limited to Stripe retries re-stamping timestamps.

**What's fine (verified):**
- **Stripe webhook signature verification is correct** — raw-body `constructEvent`, forged POST → 400; the core `client_reference_id`+metadata → plan grant is reliable.
- **The blob-proxy route was deliberately SSRF-locked** to `*.public.blob.vercel-storage.com` — the gallery path just didn't reuse it (that's B2).
- **Extension token design is sound** — HMAC, `timingSafeEqual`, version-bump revocation — just unreachable behind the matcher gap (§4).
- **bcrypt cost 10**; **HTTPS enforced** (http→308 https), **HSTS present**, **TLS valid**, functions region-pinned `pdx1`.

---

## 8. UX / UI

### Desktop
- **Signed-out color-tool pages are a work-loss dead-end** (`/tools/wheel|match|dropper|stacking`, 200 signed-out) — no site chrome, the only nav link (`← TOOLS`) 307s to `/sign-in`, and Save/Send-to-Recipe silently redirects mid-transition, **discarding the generated palette + typed name** with no "sign in to save" cue. These are the app's most search-discoverable pages (§6). **Nuance:** Save is *also* Pro-gated in code (inert while `BILLING_ENFORCED=false`), so "create a free account to save" won't enable Save once billing flips — the anonymous-dead-end fix and the free-vs-Pro save gate are separate decisions. **Fix:** public header + Sign-up CTA + inline "sign in to save" that preserves state (the `MockProvider` already exposes `signedIn` to client components).
- **Full-page project view can't edit granular progress** — §4.
- **Roster columns clip when the inspector is open at 1440px** (low, unverified).

### Mobile (the launch's primary platform)
- **Library virtualization defeated → 7,150 nodes / 28,000px** — §5 P4. Highest-value mobile fix, one CSS line.
- **Every text input renders at 13px → iOS Safari auto-zoom on focus** (`globals.css:156` `--text-body:0.8125rem` via `Input.tsx:49`), starting with the sign-in username field — the first thing a phone user touches. Universal first-session friction (recoverable — `maximum-scale` isn't locked). **Fix:** ≥16px on form controls only (scope to inputs/select/textarea, gate to mobile widths; `text-base` = 14px is **not** enough; do **not** lock `maximum-scale` — WCAG 1.4.4 regression).
- **Many controls 24–33px tall** — below the 44px HIG guideline, and the 17px inline retailer links + the layer-name input dip under the WCAG 2.2 SC 2.5.8 24px floor (the 24×24 pickers sit exactly at it). **Fix:** raise to 44px, or 24px + adequate spacing; the 17px links are the genuine WCAG concern.
- **Hero "Start for Free" CTA below the fold at 1366×768** (button top=893px); header exposes only "Sign in" — the wrong door for a new user. **Fix:** cap the hero illustration (~40vh) and/or add a persistent "Start for Free" to `PublicHeader`. §9.
- Bottom-nav labels ~9.6px (low, unverified).

### Accessibility
- **[MEDIUM] Form errors not announced or linked to fields** (`Input.tsx:45,56`) — sign-up/sign-in set `aria-invalid` but the error span has no `id`, no `role`/`aria-live`, and the input has no `aria-describedby`; a screen-reader user on account creation hears "invalid entry" with no reason. WCAG 3.3.1 (A) + 4.1.3 (AA). **Fix (one shared primitive):** stable error `id` + `aria-describedby` + `aria-live="polite"` (prefer polite over assertive `role=alert` since it's app-wide).
- **[MEDIUM] 841 paint swatches announce as "list item," not "button"** (`SwatchWall.tsx:111`, `ColorPicker.tsx:239/409`) — `role="listitem"` on native `<button>` overrides the button role. WCAG 4.1.2 (A); keyboard still works. **Fix:** drop `role="listitem"` (only the non-selectMode branch — the `role="checkbox"` selectMode branch is valid).
- **[MEDIUM] Footer links distinguishable by color alone (2.11:1)** with underline only on hover (`LandingView.tsx:304`, also `/gallery` footer + `r/[slug]/page.tsx:132`) — `text-cyan-lite hover:underline`. WCAG 1.4.1 (A). **Fix:** persistent `underline` (cheapest; keeps the deliberate 2-tier accent contract).
- **Low (unverified):** duplicate/nested `<main>` on `/gallery`; `aria-label` on role-less `<span>` (app-wide `Swatch`); generic `<title>` on `/dashboard`/`/library`/`/sign-up`; empty collection checkbox-column header.

**What's good:** the vintage-terminal design system is genuinely consistent (worst cosmetic finding is a single en-dash); desktop virtualization works (849 nodes at 1440px); the only recurring console error app-wide is a local-only Vercel-insights 404 — no JS/page errors in any flow.

---

## 9. Success potential: how to win

The product already contains the machine that wins: painter finishes a model → exports a branded share card → posts it into a hobby community → stranger sees proof → clones the exact recipe in one click → becomes the next poster. The engine isn't missing — **almost every joint is leaking, and three leaks route traffic to a 404 or a blank card.** *(No traffic/conversion numbers exist pre-launch; every diagnosis below is grounded in code + live HTTP, not assumed market behavior.)*

### The distribution loop, leak by leak
1. **The link into the room is dead** → B1 (§2).
2. **The post unfurls blank** → B3 (§2).
3. **The card that travels carries no address.** The rasterized `cardRef` node's only brand element is the `MINI-MAINFRAME` wordmark — no URL, no `/r/` link, no QR (grep-confirmed). The `/r/` OG image already prints `mini-mainframe.com`; copy that onto the asset users actually export. Not a hard dead-end (the wordmark is searchable), but added friction on the highest-leverage moment. **Fix (~15 lines, both DOWNLOAD + SUBMIT share `renderCardPng`):** a footer strip **inside** `cardRef` reading `mini-mainframe.com` (static text covers both paths, since DOWNLOAD can run with `recipeId==null`), ideally `/r/<slug>` + a small inline QR.
4. **Search can't find the content** → §6 sitemap.
5. **Would a painter be proud to post it? Today the gallery says no** — all 8 seed cards render as abstract swatch strips (`cardImageUrl` null), not model photos. The differentiator is *painted model AND recipe*; a cold visitor sees colour bars that look like a spreadsheet. **Fix (content, not code):** seed 8–15 real photo cards through the live submit flow before driving traffic. This fixes moat-visibility, share-worthiness, and activation in one move.
6. **You'll launch blind on the loop** — card download / gallery submit / clone fire zero analytics (the one instrumented event, `PublicRecipeShared`, covers the secondary public-link surface, not the moat loop). Gallery submits + clones leave DB rows (`gallerySubmittedAt`, `cloneCount`) and Vercel Analytics auto-tracks `/r/` + `/gallery` pageviews, but **card downloads are completely invisible.** **Fix (S):** `CardDownloaded` (client — the priority, no other data source), `CardSubmittedToGallery` + `RecipeCloned` (server).
7. **The loop is half-tolled** — `publishRecipe` (mint the public `/r/` link) is Pro-gated ("Upgrade to share recipes publicly"), while `submitRecipeToGallery` (same capability) is free. Inert today (`BILLING_ENFORCED=false`) but a growth own-goal the moment billing flips. **Recommendation:** make **all** sharing free forever — pull the Pro gate out of `publishRecipe`; monetize on volume/AI/imports (as `/pricing` already does). Separately, the Founder "100 seats" scarcity is unbacked (§4 webhook counter) — wire the real counter or drop the "Limited launch" claim.

### Activation — shorten stranger → "this is useful"
Today the funnel makes a stranger *produce content before value*: landing → sign-up (username+email+password) → empty dashboard → "Create your first project" → name/add unit/set counts. ~6 interactions + manual data entry before the app reflects anything back. Yet the fastest "wow" already exists and is hidden: **"Clone to my library"** lands you on a fully-populated recipe in one action, and the color tools work fully signed-out. Neither appears in the hero (which links to `/sign-up` 3×, gallery 0×), the dashboard empty state, or the empty `/recipes`/`/collection` states. **Move:** add "Browse the gallery — clone a starter recipe" to those empty states; add a "See the gallery (no signup)" hero CTA; promote a **visible** keyword H1; cap the hero illustration so the CTA clears the fold at 768px.

### Retention — what brings a painter back next weekend
The schema stores everything a pull-back engine needs — `event.event_date`, `paint_sessions.started_at`, project stage counters — and the **streak is already built** (`src/lib/streak.ts` + dashboard StatRow). What's missing is purely the **outbound** channel: `vercel.json` has no crons, Resend is transactional-only. Ranked: (1) **weekly digest email** via a Vercel cron reusing the Resend mailer ("your tournament is in 5 days and 12 models are unpainted" + backlog) — effort L, mind transactional-vs-marketing consent + Resend deliverability; (2) deadline reminders keyed to `event.event_date`; (3) surface the streak harder in-app (S). Retention ranks below distribution/activation *for this stage only.*

### Differentiation — the one thing a spreadsheet can't do
A spreadsheet lists paints; it can't pair a photo of your finished model with the exact, reproducible, cross-brand recipe behind it and let a stranger clone the whole scheme in one click. All three pieces are built (7,000-paint catalog, branded share card, one-click Clone) — they're just invisible (gallery is a footer link, and it's swatch strips). **Make a wall of real painted minis with visible "Clone" buttons the landing hero**, above the fold. Longer horizon: the catalog is the §6 programmatic-SEO surface.

### Top-5 highest-leverage changes (if the builder does only five)
1. **[S] Unbreak the plumbing** — OG image matcher + AUTH_URL/canonical host (B1+B3). *Do this first — trivially cheap, currently caps the entire posting strategy at near-zero.*
2. **[S] Stamp the URL onto the share card** (~15 lines) — every posted card becomes a route back.
3. **[M] Seed the gallery with real minis + surface it** — turns top-of-funnel proof from swatches into aspiration and exposes the one-click clone.
4. **[S] Dynamic sitemap + homepage rewrite** — expose the UGC + rank for real terms (compounding bet, not a day-1 channel).
5. **[S] Instrument the loop** — measure the one launch spike; card-download is the priority.

*Deliberately left off:* the weekly-digest retention engine (obvious #6, L effort, pays over weeks). And the B4 lockout + B2 moderation bypass are the price of admission — a locked-out user or a day-1 gallery incident would poison the loop faster than these five could feed it.

---

## 10. What we did NOT check (the audit's own limits)

This audit thoroughly de-risked the *interactive code and UX* but treated launch as a code review, not an operations launch. Honest gaps:

**Surfaces never exercised end-to-end:** the **army/roster import pipeline** (BattleScribe `.ros/.rosz`, PDF, text, JSON, + **Groq LLM fallback** on low parser confidence) — the single highest-risk untested surface: 20MB base64 upload → file decode → PDF extraction → external-LLM egress to an **undisclosed subprocessor**. Also never driven: focus-bench time-tracking CRUD, calendar/events create-edit-delete, inspiration-image uploads (a 2nd blob surface), paint notes, `/recipes/[id]`. **Recommend at minimum a manual smoke of an army-list paste (both parser and Groq fallback) + one inspo-image upload before go-live.**

**Risk classes turned into evidenced findings by the completeness pass** (folded into §2/§4 above): error monitoring (O1), support/data-rights contact (O2), rate/quota caps (O3), FK-cascade erasure (O4). Additional GDPR/legal items *not* yet gating but worth closing week 1:
- **Data export is incomplete** — `exportData.ts` exports 6 of 16 owner-scoped tables (omits paint notes, sessions, events, activity log, project/inspo images, imports, step-completion, feedback), yet `privacy/page.tsx:37` claims "you can export all of your data" and names "sessions and events." Portability + policy disagree.
- **Account deletion never removes Vercel Blob objects** — project images, inspo images, gallery PNGs persist in blob storage and their URLs keep resolving after "delete my account" (GDPR Art.17 gap). **Fix:** enumerate + `del()` blobs in `deleteAccount`.
- **Privacy policy omits AI + analytics subprocessors** — Anthropic (recipe prompts + gallery-moderation images), Groq (army-list text), Vercel Analytics are undisclosed (GDPR Art.13/28).
- **No rollback plan / no pre-deploy DB snapshot gate** — `migrate-or-skip.mjs` auto-applies migrations to prod on every build; `DEPLOY.md` documents only Turso's 24h auto-backups, no runbook. **Fix:** manual `.dump` snapshot as an explicit gate for schema-changing releases + a one-paragraph rollback runbook.
- **Deploy runbook omits 5 env-var groups** the live app reads (Stripe ×5, Blob, Anthropic, `NEXT_PUBLIC_APP_URL`, `MM_ADMIN_EMAILS`) and still documents removed magic-link auth — a from-scratch rebuild would silently ship payments/uploads/AI/moderation degraded.
- **`npm run lint` is broken** (`next lint` removed in Next 16 → lints zero files) and **CI runs no linter at all** — a whole class of defects ships unchecked.

**Also unmeasured:** every prod-latency number is against `/gallery` (one query) or extrapolated — nobody could query the prod DB or confirm the Turso region (P9 stays an "investigate," not a proven defect). Local timings use a zero-latency SQLite file DB.

---

## 11. Appendix

### A. Verifier corrections (the process had teeth)
The adversarial verification pass **downgraded or corrected** many findings — reported here so the reader trusts the survivors:
- **Three separate findings** (`build-health` canonical-URL, `seo-technical` AUTH-redirect, `security` AUTH-misconfig) were **one root cause** — deduped to B1; counting them separately would have inflated the blocker count.
- **Two password-reset findings** filed with contradictory gating were merged (B4); both proposed a fix (`fall back to email when emailVerified`) that **still strands the majority** — corrected to "reset against `users.email` unconditionally."
- **"19× function invocations" per click → corrected to 2** invocations user-facing; the 18-request storm is background prefetch that does **not** block the edit. Real harm reframed as server-side amplification (P2).
- **GW scrape "silent failure" → corrected:** it fires a **green success toast**, and the proposed `gw.ts` hostname fix is **ineffective** (405 before any parser runs).
- **Many SEO/growth "high" findings downgraded to medium** — the product is *not* invisible to Google (indexable homepage/pricing/gallery exist); the gaps are optimization, not visibility.
- **Cold-start fix corrected** — `router.refresh()` reduction is a warm-latency win, not a cold-start cure.
- **loadAppData relocation corrected** — must not strip `/collection` (would show demo fixtures).
- **iOS-zoom / touch-target severities** trimmed high→medium (recoverable friction, missed best-practice, not blocking).
- **Wildcard-image "SSRF" narrowed** to blind (no body exfil); **clickjacking** narrowed (server-action same-origin check).
- **`/recipes` "ships every recipe twice" → false** (client gets each once); "serial 3N RTT" → concurrent connection pressure.

**Findings left UNVERIFIED** (surfaced, plausible, but not adversarially re-confirmed — treat as leads): `+ADD UNIT` label, Vercel-insights prod 404, roster column clip, SYS-banner en-dash, `markBought` containment, `revalidatePath` bugs-code dup, dead `buildRecipesByPaintTitle`, unindexed hot columns, `/r` twitter:title, HSTS hardening, Stripe idempotency (security dup), extension verify-email gate dup, price-copy disagreement, nested `<main>`, `aria-label` span, generic titles, empty checkbox header, Turso auto-migrate gate, sw.js stamp dirties tree, committed ux-audit PNGs.

### B. Full findings table (verified, most-severe first)

| Sev | Gate | Dimension | Finding | Location | Effort |
|---|---|---|---|---|---|
| BLOCKER | ✓ | seo-tech/security/build | Prod origin → dead vercel.app (re-auth 404 + split-brain cookies + dead email links) | `proxy.ts:73`; env | S |
| BLOCKER | ✓ | automations | Gallery moderation bypass + SSRF | `gallerySubmissions.ts:94-179` | M |
| HIGH | ✓ | seo-technical | og:image/twitter:image gated → blank unfurls | `proxy.ts:106` | S |
| HIGH | ✓ | signup-funnel | Password reset dead-end (reads `recoveryEmail`, not `email`) | `passwordReset.ts:66` | M |
| HIGH | (ops) | build-health | No error monitoring / alerting anywhere | `instrumentation.ts` (absent) | S |
| HIGH | — | ux-desktop | Collection URL auto-fill silently fails for GW (+false success toast) | `gw.ts:9`, `scrapeInsert.ts:58` | M |
| HIGH | — | perf-live | Status/Type/Priority no optimistic UI (stale value ~0.6–1.1s) | `Listbox.tsx:55`, `PriorityDropdown.tsx:40` | M |
| HIGH | — | perf-live | Intermittent permanent hang on the three controls | `ProjectWorkspaceBody.tsx:310` | S |
| HIGH | — | perf-live | 18-request `router.refresh()` RSC storm (~19× loadAppData) | `ProjectWorkspaceBody.tsx:318` +5 | M |
| HIGH | — | ux-mobile | Library virtualization defeated (7,152 nodes / 28,000px) | `AppShell.tsx:31` | S |
| MED | (ops) | privacy/legal | No reachable support / data-rights email | `privacy/page.tsx:41` | S |
| MED | (ops) | ops | "Capped" beta uncapped — no rate limits/quota/captcha | `plans.ts:39`; signup/AI/gallery | M |
| MED | (verify) | data | Prod FK cascade unverified (erasure may orphan data) | `db/client.ts` | S |
| MED | — | bugs-code | `saveRecipe` deletes slots before re-insert, no transaction | `saveRecipe.ts:70-101` | M |
| MED | — | bugs-code | Double-click `+New Project` → duplicates | `DashboardClient.tsx:59` | S |
| MED | — | bugs-code | Email-verification link 307s for signed-out | `proxy.ts:26-37,106` | S |
| MED | — | bugs-code | Password change/reset doesn't revoke other sessions | `passwordReset.ts:143` | M |
| MED | — | automations | Extension API unreachable (matcher omits `api/extension`) | `proxy.ts:104` | S |
| MED | — | automations | Stripe webhook no idempotency + Founder counter never written | `billing/webhook/route.ts:60` | M |
| MED | — | build-health | No executed test covers checkout/webhook | `qa_billing_upgrade.spec.ts` | M |
| MED | — | ux-desktop | Signed-out color-tool pages work-loss dead-end | `ToolShell.tsx`, `palettes.ts:73` | M |
| MED | — | ux-desktop | Full-page project view can't edit granular progress | `ProjectPageClient.tsx:384` | M |
| MED | — | perf-live/code | loadAppData full batch every route, recipe read 3× | `layout.tsx:28`, `appData.ts:366` | L |
| MED | — | perf-live | Prod cold start ~1.4–2.2s | `/gallery` (pdx1) | M |
| MED | — | perf-code | `/recipes` N+1 (~3N round-trips) | `recipes/page.tsx:20-33` | M |
| MED | — | perf-code | html-to-image ships eagerly; zero code-splitting | `RecipeWorkbench.tsx:17` | M |
| MED | — | perf-code | force-dynamic vs remote Turso; region unverified | `vercel.json:4` | M |
| MED | — | security | No HTTP security headers (CSP/XFO/nosniff/…) | `next.config.ts:79` | M |
| MED | — | security | Wildcard `next/image` remotePatterns (open proxy) | `next.config.ts:47` | S |
| MED | — | security | Admin gate on unverified email + hard-coded fallback | `allowlist.ts:19,31` | S |
| MED | — | ux-mobile | 13px inputs → iOS focus-zoom (incl. sign-in) | `globals.css:156`, `Input.tsx:49` | S |
| MED | — | ux-mobile | Many controls 24–33px (touch targets / WCAG 2.5.8) | segmented/pills/links | M |
| MED | — | signup-funnel | Hero "Start for Free" below fold at 1366×768 | `LandingView.tsx` hero | S |
| MED | — | a11y | Form errors not announced/linked (3.3.1 A, 4.1.3 AA) | `Input.tsx:45,56` | S |
| MED | — | a11y | 841 swatches `role=listitem` on `<button>` (4.1.2 A) | `SwatchWall.tsx:111` | S |
| MED | — | a11y | Footer links color-only 2.11:1 (1.4.1 A) | `LandingView.tsx:304` | S |
| MED | — | seo-onpage | Homepage contains none of the target search terms | `(public)/page.tsx` | S |
| MED | — | seo-onpage/growth | Gallery + `/r/` orphaned from sitemap, thin metadata | `sitemap.ts`, `r/[slug]/page.tsx` | M |
| MED | — | seo-onpage | Zero structured data (JSON-LD) anywhere | app-wide | M |
| MED | — | seo-technical | www/apex split-brain; no canonical | `layout.tsx:8`, `sitemap.ts:3`, `robots.ts:3` | S |
| MED | — | seo-onpage | Only 6 thin indexable pages; no keyword surface | `sitemap.ts` | L |
| MED | — | seo-onpage/growth | 7,144-paint catalog gated + client-side (programmatic-SEO) | `public/data/paints.json` | L |
| MED | — | growth | Share card carries no address/URL | `ShareCardComposer.tsx:320` | S |
| MED | — | growth | Viral loop fires zero analytics (card download invisible) | `ShareCardComposer.tsx`; `events.ts` | S |
| MED | — | growth | No re-engagement loop (no cron/digest; streak in-app exists) | `vercel.json`; Resend | L |
| MED | — | growth | `/tools/*` usable but robots-disallowed + sitemap-absent | `robots.ts:19`; `sitemap.ts` | M |
| MED | — | growth | Gallery seed = swatch strips, not painted models | `GalleryBrowser.tsx`; seed set | M |
| MED | — | growth | Time-to-value: empty dashboard pushes data-entry over 1-click clone | dashboard/empty states | M |
| MED | — | growth | Sharing half Pro-gated; Founder scarcity unbacked | `recipeSharing.ts:87`; `founderCounter.ts` | M |
| MED | — | build-health | `npm run lint` broken + CI runs no linter | `package.json`; `ci.yml` | S |
| MED | — | build-health | Deploy runbook omits 5 env-var groups; stale auth docs | `DEPLOY.md`; `.env.production.example` | S |
| MED | — | privacy | Data export incomplete (6 of 16 tables) vs policy claim | `exportData.ts`; `privacy/page.tsx:37` | S |
| MED | — | privacy | Account deletion never removes Vercel Blob objects | `account.ts:deleteAccount` | M |
| MED | — | privacy | Privacy policy omits AI + analytics subprocessors | `privacy/page.tsx:33` | S |
| MED | — | ops | No rollback plan / pre-deploy DB snapshot gate | `DEPLOY.md`; `migrate-or-skip.mjs` | S |
| LOW | — | perf-live/bugs | 35 `revalidatePath("/projects")` hit a 308 (latent) | `projects.ts:260…` | S |
| LOW | — | seo-onpage | `/sign-in` + `/sign-up` thin duplicate titles in sitemap | `sitemap.ts:9-10` | S |
| LOW | — | security | Stripe webhook no idempotency (replay re-stamps) | `billing/webhook/route.ts:83` | S |
| LOW | — | automations | Import pipeline (BattleScribe/PDF/Groq) never smoke-tested | `imports.ts`; `llmFallbackParser` | (smoke) |

*(Low/unverified hygiene items — §11.A list — omitted from the table for length; all are S effort.)*

---

*Bottom line: two env-var/one-line config fixes (B1, B3) unbreak crawling, re-auth, email, and social unfurls; two code fixes (B2, B4) close the moderation bypass and password lockout; three operational gates (O1–O3) and one verification (O4) close the "launch blind" exposure. All are S/M. Fix the set, seed the gallery, re-verify live — YES the same night.*
