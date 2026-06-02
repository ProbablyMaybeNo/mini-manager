"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { clsx } from "clsx";
import { Button } from "@/components/ui/Button";

export interface RecipeTab {
  id: string;
  name: string;
}

interface Props {
  /** Attached recipes in display order (most-recently-updated first
   *  per the FocusPanel query). Caller is responsible for ordering. */
  recipes: ReadonlyArray<RecipeTab>;
  /** Currently active recipe id. */
  activeId: string;
  /** Search-param key the recipe id is persisted to. Default
   *  `focusRecipe` for the dashboard FOCUS panel; the leaf workspace's
   *  COLOR SCHEME box uses `recipe` so the param scopes per-surface. */
  paramKey?: string;
  /** Accessible label for the tab strip. */
  label?: string;
}

/**
 * UX-907 — Horizontal segmented tab strip for projects with 2+
 * attached recipes. Renders nothing for the single-recipe case so the
 * existing zero-tab layout is preserved.
 *
 * The active tab ships as a solid-fill success button (matches the
 * FOCUS card's green accent); inactive tabs drop to `tone="outline"`.
 * Cyan is deliberately avoided per the P13.1 + R11 prohibitions —
 * cyan is the recipe-system anchor colour, reserved for the recipe
 * card chrome itself, not the tab affordance.
 *
 * Tab clicks write the selected recipe id into the URL search params
 * via `router.replace` so reloads + back/forward survive, AND the
 * dashboard remembers which recipe the painter was last working with
 * when they navigate away + return. The chosen id is the only
 * client-visible state — the server reads `searchParams.focusRecipe`
 * and re-renders the bundle accordingly.
 */
export function RecipeTabs({
  recipes,
  activeId,
  paramKey = "focusRecipe",
  label = "Recipe tabs",
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  if (recipes.length < 2) return null;

  const select = (recipeId: string) => {
    if (recipeId === activeId) return;
    const next = new URLSearchParams(searchParams?.toString() ?? "");
    next.set(paramKey, recipeId);
    startTransition(() => {
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    });
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      className={clsx(
        "flex flex-wrap items-center gap-2",
        pending && "opacity-80",
      )}
    >
      {recipes.map((r) => {
        const isActive = r.id === activeId;
        return (
          <Button
            key={r.id}
            type="button"
            variant="success"
            size="sm"
            tone={isActive ? "solid" : "outline"}
            aria-selected={isActive}
            role="tab"
            data-recipe-id={r.id}
            onClick={() => select(r.id)}
            disabled={pending}
          >
            {r.name}
          </Button>
        );
      })}
    </div>
  );
}
