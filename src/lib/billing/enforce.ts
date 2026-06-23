/**
 * Server-action limit enforcement.
 *
 * P10.2 — `enforceCreateLimit` is the single chokepoint used by
 * createProject / createRecipe / createWishlistItem. It loads the
 * user's plan-relevant columns, takes a current count from the caller
 * (cheap because every action already needs to know the count to
 * write a sensible row), and asks `isWithinLimit` whether the NEXT
 * row would still fit under the cap.
 *
 * Returns:
 *   - `null` when the create is allowed (caller proceeds)
 *   - `{ ok: false, error, upgradeUrl }` when the create is blocked
 *     (caller returns this verbatim — same shape every other server
 *     action returns for failures)
 *
 * Keeping the gate in `@/lib/billing/` (not inside each action file)
 * means a future "free tier abuse" tightening — IP-based throttle,
 * email-verify-before-N rule, whatever — has one place to add the
 * logic to.
 */

import { and, count, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { recipes, users } from "@/db/schema";
import {
  BILLING_ENFORCED,
  FREE_TIER_LIMIT_ERROR,
  getPlanForUser,
  isWithinLimit,
  type LimitedResource,
  type PlanRelevantUser,
} from "./plans";

export type LimitDeniedResult = {
  ok: false;
  error: string;
  upgradeUrl: string;
};

/**
 * Resolve the user's plan-relevant columns. Returns null when the user
 * row vanished mid-request — caller should treat that as a generic
 * "not found" / re-auth case.
 */
export async function loadPlanUser(
  userId: string,
): Promise<PlanRelevantUser | null> {
  const row = await db
    .select({
      plan: users.plan,
      planExpiresAt: users.planExpiresAt,
      founderClaimedAt: users.founderClaimedAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!row[0]) return null;
  return row[0] as PlanRelevantUser;
}

/**
 * True when the user is on a paid plan — or whenever billing isn't enforced
 * yet, so Pro-only features stay open for testing until Stripe goes live.
 * Used to gate Pro-only surfaces like the browser extension.
 */
export async function isProUser(userId: string): Promise<boolean> {
  if (!BILLING_ENFORCED) return true;
  const user = await loadPlanUser(userId);
  if (!user) return false;
  return getPlanForUser(user) !== "free";
}

/**
 * Gate the next insert on the user's plan tier.
 *
 * The caller provides `currentCount` (i.e. how many rows of this
 * resource the user owns NOW); the helper resolves the plan tier and
 * asks `isWithinLimit` whether one more would fit. Returning the count
 * via a callback rather than re-counting inside the helper keeps the
 * gate honest about race conditions — a careful caller can take the
 * count inside the same transaction it inserts into.
 *
 * @returns `null` when the create is allowed. Otherwise an
 *          ActionResult payload the caller should `return` directly.
 */
export async function enforceCreateLimit(
  userId: string,
  resource: LimitedResource,
  currentCount: number,
): Promise<LimitDeniedResult | null> {
  const user = await loadPlanUser(userId);
  if (!user) {
    // Defensive — should never fire in practice because currentUserId()
    // already verified the session row. Treat as "skip the gate": let
    // the downstream action surface a more specific error (ownership
    // check, FK constraint, etc.) rather than masking the real issue.
    return null;
  }

  if (isWithinLimit(user, resource, currentCount)) {
    return null;
  }

  return {
    ok: false,
    error: FREE_TIER_LIMIT_ERROR,
    upgradeUrl: "/pricing",
  };
}

/**
 * Gate the next recipe insert on the free-tier PER-PROJECT-NODE cap.
 *
 * Unlike projects / wishlist (which are capped on the per-account total),
 * the free recipe allowance is "1 recipe per project node": a free painter
 * can keep one recipe on every project they own, plus one standalone
 * recipe. The "node" is the recipe's `attachedProjectId`; standalone
 * recipes (`attachedProjectId === null`) share one "no-project" node.
 *
 * So instead of counting ALL the user's recipes, this counts only the
 * recipes already sharing the target node, then defers to
 * `enforceCreateLimit` with the `recipes` resource (free cap = 1). The
 * count is taken owner-scoped so it can never see another user's rows.
 *
 * @returns `null` when the create is allowed. Otherwise an ActionResult
 *          payload the caller should `return` directly.
 */
export async function enforceRecipeNodeLimit(
  userId: string,
  attachedProjectId: string | null,
): Promise<LimitDeniedResult | null> {
  // Owner-scoped count of recipes already attached to this node. Null
  // node (standalone) needs `IS NULL`, not `= null`, so branch the filter.
  const nodeFilter =
    attachedProjectId === null
      ? and(eq(recipes.ownerId, userId), isNull(recipes.attachedProjectId))
      : and(
          eq(recipes.ownerId, userId),
          eq(recipes.attachedProjectId, attachedProjectId),
        );

  const nodeRows = await db
    .select({ n: count() })
    .from(recipes)
    .where(nodeFilter);

  return enforceCreateLimit(userId, "recipes", nodeRows[0]?.n ?? 0);
}
