"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import {
  Button,
  EmptyState,
  Input,
  PriorityTag,
  ProgressBar,
  StatusText,
  SwatchStrip,
  TypeChip,
} from "@/components/kit";
import { formatMinutes } from "@/lib/palette";
import { rollupProjectMinutes } from "@/lib/projectTime";
import type { Project, ProjectType } from "@/lib/types";

const COLS = ["Title", "Type", "Recipe", "Status", "Priority", "Completion", "Time", ""];

/** Per-depth indent (px) applied to the Title cell so nested sub-projects
 *  read as a tree: Army → Unit → Model. */
const INDENT_PX = 18;

/**
 * Which child type a container row can spawn (OR6fdf — "units to armies,
 * models to units"). Army / Warband hold Units; a Unit holds Models. Leaf
 * types (Model, Terrain) get no add-sub affordance.
 */
const SUB_TYPE: Partial<Record<ProjectType, ProjectType>> = {
  Army: "Unit",
  Warband: "Unit",
  Unit: "Model",
};

export function ProjectsTable({
  projects,
  projectMinutes = {},
  selectedId,
  onOpenProject,
  onAttachRecipe,
  onFocusProject,
  onAddSubProject,
}: {
  projects: Project[];
  /** Per-project logged minutes (UX-011), rolled up over sub-projects per row. */
  projectMinutes?: Record<string, number>;
  selectedId?: string;
  onOpenProject: (project: Project) => void;
  onAttachRecipe: (project: Project) => void;
  /** Jump straight to the focus bench with this project (+ its recipe) loaded. */
  onFocusProject: (project: Project) => void;
  /** Create a sub-project under `parent` of the given child type (D3 / OR6fdf). */
  onAddSubProject?: (parent: Project, childType: ProjectType, name: string) => void;
}) {
  // Which container rows are expanded. Sub-projects render inline beneath
  // their parent; expanding a sub-project reveals the next tier.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // Which row currently has its inline "add sub-project" form open.
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [subName, setSubName] = useState("");

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openAddSub(p: Project) {
    setAddingFor((cur) => (cur === p.id ? null : p.id));
    setSubName("");
    // Reveal children so the new row lands in view once created.
    setExpanded((prev) => new Set(prev).add(p.id));
  }

  function submitSub(parent: Project, childType: ProjectType) {
    const name = subName.trim();
    if (!name) return;
    onAddSubProject?.(parent, childType, name);
    setAddingFor(null);
    setSubName("");
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
      const childType = SUB_TYPE[p.type];
      const canAddSub = !!childType && !!onAddSubProject;
      const isAdding = addingFor === p.id;
      // The caret expands/collapses existing sub-projects, so only rows that
      // actually have children render it. Leaf rows (incl. empty containers
      // like a childless Army) render no chevron — adding a first sub-project
      // is done via the dedicated "+" action button, which then makes the
      // caret appear (honours the documented leaf contract, M3.2).
      const showCaret = hasChildren;

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
              {showCaret ? (
                <button
                  type="button"
                  aria-label={`${isExpanded ? "Collapse" : "Expand"} ${p.title}`}
                  aria-expanded={isExpanded}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(p.id);
                  }}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-fg-faint transition-colors hover:bg-cyan/15 hover:text-cyan focus:outline-none focus-visible:bg-cyan/15"
                >
                  <span className={cn("transition-transform", isExpanded && "rotate-90")}>
                    ▸
                  </span>
                </button>
              ) : (
                // Spacer keeps leaf titles aligned with their expandable siblings.
                <span className="h-6 w-6 shrink-0" aria-hidden />
              )}
              {/* Name stays white so it's clearly distinct from the coloured
                  TYPE chip — even on the cyan-highlighted selected row (JRH4). */}
              <span className="text-fg">{p.title}</span>
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
            {/* Solid single-colour fill to match the GOLDEN STANDARD progress
                bars (C_T1) — green when complete, otherwise a solid cyan fill
                rather than the red→yellow ramp. */}
            <ProgressBar
              percent={p.completionPercent}
              accent={p.completionPercent >= 100 ? "green" : "cyan"}
            />
            {/* D4 — surface the underlying model progress so the bar isn't
                just a colour: "12/40 models" beneath the percentage. */}
            {p.modelCount != null && p.modelCount > 0 && (
              <span className="mt-0.5 block font-mono text-[10px] tabular-nums text-fg-faint">
                {p.modelsComplete ?? Math.round((p.completionPercent / 100) * p.modelCount)}/
                {p.modelCount} models
              </span>
            )}
          </td>
          <td className="w-16 px-3 py-2.5">
            {/* Logged focus time, rolled up over sub-projects (UX-011).
                Dim "—" when nothing's been logged so empty rows stay quiet. */}
            {rollupProjectMinutes(p, projectMinutes) > 0 ? (
              <span className="font-mono text-xs tabular-nums text-cyan">
                {formatMinutes(rollupProjectMinutes(p, projectMinutes))}
              </span>
            ) : (
              <span className="font-mono text-xs text-fg-faint">—</span>
            )}
          </td>
          <td className="w-20 px-3 py-2.5">
            <div className="flex items-center justify-end gap-1">
              {canAddSub && (
                <button
                  type="button"
                  aria-label={`Add ${childType} to ${p.title}`}
                  title={`Add ${childType}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    openAddSub(p);
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-sm border border-green/40 text-green transition-colors hover:bg-green/15 focus:outline-none focus-visible:bg-green/15"
                >
                  +
                </button>
              )}
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
            </div>
          </td>
        </tr>
      );

      const addRow =
        isAdding && childType ? (
          <tr key={`${p.id}-add`} className="border-b border-fg/10 bg-bg-raised/30">
            <td colSpan={COLS.length} className="px-3 py-2">
              <div
                className="flex items-center gap-2"
                style={{ paddingLeft: (depth + 1) * INDENT_PX }}
              >
                <span className="font-osd text-[10px] uppercase tracking-[0.15em] text-green">
                  + {childType}
                </span>
                <Input
                  name={`sub-${p.id}`}
                  value={subName}
                  onChange={(e) => setSubName(e.target.value)}
                  placeholder={`${childType} name`}
                  containerClassName="max-w-[200px]"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      submitSub(p, childType);
                    }
                    if (e.key === "Escape") setAddingFor(null);
                  }}
                  autoFocus
                />
                <Button size="sm" onClick={() => submitSub(p, childType)}>
                  Add
                </Button>
                <Button
                  size="sm"
                  variant="tertiary"
                  onClick={() => setAddingFor(null)}
                >
                  Cancel
                </Button>
              </div>
            </td>
          </tr>
        ) : null;

      const childRows =
        hasChildren && isExpanded ? renderRows(p.children!, depth + 1) : [];
      return [row, ...(isExpanded && addRow ? [addRow] : []), ...childRows];
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
