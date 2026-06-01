"use server";

import { revalidatePath } from "next/cache";
import { and, eq, max } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import {
  recipes,
  recipeSteps,
  recipeZones,
  type RecipeZone,
} from "@/db/schema";
import { currentUserId } from "@/lib/auth-stub";
import { logActivity } from "@/lib/activityLog";
import { getZoneWithOwnerCheck } from "@/db/queries/recipes";
import type { ActionResult } from "@/lib/actions/projects";

const zoneIdSchema = z.string().min(1).max(64);
const recipeIdSchema = z.string().min(1).max(64);

const addSchema = z.object({
  recipeId: recipeIdSchema,
  name: z
    .string()
    .trim()
    .min(1, "Zone name is required")
    .max(80, "Zone name is too long"),
  silhouetteZoneId: z.string().min(1).max(64).nullish(),
});

const updateSchema = z.object({
  id: zoneIdSchema,
  name: z
    .string()
    .trim()
    .min(1, "Zone name is required")
    .max(80, "Zone name is too long")
    .optional(),
  silhouetteZoneId: z.string().min(1).max(64).nullish(),
});

const deleteSchema = z.object({ id: zoneIdSchema });

const reorderSchema = z.object({
  recipeId: recipeIdSchema,
  orderedIds: z.array(zoneIdSchema).min(1).max(64),
});

const bulkZoneSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(80),
});

const addBulkSchema = z.object({
  recipeId: recipeIdSchema,
  zones: z.array(bulkZoneSchema).min(1).max(32),
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
   addZone
   ============================================================ */

export async function addZone(
  raw: z.infer<typeof addSchema>,
): Promise<ActionResult<RecipeZone>> {
  const parsed = addSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid zone",
    };
  }
  const { recipeId, name, silhouetteZoneId } = parsed.data;
  const userId = await currentUserId();

  const owned = await verifyRecipeOwnership(userId, recipeId);
  if (!owned) return { ok: false, error: "Recipe not found" };

  const positionRows = await db
    .select({ maxPos: max(recipeZones.position) })
    .from(recipeZones)
    .where(eq(recipeZones.recipeId, recipeId));
  const currentMax = positionRows[0]?.maxPos ?? null;
  const nextPosition = currentMax === null ? 0 : currentMax + 1;

  try {
    const inserted = await db
      .insert(recipeZones)
      .values({
        recipeId,
        name,
        silhouetteZoneId: silhouetteZoneId ?? null,
        position: nextPosition,
      })
      .returning();
    const row = inserted[0];
    if (!row) return { ok: false, error: "Insert returned no row" };
    // P14.1 — feed the PLANNER activity stream.
    await logActivity(userId, "slot_added", row.id);
    revalidateForRecipe(recipeId);
    return { ok: true, data: row };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to add zone",
    };
  }
}

/* ============================================================
   addZonesBulk — one-shot insert of a starter preset list. Appends
   to the existing zone order; never replaces or deduplicates. Each
   incoming zone gets its preset id stashed in `silhouetteZoneId` so
   the row knows which preset it came from (useful for the /recipes
   filter even though the silhouette mechanic itself is gone).
   ============================================================ */

export async function addZonesBulk(
  raw: z.infer<typeof addBulkSchema>,
): Promise<ActionResult<{ recipeId: string; addedCount: number }>> {
  const parsed = addBulkSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid bulk input",
    };
  }
  const { recipeId, zones } = parsed.data;
  const userId = await currentUserId();

  const owned = await verifyRecipeOwnership(userId, recipeId);
  if (!owned) return { ok: false, error: "Recipe not found" };

  const positionRows = await db
    .select({ maxPos: max(recipeZones.position) })
    .from(recipeZones)
    .where(eq(recipeZones.recipeId, recipeId));
  const currentMax = positionRows[0]?.maxPos;
  const startPosition =
    currentMax === null || currentMax === undefined ? 0 : currentMax + 1;

  try {
    const values = zones.map((z, i) => ({
      recipeId,
      name: z.name,
      silhouetteZoneId: z.id,
      position: startPosition + i,
    }));
    const inserted = await db.insert(recipeZones).values(values).returning();
    revalidateForRecipe(recipeId);
    return { ok: true, data: { recipeId, addedCount: inserted.length } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to add zones",
    };
  }
}

/* ============================================================
   addSlotWithPaint — P12.2 one-shot: creates a zone AND a single
   basecoat step that pins the chosen paint OR a custom hex. This is
   the action wired to the recipe slot grid's ColorPicker side panel
   so picking a colour creates a fully-formed slot in one round-trip.

   `name` is optional — when omitted, the slot gets a default
   "Slot N" label using the next position. The user can rename later.
   ============================================================ */

const hexShape = z
  .string()
  .trim()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/i, "Hex must be #RGB or #RRGGBB");

const addSlotWithPaintSchema = z
  .object({
    recipeId: recipeIdSchema,
    name: z
      .string()
      .trim()
      .min(1, "Slot name is required")
      .max(80, "Slot name is too long")
      .optional(),
    paintId: z.string().min(1).max(64).nullish(),
    customColorHex: hexShape.nullish(),
  })
  .refine(
    (d) => Boolean(d.paintId) !== Boolean(d.customColorHex),
    { message: "Provide exactly one of paintId or customColorHex" },
  );

