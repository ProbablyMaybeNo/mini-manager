import type { RecipeSlot as DbRecipeSlot } from "@/db/schema";
import type { RecipeWithSlots } from "@/lib/recipes/types";
import { techniqueLabel } from "@/lib/recipes/technique";
import type { Paint as CatalogPaint } from "@/lib/paints/types";
import type { Recipe, RecipeSlot } from "@/lib/types";

export function toRecipeSlot(
  s: DbRecipeSlot,
  catalogById: ReadonlyMap<string, CatalogPaint>,
): RecipeSlot {
  const paint = s.paintId ? catalogById.get(s.paintId) : undefined;
  const swatch = paint?.hex ?? s.customColorHex ?? "#000000";
  const note = s.notes ?? s.notesMd ?? undefined;
  return {
    paintId: s.paintId ?? "",
    swatch,
    brand: paint?.brand ?? (s.customColorHex ? "Custom" : ""),
    name: paint?.name ?? s.customColorHex ?? "Custom mix",
    layer: techniqueLabel(s.technique),
    ...(note ? { note } : {}),
  };
}

export function toRecipe(
  r: RecipeWithSlots,
  inspoUrls: ReadonlyArray<string>,
  catalogById: ReadonlyMap<string, CatalogPaint>,
): Recipe {
  return {
    id: r.id,
    name: r.name,
    slots: [...r.slots]
      .sort((a, b) => a.position - b.position)
      .map((s) => toRecipeSlot(s, catalogById)),
    inspoLinks: [...inspoUrls],
    ...(r.attachedProjectId ? { assignedProjectId: r.attachedProjectId } : {}),
    ...(r.publicSlug ? { shareUrl: `/r/${r.publicSlug}` } : {}),
    ...(r.notesMd ? { notes: r.notesMd } : {}),
  };
}
