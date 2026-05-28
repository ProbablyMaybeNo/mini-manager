"use server";

import { revalidatePath } from "next/cache";
import { eq, max } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { recipeSteps, techniqueKeys, type RecipeStep } from "@/db/schema";
import { currentUserId } from "@/lib/auth-stub";
import {
  getStepWithOwnerCheck,
  getZoneWithOwnerCheck,
} from "@/db/queries/recipes";
import type { ActionResult } from "@/lib/actions/projects";

const stepIdSchema = z.string().min(1).max(64);
const zoneIdSchema = z.string().min(1).max(64);

/** 3, 6, or 8-char hex with leading #. Validates the painter's
 *  manual entry without depending on a regex engine outside
 *  Zod. */
const hexSchema = z
  .string()
  .trim()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/i, "Hex must be #RGB, #RRGGBB, or #RRGGBBAA");

const addSchema = z
  .object({
    zoneId: zoneIdSchema,
    technique: z.enum(techniqueKeys),
    paintId: z.string().min(1).max(64).nullish(),
    customColorHex: hexSchema.nullish(),
    notesMd: z.string().max(10_000).nullish(),
  })
  .refine(
    (d) => Boolean(d.paintId) !== Boolean(d.customColorHex),
    { message: "Provide exactly one of paintId or customColorHex" },
  );

const updateSchema = z
  .object({
    id: stepIdSchema,
    technique: z.enum(techniqueKeys).optional(),
    paintId: z.string().min(1).max(64).nullish(),
    customColorHex: hexSchema.nullish(),
    notesMd: z.string().max(10_000).nullish(),
  })
  .refine(
    (d) => {
      // If both paintId and customColorHex are being patched in the
      // same call, at most one can be a non-null value. Patching only
      // one side at a time is fine — the "exactly one is set" invariant
      // is rechecked against the merged row below.
      if (d.paintId && d.customColorHex) return false;
      return true;
    },
    { message: "Provide at most one of paintId or customColorHex" },
  );

const deleteSchema = z.object({ id: stepIdSchema });

const reorderSchema = z.object({
  zoneId: zoneIdSchema,
  orderedIds: z.array(stepIdSchema).min(1).max(64),
});

function revalidateForRecipe(recipeId: string) {
  revalidatePath(`/recipes/${recipeId}`);
  revalidatePath("/recipes");
}

/* ============================================================
   addStep
   ============================================================ */

export async function addStep(
  raw: z.infer<typeof addSchema>,
): Promise<ActionResult<RecipeStep>> {
  const parsed = addSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid step",
    };
  }
  const d = parsed.data;
  const userId = await currentUserId();

  const owned = await getZoneWithOwnerCheck(userId, d.zoneId);
  if (!owned) return { ok: false, error: "Zone not found" };

  const positionRows = await db
    .select({ maxPos: max(recipeSteps.position) })
    .from(recipeSteps)
    .where(eq(recipeSteps.zoneId, d.zoneId));
  const currentMax = positionRows[0]?.maxPos ?? null;
  const nextPosition = currentMax === null ? 0 : currentMax + 1;

  try {
    const inserted = await db
      .insert(recipeSteps)
      .values({
        zoneId: d.zoneId,
        position: nextPosition,
        technique: d.technique,
        paintId: d.paintId ?? null,
        customColorHex: d.customColorHex ?? null,
        notesMd: d.notesMd ?? null,
      })
      .returning();
    const row = inserted[0];
    if (!row) return { ok: false, error: "Insert returned no row" };
    revalidateForRecipe(owned.recipeId);
    return { ok: true, data: row };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to add step",
    };
  }
}

/* ============================================================
   updateStep
   ============================================================ */

