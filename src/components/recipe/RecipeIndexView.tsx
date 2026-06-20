"use client";

import { useState } from "react";
import { Button, Panel } from "@/components/kit";
import { PageHeader } from "@/components/shell";
import { ColorPickerPanel } from "@/components/tools/ColorPickerPanel";
import type { Project, Recipe } from "@/lib/types";
import type { ColorPickerSelection } from "@/lib/colorPicker/types";
import { RecipeIndexTable } from "./RecipeIndexTable";

export type RecipeStatus = "ready" | "loading" | "error";

export function RecipeIndexView({
  recipes,
  projects,
  status = "ready",
  onOpenRecipe,
  onAssignProject,
  onShare,
  onNewRecipe,
  onRetry,
  onEditPaint,
}: {
  recipes: Recipe[];
  projects: Project[];
  status?: RecipeStatus;
  onOpenRecipe: (recipe: Recipe) => void;
  onAssignProject: (recipe: Recipe, projectId: string) => void;
  onShare: (recipe: Recipe) => void;
  /** TXjhrdKPsrda — "+ Recipe" goes straight to the full create page; the
   *  recipe is named in the editor, so there is no separate naming step. */
  onNewRecipe: () => void;
  onRetry?: () => void;
  /** MM-51 — a picker selection on a recipe-table paint. The host decides
   *  how to persist (e.g. open the recipe editor focused on that slot). */
  onEditPaint?: (recipe: Recipe, slotIndex: number, selection: ColorPickerSelection) => void;
}) {
  // MM-51 — which recipe paint the shared ColorPicker is editing.
  const [editingPaint, setEditingPaint] = useState<{ recipe: Recipe; index: number } | null>(
    null,
  );

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <PageHeader
        title="RECIPE"
        tagline="Build, manage, and share repeatable paint schemes."
        actions={<Button variant="attach" onClick={onNewRecipe}>+ Recipe</Button>}
      />

      {status === "error" ? (
        <Panel label="ERROR" accent="red" className="max-w-md p-6">
          <p className="font-body text-body text-red">▸ Couldn’t load your recipes.</p>
          {onRetry && (
            <div className="mt-4">
              <Button variant="danger" onClick={onRetry}>
                Retry
              </Button>
            </div>
          )}
        </Panel>
      ) : (
        <Panel label="RECIPES" cornerTicks className="p-4">
          {status === "loading" ? (
            <div className="h-48 animate-pulse bg-cyan/5" aria-busy="true" />
          ) : (
            <RecipeIndexTable
              recipes={recipes}
              projects={projects}
              onOpenRecipe={onOpenRecipe}
              onAssignProject={onAssignProject}
              onShare={onShare}
              onCreate={onNewRecipe}
              onOpenPaint={
                onEditPaint
                  ? (recipe, index) => setEditingPaint({ recipe, index })
                  : undefined
              }
            />
          )}
        </Panel>
      )}

      {/* MM-51 — clicking a recipe-table paint opens the SAME shared
          ColorPicker (wheel + library + eyedropper) used in the recipe
          creator, so colours can be changed without opening the full editor. */}
      <ColorPickerPanel
        open={editingPaint != null}
        onClose={() => setEditingPaint(null)}
        title="Edit recipe paint"
        breadcrumb="RECIPE ▸ EDIT PAINT"
        contextLabel={
          editingPaint
            ? editingPaint.recipe.slots[editingPaint.index]?.name ?? "Paint"
            : undefined
        }
        mode="edit-slot"
        initialHex={editingPaint?.recipe.slots[editingPaint.index]?.swatch ?? null}
        initialPaintId={editingPaint?.recipe.slots[editingPaint.index]?.paintId || null}
        closeOnSelect
        onSelect={(sel) => {
          if (editingPaint) onEditPaint?.(editingPaint.recipe, editingPaint.index, sel);
        }}
      />
    </div>
  );
}
