"use client";

import { useState } from "react";
import { Button, EmptyState, Panel, SegmentedToggle } from "@/components/kit";
import { PageHeader } from "@/components/shell";
import { ColorPickerPanel } from "@/components/tools/ColorPickerPanel";
import { useSubscriber } from "@/lib/billing/SubscriberContext";
import type { Project, Recipe } from "@/lib/types";
import type { ColorPickerSelection } from "@/lib/colorPicker/types";
import { RecipeCardGrid } from "./RecipeCard";
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
  onGenerateAi,
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
  /** Open the AI Recipe Creator (Pro). When omitted, the button is hidden. */
  onGenerateAi?: () => void;
  onRetry?: () => void;
  /** MM-51 — a picker selection on a recipe-table paint. The host decides
   *  how to persist (e.g. open the recipe editor focused on that slot). */
  onEditPaint?: (recipe: Recipe, slotIndex: number, selection: ColorPickerSelection) => void;
}) {
  // MM-51 — which recipe paint the shared ColorPicker is editing.
  const [editingPaint, setEditingPaint] = useState<{ recipe: Recipe; index: number } | null>(
    null,
  );
  const isSubscriber = useSubscriber();
  // DOP-009 — table (dense, sortable scan) vs card (colour-first) view. Cards
  // lead with the scheme palette; the table keeps the per-row paint tiles.
  const [view, setView] = useState<"table" | "cards">("table");

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <PageHeader
        title="RECIPE"
        actions={
          <div className="flex items-center gap-2">
            <SegmentedToggle
              aria-label="Recipe view mode"
              options={[
                { value: "table", label: "Table" },
                { value: "cards", label: "Cards" },
              ]}
              value={view}
              onChange={setView}
              disabled={status !== "ready"}
            />
            {onGenerateAi && (
              <Button variant="solidCyan" onClick={onGenerateAi}>
                ✨ Generate with AI
              </Button>
            )}
            <Button variant="attach" onClick={onNewRecipe}>
              + Recipe
            </Button>
          </div>
        }
      />

      {/* Blue intro banner matching the project page's WelcomeCard slim bar
          (same #22568F navy + white mono "> SYS —" prefix) so the recipes
          page reads as the same family. */}
      <section
        className="rounded-[10px] px-4 py-2.5 text-white"
        style={{ backgroundColor: "#22568F" }}
      >
        <span className="font-mono text-[13px] text-white">
          <span className="font-bold">&gt; SYS</span> — build, manage &amp; share repeatable
          paint schemes.
        </span>
      </section>

      {status === "error" ? (
        <Panel label="ERROR" accent="red" className="max-w-md p-6">
          <p className="font-body text-body text-red-text">▸ Couldn’t load your recipes.</p>
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
            <div className="h-48 animate-pulse rounded-[6px] border border-border bg-surface-2" aria-busy="true" />
          ) : view === "cards" ? (
            recipes.length === 0 ? (
              <EmptyState
                glyph="⌖"
                title="No recipes yet"
                hint="A recipe is a repeatable paint scheme you can attach to a project and share."
                action={{
                  label: "+ Create your first recipe",
                  onClick: onNewRecipe,
                  variant: "add",
                }}
              />
            ) : (
              <RecipeCardGrid
                recipes={recipes}
                projects={projects}
                onOpenRecipe={onOpenRecipe}
                onAssignProject={onAssignProject}
                onShare={onShare}
              />
            )
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
          ColorPicker used in the recipe creator, so colours can be changed
          without opening the full editor. Subscription paywall (fix 3):
          the wheel + eyedropper are subscriber-only tools, so a
          non-subscriber gets library search only here too — same rule as
          the recipe creator's empty-slot panel, just without its tabs. */}
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
        showWheel={isSubscriber}
        showEyedropper={isSubscriber}
        closeOnSelect
        onSelect={(sel) => {
          if (editingPaint) onEditPaint?.(editingPaint.recipe, editingPaint.index, sel);
        }}
      />
    </div>
  );
}
