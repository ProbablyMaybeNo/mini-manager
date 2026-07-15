# Pre-Launch Task Batch — autonomous work queue

**For the agent working this file.** Source context: `docs/LAUNCH_BUILD_LIST.md` (batched rationale) and `docs/LAUNCH_READINESS_REPORT.md` (full audit with file:line detail). Read the relevant section of those for any task where you need more than the summary here.

Everything in **§DO** is self-contained code you can finish without asking a human. Everything in **§SKIP** needs a human decision or an external credential — do **not** attempt it, do not stub it in a way that pretends it works.

---

## Execution protocol (follow exactly)

1. Work **§DO tasks strictly in listed order** (they're dependency-sorted). One task at a time.
2. For each task: implement → run the gate → if green, **commit that task alone**, then tick its box here (`- [ ]` → `- [x]` with the short commit SHA) and commit the tick with the code.
3. **Per-task gate (all must pass before you commit):**
   - `npm run typecheck` — zero errors
   - `npm run lint` — zero **errors** (warnings are fine; do not chase the 39 pre-existing `react-hooks/*` warnings)
   - `npm run test:unit`
   - `npm run test:integration`
   Run `npm run build` at the **end of each lettered group** (A, B, …) rather than every task — it's the slow one.
4. Match existing patterns in neighbouring files. Strict TypeScript, no `any`, no `@ts-ignore`, no new deps unless a task explicitly says so. No comments except where a constraint isn't obvious from the code. Follow `C:\Users\Admin\.claude\CLAUDE.md` coding standards.
5. **When a task adds behaviour, add or extend a test for it** (this repo has real unit + integration coverage — keep it green and cover new logic).
6. **If a gate fails:** try to fix it (up to ~2–3 focused attempts). If you cannot get it green, **revert that task's changes** (`git checkout -- .` / `git reset --hard HEAD` on the uncommitted work only), mark the box `- [~] BLOCKED: <one-line reason>`, and **move on to the next task**. Do not let one stuck task end the run.
7. **If a task turns out to need a decision or a credential** you don't have, mark it `- [~] NEEDS-ROSS: <reason>` and move on. Don't guess a support email, don't invent an API key.
8. **Do NOT push per commit.** Commit locally as you go; the account was just re-billed and per-commit preview builds cost money. **Push the branch once, at the very end**, and do not open a PR or touch `main`.
9. Do not run `next dev` (a running dev server corrupts the shared `.next`). Gates use build/test only.
10. When every §DO task is done or marked BLOCKED/NEEDS-ROSS, write a final summary section at the bottom of this file (what shipped, what was skipped and why) and commit it, then push the branch.

Commit style: `type(scope): summary`, end body with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## §DO — self-contained code tasks

### Group A — Auth / proxy / gallery security (gating; small; mostly `src/proxy.ts`)

- [x] `8bac532` **A1 — Un-gate OG/Twitter image + verify-email + extension in the proxy matcher.**
  In `src/proxy.ts`: add `opengraph-image|twitter-image` and `api/extension` to the matcher negative-lookahead (`config.matcher`, ~line 106); add `/verify-email` and `/user/verify-recovery` to **both** `isPublicPath()` (~line 26) and the matcher. *Acceptance:* `isPublicPath("/verify-email")` is true; build green. If a `proxy`/middleware unit test exists, extend it; otherwise add one asserting these paths are public and `opengraph-image`/`api/extension` are matcher-excluded. (Covers B3 + the verify-email/extension parts of B2.)

- [x] `da0bef2` **A2 — Password reset issues against `users.email`.**
  In `src/lib/auth/passwordReset.ts` `requestPasswordReset`: look the user up by username and send the reset to `users.email` directly. Do **not** gate on `emailVerified` (the majority never clicked verify and would stay locked out). Keep the always-`ok:true` enumeration-safe behaviour. Send the mail to `users.email`. *Acceptance:* an integration test where a normal credentials signup can request a reset and a mail is dispatched to their signup email; existing reset tests updated. (B4)

- [x] `3a469ef` **A3 — Revoke other sessions on password reset + change.**
  In `applyPasswordReset` (`passwordReset.ts`) delete all sessions for the user, then re-mint the one you return. In `changePassword` delete all sessions **except** the current token. *Acceptance:* integration test proving a second session is invalidated after reset. (B4 companion)

- [x] `76c0fe3` **A4 — Lock the gallery image path (moderation bypass + SSRF).**
  In `src/lib/actions/gallerySubmissions.ts` `submitRecipeToGallery`: reject any `imageUrl` whose host isn't `*.public.blob.vercel-storage.com` — reuse `isProxiableBlobUrl` from `src/lib/shareCard/imageSrc.ts`; also confirm the URL's pathname matches the `imagePathname` the client already sends. Apply the same allowlist inside `fetchImage` in `src/lib/ai/imageModeration.ts`. Render `cardImageUrl` through the blob-proxy at all three sinks: `GalleryBrowser.tsx`, `AdminGalleryReview.tsx`, and `src/app/r/[slug]/opengraph-image.tsx` (this last one embeds fetched bytes into a public OG image — the strongest SSRF; route it through the locked path too). *Acceptance:* integration test — a submit with an off-host `imageUrl` is rejected; an on-host one passes. Build green. (B2)

**→ run `npm run build` after Group A.**

### Group B — Amplification / cost (promoted to before-traffic; the thing that caused the 402)

- [x] `b87c924` **B1 — Optimistic Status/Type/Priority + kill the RSC storm (P1+P2+P3 together — they interlock, ship as ONE task).**
  These three must land together or the UI regresses. Files: `src/components/dashboard/ProjectWorkspaceBody.tsx`, `src/app/(app)/projects/[id]/ProjectPageClient.tsx`, `src/components/dashboard/PriorityDropdown.tsx`, `src/components/dashboard/ProjectsTable.tsx`, plus the 35 action sites.
  - **P1:** wrap the project view-model in `useOptimistic`, apply the picked value synchronously before awaiting the action, and **drop `disabled={pending}`** from the three Listboxes. Do it in all three control surfaces.
  - **P2:** delete the six `router.refresh()` calls in the mutation handlers (both host pages are `force-dynamic`, so the POST already re-renders).
  - **P3 (must ship with P2):** swap every `revalidatePath("/projects")` → `revalidatePath("/dashboard")` (~35 sites; also the non-route `/projects/import` in `imports.ts`). `/projects` is a 308 redirect, not a page — once `router.refresh()` is gone this is what keeps the dashboard fresh.
  *Acceptance:* typecheck + unit + integration green; existing project-action integration tests still pass. This is subtle — read report §5 P1–P3 first. *Note in your commit:* this touches the same 4 files as the uncommitted faction/wargame WIP on `feat/project-faction-wargame`; a later merge will need manual reconciliation.

- [x] `5bf1777` **B2 — Library mobile virtualization (one line).**
  Add `min-h-0` to the content column in `src/components/shell/AppShell.tsx` (~line 31) so the mobile scroll container is bounded and `react-virtual` stops rendering all 7,000+ paint nodes. *Acceptance:* build green. (P4)

- [x] `cb95a7a` **B3 — De-dup `loadAppData` recipe reads.**
  In `src/lib/appData.ts` (~366–399) the `recipe` table is read 3× and `recipe_slot` 2× per request. Collapse to one read each. Lowest-risk perf win; keep the returned shape identical. *Acceptance:* all integration tests that exercise `loadAppData` still pass. (P5)

**→ run `npm run build` after Group B.**

### Group C — SEO base (cheap, clustered)

- [x] `86e36f6` **C1 — Canonical host → www.** Set `metadataBase` (`src/app/layout.tsx`), sitemap `BASE` (`src/app/sitemap.ts`), and robots `BASE`/`host`/`sitemap` (`src/app/robots.ts`) to `https://www.mini-mainframe.com`. Add `alternates.canonical` per public page metadata. *Acceptance:* build green; sitemap/robots emit www URLs.
- [x] `07e896b` **C2 — Dynamic sitemap.** Make `sitemap.ts` async; append `/gallery` and every published `/r/<slug>` (reuse `listPublishedRecipes()`); **remove `/sign-in` and `/sign-up`**; set `robots: { index: false }` on the auth pages. *Acceptance:* sitemap includes `/gallery` + at least the published slugs, excludes the auth pages; build green.
- [x] `3570f42` **C3 — Structured data (JSON-LD).** Add `WebApplication` + `FAQPage` on the homepage, `BreadcrumbList` on `/gallery` and `/r/[slug]`. **No `Recipe`/`HowTo` schema, no `aggregateRating`** (no real reviews — fabricating violates Google policy). *Acceptance:* valid JSON-LD renders in the page HTML; build green.
- [x] `b8f093c` **C4 — Homepage keyword copy.** Add a **visible** plain-English sub-headline under the CRT logo and weave target terms (miniature painting tracker, paint collection manager, wargame project tracker, Warhammer/Citadel/Vallejo/Army Painter, pile of shame) into the `<title>`, meta description, and FEATURE blurbs. Keep the brand mark. Suggested title/subhead are in `LAUNCH_BUILD_LIST.md` §B4. *Acceptance:* the live-rendered landing HTML contains those terms; build green.

**→ run `npm run build` after Group C.**

### Group D — Growth loop instrumentation

- [x] `ec78b46` **D1 — Stamp the URL onto the share card.** Add a footer strip **inside** the rasterized `cardRef` node reading `mini-mainframe.com` (static text — must cover the `recipeId == null` DOWNLOAD path too). Both DOWNLOAD and SUBMIT share `renderCardPng`, so one change covers both. `src/components/recipe/ShareCardComposer.tsx`. *Acceptance:* build green; the stamp is inside the captured node, not the surrounding UI.
- [x] `87e14e9` **D2 — Add the missing analytics events.** Extend `src/lib/analytics/events.ts` and fire: `share_card_downloaded` (client — priority), `gallery_view`, `recipe_card_view`, `recipe_cloned`, `gallery_submit_started`, `gallery_submit_completed`, `tool_match_completed`, `tool_result_saved`, `extension_token_created`, `billing_checkout_started`, `billing_checkout_completed`. Wire each at its natural call site. *Acceptance:* events defined + fired; typecheck green.

### Group E — Correctness / security hardening

- [x] `4d9d829` **E1 — `saveRecipe` transactional slot replace.** `src/lib/actions/saveRecipe.ts` deletes all slots before re-inserting with no rollback. Copy the manual snapshot-and-restore pattern `cloneRecipe` already uses, or persist the new set before deleting the old. *Acceptance:* integration test — a forced mid-save failure leaves the original slots intact.
- [x] `36bd51f` **E2 — Guard double-submit `+ New Project`.** `src/components/dashboard/DashboardClient.tsx` — capture the `useTransition` pending flag, thread `disabled` to every create button, add an early-return guard. *Acceptance:* a double-click yields one project (integration or a guard unit test).
- [x] `5213a8a` **E3 — Fail the admin allowlist closed.** `src/lib/**/allowlist.ts` — remove the hard-coded `FALLBACK_ADMIN_EMAIL`, require `MM_ADMIN_EMAILS`, and require `emailVerified` (or key off a stable user id / DB role). Fail closed when unset. *Acceptance:* unit test — unset env ⇒ nobody is admin; a non-verified matching email is not admin.
- [x] `1f42543` **E4 — HTTP security headers.** Add a `headers()` block in `next.config.ts`: CSP **report-only** first (the app uses inline styles — do not enforce yet), `X-Frame-Options: DENY` / `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, and `includeSubDomains` on HSTS. *Acceptance:* build green; headers present on a built response.
- [x] `6f34397` **E5 — Tighten `next/image` remotePatterns.** `next.config.ts` — replace the `hostname:'**'` wildcard with the blob host + any genuinely-needed hosts. **Pasted reference images** must still work: route them through a validated same-origin proxy or a plain `<img>` in the same change, or this breaks that feature. *Acceptance:* build green; `/_next/image?url=<arbitrary external>` no longer optimizes an off-allowlist host; pasted-reference feature still renders.
- [x] `f543775` **E6 — FK cascade on.** Add `PRAGMA foreign_keys = ON` on connection init in `src/db/client.ts` (harmless if already on). *Acceptance:* tests green. (O4)
- [x] `02126af` **E7 — Per-user quota + signup rate limit (DB-counter based, no external service).** Add a per-user daily quota on `/api/recipe/ai` and gallery-submit (a simple DB counter table/column is enough), and an IP-based rate limit on the credentials signup action. **Independent of `BILLING_ENFORCED`.** Do **not** add Cloudflare Turnstile here — that needs keys (see §SKIP). *Acceptance:* integration test — the N+1th AI/gallery call in a day for one user is refused; build green. (O3, minus captcha)

**→ run `npm run build` after Group E.**

### Group F — a11y / mobile polish

- [x] `5395acf` **F1 — iOS input zoom.** Raise form-control font-size to ≥16px on `input`/`select`/`textarea`, scoped to mobile widths. Do **not** lock `maximum-scale` (WCAG 1.4.4). Source: `globals.css` `--text-body`, `Input.tsx`. *Acceptance:* build green; controls compute ≥16px at mobile widths.
- [x] `2365d0a` **F2 — a11y trio.** (a) In `src/components/kit/Input.tsx` give the error span a stable `id`, wire `aria-describedby`, add `aria-live="polite"`. (b) Drop `role="listitem"` from the native `<button>` swatches in `SwatchWall.tsx` + `ColorPicker.tsx` (only the non-selectMode branch; keep the `role="checkbox"` selectMode branch). (c) Give footer links a persistent `underline` (`LandingView.tsx`, `/gallery` footer, `r/[slug]/page.tsx`). *Acceptance:* build green.

**→ run `npm run build` after Group F.**

### Group G — Privacy / legal (agent-doable parts)

- [x] `d4676df` **G1 — Complete data export.** `src/lib/**/exportData.ts` currently exports 6 of 16 owner-scoped tables. Add the missing ones (paint notes, sessions, events, activity log, project/inspo images, imports, step-completion, feedback). *Acceptance:* export includes all owner-scoped tables; test updated.
- [x] `145b595` **G2 — Delete blobs on account deletion.** In `deleteAccount`, enumerate and `del()` the user's Vercel Blob objects (project images, inspo images, gallery PNGs) so their URLs stop resolving. *Acceptance:* the delete path calls blob `del()` for the user's objects; test with a mocked blob client.
- [ ] **G3 — Disclose subprocessors in the privacy policy.** `src/app/**/privacy/page.tsx` — add Anthropic (recipe prompts + gallery-moderation images), Groq (army-list text), and Vercel Analytics. *Acceptance:* the three are named; build green.
- [ ] **G4 — Support-email plumbing (placeholder value).** Add a single `SUPPORT_EMAIL` constant (read from `process.env.SUPPORT_EMAIL` with a clearly-marked `CHANGE_ME@mini-mainframe.com` fallback) and surface it in the footer, privacy + terms pages, `/sign-in`, and the reset page; accept anonymous feedback in the report form. **Leave the real address for Ross** — do the wiring, mark the value NEEDS-ROSS in your summary. *Acceptance:* the constant is surfaced everywhere listed; build green. (O2 plumbing)

**→ run `npm run build` after Group G, then the full gate one final time.**

---

## §SKIP — do NOT attempt (needs a human decision or an external credential)

- **Error monitoring (O1)** — needs a Sentry account/DSN or a Vercel Log-Drains decision. Don't scaffold a fake init.
- **Cloudflare Turnstile on `/sign-up`** — needs Cloudflare site keys.
- **Gallery real-photo seeding** — content; Ross submits real painted-model cards through the live flow.
- **Free-vs-paid tier reset / `BILLING_ENFORCED` / founder-seat policy** — product decision. (You may do the mechanical Stripe **webhook idempotency + founder counter write** only if you're confident and it's covered by a test — otherwise skip.)
- **Programmatic paint SEO** (`/paint/[brand]/[slug]`, `/paint-conversion/[a]-to-[b]`) — large, its own project.
- **Weekly digest cron** — needs marketing-consent + deliverability decisions.
- **`drizzle-orm` high advisory** — breaking 0.36→0.45 upgrade, no reachable exposure (no `sql.identifier`/`sql.raw` in `src/`). Post-launch PR.

---

## Final summary
*(agent fills this in at the end)*
