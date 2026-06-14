"use client";

import { Button, SwatchStrip } from "@/components/kit";
import type { Project, Recipe } from "@/lib/types";

const COLS = ["Name", "Recipe", "Project", "Share"];

export function RecipeIndexTable({
  recipes,
  projects,
  onOpenRecipe,
  onAssignProject,
  onShare,
  onCreate,
}: {
  recipes: Recipe[];
  projects: Project[];
  onOpenRecipe: (recipe: Recipe) => void;
  onAssignProject: (recipe: Recipe, projectId: string) => void;
  onShare: (recipe: Recipe) => void;
  onCreate: () => void;
}) {
  if (recipes.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="font-osd text-sm uppercase tracking-[0.18em] text-fg-dim">
          No recipes yet
        </p>
        <p className="font-mono text-xs text-fg-faint">
          A recipe is a repeatable paint scheme you can attach to a project and share.
        </p>
        <Button onClick={onCreate}>+ Create your first recipe</Button>
      </div>
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
            <tr key={r.id} className="border-b border-fg/10 hover:bg-cyan/5">
              <td className="px-3 py-3">
                <button
                  type="button"
                  onClick={() => onOpenRecipe(r)}
                  className="font-mono text-sm text-fg hover:text-cyan"
                >
                  {r.name}
                </button>
              </td>
              <td className="px-3 py-3">
                <button type="button" onClick={() => onOpenRecipe(r)} aria-label={`Edit ${r.name}`}>
                  <SwatchStrip swatches={r.slots.map((s) => s.swatch)} onAttach={() => onOpenRecipe(r)} />
                </button>
              </td>
              <td className="px-3 py-3">
                <select
                  value={r.assignedProjectId ?? ""}
                  onChange={(e) => onAssignProject(r, e.target.value)}
                  aria-label={`Assign ${r.name} to a project`}
                  className="border border-cyan/50 bg-bg px-2 py-1 font-mono text-xs text-fg focus:border-cyan focus:outline-none"
                >
                  <option value="">Assign…</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-3 py-3">
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
