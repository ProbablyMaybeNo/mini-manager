import "server-only";

import { and, asc, count as countFn, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { projectImages, type ProjectImage } from "@/db/schema";

/**
 * Recipe-card phase 1 — project model-photo query layer. Mirrors the shape
 * of `src/db/queries/inspoImages.ts`: reads are owner-scoped where the
 * caller has a userId in hand, position-ordered so the carousel + the
 * upload append (`max(position) + 1`) agree on ordering.
 */

/** Every uploaded photo for one project node, in carousel order. */
export async function listProjectImages(
  projectId: string,
): Promise<ReadonlyArray<ProjectImage>> {
  return db
    .select()
    .from(projectImages)
    .where(eq(projectImages.projectId, projectId))
    .orderBy(asc(projectImages.position));
}

/** How many images a project node currently has — backs the upload cap. */
export async function countProjectImages(projectId: string): Promise<number> {
  const rows = await db
    .select({ n: countFn() })
    .from(projectImages)
    .where(eq(projectImages.projectId, projectId));
  return rows[0]?.n ?? 0;
}

/**
 * Single-row fetch with owner check — used by delete/reorder to verify the
 * painter owns the row before mutating (and before calling Blob `del()`).
 */
export async function getProjectImageForOwner(
  userId: string,
  id: string,
): Promise<ProjectImage | null> {
  const rows = await db
    .select()
    .from(projectImages)
    .where(and(eq(projectImages.id, id), eq(projectImages.ownerId, userId)))
    .limit(1);
  return rows[0] ?? null;
}