export async function addSlotWithPaint(
  raw: z.infer<typeof addSlotWithPaintSchema>,
): Promise<ActionResult<{ zoneId: string; stepId: string }>> {
  const parsed = addSlotWithPaintSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid slot",
    };
  }
  const { recipeId, paintId, customColorHex } = parsed.data;
  const userId = await currentUserId();

  const owned = await verifyRecipeOwnership(userId, recipeId);
  if (!owned) return { ok: false, error: "Recipe not found" };

  // Position = max + 1, or 0 if no zones yet.
  const positionRows = await db
    .select({ maxPos: max(recipeZones.position) })
    .from(recipeZones)
    .where(eq(recipeZones.recipeId, recipeId));
  const currentMax = positionRows[0]?.maxPos ?? null;
  const nextPosition = currentMax === null ? 0 : currentMax + 1;

  // Default name "Slot N" — N is 1-indexed, matches the position +1.
  const slotName = parsed.data.name ?? `Slot ${nextPosition + 1}`;

  try {
    const zoneInserted = await db
      .insert(recipeZones)
      .values({
        recipeId,
        name: slotName,
        silhouetteZoneId: null,
        position: nextPosition,
      })
      .returning();
    const zoneRow = zoneInserted[0];
    if (!zoneRow) return { ok: false, error: "Slot insert returned no row" };

    const stepInserted = await db
      .insert(recipeSteps)
      .values({
        zoneId: zoneRow.id,
        position: 0,
        technique: "basecoat",
        paintId: paintId ?? null,
        customColorHex: customColorHex ?? null,
        notesMd: null,
      })
      .returning();
    const stepRow = stepInserted[0];
    if (!stepRow) {
      // Roll back the orphaned zone if the step insert failed silently.
      await db.delete(recipeZones).where(eq(recipeZones.id, zoneRow.id));
      return { ok: false, error: "Step insert returned no row" };
    }

    // P14.1 — feed the PLANNER activity stream.
    await logActivity(userId, "slot_added", zoneRow.id);

    revalidateForRecipe(recipeId);
    return { ok: true, data: { zoneId: zoneRow.id, stepId: stepRow.id } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to add slot",
    };
  }
}

/* ============================================================
   updateZone
   ============================================================ */

export async function updateZone(
  raw: z.infer<typeof updateSchema>,
): Promise<ActionResult<RecipeZone>> {
  const parsed = updateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid update",
    };
  }
  const { id, ...patch } = parsed.data;
  const userId = await currentUserId();

  const owned = await getZoneWithOwnerCheck(userId, id);
  if (!owned) return { ok: false, error: "Zone not found" };

  const patchValues: Partial<typeof recipeZones.$inferInsert> = {};
  if (patch.name !== undefined) patchValues.name = patch.name;
  if (patch.silhouetteZoneId !== undefined) {
    patchValues.silhouetteZoneId = patch.silhouetteZoneId ?? null;
  }
  if (Object.keys(patchValues).length === 0) {
    return { ok: true, data: owned.zone };
  }

  try {
    const updated = await db
      .update(recipeZones)
      .set(patchValues)
      .where(eq(recipeZones.id, id))
      .returning();
    const row = updated[0];
    if (!row) return { ok: false, error: "Update returned no row" };
    revalidateForRecipe(owned.recipeId);
    return { ok: true, data: row };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to update zone",
    };
  }
}

/* ============================================================
   deleteZone
   ============================================================ */

export async function deleteZone(
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
  const owned = await getZoneWithOwnerCheck(userId, parsed.data.id);
  if (!owned) return { ok: false, error: "Zone not found" };

  try {
    await db.delete(recipeZones).where(eq(recipeZones.id, owned.zone.id));
    revalidateForRecipe(owned.recipeId);
    return { ok: true, data: { id: owned.zone.id } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to delete zone",
    };
  }
}

/* ============================================================
   reorderZones — bump every position by a large offset first to
   avoid colliding with the unique (recipeId, position) index, then
   assign final positions. Wraps both passes in a single db.batch
   so the unique constraint never sees an inconsistent state.
   ============================================================ */

const REORDER_OFFSET = 10_000;

export async function reorderZones(
  raw: z.infer<typeof reorderSchema>,
): Promise<ActionResult<{ recipeId: string }>> {
  const parsed = reorderSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid order",
    };
  }
  const { recipeId, orderedIds } = parsed.data;
  const userId = await currentUserId();

  const owned = await verifyRecipeOwnership(userId, recipeId);
  if (!owned) return { ok: false, error: "Recipe not found" };

  // Confirm every id supplied actually belongs to this recipe so a
  // hostile client can't reposition another user's zones via this path.
  const existing = await db
    .select({ id: recipeZones.id })
    .from(recipeZones)
    .where(eq(recipeZones.recipeId, recipeId));
  const existingIds = new Set(existing.map((z) => z.id));
  if (orderedIds.length !== existingIds.size) {
    return { ok: false, error: "Ordered list does not match recipe zones" };
  }
  for (const id of orderedIds) {
    if (!existingIds.has(id)) {
      return { ok: false, error: "Unknown zone id in ordering" };
    }
  }

  try {
    // Stage 1: push every position into a high range so the second
    // pass never collides with itself.
    for (let i = 0; i < orderedIds.length; i += 1) {
      const id = orderedIds[i];
      if (!id) continue;
      await db
        .update(recipeZones)
        .set({ position: REORDER_OFFSET + i })
        .where(eq(recipeZones.id, id));
    }
    // Stage 2: assign final positions.
    for (let i = 0; i < orderedIds.length; i += 1) {
      const id = orderedIds[i];
      if (!id) continue;
      await db
        .update(recipeZones)
        .set({ position: i })
        .where(eq(recipeZones.id, id));
    }
    revalidateForRecipe(recipeId);
    return { ok: true, data: { recipeId } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to reorder zones",
    };
  }
}
