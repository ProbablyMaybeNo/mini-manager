"use server";

import { eq } from "drizzle-orm";
import Stripe from "stripe";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { currentUserId } from "@/lib/auth-stub";
import { stripeSecretKey } from "@/lib/billing/env";
import type { ActionResult } from "@/lib/actions/projects";

/**
 * Permanently delete the signed-in user's account and all their data.
 *
 * Every owner-scoped table FKs `users.id` with `ON DELETE CASCADE`, so
 * deleting the single user row removes projects, recipes, collection,
 * sessions, etc. in one statement. Deleting the `session` rows also
 * invalidates the caller's login immediately (DB-backed sessions).
 *
 * If the account has a live Stripe subscription and Stripe is configured,
 * we cancel it first on a best-effort basis so a deleted account is never
 * billed again — but a Stripe failure never blocks the deletion.
 */
export async function deleteAccount(): Promise<ActionResult<{ deleted: true }>> {
  const userId = await currentUserId({ skipMigrationCheck: true });

  const rows = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const user = rows[0];
  if (!user) return { ok: false, error: "Account not found" };

  const secret = stripeSecretKey();
  if (secret && user.stripeSubscriptionId) {
    try {
      const stripe = new Stripe(secret);
      await stripe.subscriptions.cancel(user.stripeSubscriptionId);
    } catch {
      /* best-effort — proceed with deletion regardless */
    }
  }

  try {
    await db.delete(users).where(eq(users.id, userId));
    return { ok: true, data: { deleted: true } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to delete account",
    };
  }
}
