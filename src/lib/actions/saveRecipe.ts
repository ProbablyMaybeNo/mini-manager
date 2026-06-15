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
}): Promise<ActionResult<{ id: string }>> {
  const userId = await currentUserId();
  let recipeId: string;

  if (input.id && input.id !== "new") {
    const owned = await db
      .select({ id: recipes.id })
      .from(recipes)
      .where(and(eq(recipes.id, input.id), eq(recipes.ownerId, userId)))
      .limit(1);
    if (!owned[0]) return { ok: false, error: "Recipe not found" };
    const upd = await updateRecipe({ id: input.id, name: input.name });
    if (!upd.ok) return upd;
    recipeId = input.id;
    // Replace the slot set wholesale.
    await db.delete(recipeSlots).where(eq(recipeSlots.recipeId, recipeId));
  } else {
    const created = await createRecipe({
      name: input.name,
      attachedProjectId: input.attachedProjectId ?? null,
    });
    if (!created.ok) return created;
    recipeId = created.data.id;
  }

  for (const slot of input.slots) {
    const usePaint = Boolean(slot.paintId);
    const res = await addSlot({
      recipeId,
      technique: toTechnique(slot.layer),
      paintId: usePaint ? slot.paintId : null,
      customColorHex: usePaint ? null : slot.hex,
    });
    if (!res.ok) return res;
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
