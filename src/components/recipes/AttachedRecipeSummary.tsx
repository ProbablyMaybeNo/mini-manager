"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";
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
  editHref: Route;
}

/**
 * Read-only inline summary of an attached recipe. Lives in the project
 * workspace beneath the named-models panel. Includes a `[ Detach ]`
 * action that clears the attachment (the recipe itself survives —
 * goes back to standalone) and `[ Edit recipe ]` that links to the
 * editor.
 */
export function AttachedRecipeSummary({ recipe, zones, editHref }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleDetach = () => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `Detach "${recipe.name}" from this project? The recipe will be saved as standalone.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      await detachRecipe({ recipeId: recipe.id });
      router.refresh();
    });
  };

  return (
    <div
      className={clsx(
        "frame px-3 py-3 space-y-2",
        isPending && "opacity-70",
      )}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link
          href={editHref}
          className="font-mono text-sm text-[var(--color-green)] hover:underline"
          style={{
            textShadow:
              "0 0 6px color-mix(in srgb, var(--color-green) 30%, transparent)",
          }}
        >
          {recipe.name}
        </Link>
        <span className="flex items-center gap-3 text-2xs font-mono uppercase tracking-wider">
          <Link
            href={editHref}
            className="text-[var(--color-cyan)] hover:underline tap-target px-2"
          >
            [ edit ]
          </Link>
          <button
            type="button"
            onClick={handleDetach}
            disabled={isPending}
            className={clsx(
              "text-[var(--color-fg-subtle)] hover:text-[var(--color-amber)] tap-target px-2",
              isPending && "cursor-progress",
            )}
          >
            [ detach ]
          </button>
        </span>
      </div>

      {zones.length === 0 ? (
        <p className="text-2xs font-sans text-[var(--color-fg-muted)]">
          No zones yet. <Link href={editHref} className="hover:underline text-[var(--color-cyan)]">Open the editor</Link> to start building.
        </p>
      ) : (
        <ul role="list" className="grid grid-cols-2 gap-x-3 gap-y-1.5">
          {zones.map((z) => (
            <li key={z.id} className="flex items-center gap-2">
              <span
                aria-hidden
                className="inline-block w-3.5 h-3.5 rounded-sm border shrink-0"
                style={{
                  background: z.swatchHex ?? "transparent",
                  borderColor: "var(--color-border-strong)",
                }}
              />
              <span className="text-2xs font-mono truncate text-[var(--color-fg)]">
                {z.name}
              </span>
              <span className="text-2xs font-mono text-[var(--color-fg-subtle)] tracking-wider">
                · {z.stepCount}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
