import Link from "next/link";
import type { Recipe } from "@/db/schema";
import {
  getRecipeWithZones,
  paletteForRecipe,
} from "@/db/queries/recipes";
import { currentUserId } from "@/lib/auth-stub";

interface AttachmentLabel {
  kind: "project" | "named-model" | "standalone";
  label: string;
}

interface Props {
  recipe: Recipe;
  attachment: AttachmentLabel;
}

const MAX_SWATCHES = 8;

/**
 * Server component card — one per recipe, used in the standalone +
 * attached-to-project + attached-to-named-model sections of /recipes.
 *
 * Loads the recipe's zones + palette internally so the parent page
 * can stay slim. Recipe lists in the user's catalog are short (tens,
 * not thousands), so per-card queries are fine.
 */
export async function RecipeCard({ recipe, attachment }: Props) {
  const userId = await currentUserId();
  const full = await getRecipeWithZones(userId, recipe.id);
  const palette = full ? await paletteForRecipe(full) : new Map<string, string>();

  const swatchesAll = full
    ? full.zones
        .map((z) => {
          const first = z.steps[0];
          if (first?.customColorHex) return first.customColorHex;
          if (first?.paintId) {
            const key = z.silhouetteZoneId ?? z.id;
            return palette.get(key) ?? null;
          }
          return null;
        })
        .filter((hex): hex is string => Boolean(hex))
    : [];
  const swatches = swatchesAll.slice(0, MAX_SWATCHES);
  const overflow = Math.max(0, swatchesAll.length - MAX_SWATCHES);

  const zoneCount = full?.zones.length ?? 0;
  const stepCount = full
    ? full.zones.reduce((acc, z) => acc + z.steps.length, 0)
    : 0;

  const attachmentTone =
    attachment.kind === "standalone"
      ? "text-[var(--color-fg-muted)]"
      : "text-[var(--color-cyan)]";

  return (
    <Link
      href={`/recipes/${recipe.id}`}
      className="frame p-4 space-y-3 hover:border-[var(--color-accent)] hover:bg-[color-mix(in_srgb,var(--color-fg)_3%,transparent)] transition-colors flex flex-col h-full"
    >
      <div className="space-y-1">
        <h3
          className="font-mono text-base text-[var(--color-cyan)] truncate"
          style={{
            textShadow:
              "0 0 6px color-mix(in srgb, var(--color-cyan) 30%, transparent)",
          }}
        >
          {recipe.name}
        </h3>
        <div className="flex items-center gap-3 text-2xs font-mono uppercase tracking-wider">
          <span className="frame px-2 py-0.5 text-[var(--color-fg-muted)]">
            {recipe.bodyType}
          </span>
          <span className={attachmentTone}>
            {attachment.kind === "standalone"
              ? "[ standalone ]"
              : `[ ${attachment.label} ]`}
          </span>
        </div>
      </div>

      {swatches.length > 0 ? (
        <div className="flex items-center gap-1 flex-wrap">
          {swatches.map((hex, idx) => (
            <span
              key={`${hex}-${idx}`}
              aria-hidden
              className="inline-block w-4 h-4 rounded-sm border"
              style={{
                background: hex,
                borderColor: "var(--color-border-strong)",
              }}
              title={hex}
            />
          ))}
          {overflow > 0 ? (
            <span className="text-2xs font-mono text-[var(--color-fg-muted)] tracking-wider ml-1">
              +{overflow}
            </span>
          ) : null}
        </div>
      ) : (
        <p className="text-2xs font-mono text-[var(--color-fg-subtle)] uppercase tracking-wider">
          empty — no zones yet
        </p>
      )}

      <p className="text-2xs font-mono text-[var(--color-fg-muted)] uppercase tracking-wider mt-auto">
        {stepCount} step{stepCount === 1 ? "" : "s"} ·{" "}
        {zoneCount} zone{zoneCount === 1 ? "" : "s"}
      </p>
    </Link>
  );
}
