# Audit batch — round 2e, 2026-08-02

Three items, all one coherent piece of work: **the rate limiter is applied
everywhere a request costs Ross money, and nowhere the abuse is free to the
attacker.** Plus one defence-in-depth hardening on the endpoint with the worst
possible failure mode.

Evidence: `ux-audit/round2-2026-08-02/REPORT.md`.

**Rules for this batch**
- You are on branch `fix/audit-batch-r2-2026-08-02`, which already holds
  eighteen round-2 fixes. Stay on it. **Never push or merge to `main`.**
- Commit per item, referencing its id.
- Before EVERY commit: `npm run typecheck` (0 errors), `npm run lint` (0 errors;
  51 pre-existing warnings are fine), `npm run test:unit`,
  `npm run test:integration`. Baselines: **823 unit**, **510 integration + 1
  skipped**. Fix causes, never skip a test to go green.
- Do NOT touch `public/data/paints.json`. Do NOT delete anything in
  `public/brand/`.
- No new dependencies. Match neighbouring file conventions.

**Read this first — the shape of the problem.** `src/lib/rateLimit/quota.ts`
works and is used correctly by four buckets: `RecipeAi`, `PaintScan`,
`GallerySubmit`, `Signup`. Every surface that spends money is bounded (verified:
AI routes gated + limited, Blob uploads bounded by ownership + a 12-image
per-project cap + 8MB size enforced by Blob itself). The gaps below are the
complete remainder — the two auth paths where abuse costs the attacker nothing.

---

- [x] **R2-19 · P2 · `requestPasswordReset` is unauthenticated, unthrottled, and sends email**
  `src/lib/auth/passwordReset.ts`, verified by reading: **no auth check, no
  throttle, sends an email on every call.**

  Everything else about it is careful and must be preserved: silent `ok: true`
  for malformed, unknown, and no-email-on-file alike (non-enumerating), 1-hour
  token lifetime, and it deletes any outstanding token so only one is live.

  **That last, correct decision is what makes this worse than inbox spam.**
  Because each request invalidates the previous token, an attacker hammering a
  victim's username **continuously destroys the reset link the victim is trying
  to click** — sustained, the victim can never complete a reset. That is denial
  of account recovery, not noise. Second cost: mass sends to one address invite
  spam complaints, damaging sender reputation on the `mail.` subdomain set up
  specifically for deliverability, and burning Resend quota.

  **Fix — two layers, both wanted:**
  1. A **short-window** limiter keyed on **username** (not only IP — the target
     is the username and an attacker can rotate IPs). On throttle it MUST still
     return the same silent `ok: true`. Do **not** surface a "too many requests"
     error: that hands back exactly the enumeration oracle the silent-ok design
     was built to avoid.
  2. A **chokepoint backstop** in `src/lib/auth/sendVerificationEmail.ts`.
     Verified behaviour-first: that module is the **only** place in the entire
     codebase that talks to a mail provider (a single
     `fetch("https://api.resend.com/emails")`; no other sender exists in
     `src/`). A guard there means no future email feature can ship unthrottled
     by omission.

  **Do NOT** reuse `enforceDailyLimit` as-is here — see R2-18.
  **Verify:** N rapid requests for one username start being suppressed while
  still returning `ok: true`; a legitimate request from a different user is
  unaffected; and a reset in progress is not destroyed by an attacker's
  subsequent requests.

- [x] **R2-18 · P2 · Sign-in has no rate limiting**
  `signInWithCredentials` (`src/lib/auth/signUp.ts`), verified by reading: no
  limiter, no lockout, no backoff. Unlimited password attempts against a known
  username.

  **Severity is moderate and the reasons matter — do not overstate it in the
  fix:**
  - bcryptjs at **cost 10 (~50ms/attempt)** is a real natural throttle; this is
    not an offline-speed guessing surface;
  - sign-in already returns one generic *"Wrong username or password"* for
    malformed input, unknown user, and bad password alike — **no enumeration
    oracle**. Preserve that exactly.
  - What remains: unlimited **credential stuffing** (bcrypt does not help — each
    known pair is one request), and every attempt is a **billed serverless
    invocation**, so a sustained attack is also a cost event.

  **The design choice, which is why this is not a one-liner.**
  `enforceDailyLimit` is a **UTC-day counter keyed per IP**. Applied to sign-in
  it would lock out everyone behind a shared IP — office, university, CGNAT —
  for the rest of the day. There is direct evidence this bites: the `Signup`
  bucket is 10/IP/day and a previous builder found a few full E2E runs exhausted
  it, failing with *"Too many sign-ups from your network today"* in a way that
  read exactly like a load flake. **Prefer a short-window limiter keyed on
  username + IP with exponential backoff.** If that means extending
  `quota.ts` with a windowed mode rather than reusing the daily one, do that and
  say so.
  **Verify:** repeated failures for one username start being rejected; a correct
  password still succeeds immediately from a clean IP; a legitimate user sharing
  an IP with a failing one is not locked out for a day.

- [x] **R2-20 · P3 · Test-auth back-door is one env var from total auth bypass**
  `src/app/api/test/sign-in/route.ts` mints a session for **any email posted to
  it**, no password. It exists so Playwright can skip the login flow.

  **It is correctly off in production — verified live: `POST` → 404 "Not
  found".** This is NOT a live vulnerability. The gate has the right polarity:
  ```js
  if (process.env.ALLOW_TEST_AUTH !== "1") return new NextResponse("Not found", { status: 404 });
  ```
  **The hardening:** that is the *only* condition — it is not also gated on
  `NODE_ENV`. One stray env var (a preview config copy-pasted into the
  production project) turns this into an open endpoint minting a session for
  **any account, including an admin's**, with no credential. `ALLOW_TEST_AUTH=1`
  circulates routinely — builders set it for local dev and the Playwright web
  server — so the value does travel.

  Every other trust boundary in this app fails closed deliberately (the admin
  allowlist, `BILLING_ENFORCED`). This is the one place that pattern is not
  doubled up, on the endpoint whose failure mode is total account takeover.
  **Fix:**
  ```js
  if (process.env.NODE_ENV === "production" || process.env.ALLOW_TEST_AUTH !== "1") …
  ```
  **Verify:** the E2E suite still authenticates locally, and the route still
  404s in a **production build** even with `ALLOW_TEST_AUTH=1` set. A unit test
  over the gate condition is the durable part.

---

## Out of scope — needs Ross, do NOT action

- **R2-17 · the MOP-004 inspector history integration.** `ProjectPanelStack`
  calls `window.history.pushState` directly; Next patches that method, so a call
  still pending when a later navigation commits makes Next re-push the previous
  canonical URL and **yank the user back to `/dashboard`**. Separately Next's
  `replaceState` overwrites the custom state, so the close-unwind never runs and
  every inspector open leaves a stale history entry. Real back-button behaviour,
  not a test artefact — but fixing it changes shipped behaviour on a deliberate
  UX decision, so it is Ross's call.
- **`public/brand/logo.png` (1.51MB)** and **`mini-mainframe-logo-poster.jpg`
  (254,751 B)**, both now unreferenced by `src/`. Deleting brand assets is
  Ross's call.
- **R2-8 Sentry CSP reporting** — a spend decision.
- **R2-3** army-list nesting, **R2-4** retailer list, **R2-5** real-device
  camera, and the failed-CI catalog commits on `main`.
- **Accessibility of the signed-in app** — public pages verified clean in a real
  browser; the interior needs credentials and its own scoped run.
