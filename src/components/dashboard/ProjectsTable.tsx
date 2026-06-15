"use client";

import { cn } from "@/lib/cn";
import {
  EmptyState,
  PriorityTag,
  ProgressBar,
  StatusText,
  SwatchStrip,
  TypeChip,
} from "@/components/kit";
import type { Project } from "@/lib/types";

const COLS = ["Title", "Type", "Recipe", "Status", "Priority", "Completion"];

export function ProjectsTable({
  projects,
  selectedId,
  onOpenProject,
  onAttachRecipe,
}: {
  projects: Project[];
  selectedId?: string;
  onOpenProject: (project: Project) => void;
  onAttachRecipe: (project: Project) => void;
}) {
  if (projects.length === 0) {
    return (
      <EmptyState
        glyph="◳"
        title="No projects yet"
        hint="Add a project or upload an army list to get started — your roster shows up here."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] border-collapse">
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
          {projects.map((p) => {
            const selected = p.id === selectedId;
            return (
              <tr
                key={p.id}
                tabIndex={0}
                role="button"
                aria-label={`Open ${p.title}`}
                aria-current={selected ? "true" : undefined}
                onClick={() => onOpenProject(p)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpenProject(p);
                  }
                }}
                className={cn(
                  "cursor-pointer border-b border-fg/10 transition-colors focus:outline-none",
                  selected
                    ? "bg-cyan/10 text-cyan"
                    : "hover:bg-cyan/5 focus-visible:bg-cyan/10",
                )}
              >
                <td className="px-3 py-2.5 font-mono text-sm text-fg">{p.title}</td>
                <td className="px-3 py-2.5">
                  <TypeChip type={p.type} />
                </td>
                <td className="px-3 py-2.5">
                  <SwatchStrip
                    swatches={p.recipeSwatches}
                    onAttach={() => onAttachRecipe(p)}
                  />
                </td>
                <td className="px-3 py-2.5">
                  <StatusText status={p.status} />
                </td>
                <td className="px-3 py-2.5">
                  <PriorityTag priority={p.priority} />
                </td>
                <td className="w-40 px-3 py-2.5">
                  <ProgressBar percent={p.completionPercent} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
