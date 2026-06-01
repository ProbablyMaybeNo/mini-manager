/**
 * Plan tier definitions + limit helpers.
 *
 * P10.1 — single source of truth for "what does each plan get". Server
 * actions gate on `isWithinLimit(...)` before any insert; the /pricing
 * page reads `PLAN_LIMITS` to render the comparison table.
 *
 * Four tiers (locked in PHASE10_PLAN.md):
 *   free          — 1 project, 1 recipe, 3 wishlist items. The tasting
 *                   menu. Sign-up needs only a username + password.
 *   pro_monthly   — unlimited. $4 / month.
 *   pro_lifetime  — unlimited. $29 one-time.
 *   founder       — unlimited. $19 one-time. Capped at 100 seats; same
 *                   limits as pro_lifetime, separate identity (badge,
 *                   About-page listing).
 *
 * Stripe wiring isn't live yet — `getPlanForUser()` derives the tier
 * from columns the webhook will populate later. Until then every user
 * resolves to "free".
 */

import type { User } from "@/db/schema";

/** The four plan tiers. Free + the three paid identities. */
export type PlanTier = "free" | "pro_monthly" | "pro_lifetime" | "founder";

/** Resources we cap on the free tier. */
export type LimitedResource = "projects" | "recipes" | "wishlist";

/**
 * Per-tier caps. `Infinity` means "no cap" — `isWithinLimit` returns
 * true unconditionally for that resource. Pro Monthly, Pro Lifetime,
 * and Founder all share the same unlimited shape; they're separate
 * tiers for identity / billing, not for capability.
 */
export const PLAN_LIMITS: Readonly<Record<PlanTier, Readonly<Record<LimitedResource, number>>>> =
  Object.freeze({
    free: Object.freeze({ projects: 1, recipes: 1, wishlist: 3 }),
    pro_monthly: Object.freeze({
      projects: Infinity,
      recipes: Infinity,
      wishlist: Infinity,
    }),
    pro_lifetime: Object.freeze({
      projects: Infinity,
      recipes: Infinity,
      wishlist: Infinity,
    }),
    founder: Object.freeze({
      projects: Infinity,
      recipes: Infinity,
      wishlist: Infinity,
    }),
  });

/** Display labels — used by /pricing and /user pages. */
export const PLAN_LABEL: Readonly<Record<PlanTier, string>> = Object.freeze({
  free: "FREE",
  pro_monthly: "PRO · MONTHLY",
  pro_lifetime: "PRO · LIFETIME",
  founder: "FOUNDER",
});

/** Display prices — used by /pricing and /user pages. */
export const PLAN_PRICE: Readonly<Record<PlanTier, string>> = Object.freeze({
  free: "$0",
  pro_monthly: "$4 / month",
  pro_lifetime: "$29 one-time",
  founder: "$19 one-time",
});

/**
 * The minimal columns `getPlanForUser` needs. Accepting a wider `User`
 * also works, but tests can pass a plain object — handy for the
 * `isWithinLimit` unit tests that don't care about NextAuth fields.
 */
export type PlanRelevantUser = Pick<
  User,
  "plan" | "planExpiresAt" | "founderClaimedAt"
>;

/**
 * Derive the active plan tier from a user row. Free is the floor —
 * any user whose paid columns aren't populated (or whose monthly sub
 * has expired) lands here.
 *
 * Resolution order:
 *   1. founderClaimedAt set → "founder" (one-time, can't lapse).
 *   2. plan === "pro_lifetime" → "pro_lifetime" (one-time, can't lapse).
 *   3. plan === "pro_monthly" AND planExpiresAt > now → "pro_monthly".
 *   4. anything else → "free".
 *
 * The `plan` column was added in P9.1 with default `"free"`; the webhook
 * (P10.5) flips it to the bought tier and stamps `planExpiresAt` for
 * monthly subs. Founder is its own column so the badge persists even
 * if the user's plan string gets reset.
 */
export function getPlanForUser(user: PlanRelevantUser, now: Date = new Date()): PlanTier {
  if (user.founderClaimedAt) {
    return "founder";
  }
  if (user.plan === "pro_lifetime") {
    return "pro_lifetime";
  }
  if (user.plan === "pro_monthly") {
    // Active sub if no expiry stamped yet (Stripe hasn't sent the first
    // `customer.subscription.updated` ping) OR expiry is still future.
    if (!user.planExpiresAt || user.planExpiresAt.getTime() > now.getTime()) {
      return "pro_monthly";
    }
  }
  return "free";
}

/**
 * The minimal plan input for `isWithinLimit`. Tests don't need a full
 * User row — they can pass `{ plan: "free", planExpiresAt: null,
 * founderClaimedAt: null }` directly.
 *
 * Accepts both a full User and a bare PlanTier string. The string form
 * lets server actions skip the resolve step when they already have the
 * tier from session caching.
 */
export type PlanInput = PlanTier | PlanRelevantUser;

function resolvePlan(input: PlanInput): PlanTier {
  if (typeof input === "string") return input;
  return getPlanForUser(input);
}

/**
 * Return true when `currentCount` is strictly LESS than the cap for the
 * given (plan, resource). i.e. "can the user add one more?"
 *
 * Edge cases:
 *   - Free at exactly the cap → false (the next add is blocked).
 *   - Paid tiers → always true (Infinity > any finite count).
 *   - Negative `currentCount` → treated as 0 (defensive; should not
 *     happen in practice but stays consistent under a buggy caller).
 */
export function isWithinLimit(
  user: PlanInput,
  resource: LimitedResource,
  currentCount: number,
): boolean {
  const tier = resolvePlan(user);
  const cap = PLAN_LIMITS[tier][resource];
  const count = Math.max(0, currentCount);
  return count < cap;
}

/**
 * Friendly error message returned by server actions when they reject a
 * create due to a free-tier limit. Co-located so the wording stays
 * consistent across `createProject`, `createRecipe`, and
 * `createWishlistItem`.
 */
export const FREE_TIER_LIMIT_ERROR =
  "Free tier limit reached. Upgrade for unlimited.";
