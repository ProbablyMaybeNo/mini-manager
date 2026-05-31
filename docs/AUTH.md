# Mini Manager — Auth model (Phase 9+)

> **Status:** shipped Phase 9 (2026-05-30). Replaces the legacy magic-link
> primary flow.

This document is the canonical reference for how authentication works in
Mini Manager. If a future agent wants to wire up OAuth, 2FA, passkeys, or
the Stripe upgrade gate, start here.

## Why username + password

Phase 1 shipped magic-link as the primary sign-in path. Two problems
showed up by Phase 8:

1. **Resend free-tier deliverability** was the single biggest source of
   sign-up funnel drop. Tracking pixels, spam folders, and corporate
   gateways killed about 20 % of attempts.
2. **The hobbyist audience** (Ross's target — wargaming + painting
   communities) is allergic to a verification email roundtrip for the
   simple "let me try this thing" first-touch.

Phase 9 unbundles "I want to use this" from "I want to be reachable":

| Concern | v1 (magic-link) | v9 (credentials) |
|---|---|---|
| Sign up | Type email, wait for mail, click link | Username + password, instant |
| Reach the user | Implicit (the email used to sign in) | Explicit (recoveryEmail, optional, verifiable) |
| Paid upgrade | Email required at sign-up regardless | Verified recovery email gates upgrade |

## The model

- **One user row, three states:**
  1. *Free + anonymous* — `username` + `passwordHash`. `email`,
     `recoveryEmail` both null.
  2. *Free + reachable* — adds `recoveryEmail` + `recoveryEmailVerified`.
     Now eligible for password reset.
  3. *Paid* — `plan != 'free'`. Will be set by P6.10 (Stripe). Requires
     state (2) as a precondition.
- **`user.email`** survives on the NextAuth adapter contract (so OAuth
  providers can still be wired in later) but is **nullable**. We do not
  write to it from the credentials sign-up flow. The legacy magic-link
  accounts move their `email` → `recoveryEmail` via the P9.7 shim.

### Columns added in P9.1

```
ALTER TABLE user ALTER COLUMN email DROP NOT NULL;
ALTER TABLE user ADD password_hash TEXT;
ALTER TABLE user ADD plan TEXT NOT NULL DEFAULT 'free';
ALTER TABLE user ADD recovery_email TEXT;
ALTER TABLE user ADD recovery_email_verified INTEGER;  -- timestamp_ms
```

Username (`user.username`) already existed as a unique nullable column
since Phase 1; Phase 9 just started populating it.

## Hashing

`bcryptjs` (pure JS, no native build deps — Vercel-friendly). Cost
factor 10. Implementation lives in `src/lib/auth/password.ts`. The
verify helper catches malformed-hash throws so callers can treat it
purely as a boolean check.

## Validation

`src/lib/auth/validation.ts` — pure module (not a server-action file).

- Usernames: 3–20 chars, `^[a-z0-9][a-z0-9_-]+$`, normalised to
  lowercase. Reserved-word list (`admin`, `root`, `support`, `mod`,
  `system`, `null`, `me`, `you`, `ross`, `billy`, `api`, `auth`,
  `signin`, `signup`, `signout`).
- Passwords: ≥ 8 chars. **No complexity gates** — modern guidance is
  length-over-character-classes.

## NextAuth wiring

`src/auth.ts` registers a single `Credentials` provider. The
adapter stays on the Drizzle SQLite implementation. Session strategy
is `database` — the `session` table is the source of truth, looked
up on every page render via `auth()`.

The first-party UI does NOT call `signIn("credentials", ...)`. Sign-up
and sign-in both go through dedicated server actions
(`signUpWithCredentials`, `signInWithCredentials` in
`src/lib/auth/signUp.ts`) which mint a session via
`createSession()` in `src/lib/auth/session.ts`. That helper writes the
`authjs.session-token` cookie + a row in `session` directly, mirroring
the long-standing test-auth route. This side-steps Auth.js v5's
"Credentials prefers JWT" default and keeps every session lookup going
through one DB-backed code path.

The Credentials provider's `authorize` is still wired up so future
server code that wants to call `signIn("credentials", ...)` (e.g. an
OAuth-bound social-link flow) has a working delegate.

## Flow inventory

| Page | Purpose | Server action |
|---|---|---|
| `/sign-up` | Free-tier account creation | `signUpAction` → `signUpWithCredentials` |
| `/sign-in` | Sign in | `signInAction` → `signInWithCredentials` |
| `/sign-in/forgot` | Request password reset | `requestPasswordResetAction` → `requestPasswordReset` |
| `/sign-in/reset?token=` | Apply password reset | `applyPasswordResetAction` → `applyPasswordReset` |
| `/user` (Recovery email card) | Add / verify / remove recovery email | `setRecoveryEmail` / `resendRecoveryEmailVerification` / `removeRecoveryEmail` |
| `/user/verify-recovery?token=` | Consume recovery-email token | `verifyRecoveryEmailToken` |
| `/finish-account` | Migration shim for pre-P9 accounts | `finishAccountAction` → `finishAccount` |

## verificationTokens table reuse

The NextAuth `verificationToken` table survived the migration. Both
the recovery-email flow and the password-reset flow store one-shot
tokens here, keyed by a scoped identifier so they cannot be replayed
across flows:

- `recovery-email:<userId>` — recovery email verification
- `password-reset:<userId>` — forgot-password reset

Both lifetimes are 1 hour. Tokens self-clean on use AND on expiry
(`applyPasswordReset` / `verifyRecoveryEmailToken` delete expired hits
they encounter). One outstanding token per (scope, user) at any time —
re-issuing replaces the prior row.

## Enumeration safety

`/sign-in/forgot` ALWAYS returns the same "If an account exists, we
sent a link" response regardless of whether:

1. The username matched a row.
2. The matched row had a recovery email set.
3. The recovery email was verified.

This is enforced server-side: `requestPasswordReset` returns
`{ ok: true }` on every branch. The mail dispatch happens on the happy
branch only — silently.

Sign-in failures (`/sign-in`) collapse to a single
"Wrong username or password" message — no distinction between
"unknown user" and "wrong password".

Live username-availability probe at `/api/auth/check-username` is
exposed as-designed — the same enumeration is already possible via the
sign-up POST itself. The probe just front-loads the check.

## P9.7 migration shim — how it stays idempotent

`currentUserId()` is the single chokepoint. Every server-rendered page
calls it; if the row is missing either `username` or `passwordHash`,
the helper redirects to `/finish-account`. The finish-account page
itself opts out via `currentUserId({ skipMigrationCheck: true })`.

The shim is **idempotent**: re-running `finishAccount()` on an already-
complete account returns `ok` and the page redirects to `/projects`.
The migration:

1. Validates the chosen username + password (server-side, full
   validation, plus a case-insensitive uniqueness check that excludes
   the user's own row so retries don't false-positive).
2. Hashes the password (bcryptjs, cost 10).
3. Moves the legacy `email` column → `recoveryEmail`, sets
   `recoveryEmailVerified = now` (the magic-link confirmation is the
   proof-of-ownership), clears `email`.
4. Sets `username` + `passwordHash`.

## Out of scope (currently)

- OAuth providers (Google / GitHub). Adapter still wired; just no
  provider registered. Add to `src/auth.ts` when ready.
- 2FA / TOTP / passkeys.
- Username changes (immutable in v1).
- Per-IP / per-username rate limiting on the forgot-password +
  sign-in routes. Add Upstash Ratelimit or Vercel Edge Rate Limiter
  before high-traffic launch.
