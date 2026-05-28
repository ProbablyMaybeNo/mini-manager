"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import type { Recipe } from "@/db/schema";
import { detachRecipe } from "@/lib/actions/recipes";

interface ZoneSlim {
  id: string;
  name: string;
  silhouetteZoneId: string | null;
  stepCount: number;
  swatchHex: string | null;
}

interface Props {
  recipe: Recipe;
  zones: ReadonlyArray<ZoneSlim>;
}

/**
 * Compact override summary shown inside a NamedModelRow expand area.
 * Renders the override recipe's name + a tight palette strip + a
 * `[ Reset to unit recipe ]` link that detaches.
 */
export function NamedModelOverrideSummary({ recipe, zones }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleReset = () => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `Reset this model to use the unit's recipe? The override "${recipe.name}" will become standalone.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      await detachRecipe({ recipeId: recipe.id });
      router.refresh();
    });
  };

  const swatches = zones
    .map((z) => z.swatchHex)
    .filter((hex): hex is string => Boolean(hex))
    .slice(0, 6);

  return (
    <div
      className={clsx(
        "flex items-center justify-between gap-3 text-2xs font-mono",
        isPending && "opacity-70",
      )}
    >
      <Link
        href={`/recipes/${recipe.id}`}
        className="flex items-center gap-2 hover:underline text-[var(--color-cyan)] truncate min-w-0"
      >
        <span className="uppercase tracking-wider shrink-0">override:</span>
        <span className="truncate">{recipe.name}</span>
        {swatches.length > 0 ? (
          <span className="flex items-center gap-0.5 shrink-0 ml-1">
            {swatches.map((hex, idx) => (
              <span
                key={`${hex}-${idx}`}
                aria-hidden
                className="inline-block w-2.5 h-2.5 rounded-sm border"
                style={{
                  background: hex,
                  borderColor: "var(--color-border-strong)",
                }}
              />
            ))}
          </span>
        ) : null}
      </Link>
      <button
        type="button"
        onClick={handleReset}
        disabled={isPending}
        className={clsx(
          "text-[var(--color-fg-subtle)] hover:text-[var(--color-amber)] tap-target px-2 shrink-0",
          isPending && "cursor-progress",
        )}
      >
        [ reset ]
      </button>
    </div>
  );
}
