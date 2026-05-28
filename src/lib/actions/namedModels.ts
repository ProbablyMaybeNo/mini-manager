"use server";

import { revalidatePath } from "next/cache";
import { and, eq, max } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { namedModels, projects } from "@/db/schema";
import { currentUserId } from "@/lib/auth-stub";
import type { ActionResult } from "@/lib/actions/projects";
import {
  applyToggle,
  namedModelStages,
  type NamedModelStageSnapshot,
} from "@/lib/namedModels/cascade";

/* ============================================================
   createNamedModel
   ============================================================ */

const createSchema = z.object({
  projectId: z.string().min(1).max(32),
  name: z.string().trim().min(1, "Name is required").max(120, "Name is too long"),
});

export type CreateNamedModelInput = z.infer<typeof createSchema>;

/**
 * Append a new named model to a project. Position is assigned as
 * `max(position) + 1` so the row lands at the end. Returns the new
 * id so the client can focus the new row if desired.
 */
export async function createNamedModel(
  raw: CreateNamedModelInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first?.message ?? "Invalid named model" };
  }
  const { projectId, name } = parsed.data;

  const userId = await currentUserId();

  // Verify ownership before writing.
  const owned = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.ownerId, userId)))
    .limit(1);
  if (!owned[0]) {
    return { ok: false, error: "Project not found" };
  }

  // Next position: append after the current max. nanoid handles id.
  const positionRows = await db
    .select({ maxPos: max(namedModels.position) })
    .from(namedModels)
    .where(eq(namedModels.projectId, projectId));
  const currentMax = positionRows[0]?.maxPos ?? null;
  const nextPosition = currentMax === null ? 0 : currentMax + 1;

  const inserted = await db
    .insert(namedModels)
    .values({
      projectId,
      name,
      position: nextPosition,
    })
    .returning({ id: namedModels.id });

  const newRow = inserted[0];
  if (!newRow) {
    return { ok: false, error: "Failed to create named model" };
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");

  return { ok: true, data: { id: newRow.id } };
}

/* ============================================================
   deleteNamedModel
   ============================================================ */

const deleteSchema = z.object({
  id: z.string().min(1).max(32),
});

export type DeleteNamedModelInput = z.infer<typeof deleteSchema>;

export async function deleteNamedModel(
  raw: DeleteNamedModelInput,
): Promise<ActionResult<{ id: string; projectId: string }>> {
  const parsed = deleteSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first?.message ?? "Invalid id" };
  }
  const { id } = parsed.data;

  const userId = await currentUserId();

  // Lookup + ownership check in one round-trip via inner join.
  const rows = await db
    .select({
      id: namedModels.id,
      projectId: namedModels.projectId,
    })
    .from(namedModels)
    .innerJoin(projects, eq(projects.id, namedModels.projectId))
    .where(and(eq(namedModels.id, id), eq(projects.ownerId, userId)))
    .limit(1);
  const target = rows[0];
  if (!target) {
    return { ok: false, error: "Named model not found" };
  }

  await db.delete(namedModels).where(eq(namedModels.id, id));

  revalidatePath(`/projects/${target.projectId}`);
  revalidatePath("/projects");

  return { ok: true, data: { id: target.id, projectId: target.projectId } };
}

/* ============================================================
   toggleNamedModelStage
   ============================================================ */

const toggleSchema = z.object({
  id: z.string().min(1).max(32),
  stage: z.enum(namedModelStages),
  nextValue: z.boolean(),
});

export type ToggleNamedModelStageInput = z.infer<typeof toggleSchema>;

/**
 * Flip a single boolean stage on a named model. Pre-validates the
 * cascade and cascades downward on un-ticks (see `applyToggle`).
 * Returns the new stage snapshot so the optimistic client can
 * confirm.
 */
export async function toggleNamedModelStage(
  raw: ToggleNamedModelStageInput,
): Promise<ActionResult<NamedModelStageSnapshot>> {
  const parsed = toggleSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first?.message ?? "Invalid toggle" };
  }
  const { id, stage, nextValue } = parsed.data;

  const userId = await currentUserId();

  const rows = await db
    .select({
      id: namedModels.id,
      projectId: namedModels.projectId,
      isBuilt: namedModels.isBuilt,
      isPrimed: namedModels.isPrimed,
      isPainted: namedModels.isPainted,
      isBased: namedModels.isBased,
      isComplete: namedModels.isComplete,
    })
    .from(namedModels)
    .innerJoin(projects, eq(projects.id, namedModels.projectId))
    .where(and(eq(namedModels.id, id), eq(projects.ownerId, userId)))
    .limit(1);
  const target = rows[0];
  if (!target) {
    return { ok: false, error: "Named model not found" };
  }

  const snap: NamedModelStageSnapshot = {
    isBuilt: target.isBuilt,
    isPrimed: target.isPrimed,
    isPainted: target.isPainted,
    isBased: target.isBased,
    isComplete: target.isComplete,
  };

  const result = applyToggle(snap, stage, nextValue);
  if (!result.ok) return result;

  try {
    await db.update(namedModels).set(result.patch).where(eq(namedModels.id, id));
  } catch (err) {
    const message =
      err instanceof Error && err.message.includes("named_model_stage_cascade")
        ? "Stage cascade violated. Refresh and try again."
        : "Failed to update named model.";
    return { ok: false, error: message };
  }

  revalidatePath(`/projects/${target.projectId}`);
  revalidatePath("/projects");

  return { ok: true, data: result.patch };
}
