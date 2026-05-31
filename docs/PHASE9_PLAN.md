# Phase 9 — Username + Password Auth (replaces magic-link primary flow)

**Phase intent.** Replace magic-link as the default auth path with username + password. Sign-up is **frictionless for free tier**: username + password, no email required, no verification. Email is the **upgrade gate** — adding (and verifying) a recovery email is required before any paid tier upgrade. Magic-link mechanism survives only as the transport for two one-time flows: recovery-email verification + password reset.

This decouples sign-up funnel from email deliverability (Resend free-tier was a P1 blocker, this removes the dependency for hobbyist signups) and gives the future Stripe upgrade flow (P6.10) a natural commitment ladder: free is anonymous-ish, paid requires a real address.

## Design decisions locked

- **Hash:** `bcryptjs` (pure JS, no native deps — Vercel serverless friendly). Cost factor 10.
- **Session machinery:** keep NextAuth v5 + Drizzle adapter + database sessions. Swap the **provider** only — Credentials replaces the inline email magic-link provider.
- **Username rules:** 3–20 chars, lowercase letters + digits + `_` + `-`. Must start with a letter or digit. Reserved word list (`admin`, `root`, `support`, `mod`, `system`, `null`, `me`, `you`, `ross`, `billy`, `api`, `auth`, `signin`, `signup`, `signout`).
- **Password rules:** ≥ 8 chars. No complexity gates (modern guidance — length beats character classes).
- **Email column:** flipped from `NOT NULL UNIQUE` → nullable, `UNIQUE WHERE NOT NULL`. Add `recoveryEmail` column (semantically distinct from the NextAuth `email` — the latter stays for adapter compatibility, the former is what we display + verify).
- **Plan column:** `plan TEXT NOT NULL DEFAULT 'free'` — added now (cheap), consumed by P6.10.
- **Kill switches:** magic-link as primary sign-in path is **gone**. The `/sign-in` page no longer renders an email field. `verificationTokens` table stays — reused for email verify + password reset.
- **Migration shim:** existing dogfood accounts (Ross) have `email NOT NULL` but no `passwordHash`. On next sign-in they're redirected to `/finish-account` where they pick a username + password. The existing verified `email` is moved to `recoveryEmail` (already verified by virtue of being on file).

## Milestones

- [ ] **P9.1 — Schema migration + bcrypt utility.**
  - Drizzle migration: make `user.email` nullable, add `user.passwordHash TEXT`, `user.plan TEXT NOT NULL DEFAULT 'free'`, `user.recoveryEmail TEXT`, `user.recoveryEmailVerified INTEGER` (timestamp). Backfill `username` from existing local-part for any dogfood account (one row currently).
  - Install `bcryptjs` + `@types/bcryptjs`. Create `src/lib/auth/password.ts` with `hashPassword` / `verifyPassword`.
  - Username + password validators in `src/lib/auth/validation.ts`. Reserved word list constant.
  - Unit tests: hash round-trip, hash mismatch, password length floor, username rules, reserved words.

- [ ] **P9.2 — NextAuth Credentials provider + sign-up server action.**
  - Rewrite `src/auth.ts`: replace `magicLinkProvider()` with `Credentials({ ... })`. `authorize()` looks up by username, calls `verifyPassword`, returns user.
  - New `src/lib/auth/signUp.ts` server action: validates username + password, checks uniqueness (case-insensitive), hashes password, inserts user row, signs them in.
  - JWT session strategy stays at `database` so the adapter session tables keep working.
  - Tests: signUp creates user, duplicate username rejected, weak password rejected, reserved word rejected.

- [ ] **P9.3 — Sign-up page `/sign-up`.**
  - New page using Card + Button + StatusPill primitives (P8 design language).
  - **Logo at top of card.** Reuse `<Logo />` primitive from P9.4 (`public/brand/logo.png`, `mix-blend-mode: screen`, sized ~140px wide on desktop / ~110px on mobile, centered above form). Card heading "Create account" sits below the logo.
  - Three fields: username, password, confirm password. Real-time uniqueness check (debounced, returns ok/taken pill).
  - Submits via server action; on success → redirect `/projects`.
  - Error states: pill row above form for validation failures. Inline focus ring cyan.
  - Footer link "Already have an account? Sign in" → `/sign-in`.
  - E2E: signup-happy-path mission.

