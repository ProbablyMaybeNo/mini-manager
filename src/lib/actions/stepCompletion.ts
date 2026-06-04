"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { recipeStepCompletion, recipeSlots } from "@/db/schema";
import { currentUserId } from "@/lib/auth-stub";
import { getSlotWithOwnerCheck } from "@/db/queries/recipes";
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
 * P15.0 — Toggle a single slot's per-painter done-state (2026-06-04
 * flatten — a "step" is now a slot; `recipe_step_completion.stepId`
 * holds the slot id, preserved == old step.id from the migration).
 *
 * Done-state is stored as the existence of a `recipe_step_completion`
 * row keyed by `(user_id, step_id)`, so toggling on inserts a row and
 * toggling off deletes it. Ownership is verified via the slot's parent
 * recipe before any write — a slot belonging to another painter's
 * recipe returns `not found` without touching the table.
 *
 * Insert is idempotent: ticking an already-done slot is a no-op (the
 * unique index guards against duplicates, and we short-circuit on the
 * pre-read). Un-ticking an already-undone slot likewise succeeds.
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

  const owned = await getSlotWithOwnerCheck(userId, stepId);
  if (!owned) return { ok: false, error: "Slot not found" };

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
 * P15.0 — "Advance slot" quick-action (2026-06-04 flatten).
 *
 * Marks the given slot done for the painter, then resolves the next slot
 * in the active recipe that's still undone — that becomes the new active
 * slot the dashboard focuses on. Ownership is verified via the slot's
 * parent recipe. (`zoneId` is the slot id; the param name is kept for
 * the existing client contract.)
 *
 * Returns `nextSlotId`:
 *   - the id of the next slot (in position order, wrapping to the start)
 *     that is still undone, or
 *   - null when the whole recipe is now complete (no undone slots remain)
 *     — the caller drops the active-slot URL param.
 *
 * Idempotent: completing an already-done slot is a no-op.
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
  const { zoneId: slotId } = parsed.data;
  const userId = await currentUserId();

  const owned = await getSlotWithOwnerCheck(userId, slotId);
  if (!owned) return { ok: false, error: "Slot not found" };
  const recipeId = owned.recipeId;

  // Every slot in the recipe, in position order — needed to find the
  // "next undone" slot after the current one.
  const slots = await db
    .select({ id: recipeSlots.id, position: recipeSlots.position })
    .from(recipeSlots)
    .where(eq(recipeSlots.recipeId, recipeId))
    .orderBy(asc(recipeSlots.position));

  const slotIds = slots.map((s) => s.id);
  if (slotIds.length === 0) {
    return { ok: false, error: "Slot not found" };
  }

  // The painter's existing completion marks across the recipe.
  const doneRows = await db
    .select({ stepId: recipeStepCompletion.stepId })
    .from(recipeStepCompletion)
    .where(
      and(
        eq(recipeStepCompletion.userId, userId),
        inArray(recipeStepCompletion.stepId, slotIds),
      ),
    );
  const doneBefore = new Set(doneRows.map((r) => r.stepId));

  // Mark the current slot done (if it isn't already).
  if (!doneBefore.has(slotId)) {
    try {
      await db.insert(recipeStepCompletion).values({ userId, stepId: slotId });
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Failed to advance slot",
      };
    }
  }

  // Recompute the done-set, then walk slots from the one AFTER the
  // current slot, wrapping around, to find the first undone slot.
  const doneAfter = new Set(doneBefore);
  doneAfter.add(slotId);

  const currentIdx = slots.findIndex((s) => s.id === slotId);
  let nextSlotId: string | null = null;
  for (let offset = 1; offset <= slots.length; offset++) {
    const candidate = slots[(currentIdx + offset) % slots.length]!;
    if (!doneAfter.has(candidate.id)) {
      nextSlotId = candidate.id;
      break;
    }
  }

  revalidatePath("/projects");
  revalidatePath(`/recipes/${recipeId}`);
  return { ok: true, data: { completedZoneId: slotId, nextSlotId } };
}
