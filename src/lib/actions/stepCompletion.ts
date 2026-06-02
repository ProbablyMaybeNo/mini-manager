"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { recipeStepCompletion, recipeSteps, recipeZones } from "@/db/schema";
import { currentUserId } from "@/lib/auth-stub";
import {
  getStepWithOwnerCheck,
  getZoneWithOwnerCheck,
} from "@/db/queries/recipes";
import type { ActionResult } from "@/lib/actions/projects";

const stepIdSchema = z.string().min(1).max(64);
const zoneIdSchema = z.string().min(1).max(64);

const setSchema = z.object({
  stepId: stepIdSchema,
  done: z.boolean(),
});

const advanceSchema = z.object({
  zoneId: zoneIdSchema,
});

/**
 * P15.0 — Toggle a single step's per-painter done-state.
 *
 * Done-state is stored as the existence of a `recipe_step_completion`
 * row keyed by `(user_id, step_id)`, so toggling on inserts a row and
 * toggling off deletes it. Ownership is verified via the step's parent
 * recipe before any write — a step belonging to another painter's
 * recipe returns `not found` without touching the table.
 *
 * Insert is idempotent: ticking an already-done step is a no-op (the
 * unique index guards against duplicates, and we short-circuit on the
 * pre-read). Un-ticking an already-undone step likewise succeeds.
 */
export async function setStepCompletion(
  raw: z.infer<typeof setSchema>,
): Promise<ActionResult<{ stepId: string; done: boolean }>> {
  const parsed = setSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid completion toggle",
    };
  }
  const { stepId, done } = parsed.data;
  const userId = await currentUserId();

  const owned = await getStepWithOwnerCheck(userId, stepId);
  if (!owned) return { ok: false, error: "Step not found" };

  try {
    if (done) {
      const existing = await db
        .select({ id: recipeStepCompletion.id })
        .from(recipeStepCompletion)
        .where(
          and(
            eq(recipeStepCompletion.userId, userId),
            eq(recipeStepCompletion.stepId, stepId),
          ),
        )
        .limit(1);
      if (!existing[0]) {
        await db
          .insert(recipeStepCompletion)
          .values({ userId, stepId });
      }
    } else {
      await db
        .delete(recipeStepCompletion)
        .where(
          and(
            eq(recipeStepCompletion.userId, userId),
            eq(recipeStepCompletion.stepId, stepId),
          ),
        );
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to update step",
    };
  }

  revalidatePath("/projects");
  revalidatePath(`/recipes/${owned.recipeId}`);
  return { ok: true, data: { stepId, done } };
}

/**
 * P15.0 — "Advance slot" quick-action.
 *
 * Marks every step in the given slot (zone) done for the painter, then
 * resolves the next slot in the active recipe that still has at least
 * one undone step — that becomes the new active slot the dashboard
 * focuses on. Ownership is verified via the zone's parent recipe.
 *
 * Returns `nextSlotId`:
 *   - the id of the next slot (in position order, wrapping to the start)
 *     that has at least one undone step, or
 *   - null when the whole recipe is now complete (no undone steps
 *     remain anywhere) — the caller drops the active-slot URL param.
 *
 * Bulk-inserts only the steps that aren't already done so the unique
 * index never trips on a partially-completed slot.
 */
export async function advanceSlot(
  raw: z.infer<typeof advanceSchema>,
): Promise<ActionResult<{ completedZoneId: string; nextSlotId: string | null }>> {
  const parsed = advanceSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid slot",
    };
  }
  const { zoneId } = parsed.data;
  const userId = await currentUserId();

  const owned = await getZoneWithOwnerCheck(userId, zoneId);
  if (!owned) return { ok: false, error: "Slot not found" };
  const recipeId = owned.recipeId;

  // Every zone in the recipe, in position order — needed to find the
  // "next undone" slot after the current one.
  const zones = await db
    .select({ id: recipeZones.id, position: recipeZones.position })
    .from(recipeZones)
    .where(eq(recipeZones.recipeId, recipeId))
    .orderBy(asc(recipeZones.position));

  const zoneIds = zones.map((z) => z.id);
  if (zoneIds.length === 0) {
    return { ok: false, error: "Slot not found" };
  }

  // Every step across the recipe + the painter's existing completion
  // marks, so we can both bulk-complete the current slot and locate the
  // next slot with outstanding work.
  const steps = await db
    .select({ id: recipeSteps.id, zoneId: recipeSteps.zoneId })
    .from(recipeSteps)
    .where(inArray(recipeSteps.zoneId, zoneIds));

  const stepIds = steps.map((s) => s.id);
  const doneRows = stepIds.length
    ? await db
        .select({ stepId: recipeStepCompletion.stepId })
        .from(recipeStepCompletion)
        .where(
          and(
            eq(recipeStepCompletion.userId, userId),
            inArray(recipeStepCompletion.stepId, stepIds),
          ),
        )
    : [];
  const doneBefore = new Set(doneRows.map((r) => r.stepId));

  // Mark the current slot's still-undone steps done.
  const toInsert = steps
    .filter((s) => s.zoneId === zoneId && !doneBefore.has(s.id))
    .map((s) => ({ userId, stepId: s.id }));

  try {
    if (toInsert.length > 0) {
      await db.insert(recipeStepCompletion).values(toInsert);
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to advance slot",
    };
  }

  // Recompute done-set including this slot's new completions, then walk
  // zones from the one AFTER the current slot, wrapping around, to find
  // the first slot with an undone step.
  const doneAfter = new Set(doneBefore);
  for (const ins of toInsert) doneAfter.add(ins.stepId);

  const stepsByZone = new Map<string, string[]>();
  for (const s of steps) {
    const arr = stepsByZone.get(s.zoneId) ?? [];
    arr.push(s.id);
    stepsByZone.set(s.zoneId, arr);
  }

  const currentIdx = zones.findIndex((z) => z.id === zoneId);
  let nextSlotId: string | null = null;
  for (let offset = 1; offset <= zones.length; offset++) {
    const candidate = zones[(currentIdx + offset) % zones.length]!;
    const candidateSteps = stepsByZone.get(candidate.id) ?? [];
    const hasUndone = candidateSteps.some((id) => !doneAfter.has(id));
    if (hasUndone) {
      nextSlotId = candidate.id;
      break;
    }
  }

  revalidatePath("/projects");
  revalidatePath(`/recipes/${recipeId}`);
  return { ok: true, data: { completedZoneId: zoneId, nextSlotId } };
}
