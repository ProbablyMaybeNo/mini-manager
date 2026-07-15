# Pre-Launch Task Batch R2 — remaining work after Hermie's 2026-07-15 audit

**For the agent working this file.** Read `§0` first — it changes what "remaining" means. Source context:
Hermie's 2026-07-15 readiness message, `docs/LAUNCH_READINESS_REPORT.md` (the full 2026-07-14 audit),
and `docs/LAUNCH_TASKS.md` (the R1 batch — **already shipped** on this branch).

---

## §0 — Read this first (the reframe)

**Almost everything in Hermie's 2026-07-15 audit is already fixed in code, on this branch
(`launch/pre-launch-batch`, 56 commits ahead of `main`), and the branch is green.** Hermie audited
`main` (`d1bf80a`) + live prod — **neither has the R1 batch deployed** — so the report reads as if the
fixes don't exist. They do. Verified 2026-07-15:

| Hermie flagged | Reality on this branch |
|---|---|
| OG/Twitter images gated by proxy | **Fixed** — A1 (`8bac532`), `proxy.ts` matcher excludes `opengraph-image\|twitter-image` |
| verify-email route gated | **Fixed** — A1, in `isPublicPath()` + matcher |
| Extension API gated | **Fixed** — A1, `api/extension` matcher-excluded |
| Password reset broken (`recoveryEmail`) | **Fixed** — A2 (`da0bef2`), issues against `users.email` |
| Gallery moderation bypass + SSRF | **Fixed** — A4 (`76c0fe3`), blob-host allowlist at all sinks |
| www/apex canonical mismatch | **Fixed** — C1 (`86e36f6`) |
| `/gallery` absent / auth pages in sitemap | **Fixed** — C2 (`07e896b`) |
| No structured data | **Fixed** — C3 (`3570f42`), WebApplication + FAQPage + BreadcrumbList |
| Homepage keywords underused | **Fixed** — C4 (`b8f093c`), visible sub-headline + keyword copy |
| All the new analytics events Hermie lists | **Fixed** — D2 (`87e14e9`), all 11 events wired |
| Rate limits / per-user quotas | **Fixed** — E7 (`02126af`), DB-counter quotas + IP signup limit |
| Mobile library virtualization | **Fixed** — B2 (`5bf1777`), `min-h-0` |
| iOS input font-size zoom | **Fixed** — F1 (`5395acf`) |
| Support/privacy email plumbing | **Fixed** — G4 (`9e7c5da`) — *needs the real value set in env* |
| Data export incomplete / blobs not deleted / subprocessors undisclosed | **Fixed** — G1/G2/G3 |
| `npm run lint` broken (`next lint`) | **Fixed** — `eslint.config.mjs` (flat config) + `"lint":"eslint ."`; verified **0 errors** |
| `sw.js` stamp breaks `test:unit` | **Fixed** — placeholder restored; `strategy.test.ts` **24/24 pass** |
| **B1 — prod origin → dead vercel.app host** | **DONE + verified live 2026-07-15** (env set, redeploy picked it up, billing pause cleared) |

**So R2 is not "re-do the audit."** R2 is three things:
1. **Ship the branch** (merge → deploy). One action resolves ~20 of Hermie's findings at once.
2. **Do the handful of genuinely-new code items** the R1 batch didn't cover (below).
3. **Close the operational gates that need a human decision or a credential** (error monitoring, real env
   values, gallery photo seed), then re-verify live.

Do **not** burn time re-implementing anything in the table above — it exists, it's tested, it's committed.

---

## Execution protocol

1. Work **§DO tasks in listed order**, one at a time. Match neighbouring-file patterns. Strict TS, no `any`,
   no new deps unless a task says so. Follow `C:\Users\Admin\.claude\CLAUDE.md`.
2. Per-task gate before commit: `npm run typecheck` (0 errors) · `npm run lint` (0 **errors**; the 49
   `react-hooks/*` warnings are pre-existing, leave them) · `npm run test:unit` · `npm run test:integration`.
   Run `npm run build` at the end of a group, not per task.
