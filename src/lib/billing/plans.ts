/**
 * Plan tier definitions + limit helpers.
 *
 * P10.1 — single source of truth for "what does each plan get". Server
 * actions gate on `isWithinLimit(...)` before any insert; the /pricing
 * page reads `PLAN_LIMITS` to render the comparison table.
 *
 * Four tiers (locked in PHASE10_PLAN.md, gating-layer revision):
 *   free          — UNLIMITED projects + wishlist/collection, but only
 *                   1 recipe PER PROJECT NODE (per attachedProjectId). The
 *                   `recipes` cap is special — see the per-node note on
 *                   PLAN_LIMITS. Sign-up needs only a username + password.
 *   pro_monthly   — unlimited. $4 / month.
 *   pro_lifetime  — unlimited. $36 one-time (3 free months vs monthly).
 *   founder       — unlimited. $26 one-time. Capped at 100 seats; same
 *                   limits as pro_lifetime, separate identity (badge,
 *                   About-page listing).
 *
 * Stripe wiring isn't live yet — `getPlanForUser()` derives the tier
 * from columns the webhook will populate later. Until then every user
 * resolves to "free".
 */

import type { User } from "@/db/schema";

/**
 * Whether plan caps + `isProUser` gates are actually ENFORCED at the
 * action layer.
 *
 * `true` as of the subscription-paywall build (docs/SUBSCRIPTION_PAYWALL.md)
 * — Stripe checkout + webhook are live, so there's a real path from "free"
 * to "pro_monthly" and the gates can bite for real. `isWithinLimit` now
 * defers to the real `PLAN_LIMITS` cap math, and `isProUser` (enforce.ts)
 * resolves the caller's actual plan instead of always returning true.
 *
 * Only the tools/AI/creator-power-feature gates described in the spec check
 * `isProUser`; the base app (projects, library, add-paint-to-project/recipe,
 * collection, gallery browse + share) never calls it, so flipping this to
 * `true` does NOT wall anything outside that gated set. `PLAN_LIMITS.free`
 * keeps projects/wishlist at `Infinity` — only the per-project-node recipe
 * cap (1) actually changed behaviour when this flipped.
 */
export const BILLING_ENFORCED = true;

/** The four plan tiers. Free + the three paid identities. */
export type PlanTier = "free" | "pro_monthly" | "pro_lifetime" | "founder";

/** Resources we cap on the free tier. */
export type LimitedResource = "projects" | "recipes" | "wishlist";

/**
 * Per-tier caps. `Infinity` means "no cap" — `isWithinLimit` returns
 * true unconditionally for that resource. Pro Monthly, Pro Lifetime,
 * and Founder all share the same unlimited shape; they're separate
 * tiers for identity / billing, not for capability.
 *
 * NOTE on `recipes` (gating-layer): the free `recipes` cap is special.
 * It is NOT a per-account total — projects and wishlist are unlimited on
 * free, and a free painter can keep one recipe on EVERY project node.
 * The cap is enforced PER PROJECT NODE: `createRecipe` counts only the
 * recipes sharing the new recipe's `attachedProjectId` (standalone
 * recipes — `attachedProjectId === null` — form their own "no-project"
 * node) and blocks the 2nd under that same node. The `1` here is that
 * per-node ceiling; the cap MATH in `isWithinPlanLimit` is unchanged
 * (count < cap), only the count the caller passes differs.
 */
export const PLAN_LIMITS: Readonly<Record<PlanTier, Readonly<Record<LimitedResource, number>>>> =
  Object.freeze({
    free: Object.freeze({ projects: Infinity, recipes: 1, wishlist: Infinity }),
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
  pro_monthly: "$3.99 / month",
  pro_lifetime: "$25 one-time",
  founder: "$19 one-time",
});

/**
 * The minimal columns `getPlanForUser` needs. Accepting a wider `User`
 * also works, but tests can pass a plain object — handy for the
 * `isWithinLimit` unit tests that don't care about NextAuth fields.
 */
export type PlanRelevantUser = Pick<
  User,
  "plan" | "planExpiresAt" | "founderClaimedAt" | "freeForeverGrantedAt"
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
  // Testing-period free-forever grant → permanent full access (never lapses),
  // resolved as pro_lifetime (the unlimited, no-expiry tier).
  if (user.freeForeverGrantedAt) {
    return "pro_lifetime";
  }
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
  // Until billing is live there's no way to upgrade past a cap, so caps
  // aren't enforced — every user is unlimited (see BILLING_ENFORCED). Once
  // Stripe ships, flip the flag and this defers to the real plan caps.
  if (!BILLING_ENFORCED) return true;
  return isWithinPlanLimit(user, resource, currentCount);
}

/**
 * Pure cap check — does the (plan, resource) allow one more, IGNORING the
 * BILLING_ENFORCED gate? Exported so the cap math stays under test while
 * enforcement is relaxed, and so the Stripe wire-up (P10.4–P10.8) can rely
 * on it directly. `isWithinLimit` is what server actions call.
 */
export function isWithinPlanLimit(
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
