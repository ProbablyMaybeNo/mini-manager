"use client";

import { Button, EmptyState, Listbox, RecipePaintStrip } from "@/components/kit";
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
        action={{ label: "+ Create your first recipe", onClick: onCreate, variant: "add" }}
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
                className="px-3 py-2 text-left font-osd text-[12px] uppercase tracking-[0.18em] text-fg-faint"
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
                  className="font-mono text-base text-fg hover:text-cyan"
                >
                  {r.name}
                </button>
              </td>
              <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                {r.slots.length === 0 ? (
                  <Button variant="attach" size="sm" onClick={() => onOpenRecipe(r)}>
                    + Attach
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
                <Listbox
                  value={r.assignedProjectId ?? ""}
                  ariaLabel={`Assign ${r.name} to a project`}
                  placeholder="Assign…"
                  onChange={(v) => onAssignProject(r, v)}
                  options={[
                    { value: "", label: "Assign…" },
                    ...projects.map((p) => ({ value: p.id, label: p.title })),
                  ]}
                />
              </td>
              <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                {/* Share → neon green (t7doCednL8MP). Font stays DePixel Klein. */}
                <Button variant="add" size="sm" onClick={() => onShare(r)}>
                  Share
                </Button>
              </td>
            </tr>
          ))}
          <tr>
            <td colSpan={COLS.length} className="px-3 py-3 text-center">
              {/* + Recipe → pastel purple attach affordance (CiBUwVgwwQRD). */}
              <Button variant="attach" onClick={onCreate}>
                + Recipe
              </Button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
