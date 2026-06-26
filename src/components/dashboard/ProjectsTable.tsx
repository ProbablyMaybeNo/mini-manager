"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import {
  Button,
  EmptyState,
  FocusReticleIcon,
  IconButton,
  Input,
  ProgressBar,
  StatusText,
  SwatchStrip,
  TypeChip,
} from "@/components/kit";
import { formatMinutes } from "@/lib/palette";
import { rollupProjectMinutes } from "@/lib/projectTime";
import type { Project, ProjectType } from "@/lib/types";
import { PriorityDropdown } from "./PriorityDropdown";

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
  onAddProject,
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
  /** Open the create-project flow — wires the first-run empty-state CTA. */
  onAddProject?: () => void;
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
        hint="A project tracks a model, unit, or whole army from wishlist to finished — your roster shows up here."
        action={
          onAddProject
            ? { label: "+ Create your first project", onClick: onAddProject, variant: "add" }
            : undefined
        }
      />
    );
  }

  // `groupIndex` is the index of the top-level ancestor; it stays constant as
  // we recurse so an Army and all its sub-projects share one banding tint and
  // each top-level group alternates (UX-015 — separate dense row groups).
  function renderRows(items: Project[], depth: number, groupIndex?: number): ReactNode[] {
    return items.flatMap((p, i) => {
      const group = groupIndex ?? i;
      const banded = group % 2 === 1;
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
              : cn("hover:bg-cyan/5 focus-visible:bg-cyan/10", banded && "bg-fg/[0.02]"),
          )}
        >
          <td className="px-3 py-2.5 font-body text-body text-fg">
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
            <PriorityDropdown projectId={p.id} value={p.priority} />
          </td>
          <td className="w-40 px-3 py-2.5">
            {/* Solid single-colour fill to match the GOLDEN STANDARD progress
                bars (C_T1) — green when complete, otherwise a solid cyan fill
                rather than the red→yellow ramp. */}
            {/* Just the bar + its percentage — the redundant "X/Y models"
                line beneath it was dropped (NVOzFLAjh-vq). */}
            <ProgressBar
              percent={p.completionPercent}
              accent={p.completionPercent >= 100 ? "green" : "cyan"}
            />
          </td>
          <td className="w-16 px-3 py-2.5">
            {/* Logged focus time, rolled up over sub-projects (UX-011).
                Dim "—" when nothing's been logged so empty rows stay quiet. */}
            {rollupProjectMinutes(p, projectMinutes) > 0 ? (
              <span className="font-num2 text-num2 tabular-nums text-cyan">
                {formatMinutes(rollupProjectMinutes(p, projectMinutes))}
              </span>
            ) : (
              <span className="font-body text-body text-fg">—</span>
            )}
          </td>
          <td className="w-20 px-3 py-2.5">
            {/* gap-2 keeps ≥8px between the two action targets; each button
                carries an invisible centered 44px tap area (after:) so the
                touch target clears the WCAG floor (MUX-004) without the 24px
                glyph bloating the dense desktop row. */}
            <div className="flex items-center justify-end gap-2">
              {canAddSub && (
                <IconButton
                  variant="add"
                  size="sm"
                  className="relative h-7 w-7 after:absolute after:left-1/2 after:top-1/2 after:h-11 after:w-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-['']"
                  aria-label={`Add ${childType} to ${p.title}`}
                  title={`Add ${childType}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    openAddSub(p);
                  }}
                >
                  +
                </IconButton>
              )}
              <IconButton
                variant="outlinePurple"
                size="sm"
                className="relative h-7 w-7 after:absolute after:left-1/2 after:top-1/2 after:h-11 after:w-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-['']"
                aria-label={`Open ${p.title} in focus`}
                title="Open in focus bench"
                onClick={(e) => {
                  e.stopPropagation();
                  onFocusProject(p);
                }}
              >
                <FocusReticleIcon size={24} />
              </IconButton>
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
                <span className="label-osd text-green">
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
        hasChildren && isExpanded ? renderRows(p.children!, depth + 1, group) : [];
      return [row, ...(isExpanded && addRow ? [addRow] : []), ...childRows];
    });
  }

  // ── Mobile card view (MUX-002 / MOP-003) ────────────────────────────────
  // Below 600px the dense 8-column table overflows the viewport, so each
  // project renders as a stacked card carrying the key fields (title + type +
  // status + completion + progress bar) and the same row actions. Reuses the
  // exact handlers + expand/add state above — no duplicated logic. The tree is
  // preserved via the same depth-indent + caret model as the table.
  function renderCards(items: Project[], depth: number): ReactNode[] {
    return items.flatMap((p) => {
      const selected = p.id === selectedId;
      const hasChildren = !!p.children && p.children.length > 0;
      const isExpanded = expanded.has(p.id);
      const childType = SUB_TYPE[p.type];
      const canAddSub = !!childType && !!onAddSubProject;
      const isAdding = addingFor === p.id;
      const minutes = rollupProjectMinutes(p, projectMinutes);

      const card = (
        <div
          key={p.id}
          role="button"
          tabIndex={0}
          aria-label={`Manage ${p.title}`}
          aria-current={selected ? "true" : undefined}
          onClick={() => onOpenProject(p)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onOpenProject(p);
            }
          }}
          style={{ marginLeft: depth * INDENT_PX }}
          className={cn(
            "cursor-pointer border p-3 transition-colors focus:outline-none focus-visible:border-cyan",
            selected
              ? "border-cyan bg-cyan/10"
              : "border-fg/15 hover:border-cyan/40 hover:bg-cyan/5",
          )}
        >
          <div className="flex items-start gap-2">
            {hasChildren ? (
              <button
                type="button"
                aria-label={`${isExpanded ? "Collapse" : "Expand"} ${p.title}`}
                aria-expanded={isExpanded}
                onClick={(e) => {
                  e.stopPropagation();
                  toggle(p.id);
                }}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm text-fg-faint transition-colors hover:bg-cyan/15 hover:text-cyan focus:outline-none focus-visible:bg-cyan/15"
              >
                <span className={cn("transition-transform", isExpanded && "rotate-90")}>
                  ▸
                </span>
              </button>
            ) : (
              <span className="h-7 w-7 shrink-0" aria-hidden />
            )}
            <span className="min-w-0 flex-1 break-words font-body text-body text-fg">
              {p.title}
            </span>
            <StatusText status={p.status} />
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 pl-9">
            <TypeChip type={p.type} />
            {minutes > 0 && (
              <span className="font-num2 text-num2 tabular-nums text-cyan">
                {formatMinutes(minutes)}
              </span>
            )}
          </div>

          <div className="mt-2 pl-9">
            <ProgressBar
              percent={p.completionPercent}
              accent={p.completionPercent >= 100 ? "green" : "cyan"}
            />
          </div>

          <div className="mt-3 flex items-center gap-2 pl-9">
            <SwatchStrip
              swatches={p.recipeSwatches}
              onAttach={() => onAttachRecipe(p)}
            />
            <div className="ml-auto flex items-center gap-2">
              {canAddSub && (
                <IconButton
                  variant="add"
                  size="sm"
                  className="h-9 w-9"
                  aria-label={`Add ${childType} to ${p.title}`}
                  title={`Add ${childType}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    openAddSub(p);
                  }}
                >
                  +
                </IconButton>
              )}
              <IconButton
                variant="outlinePurple"
                size="sm"
                className="h-9 w-9"
                aria-label={`Open ${p.title} in focus`}
                title="Open in focus bench"
                onClick={(e) => {
                  e.stopPropagation();
                  onFocusProject(p);
                }}
              >
                <FocusReticleIcon size={24} />
              </IconButton>
            </div>
          </div>
        </div>
      );

      const addCard =
        isAdding && childType ? (
          <div
            key={`${p.id}-add`}
            style={{ marginLeft: (depth + 1) * INDENT_PX }}
            className="flex flex-col gap-2 border border-cyan/30 bg-bg-raised/30 p-3"
          >
            <span className="label-osd text-green">+ {childType}</span>
            <Input
              name={`sub-card-${p.id}`}
              value={subName}
              onChange={(e) => setSubName(e.target.value)}
              placeholder={`${childType} name`}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submitSub(p, childType);
                }
                if (e.key === "Escape") setAddingFor(null);
              }}
              autoFocus
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => submitSub(p, childType)}>
                Add
              </Button>
              <Button size="sm" variant="tertiary" onClick={() => setAddingFor(null)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null;

      const childCards =
        hasChildren && isExpanded ? renderCards(p.children!, depth + 1) : [];
      return [card, ...(isExpanded && addCard ? [addCard] : []), ...childCards];
    });
  }

  return (
    <>
      {/* Desktop table — unchanged from today, shown at ≥600px (MUX-002). */}
      <div className="hidden overflow-x-auto min-[600px]:block">
        <table className="w-full min-w-[680px] border-collapse">
          <thead>
            <tr className="border-b border-cyan/30">
              {COLS.map((c, i) => (
                <th
                  key={c || `col-${i}`}
                  scope="col"
                  className="px-3 py-2 text-left label-osd tracking-[0.18em] text-fg"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{renderRows(projects, 0)}</tbody>
        </table>
      </div>

      {/* Mobile cards — shown < 600px, no horizontal overflow (MUX-002). */}
      <div className="flex flex-col gap-2 min-[600px]:hidden">
        {renderCards(projects, 0)}
      </div>
    </>
  );
}
