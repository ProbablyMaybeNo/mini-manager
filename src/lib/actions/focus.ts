"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { projects, users } from "@/db/schema";
import { currentUserId } from "@/lib/auth-stub";
import type { ActionResult } from "@/lib/actions/projects";

const projectIdSchema = z.string().min(1).max(32);

const setSchema = z.object({ projectId: projectIdSchema });

/**
 * P13.11 — Pin a project as the painter's current "focus". The dashboard
 * FOCUS section renders the focused project's full recipe with per-step
 * notes editable. The painter sets focus from the FocusPicker dropdown.
 *
 * Ownership is verified before write: a hostile id from another owner
 * returns `not found` without touching the user row.
 */
export async function setFocusProject(
  raw: z.infer<typeof setSchema>,
): Promise<ActionResult<{ projectId: string }>> {
  const parsed = setSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid project",
    };
  }
  const { projectId } = parsed.data;
  const userId = await currentUserId();

  const owned = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.ownerId, userId)))
    .limit(1);
  if (!owned[0]) return { ok: false, error: "Project not found" };

  try {
    await db
      .update(users)
      .set({ focusProjectId: projectId })
      .where(eq(users.id, userId));
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to set focus",
    };
  }

  revalidatePath("/projects");
  return { ok: true, data: { projectId } };
}

/**
 * P13.11 — Clear the focus pin. Painter is no longer working on a
 * specific project; the FOCUS section reverts to its empty state.
 */
export async function clearFocusProject(): Promise<
  ActionResult<{ cleared: true }>
> {
  const userId = await currentUserId();
  try {
    await db
      .update(users)
      .set({ focusProjectId: null })
      .where(eq(users.id, userId));
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to clear focus",
    };
  }
  revalidatePath("/projects");
  return { ok: true, data: { cleared: true } };
}
