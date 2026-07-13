import "server-only";

import { and, desc, eq, ne } from "drizzle-orm";
import { db } from "@/db/client";
import { recipes, users, type GalleryStatus } from "@/db/schema";

/**
 * Recipe-card phase 3 — the admin review queue read (`/admin/gallery`).
 * A "submission" isn't a separate table (see `src/lib/actions/gallerySubmissions.ts`
 * for the data-model rationale) — it's just a recipe row with
 * `galleryStatus = 'pending'`. One join to `users` for the submitter's
 * display name/email.
 */
export interface PendingGallerySubmission {
  recipeId: string;
  recipeName: string;
  cardImageUrl: string;
  cardImageRatio: string | null;
  submittedAt: number | null;
  submitterId: string;
  submitterEmail: string | null;
  submitterUsername: string | null;
}

export async function listPendingGallerySubmissions(): Promise<
  ReadonlyArray<PendingGallerySubmission>
> {
  const rows = await db
    .select({
      recipeId: recipes.id,
      recipeName: recipes.name,
      cardImageUrl: recipes.galleryImageUrl,
      cardImageRatio: recipes.galleryImageRatio,
      submittedAt: recipes.gallerySubmittedAt,
      submitterId: recipes.ownerId,
      submitterEmail: users.email,
      submitterUsername: users.username,
    })
    .from(recipes)
    .innerJoin(users, eq(users.id, recipes.ownerId))
    .where(eq(recipes.galleryStatus, "pending"))
    .orderBy(desc(recipes.gallerySubmittedAt));

  // `cardImageUrl` is null only if a row somehow reached `pending` without an
  // image (shouldn't happen — submit always sets it together) — skip rather
  // than render a broken tile.
  const out: PendingGallerySubmission[] = [];
  for (const r of rows) {
    if (!r.cardImageUrl) continue;
    out.push({
      recipeId: r.recipeId,
      recipeName: r.recipeName,
      cardImageUrl: r.cardImageUrl,
      cardImageRatio: r.cardImageRatio,
      submittedAt: r.submittedAt ? r.submittedAt.getTime() : null,
      submitterId: r.submitterId,
      submitterEmail: r.submitterEmail,
      submitterUsername: r.submitterUsername,
    });
  }
  return out;
}

/**
 * "Your cards" — one row per gallery card the signed-in painter has
 * submitted, with its current moderation status. A "submission" is just a
 * recipe row whose `galleryStatus` has left the default `none` (see
 * `src/lib/actions/gallerySubmissions.ts` for the single-table rationale),
 * so this is a single owner-scoped read filtering out `none`. Newest
 * submission first.
 */
export interface MyGalleryCard {
  recipeId: string;
  name: string;
  /** "pending" | "approved" | "rejected" — never "none" (filtered out). */
  status: GalleryStatus;
  submittedAt: number | null;
}

export async function listMyGallerySubmissions(
  userId: string,
): Promise<ReadonlyArray<MyGalleryCard>> {
  const rows = await db
    .select({
      recipeId: recipes.id,
      name: recipes.name,
      status: recipes.galleryStatus,
      submittedAt: recipes.gallerySubmittedAt,
    })
    .from(recipes)
    .where(and(eq(recipes.ownerId, userId), ne(recipes.galleryStatus, "none")))
    .orderBy(desc(recipes.gallerySubmittedAt));

  return rows.map((r) => ({
    recipeId: r.recipeId,
    name: r.name,
    status: r.status,
    submittedAt: r.submittedAt ? r.submittedAt.getTime() : null,
  }));
}
