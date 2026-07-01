"use client";

import { Button, ModalDialog, Swatch } from "@/components/kit";

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
  onCreateNew,
  onClose,
  busy = false,
  title = "Attach a recipe",
  breadcrumb = "COLLECTION",
  createLabel = "+ New",
}: {
  open: boolean;
  recipes: RecipePickerOption[];
  onPick: (recipeId: string) => void;
  /** Pinned "+ New" entry — routes to the recipe create page when supplied. */
  onCreateNew?: () => void;
  onClose: () => void;
  busy?: boolean;
  /** Dialog heading — override for a project-scoped attach ("Attach to X"). */
  title?: string;
  /** Breadcrumb kicker above the title. */
  breadcrumb?: string;
  /** Label for the pinned create entry. */
  createLabel?: string;
}) {
  const newEntry = onCreateNew ? (
    <Button
      variant="add"
      size="sm"
      disabled={busy}
      onClick={onCreateNew}
      className="self-start"
    >
      {createLabel}
    </Button>
  ) : null;

  return (
    <ModalDialog open={open} onClose={onClose} title={title} breadcrumb={breadcrumb}>
      {recipes.length === 0 ? (
        <div className="flex flex-col gap-2">
          {newEntry}
          <p className="font-body text-body text-fg">
            No recipes yet — create one with “{createLabel}”.
          </p>
        </div>
      ) : (
        <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
          {newEntry}
          {recipes.map((r) => (
            <button
              key={r.id}
              type="button"
              disabled={busy}
              onClick={() => onPick(r.id)}
              className="flex items-center justify-between gap-3 border border-cyan/30 px-3 py-2 text-left font-body text-body text-fg hover:border-cyan hover:bg-cyan/10 disabled:opacity-50"
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
