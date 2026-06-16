"use client";

import { Button, EmptyState, RecipePaintStrip } from "@/components/kit";
import type { Project, Recipe } from "@/lib/types";

const COLS = ["Name", "Recipe", "Project", "Share"];

export function RecipeIndexTable({
  recipes,
  projects,
  onOpenRecipe,
  onAssignProject,
  onShare,
  onCreate,
  onOpenPaint,
}: {
  recipes: Recipe[];
  projects: Project[];
  onOpenRecipe: (recipe: Recipe) => void;
  onAssignProject: (recipe: Recipe, projectId: string) => void;
  onShare: (recipe: Recipe) => void;
  onCreate: () => void;
  /** MM-51 — open the shared ColorPicker for a specific paint in a recipe. */
  onOpenPaint?: (recipe: Recipe, slotIndex: number) => void;
}) {
  if (recipes.length === 0) {
    return (
      <EmptyState
        glyph="⌖"
        title="No recipes yet"
        hint="A recipe is a repeatable paint scheme you can attach to a project and share."
        action={{ label: "+ Create your first recipe", onClick: onCreate }}
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse">
        <thead>
          <tr className="border-b border-cyan/30">
            {COLS.map((c) => (
              <th
                key={c}
                scope="col"
                className="px-3 py-2 text-left font-osd text-[10px] uppercase tracking-[0.18em] text-fg-faint"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {recipes.map((r) => (
            // MM-28 — the whole row is clickable → opens the recipe page.
            // Interactive cells (paint tiles, project select, share, name)
            // stop propagation so they keep their own behaviour.
            <tr
              key={r.id}
              onClick={() => onOpenRecipe(r)}
              className="cursor-pointer border-b border-fg/10 transition-colors hover:bg-cyan/5"
            >
              <td className="px-3 py-3">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenRecipe(r);
                  }}
                  className="font-mono text-sm text-fg hover:text-cyan"
                >
                  {r.name}
                </button>
              </td>
              <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                {r.slots.length === 0 ? (
                  <Button variant="tertiary" size="sm" onClick={() => onOpenRecipe(r)}>
                    + attach
                  </Button>
                ) : (
                  // l9-Ep / C1Dj / -zP2IB / XBqE — large legible tiles with
                  // company top, name centre, layer bottom in black/white.
                  // MM-51 — clicking a tile opens the shared ColorPicker.
                  <RecipePaintStrip
                    slots={r.slots.map((s) => ({
                      hex: s.swatch,
                      name: s.name,
                      brand: s.brand,
                      layer: s.layer,
                    }))}
                    onPaintClick={onOpenPaint ? (i) => onOpenPaint(r, i) : undefined}
                  />
                )}
              </td>
              <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                <select
                  value={r.assignedProjectId ?? ""}
                  onChange={(e) => onAssignProject(r, e.target.value)}
                  aria-label={`Assign ${r.name} to a project`}
                  className="border border-cyan/50 bg-bg px-2 py-1 font-mono text-xs text-fg transition-[border-color,box-shadow] duration-150 focus:border-cyan focus:shadow-[0_0_0_3px_rgba(0,210,255,0.12)] focus:outline-none"
                >
                  <option value="">Assign…</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                <Button variant="secondary" size="sm" onClick={() => onShare(r)}>
                  Share
                </Button>
              </td>
            </tr>
          ))}
          <tr>
            <td colSpan={COLS.length} className="px-3 py-3 text-center">
              <Button variant="tertiary" onClick={onCreate}>
                + Recipe
              </Button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
