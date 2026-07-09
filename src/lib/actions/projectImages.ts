"use server";

import { revalidatePath } from "next/cache";
import { and, eq, max } from "drizzle-orm";
import { del } from "@vercel/blob";
import { z } from "zod";
import { db } from "@/db/client";
import { projectImages, projects, type ProjectImage } from "@/db/schema";
import { currentUserId } from "@/lib/auth-stub";
import { isBlobConfigured, blobReadWriteToken } from "@/lib/blob/env";
import { MAX_IMAGES_PER_PROJECT } from "@/lib/blob/limits";
import { listProjectImages } from "@/db/queries/projectImages";
import type { ActionResult } from "@/lib/actions/projects";

/**
 * Recipe-card phase 1 — project model-photo actions.
 *
 * IMPORTANT: this file must NOT import `@/auth` — that pulls next-auth's
 * `next/server` into the module graph and breaks the integration suite's
 * top-level import (the test file then collects 0 tests). Ownership
 * resolves via `currentUserId()` from `@/lib/auth-stub` instead, same as
 * every other action module.
 *
 * Upload itself is a client-upload (see `/api/project-images/upload` +
 * `ProjectImagePanel`) — the browser PUTs bytes straight to Vercel Blob,
 * bypassing this server entirely for the file transfer. `recordProjectImage`
 * is what the client calls right after `upload()` resolves, to persist the
 * blob url/pathname as a DB row. It re-verifies ownership + the per-project
 * cap itself (the upload route's `onBeforeGenerateToken` check happens
 * moments earlier over the same data, but this call is the one with write
 * access — nothing here trusts the client's say-so).
 */

const idSchema = z.string().min(1).max(64);

async function verifyProjectOwnership(
  userId: string,
  projectId: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.ownerId, userId)))
    .limit(1);
  return rows.length === 1;
}

function revalidateForProject(projectId: string) {
  revalidatePath("/dashboard");
  revalidatePath(`/projects/${projectId}`);
}

/* ============================================================
   recordProjectImage — persists a completed client upload as a row.
   ============================================================ */

const recordSchema = z.object({
  projectId: idSchema,
  url: z.string().trim().url("Invalid image URL").max(2048),
  pathname: z.string().trim().min(1).max(1024),
});

export async function recordProjectImage(
  raw: z.infer<typeof recordSchema>,
): Promise<ActionResult<ProjectImage>> {
  const parsed = recordSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid image" };
  }
  const { projectId, url, pathname } = parsed.data;
  const userId = await currentUserId();

  const owned = await verifyProjectOwnership(userId, projectId);
  if (!owned) return { ok: false, error: "Project not found" };

  const existing = await listProjectImages(projectId);
  if (existing.length >= MAX_IMAGES_PER_PROJECT) {
    return {
      ok: false,
      error: `This project already has the maximum of ${MAX_IMAGES_PER_PROJECT} photos.`,
    };
  }

  const positionRows = await db
    .select({ maxPos: max(projectImages.position) })
    .from(projectImages)
    .where(eq(projectImages.projectId, projectId));
  const currentMax = positionRows[0]?.maxPos ?? null;
  const nextPosition = currentMax === null ? 0 : currentMax + 1;

  try {
    const inserted = await db
      .insert(projectImages)
      .values({
        projectId,
        ownerId: userId,
        url,
        pathname,
        position: nextPosition,
      })
      .returning();
    const row = inserted[0];
    if (!row) return { ok: false, error: "Insert returned no row" };
    revalidateForProject(projectId);
    return { ok: true, data: row };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to save image",
    };
  }
}

/* ============================================================
   deleteProjectImage — removes the row + the underlying blob object.
   ============================================================ */

const deleteSchema = z.object({ id: idSchema });

export async function deleteProjectImage(
  raw: z.infer<typeof deleteSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = deleteSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid id" };
  }
  const { id } = parsed.data;
  const userId = await currentUserId();

  const rows = await db
    .select()
    .from(projectImages)
    .where(and(eq(projectImages.id, id), eq(projectImages.ownerId, userId)))
    .limit(1);
  const row = rows[0];
  if (!row) return { ok: false, error: "Image not found" };

  try {
    await db.delete(projectImages).where(eq(projectImages.id, id));
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to delete image",
    };
  }

  // Best-effort blob cleanup — the DB row is already gone (the painter's
  // view is already correct), so a Blob-side failure here (missing token,
  // network hiccup, already-deleted object) must not surface as an error
  // or resurrect the row. Worst case is an orphaned object in storage,
  // which is cheap and recoverable, vs. a delete that appears to fail.
  if (isBlobConfigured()) {
    try {
      await del(row.pathname, { token: blobReadWriteToken() ?? undefined });
    } catch {
      // swallow — see comment above.
    }
  }

  revalidateForProject(row.projectId);
  return { ok: true, data: { id } };
}

/* ============================================================
   reorderProjectImages — persists the painter's carousel drag order.
   Ships the ACTION now even though the panel ships upload+cycle+delete
   first — a fast-follow reorder UI can call straight into this.
   ============================================================ */

const reorderSchema = z.object({
  projectId: idSchema,
  orderedIds: z.array(idSchema).min(1).max(MAX_IMAGES_PER_PROJECT),
});

export async function reorderProjectImages(
  raw: z.infer<typeof reorderSchema>,
): Promise<ActionResult<{ projectId: string }>> {
  const parsed = reorderSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid order" };
  }
  const { projectId, orderedIds } = parsed.data;
  const userId = await currentUserId();

  const owned = await verifyProjectOwnership(userId, projectId);
  if (!owned) return { ok: false, error: "Project not found" };

  const existing = await db
    .select({ id: projectImages.id })
    .from(projectImages)
    .where(eq(projectImages.projectId, projectId));
  const existingIds = new Set(existing.map((r) => r.id));

  // Every id must belong to this project — a stray id (someone else's
  // image, or a typo) is a hard reject rather than a silent partial apply.
  if (
    orderedIds.length !== existingIds.size ||
    !orderedIds.every((id) => existingIds.has(id))
  ) {
    return { ok: false, error: "Order does not match this project's images" };
  }

  try {
    await Promise.all(
      orderedIds.map((id, position) =>
        db
          .update(projectImages)
          .set({ position })
          .where(
            and(eq(projectImages.id, id), eq(projectImages.projectId, projectId)),
          ),
      ),
    );
    revalidateForProject(projectId);
    return { ok: true, data: { projectId } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to reorder images",
    };
  }
}

/* ============================================================
   loadProjectImages — client-callable read wrapper around the
   `listProjectImages` query (owner-scoped so a painter can't probe
   another user's project id for its photo list).
   ============================================================ */

export async function loadProjectImages(
  projectId: string,
): Promise<ReadonlyArray<ProjectImage>> {
  const userId = await currentUserId();
  const owned = await verifyProjectOwnership(userId, projectId);
  if (!owned) return [];
  return listProjectImages(projectId);
}
