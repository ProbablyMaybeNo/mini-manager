"use server";

import { revalidatePath } from "next/cache";
import { and, eq, max } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { namedModels, projects, type NamedModel } from "@/db/schema";
import { currentUserId } from "@/lib/auth-stub";
import type { ActionResult } from "@/lib/actions/projects";

/**
 * Boolean stages on a named model, ordered from "lowest" (must be
 * true first) to "highest" (only true if the prior is also true).
 * This mirrors the DB CHECK constraint `named_model_stage_cascade`:
 *
 *   isBuilt ≥ isPrimed ≥ isPainted ≥ isBased ≥ isComplete
 *
 * (where "≥" on booleans means "if upper is true, lower must be true").
 */
export const namedModelStages = [
  "isBuilt",
  "isPrimed",
  "isPainted",
  "isBased",
  "isComplete",
] as const;
export type NamedModelStage = (typeof namedModelStages)[number];

type NamedModelStageSnapshot = Pick<
  NamedModel,
  "isBuilt" | "isPrimed" | "isPainted" | "isBased" | "isComplete"
>;

function labelFor(stage: NamedModelStage): string {
  switch (stage) {
    case "isBuilt":
      return "Built";
    case "isPrimed":
      return "Primed";
    case "isPainted":
      return "Painted";
    case "isBased":
      return "Based";
    case "isComplete":
      return "Complete";
  }
}

/**
 * Given a stage and its desired next value, walk the cascade and
 * return either the patch we should write OR a friendly error.
 *
 * Toggling ON a stage forces every prior stage on too (you can't
 * be Painted without being Primed). Toggling OFF a stage forces
 * every later stage off (the DB CHECK would reject otherwise, but
 * we'd rather not error — the user obviously means "untick this
 * and everything after"). This matches the "single mini" mental
 * model: one click should leave the row in a legal state.
 */
export function applyToggle(
  snap: NamedModelStageSnapshot,
  stage: NamedModelStage,
  nextValue: boolean,
): { ok: true; patch: NamedModelStageSnapshot } | { ok: false; error: string } {
  const idx = namedModelStages.indexOf(stage);
  if (idx === -1) {
    return { ok: false, error: "Unknown stage" };
  }

  const patch: NamedModelStageSnapshot = { ...snap, [stage]: nextValue };

  if (nextValue) {
    // Turning ON: ensure every prior stage is also on. We won't
    // silently flip them — if the painter unticks Primed they
    // probably stripped it, so we let them tick Built/Primed back
    // up explicitly. Surface a friendly error instead.
    for (let i = 0; i < idx; i += 1) {
      const earlier = namedModelStages[i];
      if (earlier === undefined) continue;
      if (!snap[earlier]) {
        return {
          ok: false,
          error: `Tick ${labelFor(earlier)} first.`,
        };
      }
    }
  } else {
    // Turning OFF: any later stage that's currently on would violate
    // the cascade. Cascade the untick down so one click does the
    // right thing (e.g. unticking Primed clears Painted/Based/Complete).
    for (let i = idx + 1; i < namedModelStages.length; i += 1) {
      const later = namedModelStages[i];
      if (later === undefined) continue;
      patch[later] = false;
    }
  }

  return { ok: true, patch };
}

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

  const userId = currentUserId();

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

  const userId = currentUserId();

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

  const userId = currentUserId();

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
