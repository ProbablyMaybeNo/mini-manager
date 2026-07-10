import "server-only";

import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { recipes, users } from "@/db/schema";

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
