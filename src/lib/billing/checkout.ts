/**
 * Billing checkout helpers — the small bits of mapping shared between the
 * `/api/billing/checkout` route, the `/api/billing/webhook` route, and the
 * `/pricing` page (P10.4 / P10.5).
 *
 * Three layers of identifier are in play and easy to mix up:
 *
 *   - `PricingTier.id` — the fixture id rendered by the /pricing cards
 *     ("free" | "pro-monthly" | "pro-lifetime" | "founder"). Hyphenated.
 *   - `StripePriceKey`  — the env-getter key in env.ts
 *     ("pro_monthly" | "pro_lifetime" | "founder"). Underscored, no "free".
 *   - `PlanTier`        — the DB `plan` column value in plans.ts
 *     ("free" | "pro_monthly" | "pro_lifetime" | "founder").
 *
 * Keeping the three maps here means the route handlers stay declarative and
 * there's a single place to audit the wiring.
 */

import type { StripePriceKey } from "./env";
import type { PlanTier } from "./plans";

/** The three keys checkout accepts — the runtime allow-list for validation. */
export const STRIPE_PRICE_KEYS: readonly StripePriceKey[] = [
  "pro_monthly",
  "pro_lifetime",
  "founder",
] as const;

/** Narrow an arbitrary string to a `StripePriceKey`. */
export function isStripePriceKey(value: unknown): value is StripePriceKey {
  return (
    typeof value === "string" &&
    (STRIPE_PRICE_KEYS as readonly string[]).includes(value)
  );
}

/**
 * Map a /pricing card id (`PricingTier.id` from the fixtures) to the Stripe
 * price key the checkout route expects. The free tier returns null — it has
 * no Stripe price; the page sends free → /sign-up instead.
 */
export function priceKeyForTierId(tierId: string): StripePriceKey | null {
  switch (tierId) {
    case "pro-monthly":
      return "pro_monthly";
    case "pro-lifetime":
      return "pro_lifetime";
    case "founder":
      return "founder";
    default:
      // "free" + anything unrecognised → no Stripe checkout.
      return null;
  }
}

/** Map a Stripe price key to the DB `plan` tier the webhook persists. */
export function planTierForPriceKey(key: StripePriceKey): PlanTier {
  // The two vocabularies already line up 1:1 for the paid tiers.
  return key;
}

/** Whether a price key is a one-time purchase (Stripe `mode: "payment"`)
 *  vs a recurring subscription (`mode: "subscription"`). Pro Lifetime and
 *  Founder are both one-time; Pro Monthly is the only subscription. */
export function isOneTimePriceKey(key: StripePriceKey): boolean {
  return key === "pro_lifetime" || key === "founder";
}
