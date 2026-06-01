/**
 * Stripe environment variable reads.
 *
 * P10.1 — the scaffold ships BEFORE Ross creates the Stripe account, so
 * none of these env vars exist yet in prod. Every read returns
 * `undefined` (or `null` for narrowing) when the var is missing — no
 * top-level throws — so importing `@/lib/billing/*` from a route handler
 * or server action is safe regardless of whether the credentials are
 * wired up yet. The /pricing page renders fine without them; the live
 * Checkout flow (P10.4) is the first place that will hard-require the
 * secret key + price IDs.
 *
 * When the var IS set, the helpers below return it verbatim. A future
 * milestone (P10.4) will add a `requireStripeSecret()` that throws —
 * but that one is invoked only inside `/api/billing/checkout`, never at
 * module load.
 */

/**
 * Which checkout price tiers the app knows about. Keep in sync with
 * `priceKey` validation inside `/api/billing/checkout` (P10.4).
 */
export type StripePriceKey = "pro_monthly" | "pro_lifetime" | "founder";

/** Return the Stripe secret key (`sk_live_...` / `sk_test_...`) or null. */
export function stripeSecretKey(): string | null {
  return process.env.STRIPE_SECRET_KEY?.trim() || null;
}

/** Return the Stripe webhook-signing secret (`whsec_...`) or null. */
export function stripeWebhookSecret(): string | null {
  return process.env.STRIPE_WEBHOOK_SECRET?.trim() || null;
}

/**
 * Resolve a price ID by key. Each tier maps to its own Stripe Product /
 * Price. Returns null when the env var is unset — callers must surface a
 * friendly "not configured" error rather than calling the Stripe API
 * with an empty string.
 */
export function stripePriceId(key: StripePriceKey): string | null {
  switch (key) {
    case "pro_monthly":
      return process.env.STRIPE_PRICE_PRO_MONTHLY?.trim() || null;
    case "pro_lifetime":
      return process.env.STRIPE_PRICE_PRO_LIFETIME?.trim() || null;
    case "founder":
      return process.env.STRIPE_PRICE_FOUNDER?.trim() || null;
  }
}

/**
 * True when every required env var is present and the live Checkout
 * flow can be safely invoked. /pricing uses this to decide whether to
 * render real checkout buttons vs. the "Stripe wire-up pending" stub.
 */
export function isStripeConfigured(): boolean {
  return (
    stripeSecretKey() !== null &&
    stripePriceId("pro_monthly") !== null &&
    stripePriceId("pro_lifetime") !== null &&
    stripePriceId("founder") !== null
  );
}
