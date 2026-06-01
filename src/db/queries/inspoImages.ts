import "server-only";

import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { inspoImages, type InspoImage } from "@/db/schema";

/**
 * P14.7 — Inspo gallery query layer.
 *
 * Two reads back the dashboard widget:
 *
 *   listDisplayedInspoImages   — only `is_displayed = true`, in
 *                                 `position_index` ascending order.
 *                                 Drives the on-dashboard 3-col grid.
 *
 *   listAllInspoImages         — every row including hidden, sorted
 *                                 by display state then position.
 *                                 Drives the Manage modal where the
 *                                 painter toggles show/hide + reorders.
 *
 * Both queries are owner-scoped and rely on
 * `inspo_image_user_position_idx` for the lookup hot path.
 */
export async function listDisplayedInspoImages(
  userId: string,
): Promise<ReadonlyArray<InspoImage>> {
  return db
    .select()
    .from(inspoImages)
    .where(
      and(eq(inspoImages.userId, userId), eq(inspoImages.isDisplayed, true)),
    )
    .orderBy(asc(inspoImages.positionIndex), desc(inspoImages.createdAt));
}

export async function listAllInspoImages(
  userId: string,
): Promise<ReadonlyArray<InspoImage>> {
  // Manage modal wants displayed rows up top, hidden below — then
  // both groups sorted by position. SQL has no native bool DESC for
  // libsql, so we emulate by sorting on `isDisplayed` descending
  // (truthy 1 before 0).
  return db
    .select()
    .from(inspoImages)
    .where(eq(inspoImages.userId, userId))
    .orderBy(
      desc(inspoImages.isDisplayed),
      asc(inspoImages.positionIndex),
      desc(inspoImages.createdAt),
    );
}

/**
 * Single-row fetch with owner check — used by the per-row mutation
 * actions to verify the painter owns the row before mutating.
 */
export async function getInspoImageForOwner(
  userId: string,
  id: string,
): Promise<InspoImage | null> {
  const rows = await db
    .select()
    .from(inspoImages)
    .where(and(eq(inspoImages.id, id), eq(inspoImages.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}
