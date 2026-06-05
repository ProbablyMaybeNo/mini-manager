"use server";

import { revalidatePath } from "next/cache";
import { and, eq, max } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { recipeInspo, recipes, type RecipeInspo } from "@/db/schema";
import { currentUserId } from "@/lib/auth-stub";
import type { ActionResult } from "@/lib/actions/projects";

/**
 * Recipe inspo actions (item 4).
 *
 * Inspo rows are a flat, contained child of a recipe: each row is one
 * reference link / image URL the painter saved (a technique tutorial,
 * a reference photo). Add appends at the end; delete removes one row.
 * Same ownership-check + revalidate discipline as recipeSlots.
 */

const recipeIdSchema = z.string().min(1).max(64);
const inspoIdSchema = z.string().min(1).max(64);

const addSchema = z.object({
  recipeId: recipeIdSchema,
  url: z.string().trim().url("Enter a valid URL (http/https)").max(2048),
  label: z.string().trim().max(200).optional(),
});

const deleteSchema = z.object({ id: inspoIdSchema });

function revalidateForRecipe(recipeId: string) {
  revalidatePath(`/recipes/${recipeId}`);
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

/** Resolve the inspo row's owning recipe with an ownership check. */
async function getInspoWithOwnerCheck(
  userId: string,
  inspoId: string,
): Promise<{ row: RecipeInspo; recipeId: string } | null> {
  const rows = await db
    .select({ inspo: recipeInspo, ownerId: recipes.ownerId })
    .from(recipeInspo)
    .innerJoin(recipes, eq(recipeInspo.recipeId, recipes.id))
    .where(eq(recipeInspo.id, inspoId))
    .limit(1);
  const found = rows[0];
  if (!found || found.ownerId !== userId) return null;
  return { row: found.inspo, recipeId: found.inspo.recipeId };
}

export async function addInspo(
  raw: z.infer<typeof addSchema>,
): Promise<ActionResult<RecipeInspo>> {
  const parsed = addSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid inspo" };
  }
  const d = parsed.data;
  const userId = await currentUserId();

  const [owned, positionRows] = await Promise.all([
    verifyRecipeOwnership(userId, d.recipeId),
    db
      .select({ maxPos: max(recipeInspo.position) })
      .from(recipeInspo)
      .where(eq(recipeInspo.recipeId, d.recipeId)),
  ]);
  if (!owned) return { ok: false, error: "Recipe not found" };

  const currentMax = positionRows[0]?.maxPos ?? null;
  const nextPosition = currentMax === null ? 0 : currentMax + 1;

  try {
    const inserted = await db
      .insert(recipeInspo)
      .values({
        recipeId: d.recipeId,
        position: nextPosition,
        url: d.url,
        label: d.label && d.label.length > 0 ? d.label : null,
      })
      .returning();
    const row = inserted[0];
    if (!row) return { ok: false, error: "Insert returned no row" };
    revalidateForRecipe(d.recipeId);
    return { ok: true, data: row };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to add inspo",
    };
  }
}

export async function deleteInspo(
  raw: z.infer<typeof deleteSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = deleteSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid id" };
  }
  const userId = await currentUserId();
  const owned = await getInspoWithOwnerCheck(userId, parsed.data.id);
  if (!owned) return { ok: false, error: "Inspo not found" };

  try {
    await db.delete(recipeInspo).where(eq(recipeInspo.id, owned.row.id));
    revalidateForRecipe(owned.recipeId);
    return { ok: true, data: { id: owned.row.id } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to delete inspo",
    };
  }
}
