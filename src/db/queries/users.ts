import "server-only";

import { and, desc, eq, isNotNull, like, or, sql } from "drizzle-orm";
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

export interface AdminUserRow {
  id: string;
  username: string | null;
  email: string | null;
  emailVerified: Date | null;
  plan: string | null;
  freeForeverGrantedAt: Date | null;
  createdAt: Date | null;
}

/**
 * Every account, for the `/admin/users` roster — the owner had no way to see
 * who had signed up at all. `/admin/comp` only searches by an exact username
 * and only lists already-comped accounts, so "does <email> have an account,
 * and what's their username?" was unanswerable without querying the database
 * by hand.
 *
 * `search` matches username OR email, case-insensitively and as a substring,
 * because the practical question is usually "someone emailed me from roughly
 * this address" rather than an exact key.
 *
 * Deliberately selects no secrets — never passwordHash, never token columns.
 * Ordered newest-signup first; accounts predating the `created_at` column
 * have a null date and sort last, then by username.
 */
export async function listAllUsers(
  search?: string,
  limit = 200,
): Promise<AdminUserRow[]> {
  const q = search?.trim().toLowerCase();
  const filter = q
    ? or(
        like(sql`lower(${users.username})`, `%${q}%`),
        like(sql`lower(${users.email})`, `%${q}%`),
        like(sql`lower(${users.recoveryEmail})`, `%${q}%`),
      )
    : undefined;

  return db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      emailVerified: users.emailVerified,
      plan: users.plan,
      freeForeverGrantedAt: users.freeForeverGrantedAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(filter ? and(filter) : undefined)
    // Newest signups first; the pre-column accounts (null) sort last.
    .orderBy(desc(users.createdAt), users.username)
    .limit(limit);
}

/** Total account count — shown alongside the (capped) roster so a truncated
 *  list never reads as "this is everyone". */
export async function countAllUsers(): Promise<number> {
  const row = await db.select({ n: sql<number>`count(*)` }).from(users);
  return Number(row[0]?.n ?? 0);
}
