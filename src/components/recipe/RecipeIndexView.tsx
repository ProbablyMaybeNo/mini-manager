"use client";

import { useState } from "react";
import { Button, Input, Panel, SlideOutPanel } from "@/components/kit";
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
  onCreateRecipe,
  onRetry,
  onEditPaint,
}: {
  recipes: Recipe[];
  projects: Project[];
  status?: RecipeStatus;
  onOpenRecipe: (recipe: Recipe) => void;
  onAssignProject: (recipe: Recipe, projectId: string) => void;
  onShare: (recipe: Recipe) => void;
  onCreateRecipe: (name: string) => void;
  onRetry?: () => void;
  /** MM-51 — a picker selection on a recipe-table paint. The host decides
   *  how to persist (e.g. open the recipe editor focused on that slot). */
  onEditPaint?: (recipe: Recipe, slotIndex: number, selection: ColorPickerSelection) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  // MM-51 — which recipe paint the shared ColorPicker is editing.
  const [editingPaint, setEditingPaint] = useState<{ recipe: Recipe; index: number } | null>(
    null,
  );

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreateRecipe(trimmed);
    setName("");
    setCreating(false);
  }

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <PageHeader
        title="RECIPE"
        tagline="Build, manage, and share repeatable paint schemes."
        actions={<Button onClick={() => setCreating(true)}>+ Recipe</Button>}
      />

      {status === "error" ? (
        <Panel label="ERROR" accent="red" className="max-w-md p-6">
          <p className="font-mono text-sm text-red">▸ Couldn’t load your recipes.</p>
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
              onCreate={() => setCreating(true)}
              onOpenPaint={
                onEditPaint
                  ? (recipe, index) => setEditingPaint({ recipe, index })
                  : undefined
              }
            />
          )}
        </Panel>
      )}

      {/* Create flow — name first */}
      <SlideOutPanel
        open={creating}
        onClose={() => setCreating(false)}
        title="New recipe"
        breadcrumb="RECIPE ▸ CREATE"
        width="max-w-sm"
        footer={
          <Button className="w-full" onClick={submit} disabled={!name.trim()}>
            Create &amp; open editor
          </Button>
        }
      >
        <div className="flex flex-col gap-3">
          <Input
            label="Recipe name"
            name="recipe-name"
            autoFocus
            placeholder="e.g. Ultramarines Battle-Ready"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          <p className="font-mono text-[11px] text-fg-faint">
            ▸ Name it first, then add paint slots and notes in the editor.
          </p>
        </div>
      </SlideOutPanel>

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
