"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { clsx } from "clsx";
import type { Recipe } from "@/db/schema";
import { detachRecipe } from "@/lib/actions/recipes";
import { Button } from "@/components/ui/Button";

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
 * workspace beneath the named-models panel. Includes a Detach action
 * that clears the attachment (the recipe itself survives — goes back to
 * standalone) and Edit that links to the editor.
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
          className="font-mono text-sm text-[var(--color-cyan)] hover:underline"
          style={{
            textShadow:
              "0 0 6px color-mix(in srgb, var(--color-cyan) 30%, transparent)",
          }}
        >
          {recipe.name}
        </Link>
        <span className="flex items-center gap-2">
          <Button as="a" href={editHref} variant="secondary" size="sm">
            Edit
          </Button>
          <Button
            type="button"
            onClick={handleDetach}
            disabled={isPending}
            variant="ghost"
            size="sm"
          >
            Detach
          </Button>
        </span>
      </div>

      {zones.length === 0 ? (
        <p className="text-2xs font-sans text-[var(--color-fg-muted)]">
          No colour slots yet. <Link href={editHref} className="hover:underline text-[var(--color-cyan)]">Open the editor</Link> to start building.
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
