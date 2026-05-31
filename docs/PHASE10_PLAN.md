# Phase 10 — Pricing Gates + Stripe Billing

**Phase intent.** Add monetisation. Free tier becomes intentionally light (a tasting menu); paid tiers unlock the real value. Stripe Checkout for the upgrade; webhook keeps our user row in sync. The `plan` column already exists from P9.1 — this phase consumes it.

The funnel: anonymous browsing → free sign-up (username + password, no email) → hits a free-tier ceiling → adds + verifies recovery email (P9.5 gate already exists) → Stripe Checkout → webhook flips `plan` → paid features unlock.

## Pricing (locked from earlier discussion)

| Tier | Price | Limits | Notes |
|---|---|---|---|
| **Free** | $0 | 1 project · 1 recipe · 3 wishlist items · library + basic tools | No email required to sign up; required to upgrade |
| **Pro Monthly** | $4 / month | Unlimited everything + Tools-Pro + Sharing-Pro | Cancellable anytime |
| **Pro Lifetime** | $29 one-time | Same as Pro Monthly, forever | Best long-term value |
| **Founder Edition** | $19 one-time | Pro Lifetime + name on About page + early-access perks | **Capped at 100 sales** |

**Tools-Pro:** advanced tools — palette save beyond 3, eyedropper history, gradient ramp export. **Sharing-Pro:** custom recipe URLs, OG image customization, view analytics. (Concrete scoping in P10.3.)

## Design decisions locked

- **Stripe SDK:** `stripe` Node SDK on the server; `@stripe/stripe-js` only if we need client-side redirect-to-checkout (likely not — using hosted Checkout URL flow).
- **Session strategy:** Stripe Checkout (hosted, redirect). No embedded checkout. Simpler PCI scope, fewer moving parts.
- **Webhook signing:** mandatory verification on every webhook delivery using `STRIPE_WEBHOOK_SECRET`. Reject unsigned payloads with 400.
- **Plan enforcement:** at the server-action layer (every create-action gates on `currentUser().plan + count(currentResources)`). Not at the DB layer. Means the gate is testable in vitest without Stripe being live.
- **Upgrade gate dependency:** verified recovery email is required before checkout. Reuses the P9.5 `recoveryEmailVerified` timestamp.
- **Founder counter:** stored as a singleton row in a `meta_counters` table (or via env var seeded into DB). Atomic increment on `checkout.session.completed` for the founder price. When count hits 100, the Founder option is hidden from `/pricing` and the API rejects further attempts.
- **Refunds:** out of scope for v1. Users use Stripe's customer portal for cancellations. Refund requests handled manually until volume warrants automation.
- **Tax:** Stripe Tax enabled for US; international tax handled by Stripe's tax engine as it expands.

## Schema additions (P10.1)

```sql
ALTER TABLE user ADD COLUMN stripe_customer_id TEXT UNIQUE;
ALTER TABLE user ADD COLUMN stripe_subscription_id TEXT;
ALTER TABLE user ADD COLUMN plan_expires_at INTEGER;     -- ms timestamp; null = lifetime / current sub
ALTER TABLE user ADD COLUMN founder_claimed_at INTEGER;  -- ms timestamp when they bought Founder

CREATE TABLE meta_counters (
  key TEXT PRIMARY KEY,
  value INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
-- Seed: ('founder_sold', 0, <now>)
```

## Milestones

- [ ] **P10.1 — Stripe SDK + schema migration + plan constants.**
  - Install `stripe` (Node SDK).
  - Drizzle migration adding the four user columns + `meta_counters` table; seed `founder_sold = 0`.
  - New `src/lib/billing/plans.ts` — `PLAN_LIMITS` constant + `getPlanForUser(user)` + `isWithinLimit(user, resource, currentCount)` helpers.
  - Stripe price ID constants from env: `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_LIFETIME`, `STRIPE_PRICE_FOUNDER`.
  - Unit tests for `isWithinLimit` covering free + paid + edge (exactly-at-limit).

- [ ] **P10.2 — Plan enforcement at server actions.**
  - `createProject`, `createRecipe`, `addWishlistItem` all gate on `isWithinLimit`. Returns `{ ok: false, error: "Free tier limit reached. Upgrade for unlimited.", upgradeUrl: "/pricing" }` on rejection.
  - UI surfaces (NewProjectForm, NewRecipeButton, QuickAddBar) read the upgradeUrl from the action result and show a soft "Upgrade →" link inline with the error.
  - Integration tests: free user at 1 project → second create rejected; Pro user at 50 projects → still ok.

- [ ] **P10.3 — `/pricing` page.**
  - New route `src/app/pricing/page.tsx` (public — accessible signed-out for marketing).
  - Three Card primitives side by side desktop, stacked mobile: Free (current plan badge if signed in & free) / Pro / Lifetime / Founder.
  - Founder card shows "X of 100 remaining" live (server-fetched from `meta_counters`); hidden entirely when 0 remain.
  - CTA per card: signed-out → `/sign-up?next=/pricing`; signed-in + verified email → POST `/api/billing/checkout`; signed-in + unverified → "Verify your email to upgrade →" linking to `/settings#recovery-email`.

