"use server";

import { revalidatePath } from "next/cache";
import { and, eq, max } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { recipes, recipeSlots, techniqueKeys, type RecipeSlot } from "@/db/schema";
import { currentUserId } from "@/lib/auth-stub";
import { logActivity } from "@/lib/activityLog";
import { getSlotWithOwnerCheck } from "@/db/queries/recipes";
import type { ActionResult } from "@/lib/actions/projects";

/**
 * Unified recipe-slot actions (2026-06-04 flatten).
 *
 * A recipe is now a flat ordered list of slots; each slot = ONE paint
 * (paintId OR customColorHex, exactly one) + its layer (`technique`).
 * These replace the old recipeZones + recipeSteps action sets: `addSlot`
 * folds in addZone + addStep + addSlotWithPaint; update/delete/reorder
 * mirror the step versions one-to-one. Additive — the old actions stay
 * until every surface has cut over, then they're removed.
 */

const slotIdSchema = z.string().min(1).max(64);
const recipeIdSchema = z.string().min(1).max(64);

/** 3, 6, or 8-char hex with leading #. */
const hexSchema = z
  .string()
  .trim()
  .regex(
    /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/i,
    "Hex must be #RGB, #RRGGBB, or #RRGGBBAA",
  );

const addSchema = z
  .object({
    recipeId: recipeIdSchema,
    // Technique defaults to "basecoat" so the quick "pick a colour → make a
    // slot" flow (old addSlotWithPaint) is a one-arg call.
    technique: z.enum(techniqueKeys).optional(),
    paintId: z.string().min(1).max(64).nullish(),
    customColorHex: hexSchema.nullish(),
    notesMd: z.string().max(10_000).nullish(),
    notes: z.string().max(10_000).nullish(),
  })
  .refine((d) => Boolean(d.paintId) !== Boolean(d.customColorHex), {
    message: "Provide exactly one of paintId or customColorHex",
  });

const updateSchema = z
  .object({
    id: slotIdSchema,
    technique: z.enum(techniqueKeys).optional(),
    paintId: z.string().min(1).max(64).nullish(),
    customColorHex: hexSchema.nullish(),
    notesMd: z.string().max(10_000).nullish(),
    notes: z.string().max(10_000).nullish(),
  })
  .refine((d) => !(d.paintId && d.customColorHex), {
    message: "Provide at most one of paintId or customColorHex",
  });

const deleteSchema = z.object({ id: slotIdSchema });

const reorderSchema = z.object({
  recipeId: recipeIdSchema,
  orderedIds: z.array(slotIdSchema).min(1).max(64),
});

function revalidateForRecipe(recipeId: string) {
  revalidatePath(`/recipes/${recipeId}`);
  revalidatePath("/recipes");
}

async function verifyRecipeOwnership(
  userId: string,
  recipeId: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: recipes.id })
    .from(recipes)
    .where(and(eq(recipes.id, recipeId), eq(recipes.ownerId, userId)))
    .limit(1);
  return rows.length === 1;
}

/* ============================================================
   addSlot — folds in addZone + addStep + addSlotWithPaint. Appends a
   single paint+layer slot at the end of the recipe's slot list.
   ============================================================ */

export async function addSlot(
  raw: z.infer<typeof addSchema>,
): Promise<ActionResult<RecipeSlot>> {
  const parsed = addSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid slot" };
  }
  const d = parsed.data;
  const userId = await currentUserId();

  // Perf (perf-lag fix): the ownership check and the max-position read are
  // independent SELECTs. Production runs against a remote libsql, where
  // each awaited query is a network round-trip — running them serially
  // doubled the read latency before the insert. Fire both at once.
  const [owned, positionRows] = await Promise.all([
    verifyRecipeOwnership(userId, d.recipeId),
    db
      .select({ maxPos: max(recipeSlots.position) })
      .from(recipeSlots)
      .where(eq(recipeSlots.recipeId, d.recipeId)),
  ]);
  if (!owned) return { ok: false, error: "Recipe not found" };

  const currentMax = positionRows[0]?.maxPos ?? null;
  const nextPosition = currentMax === null ? 0 : currentMax + 1;

  try {
    const inserted = await db
      .insert(recipeSlots)
      .values({
        recipeId: d.recipeId,
        position: nextPosition,
        technique: d.technique ?? "basecoat",
        paintId: d.paintId ?? null,
        customColorHex: d.customColorHex ?? null,
        notesMd: d.notesMd ?? null,
        notes: d.notes ?? null,
      })
      .returning();
    const row = inserted[0];
    if (!row) return { ok: false, error: "Insert returned no row" };
    // P14.1 — feed the PLANNER activity stream (same kind the old
    // zone/slot adds used).
    await logActivity(userId, "slot_added", row.id);
    revalidateForRecipe(d.recipeId);
    return { ok: true, data: row };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to add slot",
    };
  }
}

