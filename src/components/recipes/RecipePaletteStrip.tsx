import { currentUserId } from "@/lib/auth-stub";
import { paletteStripForRecipe } from "@/db/queries/recipes";

interface Props {
  recipeId: string;
  /** Soft cap on number of swatches rendered. */
  slots?: number;
  ariaLabel?: string;
}

/**
 * Tiny inline palette of 16px swatches. Used in project rows + the
 * dashboard's Active cards. For a multi-row list, prefer the
 * `paletteStripsForRecipes` bulk query in the parent + render the
 * RecipePaletteStripStatic variant — avoids N+1 queries when the page
 * has many rows.
 */
export async function RecipePaletteStrip({
  recipeId,
  slots = 8,
  ariaLabel,
}: Props) {
  const userId = await currentUserId();
  const swatches = await paletteStripForRecipe(userId, recipeId, slots);
  return (
    <RecipePaletteStripStatic
      swatches={swatches}
      ariaLabel={ariaLabel ?? "Recipe palette"}
    />
  );
}

/**
 * Render-only variant — caller supplies the already-resolved swatch
 * hex array. Use this from any page that's already done a bulk palette
 * query, so each row doesn't trigger its own SQL round-trip.
 */
export function RecipePaletteStripStatic({
  swatches,
  ariaLabel = "Recipe palette",
}: {
  swatches: ReadonlyArray<string>;
  ariaLabel?: string;
}) {
  if (swatches.length === 0) return null;
  return (
    <span
      aria-label={ariaLabel}
      className="inline-flex items-center gap-0.5 align-middle"
    >
      {swatches.map((hex, idx) => (
        <span
          key={`${hex}-${idx}`}
          aria-hidden
          className="inline-block w-4 h-4 border"
          style={{
            background: hex,
            borderColor: "var(--color-border)",
          }}
        />
      ))}
    </span>
  );
}