- [ ] **P9.4 — Sign-in page redesign + username/password auth.**
  - Replace existing magic-link form at `src/app/sign-in/page.tsx` with username + password form.
  - P8 design language (Card, cyan primary, no ASCII box).
  - **Logo at top of card.** New primitive `src/components/ui/Logo.tsx` rendering `<Image>` from `public/brand/logo.png` with `mix-blend-mode: screen` to drop the black background onto our dark bg. Sized ~140px wide on desktop / ~110px on mobile, centered above the form. Replace the existing `<h1>MINI MANAGER</h1>` heading with the logo + `<span class="sr-only">Mini Manager</span>` for screen readers. The card's own h1 then reads "Sign in" — pulling auth-page visual hierarchy back to logo > action > form.
  - "Forgot password?" link below — only renders if the entered username has a verified recoveryEmail (queried on blur). Otherwise hidden + tooltip "Add a recovery email in Settings to enable password reset."
  - Footer link "No account yet? Sign up" → `/sign-up`.
  - Update `qa_signin.spec.ts` E2E + auth bypass for tests (`ALLOW_TEST_AUTH` still works).
  - Vitest: Logo primitive renders alt text + screen-reader-only fallback.

- [ ] **P9.5 — Settings: add + verify recovery email.**
  - New section in `/settings`: "Recovery Email" card. Empty state → "Add" button + inline input. Filled+unverified state → status pill `PENDING` + "Resend verification" + "Remove". Filled+verified state → status pill `VERIFIED` + "Change".
  - "Add" flow: validate email format, store as `recoveryEmail` (nullable + unverified), send Resend mail with one-time token (existing `verificationTokens` table). Click → `/settings/verify-recovery?token=...` → sets `recoveryEmailVerified = now`.
  - Server actions guard: only the logged-in user can mutate their own recovery email.
  - Tests: add → pending → click link → verified.

- [ ] **P9.6 — Forgot password flow.**
  - `/sign-in/forgot` page — input field: username. If the user has a verified recoveryEmail, generate a token (verificationTokens table), email a link → `/sign-in/reset?token=...`. **Always show the same "If an account exists, we sent a link" response** regardless of hit/miss (prevent username enumeration).
  - `/sign-in/reset?token=...` — token lookup, expire after 1h, two password fields, submit → updates `passwordHash`, deletes token, signs the user in.
  - Tests: happy path, expired token, missing recoveryEmail short-circuits silently.

- [ ] **P9.7 — Existing-user migration shim.**
  - Middleware/server check: if a signed-in user has `email IS NOT NULL` **and** `passwordHash IS NULL` → redirect to `/finish-account`.
  - `/finish-account` page: "Pick a username and password to finish setting up your account." Two fields. On submit: move existing `email` → `recoveryEmail` (with `recoveryEmailVerified` set, since the magic-link confirmed it), set username + passwordHash, clear `email`.
  - Make this idempotent: page short-circuits to `/projects` if account is already complete.
  - Tests: legacy magic-link account hits the page, completes, can sign in via new flow.

- [ ] **P9.8 — Cleanup, E2E sweep, regression.**
  - Remove `magicLinkProvider()` and `AUTH_EMAIL_FROM` checks at sign-in. (Resend transport stays for verify/reset flows only — abstracted to `src/lib/auth/sendVerificationEmail.ts`.)
  - Delete old `/sign-in?sent=1` "check your email" page (no longer used at sign-in).
  - Update `MISSIONS.md`: drop "magic-link" mission, add "credentials-signup" + "credentials-signin" + "recovery-email-verify" + "forgot-password" missions.
  - **Favicon + app icons.** Generate `app/icon.png` (32×32) and `app/apple-icon.png` (180×180) from `public/brand/logo.png` so the tab + home-screen pick up the brand. Closes UX-012. Use sharp via a one-off script committed under `scripts/gen-icons.mjs` or pre-generate and commit the PNGs directly.
  - Full vitest + playwright sweep. Lighthouse re-check (sign-in is the public surface). Update `docs/AUTH.md` (new file — covers the model, the flows, the token table reuse).
  - Update `README.md` env-var section (`AUTH_RESEND_KEY` now optional and only used for recovery/reset, no longer required for sign-up).

## Out of scope (deferred, not regressed)

- **OAuth providers** (Google / GitHub). Adapter is still wired for them but no provider registered. Re-enable in a later phase if Ross wants social sign-in.
- **Stripe upgrade flow.** P6.10 will consume `plan` + `recoveryEmailVerified` as the gate.
- **Username changes.** v1 ships immutable usernames. "Change username" deferred until users actually request it.
- **2FA / passkeys.** Out of scope. Future P9.x or P10 if warranted.

## Ship checklist

- [ ] Manual: sign up a fresh account on prod, verify can sign in/out.
- [ ] Manual: add + verify a recovery email, trigger forgot-password, reset, sign back in.
- [ ] Manual: existing magic-link account completes the migration shim cleanly.
- [ ] **Rotate** `AUTH_SECRET` post-deploy (the value has been in chat history during earlier phases — natural moment with the provider swap).
- [ ] Lighthouse on `/sign-in` and `/sign-up` post-deploy.
