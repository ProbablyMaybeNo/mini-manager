"use client";

import { useEffect, useState, useTransition } from "react";
import { Button, Input, ModalDialog } from "@/components/kit";
import {
  listRecipesForSendTo,
  sendPaletteToRecipe,
  type SendToRecipeOption,
} from "@/lib/actions/sendToRecipe";

export interface AssignSwatch {
  hex: string;
  paintId?: string | null;
  name?: string;
}

/**
 * Recipe picker for "assign / send to recipe" flows. Lists the painter's
 * recipes (append a run of slots) or mints a brand-new recipe from the
 * given swatches. Built on {@link ModalDialog}; lazy-loads the recipe list
 * the first time it opens.
 */
export function AssignToRecipeDialog({
  open,
  swatches,
  onClose,
  onAssigned,
}: {
  open: boolean;
  swatches: AssignSwatch[];
  onClose: () => void;
  onAssigned: (recipeName: string) => void;
}) {
  const [recipes, setRecipes] = useState<SendToRecipeOption[] | null>(null);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setError(null);
    setNewName("");
    setRecipes(null);
    let alive = true;
    listRecipesForSendTo().then((res) => {
      if (!alive) return;
      setRecipes(res.ok ? [...res.data] : []);
      if (!res.ok) setError(res.error);
    });
    return () => {
      alive = false;
    };
  }, [open]);

  function send(target: { targetRecipeId: string } | { newRecipeName: string }, label: string) {
    if (pending || swatches.length === 0) return;
    setError(null);
    startTransition(async () => {
      const res = await sendPaletteToRecipe({
        swatches: swatches.map((s) => ({
          hex: s.hex,
          paintId: s.paintId ?? undefined,
          name: s.name,
        })),
        ...target,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onAssigned(label);
      onClose();
    });
  }

  const count = swatches.length;

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      title={count === 1 ? "Assign to recipe" : "Send palette to recipe"}
      breadcrumb="RECIPES"
    >
      <p className="mb-3 font-body text-body text-fg">
        {count === 1
          ? "Add this paint to an existing recipe, or start a new one."
          : `Add ${count} colours to a recipe, or start a new one.`}
      </p>

      <div className="mb-4 flex flex-col gap-2">
        {recipes === null ? (
          <p className="font-body text-body text-fg">▸ Loading recipes…</p>
        ) : recipes.length === 0 ? (
          <p className="font-body text-body text-fg">
            No recipes yet — create one below.
          </p>
        ) : (
          <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
            {recipes.map((r) => (
              <button
                key={r.id}
                type="button"
                disabled={pending}
                onClick={() => send({ targetRecipeId: r.id }, r.name)}
                className="border border-cyan/30 px-3 py-2 text-left font-body text-body text-fg hover:border-cyan hover:bg-cyan/10 disabled:opacity-50"
              >
                {r.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2 border-t border-cyan/20 pt-3">
        <Input
          name="new-recipe-name"
          placeholder="New recipe name"
          value={newName}
          disabled={pending}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) =>
            e.key === "Enter" &&
            newName.trim() &&
            send({ newRecipeName: newName.trim() }, newName.trim())
          }
          containerClassName="flex-1"
        />
        <Button
          size="sm"
          disabled={pending || !newName.trim()}
          onClick={() => send({ newRecipeName: newName.trim() }, newName.trim())}
        >
          Create
        </Button>
      </div>

      {error && (
        <p className="mt-3 font-body text-body text-red" role="alert">
          ▸ {error}
        </p>
      )}
    </ModalDialog>
  );
}
