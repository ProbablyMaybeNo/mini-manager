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

import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import {
  FREE_TIER_LIMIT_ERROR,
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
