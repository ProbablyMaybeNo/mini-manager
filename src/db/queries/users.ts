import "server-only";

import { desc, eq, isNotNull } from "drizzle-orm";
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

export interface CompedUser {
  id: string;
  username: string | null;
  email: string | null;
  freeForeverGrantedAt: Date;
}

/**
 * Every account with admin-granted comp access (subscription paywall, fix
 * 5) — `/admin/comp` lists these so Ross can see + revoke without hunting
 * through the DB. Newest grant first.
 */
export async function listCompedUsers(): Promise<CompedUser[]> {
  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      freeForeverGrantedAt: users.freeForeverGrantedAt,
    })
    .from(users)
    .where(isNotNull(users.freeForeverGrantedAt))
    .orderBy(desc(users.freeForeverGrantedAt));
  return rows.map((r) => ({ ...r, freeForeverGrantedAt: r.freeForeverGrantedAt! }));
}
