import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";

/**
 * Has the user finished (or skipped) the first-run walkthrough? Reads the
 * single `tutorialCompletedAt` flag; `true` once it's stamped, so the app
 * shell knows whether to auto-start the tour on load. A missing user row
 * (shouldn't happen for a signed-in session) is treated as "seen" to avoid
 * forcing the tour on an unresolvable account.
 */
export async function hasSeenTutorial(userId: string): Promise<boolean> {
  const row = await db
    .select({ tutorialCompletedAt: users.tutorialCompletedAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const user = row[0];
  if (!user) return true;
  return user.tutorialCompletedAt != null;
}