export async function updateStep(
  raw: z.infer<typeof updateSchema>,
): Promise<ActionResult<RecipeStep>> {
  const parsed = updateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid update",
    };
  }
  const { id, ...patch } = parsed.data;
  const userId = await currentUserId();

  const owned = await getStepWithOwnerCheck(userId, id);
  if (!owned) return { ok: false, error: "Step not found" };

  const patchValues: Partial<typeof recipeSteps.$inferInsert> = {};
  if (patch.technique !== undefined) patchValues.technique = patch.technique;
  if (patch.notesMd !== undefined) {
    patchValues.notesMd = patch.notesMd ?? null;
  }

  // Paint vs custom-hex updates are mutually exclusive — setting one
  // clears the other so the "exactly one set" invariant survives.
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

  // Validate the merged row would still satisfy "exactly one set".
  const merged: { paintId: string | null; customColorHex: string | null } = {
    paintId:
      patchValues.paintId !== undefined ? patchValues.paintId : owned.step.paintId,
    customColorHex:
      patchValues.customColorHex !== undefined
        ? patchValues.customColorHex
        : owned.step.customColorHex,
  };
  if (Boolean(merged.paintId) === Boolean(merged.customColorHex)) {
    return {
      ok: false,
      error: "Step must have exactly one of paintId or customColorHex",
    };
  }

  if (Object.keys(patchValues).length === 0) {
    return { ok: true, data: owned.step };
  }

  try {
    const updated = await db
      .update(recipeSteps)
      .set(patchValues)
      .where(eq(recipeSteps.id, id))
      .returning();
    const row = updated[0];
    if (!row) return { ok: false, error: "Update returned no row" };
    revalidateForRecipe(owned.recipeId);
    return { ok: true, data: row };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to update step",
    };
  }
}

/* ============================================================
   deleteStep
   ============================================================ */

export async function deleteStep(
  raw: z.infer<typeof deleteSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = deleteSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid id",
    };
  }
  const userId = await currentUserId();
  const owned = await getStepWithOwnerCheck(userId, parsed.data.id);
  if (!owned) return { ok: false, error: "Step not found" };

  try {
    await db.delete(recipeSteps).where(eq(recipeSteps.id, owned.step.id));
    revalidateForRecipe(owned.recipeId);
    return { ok: true, data: { id: owned.step.id } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to delete step",
    };
  }
}

/* ============================================================
   reorderSteps — same offset-then-final pattern as reorderZones.
   ============================================================ */

const REORDER_OFFSET = 10_000;

export async function reorderSteps(
  raw: z.infer<typeof reorderSchema>,
): Promise<ActionResult<{ zoneId: string }>> {
  const parsed = reorderSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid order",
    };
  }
  const { zoneId, orderedIds } = parsed.data;
  const userId = await currentUserId();

  const owned = await getZoneWithOwnerCheck(userId, zoneId);
  if (!owned) return { ok: false, error: "Zone not found" };

  const existing = await db
    .select({ id: recipeSteps.id })
    .from(recipeSteps)
    .where(eq(recipeSteps.zoneId, zoneId));
  const existingIds = new Set(existing.map((s) => s.id));
  if (orderedIds.length !== existingIds.size) {
    return { ok: false, error: "Ordered list does not match zone steps" };
  }
  for (const id of orderedIds) {
    if (!existingIds.has(id)) {
      return { ok: false, error: "Unknown step id in ordering" };
    }
  }

  try {
    for (let i = 0; i < orderedIds.length; i += 1) {
      const id = orderedIds[i];
      if (!id) continue;
      await db
        .update(recipeSteps)
        .set({ position: REORDER_OFFSET + i })
        .where(eq(recipeSteps.id, id));
    }
    for (let i = 0; i < orderedIds.length; i += 1) {
      const id = orderedIds[i];
      if (!id) continue;
      await db
        .update(recipeSteps)
        .set({ position: i })
        .where(eq(recipeSteps.id, id));
    }
    revalidateForRecipe(owned.recipeId);
    return { ok: true, data: { zoneId } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to reorder steps",
    };
  }
}