/* ============================================================
   updateSlot — technique / paint|hex / notes patch. Paint vs hex are
   mutually exclusive; the merged row is re-checked for "exactly one set"
   (mirrors updateStep).
   ============================================================ */

export async function updateSlot(
  raw: z.infer<typeof updateSchema>,
): Promise<ActionResult<RecipeSlot>> {
  const parsed = updateSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid update" };
  }
  const { id, ...patch } = parsed.data;
  const userId = await currentUserId();

  const owned = await getSlotWithOwnerCheck(userId, id);
  if (!owned) return { ok: false, error: "Slot not found" };

  const patchValues: Partial<typeof recipeSlots.$inferInsert> = {};
  if (patch.technique !== undefined) patchValues.technique = patch.technique;
  if (patch.notesMd !== undefined) patchValues.notesMd = patch.notesMd ?? null;
  if (patch.notes !== undefined) patchValues.notes = patch.notes ?? null;

  // Setting one of paint/hex clears the other so the invariant survives.
  if (patch.paintId !== undefined && patch.customColorHex !== undefined) {
    if (patch.paintId && patch.customColorHex) {
      return {
        ok: false,
        error: "Provide at most one of paintId or customColorHex",
      };
    }
    patchValues.paintId = patch.paintId ?? null;
    patchValues.customColorHex = patch.customColorHex ?? null;
  } else if (patch.paintId !== undefined) {
    patchValues.paintId = patch.paintId ?? null;
    if (patch.paintId) patchValues.customColorHex = null;
  } else if (patch.customColorHex !== undefined) {
    patchValues.customColorHex = patch.customColorHex ?? null;
    if (patch.customColorHex) patchValues.paintId = null;
  }

  const merged: { paintId: string | null; customColorHex: string | null } = {
    paintId:
      patchValues.paintId !== undefined ? patchValues.paintId : owned.slot.paintId,
    customColorHex:
      patchValues.customColorHex !== undefined
        ? patchValues.customColorHex
        : owned.slot.customColorHex,
  };
  if (Boolean(merged.paintId) === Boolean(merged.customColorHex)) {
    return {
      ok: false,
      error: "Slot must have exactly one of paintId or customColorHex",
    };
  }

  if (Object.keys(patchValues).length === 0) {
    return { ok: true, data: owned.slot };
  }

  try {
    const updated = await db
      .update(recipeSlots)
      .set(patchValues)
      .where(eq(recipeSlots.id, id))
      .returning();
    const row = updated[0];
    if (!row) return { ok: false, error: "Update returned no row" };
    revalidateForRecipe(owned.recipeId);
    return { ok: true, data: row };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to update slot",
    };
  }
}

/* ============================================================
   deleteSlot
   ============================================================ */

export async function deleteSlot(
  raw: z.infer<typeof deleteSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = deleteSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid id" };
  }
  const userId = await currentUserId();
  const owned = await getSlotWithOwnerCheck(userId, parsed.data.id);
  if (!owned) return { ok: false, error: "Slot not found" };

  try {
    await db.delete(recipeSlots).where(eq(recipeSlots.id, owned.slot.id));
    revalidateForRecipe(owned.recipeId);
    return { ok: true, data: { id: owned.slot.id } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to delete slot",
    };
  }
}

/* ============================================================
   reorderSlots — offset-then-final pattern (mirrors reorderZones /
   reorderSteps) so the unique (recipeId, position) index never collides
   mid-reorder.
   ============================================================ */

const REORDER_OFFSET = 10_000;

export async function reorderSlots(
  raw: z.infer<typeof reorderSchema>,
): Promise<ActionResult<{ recipeId: string }>> {
  const parsed = reorderSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid order" };
  }
  const { recipeId, orderedIds } = parsed.data;
  const userId = await currentUserId();

  const owned = await verifyRecipeOwnership(userId, recipeId);
  if (!owned) return { ok: false, error: "Recipe not found" };

  const existing = await db
    .select({ id: recipeSlots.id })
    .from(recipeSlots)
    .where(eq(recipeSlots.recipeId, recipeId));
  const existingIds = new Set(existing.map((s) => s.id));
  if (orderedIds.length !== existingIds.size) {
    return { ok: false, error: "Ordered list does not match recipe slots" };
  }
  for (const id of orderedIds) {
    if (!existingIds.has(id)) {
      return { ok: false, error: "Unknown slot id in ordering" };
    }
  }

  try {
    for (let i = 0; i < orderedIds.length; i += 1) {
      const id = orderedIds[i];
      if (!id) continue;
      await db
        .update(recipeSlots)
        .set({ position: REORDER_OFFSET + i })
        .where(eq(recipeSlots.id, id));
    }
    for (let i = 0; i < orderedIds.length; i += 1) {
      const id = orderedIds[i];
      if (!id) continue;
      await db
        .update(recipeSlots)
        .set({ position: i })
        .where(eq(recipeSlots.id, id));
    }
    revalidateForRecipe(recipeId);
    return { ok: true, data: { recipeId } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to reorder slots",
    };
  }
}
