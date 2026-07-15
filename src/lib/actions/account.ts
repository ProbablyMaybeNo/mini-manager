"use server";

import { and, eq, isNotNull } from "drizzle-orm";
import { del } from "@vercel/blob";
import Stripe from "stripe";
import { db } from "@/db/client";
import { projectImages, recipes, users } from "@/db/schema";
import { currentUserId } from "@/lib/auth-stub";
import { stripeSecretKey } from "@/lib/billing/env";
import { blobReadWriteToken, isBlobConfigured } from "@/lib/blob/env";
import type { ActionResult } from "@/lib/actions/projects";

/**
 * Best-effort deletion of every Vercel Blob object the user owns (model
 * photos on project nodes + submitted gallery-card PNGs) so their public
 * URLs stop resolving once the account is gone. The user-row cascade drops
 * the DB rows but leaves the blob objects orphaned in the store, so we
 * enumerate the pathnames FIRST — before the row delete — then `del()` each.
 * Never throws: an orphaned blob is cheap and a delete failure must not block
 * the account deletion. (`inspo_image` URLs are external references we never
 * stored, so there's nothing to delete for them.)
 */
async function deleteUserBlobs(userId: string): Promise<void> {
  if (!isBlobConfigured()) return;
  const token = blobReadWriteToken() ?? undefined;

  const [imageRows, galleryRows] = await Promise.all([
    db
      .select({ pathname: projectImages.pathname })
      .from(projectImages)
      .where(eq(projectImages.ownerId, userId)),
    db
      .select({ pathname: recipes.galleryImagePathname })
      .from(recipes)
      .where(
        and(
          eq(recipes.ownerId, userId),
          isNotNull(recipes.galleryImagePathname),
        ),
      ),
  ]);

  const pathnames = [
    ...imageRows.map((r) => r.pathname),
    ...galleryRows.map((r) => r.pathname),
  ].filter((p): p is string => typeof p === "string" && p.length > 0);

  await Promise.all(
    pathnames.map((pathname) =>
      del(pathname, { token }).catch(() => {
        /* orphaned blob object is cheap and recoverable */
      }),
    ),
  );
}

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

  // Purge the user's blob objects before the cascade removes the rows that
  // point at them (best-effort — never blocks the delete).
  await deleteUserBlobs(userId);

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