- [ ] **P10.4 — Stripe Checkout session API + redirect.**
  - `POST /api/billing/checkout` — `{ priceKey: "pro_monthly" | "pro_lifetime" | "founder" }`. Validates session, validates verified email, creates Stripe Customer if not exists (stamps `stripe_customer_id`), creates Checkout Session with success/cancel URLs, returns `{ url }`.
  - Client invocation pattern: pricing card button POSTs, receives `{ url }`, `window.location = url`.
  - Founder-priceKey gates on remaining inventory (`meta_counters.founder_sold < 100`) — atomic SELECT FOR UPDATE before session creation to prevent overselling.
  - E2E (mocked Stripe): unverified user attempt → 403; verified user attempt → 200 with mocked URL.

- [ ] **P10.5 — Webhook handler.**
  - `POST /api/billing/webhook` — signature verification first (`stripe.webhooks.constructEvent`). Reject unsigned with 400.
  - Handle events: `checkout.session.completed` (update plan + expires_at + customer_id + sub_id; for Founder, atomic `UPDATE meta_counters SET value = value + 1` + stamp `founder_claimed_at`); `customer.subscription.updated` (sync expires_at); `customer.subscription.deleted` (downgrade to free at end of period).
  - Idempotency: store processed `event.id` in a `processed_webhooks` table; reject duplicates with 200 (Stripe retries deduped).
  - Integration tests: each event type with mocked payload + signature verification.

- [ ] **P10.6 — Settings: subscription management.**
  - New section in `/user`: "Subscription" card. Shows current plan + next billing date (if Pro Monthly) + "Manage subscription" button → POST `/api/billing/portal` → returns Stripe Customer Portal URL → redirect.
  - Stripe Customer Portal handles cancel/update/invoice download natively. No custom UI for those.
  - Founder badge displayed for users with `founder_claimed_at IS NOT NULL`.

- [ ] **P10.7 — Founder counter UI + safeguards.**
  - Public `/pricing` reads `founder_sold` server-side, renders "X of 100" prominently.
  - When `value >= 100`: hide the Founder card; API returns 410 Gone for any further Founder checkout attempts.
  - Counter increment must be atomic — wrap in a transaction with SELECT FOR UPDATE (or libsql equivalent). Webhook handler is the only writer.
  - Admin-only view (Ross's account) shows raw counter + recent Founder claims for sanity checking.

- [ ] **P10.8 — E2E + docs + cleanup.**
  - New Playwright missions: `qa_pricing_gate.spec.ts` (free user creates 1 project → blocked on 2nd, sees upgrade CTA), `qa_upgrade_flow.spec.ts` (verified user clicks Pro card → redirected to Stripe with correct session params, mocked).
  - `docs/BILLING.md` — flow diagram, env var reference, webhook event handling, refund + cancellation playbook.
  - `README.md` env-var section updated (5 new STRIPE_* vars).
  - `MISSIONS.md` adds the two new missions.
  - Lighthouse re-check on `/pricing` (public surface, will be scrutinised).

## Ship checklist (Ross-side actions)

Before P10.4 can be tested live:
- [ ] Create Stripe account (`stripe.com/signup`); enable Tax + Customer Portal.
- [ ] Create three Products: "Mini Manager Pro Monthly" / "Mini Manager Pro Lifetime" / "Mini Manager Founder Edition" with prices $4/mo, $29, $19.
- [ ] Copy the three price IDs into Vercel env vars: `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_LIFETIME`, `STRIPE_PRICE_FOUNDER`.
- [ ] Copy `sk_live_...` and `whsec_...` into `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`.
- [ ] After P10.5 deploys, register the webhook endpoint: `https://miniaturemanager.vercel.app/api/billing/webhook` with the three event types.
- [ ] Use Stripe's test-mode for local + preview; live-mode only after Lighthouse + E2E clean on prod.

## Out of scope (deferred, not regressed)

- **Refund automation.** Manual via Stripe dashboard for v1.
- **Coupons / discounts.** Defer to a marketing push later.
- **Team / multi-seat.** Single-user product for v1.
- **Annual billing tier.** Lifetime covers the "I want one big commitment" segment.
- **In-app upgrade modals** triggered by specific actions. The error → /pricing link is enough for v1.
- **Granular feature flags** beyond the Free vs Pro split. Add a tier in between only if data warrants.

## Risks to monitor

- **Webhook reliability.** Stripe retries with exponential backoff; missing one shouldn't break sync but does delay it. The customer portal lookup at login can be the reconciliation fallback (sync expiry on next session refresh).
- **Founder oversell.** Race conditions on the counter. SELECT FOR UPDATE in a single transaction is the safeguard.
- **Free tier abuse.** Same person making 100 free accounts is possible; v1 accepts this risk. If it materially impacts costs we add email-verification at sign-up or rate-limit by IP.

## Conventions for milestone-builder

Same as prior phases:
- Local commit only; no push.
- `npm run typecheck` 0 errors before commit.
- Tests INTO the feature commit.
- `"use server"` files export only async functions.
- New deps flagged in commit body (this phase adds `stripe` ^17.x).
- Halt + report if a milestone needs an architectural decision the plan doesn't cover.
