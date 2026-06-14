"use client";

import { ModalDialog, Swatch } from "@/components/kit";

export interface RecipePickerOption {
  id: string;
  name: string;
  swatches: string[];
}

/**
 * Pick one of the painter's recipes. Unlike {@link AssignToRecipeDialog}
 * (which sends a palette *into* a recipe), this just returns the chosen
 * recipe id — used to attach a recipe to a collection paint.
 */
export function RecipePickerDialog({
  open,
  recipes,
  onPick,
  onClose,
  busy = false,
}: {
  open: boolean;
  recipes: RecipePickerOption[];
  onPick: (recipeId: string) => void;
  onClose: () => void;
  busy?: boolean;
}) {
  return (
    <ModalDialog open={open} onClose={onClose} title="Attach a recipe" breadcrumb="COLLECTION">
      {recipes.length === 0 ? (
        <p className="font-mono text-xs text-fg-faint">
          No recipes yet — create one from the Recipes tab first.
        </p>
      ) : (
        <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
          {recipes.map((r) => (
            <button
              key={r.id}
              type="button"
              disabled={busy}
              onClick={() => onPick(r.id)}
              className="flex items-center justify-between gap-3 border border-cyan/30 px-3 py-2 text-left font-mono text-sm text-fg hover:border-cyan hover:bg-cyan/10 disabled:opacity-50"
            >
              <span className="truncate">{r.name}</span>
              <span className="inline-flex shrink-0 gap-0.5">
                {r.swatches.slice(0, 6).map((hex, i) => (
                  <Swatch key={`${hex}-${i}`} hex={hex} size="sm" />
                ))}
              </span>
            </button>
          ))}
        </div>
      )}
    </ModalDialog>
  );
}
