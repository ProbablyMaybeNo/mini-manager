"use client";

import { Button, Listbox, Swatch } from "@/components/kit";
import { cn } from "@/lib/cn";
import type { Project, Recipe } from "@/lib/types";

/**
 * DOP-009 — a recipe as a card (the grid-view counterpart to the table row).
 * Leads with a full-width swatch preview of the ordered scheme so the colours
 * read at a glance — the table's text-first layout never showed the palette up
 * top. Reuses the same Swatch primitive the project cards / color tools use.
 */
export function RecipeCard({
  recipe,
  projects,
  onOpenRecipe,
  onAssignProject,
  onShare,
}: {
  recipe: Recipe;
  projects: Project[];
  onOpenRecipe: (recipe: Recipe) => void;
  onAssignProject: (recipe: Recipe, projectId: string) => void;
  onShare: (recipe: Recipe) => void;
}) {
  const swatches = recipe.slots.map((s) => s.swatch);
  return (
    <div className="flex flex-col border border-cyan/20 bg-bg-raised/30 transition-colors hover:border-cyan/50">
      {/* Full-width ordered-scheme preview (the colour-first header). Clicking
          it opens the recipe — the whole strip is the affordance. */}
      <button
        type="button"
        onClick={() => onOpenRecipe(recipe)}
        aria-label={`Open ${recipe.name}`}
        className="flex h-16 w-full overflow-hidden border-b border-cyan/20"
      >
        {swatches.length === 0 ? (
          <span className="flex h-full w-full items-center justify-center bg-bg font-body text-body text-fg-faint">
            No paints yet
          </span>
        ) : (
          swatches.map((hex, i) => (
            <span
              key={`${hex}-${i}`}
              className="h-full flex-1"
              style={{ backgroundColor: hex }}
            />
          ))
        )}
      </button>

      <div className="flex flex-1 flex-col gap-3 p-3">
        <button
          type="button"
          onClick={() => onOpenRecipe(recipe)}
          className="text-left font-body text-body font-medium text-fg hover:text-cyan-lite"
        >
          {recipe.name}
        </button>

        <div className="flex items-center gap-1.5">
          <span className="label-osd text-fg-faint">
            {recipe.slots.length} {recipe.slots.length === 1 ? "paint" : "paints"}
          </span>
          {/* A compact swatch echo under the count for quick scanning even when
              the big header preview scrolls out of view in a long list. */}
          <span className="ml-auto inline-flex gap-0.5">
            {swatches.slice(0, 6).map((hex, i) => (
              <Swatch key={`${hex}-${i}`} hex={hex} size="sm" />
            ))}
          </span>
        </div>

        <div className="mt-auto flex items-center gap-2 pt-1">
          <Listbox
            className="min-w-0 flex-1"
            triggerClassName="w-full"
            value={recipe.assignedProjectId ?? ""}
            ariaLabel={`Assign ${recipe.name} to a project`}
            placeholder="Assign…"
            onChange={(v) => onAssignProject(recipe, v)}
            options={[
              { value: "", label: "Assign…" },
              ...projects.map((p) => ({ value: p.id, label: p.title })),
            ]}
          />
          <Button variant="add" size="sm" onClick={() => onShare(recipe)}>
            Share
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Grid of {@link RecipeCard}s — the recipe index "card view". */
export function RecipeCardGrid({
  recipes,
  projects,
  onOpenRecipe,
  onAssignProject,
  onShare,
  className,
}: {
  recipes: Recipe[];
  projects: Project[];
  onOpenRecipe: (recipe: Recipe) => void;
  onAssignProject: (recipe: Recipe, projectId: string) => void;
  onShare: (recipe: Recipe) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3",
        className,
      )}
    >
      {recipes.map((r) => (
        <RecipeCard
          key={r.id}
          recipe={r}
          projects={projects}
          onOpenRecipe={onOpenRecipe}
          onAssignProject={onAssignProject}
          onShare={onShare}
        />
      ))}
    </div>
  );
}