3. When a task adds behaviour, add/extend a test. Commit per task: `type(scope): summary`, body ends
   `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Tick the box here with the SHA.
4. **Do NOT push per commit** (preview builds cost money) and **do NOT merge or touch `main`** — commit
   locally, push the branch once at the end. Merge to `main` is Ross's call (see R-group).
5. Do not run `next dev` (corrupts shared `.next`). Gates use build/test only.
6. If a gate fails: ~2–3 focused fix attempts, else revert that task, mark `- [~] BLOCKED: <reason>`, move on.
   If a task needs a decision/credential, mark `- [~] NEEDS-ROSS: <reason>` and move on.

---

## §DO — new agent-executable code (before launch)

### Group H — Prove the branch is shippable

- [x] **H1 — Full QA gate + report.** Run, in order, and paste the counts into this file's final summary:
  `npm run typecheck` · `npm run lint` · `npm run test:unit` · `npm run test:integration` · `npm run build`.
  Expected: 0 type errors, 0 lint errors, unit + integration green, build green (R1 summary reported 736 unit /
  467 integration). **If anything is red, that is the top priority** — fix or BLOCKED-flag before any other task.
  *No code change unless a gate is red.* This is the go/no-go proof that the 56-commit branch is deployable.
  - **Verified 2026-07-15 — GREEN, no code change needed:** typecheck 0 errors · lint 0 errors / 49 pre-existing
    `react-hooks/*` warnings · unit **736 passed** (82 files) · integration **467 passed / 5 skipped** (40 files).
    Build run at the end of Group I & Group J (see Final summary).

### Group I — Conversion / landing (genuinely missing; Hermie §8 + §9)

- [x] **I1 — Persistent "Start for Free" CTA in the public header.** `56f5136`
  `src/components/public/PublicHeader.tsx` currently exposes only Gallery / Pricing / **Sign in** — the wrong
  door for a first-time visitor, and the hero CTA is below the fold at 1366×768 / mobile. Add a primary
  "Start for Free" link (→ `/sign-up`) to `PublicHeader`, styled as the primary action (distinct from the
  ghost nav links), kept visible at all widths (it wraps with the existing `flex-wrap`). *Acceptance:* the
  header renders a `/sign-up` CTA at mobile + desktop widths; build green. Fire the existing
  `cta_start_for_free` analytics event on click if it isn't already wired from the header.

- [ ] **I2 — Above-the-fold CTA + proof, verify-or-fix.** The landing proof copy ("7,000+ real paints"…)
  already lives in `LandingView.tsx`; the gap is the hero **"Start for Free"** sitting below the fold at
  1366×768 (button top ≈ 893px) because the CRT logo/video is large. Cap the hero illustration (≈40vh) so the
  primary CTA clears the fold at 768px **without** shrinking the brand mark to nothing. If it already clears
  the fold after I1's header CTA lands, mark this `- [x] no-op (header CTA covers it)` and skip. *Acceptance:*
  at a 1366×768 and a 390×844 viewport, a "Start for Free" affordance is visible without scrolling; build green.

**→ run `npm run build` after Group I.**

### Group J — Honest-failure polish (Hermie §4 High / §8 — non-gating but cheap, ship in the same push)

- [ ] **J1 — Kill the false "Added" toast on Games Workshop URL paste.**
  Pasting a GW paint URL creates a row titled `games-workshop.com` with brand/type/price `—` **and fires a
  green success toast** (worse than silence). `src/lib/scrape/parsers/gw.ts`, `src/lib/wishlist/scrapeInsert.ts`,
  `collection/page.tsx`. **Do not** try to make the GW scrape work (it 405s behind Cloudflare — a hostname add
  does nothing). Instead: when the scrape yields no usable brand/type, surface an honest "couldn't auto-read —
  enter details below" state and **do not** show the success toast or a hostname-named row. *Acceptance:*
  integration/unit test — a no-result scrape returns the honest state, not a success; build green.

- [ ] **J2 — Signed-out color-tool "sign in to save" cue that preserves state.**
  `/tools/wheel|match|dropper|stacking` are 200 signed-out (the most search-discoverable pages) but Save /
  Send-to-Recipe silently 307 to `/sign-in`, **discarding the generated palette + typed name**. Add an inline
  "sign in to save" affordance that preserves the in-progress state (the `MockProvider` already exposes
  `signedIn` to client components) instead of a silent redirect that loses work. **Scope note:** Save is *also*
  Pro-gated in code (inert while `BILLING_ENFORCED=false`) — this task is only the anonymous-dead-end fix, not
  the free-vs-Pro decision. *Acceptance:* a signed-out Save shows the cue and keeps the palette; build green.

**→ run `npm run build` after Group J, then the full gate one final time, then push the branch.**

---

## §R — NEEDS-ROSS gates (decision or credential; do NOT stub as if they work)

These are the real remaining launch gates. Where a decision unblocks agent work, that's noted.

- [ ] **R1 — Deploy the branch.** Merge `launch/pre-launch-batch` → `main` and **push a fresh git build**
  (a Vercel "Redeploy" reuses the stale env snapshot — proven in project history). *This is the single highest-
  leverage action left* — it takes ~20 of Hermie's findings live at once. Ross gates merges to `main`; an agent
  may open the PR (H1 must be green first) but must not merge.

- [ ] **R2 — Set the real prod env values** (Vercel Production, then redeploy):
  - `SUPPORT_EMAIL` + `NEXT_PUBLIC_SUPPORT_EMAIL` — real inbox (G4 wired a `CHANGE_ME@…` placeholder).
  - `MM_ADMIN_EMAILS` — comma-separated admin allowlist; E3 **fails closed when unset** (nobody is admin) and
    admin now also requires a **verified** email, so verify the admin account's email or `/admin/gallery` 404s.
  - Confirm `AUTH_URL` / `NEXT_PUBLIC_APP_URL` / `AUTH_TRUST_HOST` (B1 — already done + verified live 2026-07-15).
  - Optional tune: `MM_AI_DAILY_LIMIT` (50), `MM_GALLERY_DAILY_LIMIT` (20), `MM_SIGNUP_DAILY_LIMIT` (10/IP).

- [ ] **R3 — Error monitoring (Hermie O1 — "you launch blind").** *Decision first:* Sentry (DSN, best UX) **or**
    `@vercel/otel` + Vercel Log Drains (no new vendor). Once Ross picks, an agent adds `src/instrumentation.ts`
    with the chosen backend + **one alert rule** on error-rate and on `/api/billing/webhook` +
    `submitRecipeToGallery`. Do not scaffold a fake init before the decision.

- [ ] **R4 — Seed the gallery with 8–15 real painted-model photo cards** through the live submit flow. Content,
    Ross only. Today all seed cards render as swatch strips (`cardImageUrl` null); the "painted model + exact
    recipe" proof is the entire pitch and the SEO landing content. Gating for driving traffic, not for the code.

- [ ] **R5 — Post-deploy live re-verification** (after R1–R2 redeploy; agent runs the `curl` checks, Ross runs
    the human ones). Do not skip:
  1. Signed-out `GET https://www.mini-mainframe.com/dashboard` → `307` to **`www`**`/sign-in` (200), not vercel.app.
  2. `curl -I` the homepage `og:image` route → `200 image/png` (then run the X / FB / LinkedIn card debuggers).
  3. Send one real password-reset email → the link resolves on `www` and works.
  4. Submit a gallery card with an off-host `imageUrl` → **rejected**; an on-host blob URL → accepted.
  5. Create a throwaway account with a project, delete it → **zero orphaned rows** for that `ownerId`
     (confirms the O4 FK cascade in prod Turso; E6 added `PRAGMA foreign_keys = ON` but prod is a different path).
  6. Verify the property in **Google Search Console** + Bing, submit `www/sitemap.xml`, Rich-Results-Test the
     homepage (WebApplication + FAQPage present, **no** aggregateRating).

---

## §POST-LAUNCH — explicitly NOT gating (do not let these delay launch)

Monitor items and next-project-sized work. Ship launch without them; schedule after.

- **Programmatic paint SEO** — `/paint/[brand]/[slug]` + `/paint-conversion/[a]-to-[b]` off the 7,144-paint
  catalog with ΔE-matched equivalents. Hermie's "biggest organic lever." Its own project; needs the new routes
  added to `isPublicPath`/matcher/sitemap and kept out of robots Disallow.
- **First 3 keyword landing pages** — `/paint-collection-manager`, `/miniature-wargame-project-tracker`,
  `/paint-recipes`. Static/ISR, ~600–900 words each.
- **Weekly digest / re-engagement cron** — Vercel cron reusing the Resend mailer; needs a transactional-vs-
  marketing-consent + deliverability decision.
- **Cloudflare Turnstile** on `/sign-up` — needs Cloudflare site keys (rate-limit/quota already ship via E7).
- **Stripe webhook idempotency + Founder-seat counter** — persist processed `event.id`; wire the real founder
  counter or drop the "100 seats / Limited launch" scarcity claim. Product/billing decision.
- **Free-vs-paid tier reset / flip `BILLING_ENFORCED`** — product decision; also pull the Pro gate off
  `publishRecipe` so all sharing is free (growth own-goal otherwise).
- **`drizzle-orm` high advisory** — breaking 0.36→0.45 upgrade, no reachable exposure (no `sql.identifier`/
  `sql.raw` in `src/`). Post-launch PR.
- **Full-page project view `ModelCounterGrid`** — render the Built/Primed/Painted stepper on `/projects/[id]`
  leaf nodes (today it bounces to `/dashboard`).
- **Import-pipeline smoke** — one manual army-list paste (parser + Groq fallback) + one inspo-image upload;
  the single highest-risk untested surface.
- **DB rollback runbook** — manual `.dump` snapshot gate for schema-changing releases + a one-paragraph rollback.

---

## Final summary

*(agent: fill after the run — QA gate counts from H1, what shipped in I/J, what's BLOCKED/NEEDS-ROSS.)*
