"use client";

import { useState, type ReactNode } from "react";
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

const COLS = ["Title", "Type", "Recipe", "Status", "Priority", "Completion", ""];

/** Per-depth indent (px) applied to the Title cell so nested sub-projects
 *  read as a tree: Army → Unit → Model. */
const INDENT_PX = 18;

export function ProjectsTable({
  projects,
  selectedId,
  onOpenProject,
  onAttachRecipe,
  onFocusProject,
}: {
  projects: Project[];
  selectedId?: string;
  onOpenProject: (project: Project) => void;
  onAttachRecipe: (project: Project) => void;
  /** Jump straight to the focus bench with this project (+ its recipe) loaded. */
  onFocusProject: (project: Project) => void;
}) {
  // Which container rows are expanded. Sub-projects render inline beneath
  // their parent; expanding a sub-project reveals the next tier.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (projects.length === 0) {
    return (
      <EmptyState
        glyph="◳"
        title="No projects yet"
        hint="Add a project or upload an army list to get started — your roster shows up here."
      />
    );
  }

  function renderRows(items: Project[], depth: number): ReactNode[] {
    return items.flatMap((p) => {
      const selected = p.id === selectedId;
      const hasChildren = !!p.children && p.children.length > 0;
      const isExpanded = expanded.has(p.id);

      const row = (
        <tr
          key={p.id}
          tabIndex={0}
          role="button"
          aria-label={`Manage ${p.title}`}
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
          <td className="px-3 py-2.5 font-mono text-sm text-fg">
            <div
              className="flex items-center gap-1.5"
              style={{ paddingLeft: depth * INDENT_PX }}
            >
              {hasChildren ? (
                <button
                  type="button"
                  aria-label={`${isExpanded ? "Collapse" : "Expand"} ${p.title}`}
                  aria-expanded={isExpanded}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(p.id);
                  }}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-fg-faint transition-colors hover:bg-cyan/15 hover:text-cyan focus:outline-none focus-visible:bg-cyan/15"
                >
                  <span className={cn("transition-transform", isExpanded && "rotate-90")}>
                    ▸
                  </span>
                </button>
              ) : (
                // Spacer keeps leaf titles aligned with their expandable siblings.
                <span className="h-5 w-5 shrink-0" aria-hidden />
              )}
              <span>{p.title}</span>
            </div>
          </td>
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
          <td className="w-12 px-3 py-2.5">
            <button
              type="button"
              aria-label={`Open ${p.title} in focus`}
              title="Open in focus bench"
              onClick={(e) => {
                e.stopPropagation();
                onFocusProject(p);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-sm border border-cyan/30 text-cyan transition-colors hover:bg-cyan/15 focus:outline-none focus-visible:bg-cyan/15"
            >
              ◎
            </button>
          </td>
        </tr>
      );

      const childRows =
        hasChildren && isExpanded ? renderRows(p.children!, depth + 1) : [];
      return [row, ...childRows];
    });
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] border-collapse">
        <thead>
          <tr className="border-b border-cyan/30">
            {COLS.map((c, i) => (
              <th
                key={c || `col-${i}`}
                scope="col"
                className="px-3 py-2 text-left font-osd text-[10px] uppercase tracking-[0.18em] text-fg-faint"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{renderRows(projects, 0)}</tbody>
      </table>
    </div>
  );
}
