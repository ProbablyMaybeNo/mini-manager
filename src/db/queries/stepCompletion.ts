import "server-only";

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { recipeStepCompletion } from "@/db/schema";

/**
 * P15.0 — Resolve which of the given step ids the painter has marked
 * done. Returns a Set for O(1) membership checks in the dashboard page
 * when it builds the FocusPanel view model.
 *
 * Scoped to BOTH the user and the supplied step-id list so a painter
 * only ever sees their own completion marks, and the query stays bounded
 * to the active recipe's steps (no full-table scan).
 *
 * An empty `stepIds` short-circuits to an empty set — the dashboard
 * passes the focused recipe's step ids, which is empty for a recipe
 * with no steps.
 */
export async function getCompletedStepIds(
  userId: string,
  stepIds: ReadonlyArray<string>,
): Promise<Set<string>> {
  if (stepIds.length === 0) return new Set();

  const rows = await db
    .select({ stepId: recipeStepCompletion.stepId })
    .from(recipeStepCompletion)
    .where(
      and(
        eq(recipeStepCompletion.userId, userId),
        inArray(recipeStepCompletion.stepId, stepIds as string[]),
      ),
    );

  return new Set(rows.map((r) => r.stepId));
}
