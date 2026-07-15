"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { recipes, recipeSlots, recipeInspo, type TechniqueKey } from "@/db/schema";
import { currentUserId } from "@/lib/auth-stub";
import { createRecipe, updateRecipe } from "@/lib/actions/recipes";
import { addSlot } from "@/lib/actions/recipeSlots";
import type { ActionResult } from "@/lib/actions/projects";

/** Free-text kit "layer" label → backend technique key (default basecoat). */
const LAYER_TO_TECHNIQUE: Record<string, TechniqueKey> = {
  undercoat: "undercoat",
  basecoat: "basecoat",
  base: "basecoat",
  midcoat: "midcoat",
  highlight: "highlight",
  "edge highlight": "edge_highlight",
  edge_highlight: "edge_highlight",
  wash: "wash",
  shade: "wash",
  detail: "detail",
  metallic: "metallic",
  layer: "layer",
  drybrush: "drybrush",
  glaze: "glaze",
  stipple: "stipple",
};

function toTechnique(layer: string): TechniqueKey {
  return LAYER_TO_TECHNIQUE[layer.trim().toLowerCase()] ?? "basecoat";
}

export interface SaveRecipeSlot {
  /** Real catalog paint id, or null for a custom-colour slot. */
  paintId: string | null;
  hex: string;
  layer: string;
}

/** Append `slots` to `recipeId` in order via addSlot (which validates each
 *  slot + assigns positions). Returns the first failure, if any. */
async function insertSlots(
  recipeId: string,
  slots: SaveRecipeSlot[],
): Promise<ActionResult<null>> {
  for (const slot of slots) {
    const usePaint = Boolean(slot.paintId);
    const res = await addSlot({
      recipeId,
      technique: toTechnique(slot.layer),
      paintId: usePaint ? slot.paintId : null,
      customColorHex: usePaint ? null : slot.hex,
    });
    if (!res.ok) return res;
  }
  return { ok: true, data: null };
}

/**
 * REBUILD — persist the kit recipe editor's whole edited recipe in one call.
 * The editor edits name + an ordered slot list client-side; this creates or
 * renames the recipe, then replaces its slots wholesale (the editor IS the
 * source of truth on save). Each slot persists as a catalog-paint slot
 * (paintId) or a custom-colour slot (customColorHex), technique mapped from
 * the free-text layer label.
 */
export async function saveRecipe(input: {
  id: string | null;
  name: string;
  attachedProjectId?: string | null;
  slots: SaveRecipeSlot[];
  /** Inspiration URLs, in order. Omit to leave existing inspo untouched;
   *  pass an array (even empty) to replace the recipe's inspo wholesale. */
  inspo?: string[];
  /** Recipe-level notes (the editor's NOTES panel). Omit to leave the
   *  existing value untouched; pass a string (even empty) to replace it —
   *  an empty string is stored as null. */
  notesMd?: string | null;
}): Promise<ActionResult<{ id: string }>> {
  const userId = await currentUserId();
  let recipeId: string;
  const notesMd =
    input.notesMd !== undefined
      ? (input.notesMd?.trim() ? input.notesMd : null)
      : undefined;

  if (input.id && input.id !== "new") {
    const owned = await db
      .select({ id: recipes.id })
      .from(recipes)
      .where(and(eq(recipes.id, input.id), eq(recipes.ownerId, userId)))
      .limit(1);
    if (!owned[0]) return { ok: false, error: "Recipe not found" };
    const upd = await updateRecipe({ id: input.id, name: input.name, notesMd });
    if (!upd.ok) return upd;
    recipeId = input.id;

    // Snapshot the current slots BEFORE the wholesale delete + re-insert so a
    // single bad slot can't truncate the saved recipe. The delete/insert pair
    // is not atomic here, so on any failure we restore the original set and
    // surface the error rather than leaving the recipe emptied (E1).
    const slotSnapshot = await db
      .select()
      .from(recipeSlots)
      .where(eq(recipeSlots.recipeId, recipeId));
    await db.delete(recipeSlots).where(eq(recipeSlots.recipeId, recipeId));

    const replaced = await insertSlots(recipeId, input.slots);
    if (!replaced.ok) {
      await db.delete(recipeSlots).where(eq(recipeSlots.recipeId, recipeId));
      if (slotSnapshot.length > 0) {
        await db.insert(recipeSlots).values(slotSnapshot);
      }
      return replaced;
    }
  } else {
    const created = await createRecipe({
      name: input.name,
      attachedProjectId: input.attachedProjectId ?? null,
      notesMd,
    });
    if (!created.ok) return created;
    recipeId = created.data.id;

    const replaced = await insertSlots(recipeId, input.slots);
    if (!replaced.ok) {
      // Roll back the half-created recipe (cascades slots) so a failed create
      // never leaves a partial recipe behind.
      await db.delete(recipes).where(eq(recipes.id, recipeId));
      return replaced;
    }
  }

  // Replace the inspo set wholesale when the caller supplies one (the
  // editor is the source of truth on save). Stored in array order.
  if (input.inspo !== undefined) {
    await db.delete(recipeInspo).where(eq(recipeInspo.recipeId, recipeId));
    const urls = input.inspo.map((u) => u.trim()).filter(Boolean);
    for (let i = 0; i < urls.length; i++) {
      await db
        .insert(recipeInspo)
        .values({ recipeId, position: i, url: urls[i] });
    }
  }

  revalidatePath("/recipes");
  revalidatePath(`/recipes/${recipeId}`);
  return { ok: true, data: { id: recipeId } };
}
