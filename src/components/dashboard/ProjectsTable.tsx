"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  ConfirmDialog,
  EmptyState,
  IconButton,
  ProgressBar,
  StatusText,
  SwatchStrip,
  TypeChip,
  useToast,
} from "@/components/kit";
import { deleteProject } from "@/lib/actions/projects";
import { formatMinutes } from "@/lib/palette";
import { rollupProjectMinutes } from "@/lib/projectTime";
import type { Project } from "@/lib/types";
import { PriorityDropdown } from "./PriorityDropdown";

const COLS = ["Title", "Type", "#", "Recipe", "Status", "Priority", "Completion", "Time", ""];

/** Per-depth indent (px) applied to the Title cell so nested sub-projects
 *  read as a tree: Army → Unit → Model. */
const INDENT_PX = 18;

export function ProjectsTable({
  projects,
  projectMinutes = {},
  selectedId,
  onOpenProject,
  onAttachRecipe,
  onAddProject,
}: {
  projects: Project[];
  /** Per-project logged minutes (UX-011), rolled up over sub-projects per row. */
  projectMinutes?: Record<string, number>;
  selectedId?: string;
  onOpenProject: (project: Project) => void;
  onAttachRecipe: (project: Project) => void;
  /** Open the create-project flow — wires the first-run empty-state CTA. */
  onAddProject?: () => void;
}) {
  const { toast, node: toastNode } = useToast();
  const [pendingDelete, startDelete] = useTransition();
  // Which container rows are expanded. Sub-projects render inline beneath
  // their parent; expanding a sub-project reveals the next tier.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // The project queued for a confirm-guarded row delete (RF-3).
  const [deleting, setDeleting] = useState<Project | null>(null);

  function confirmDelete() {
    const target = deleting;
    if (!target) return;
    setDeleting(null);
    startDelete(async () => {
      // No router.refresh(): the force-dynamic dashboard re-renders on the
      // server-action POST, dropping the deleted row (P2).
      const res = await deleteProject({ id: target.id });
      if (!res.ok) toast(res.error, "red");
    });
  }

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
      // The caret expands/collapses existing sub-projects, so only rows that
      // actually have children render it. Adding sub-projects now happens in
      // the Army/Unit flow panel, not via a per-row affordance (strict-strip
      // to match dashboard 4:4).
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
            "group/row cursor-pointer border-b border-border transition-colors duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-cyan",
            selected
              ? "bg-cyan/10"
              : cn("bg-surface hover:bg-cyan/[0.06] focus-visible:bg-cyan/10", banded && "bg-bg"),
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
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-fg-faint transition-colors duration-150 hover:bg-cyan/15 hover:text-cyan-lite focus:outline-none focus-visible:bg-cyan/15 focus-visible:text-cyan-lite active:bg-cyan/25"
                >
                  <span className={cn("transition-transform duration-150", isExpanded && "rotate-90")}>
                    ▸
                  </span>
                </button>
              ) : (
                // Spacer keeps leaf titles aligned with their expandable siblings.
                <span className="h-6 w-6 shrink-0" aria-hidden />
              )}
              {/* Title — JetBrains Mono Bold 13px (4:4), bright white so it
                  reads distinct from the coloured TYPE chip. */}
              <span className="font-mono text-[13px] font-bold text-fg-bright">{p.title}</span>
            </div>
          </td>
          <td className="px-3 py-2.5">
            <TypeChip type={p.type} />
          </td>
          {/* # — model count (4:68). Plain mono value, dim "—" when unset. */}
          <td className="px-3 py-2.5">
            {p.modelCount != null && p.modelCount > 0 ? (
              <span className="font-mono text-[13px] tabular-nums text-fg">{p.modelCount}</span>
            ) : (
              <span className="font-body text-body text-fg-dim">—</span>
            )}
          </td>
          <td className="px-3 py-2.5">
            <SwatchStrip
              swatches={p.recipeSwatches}
              onAttach={() => onAttachRecipe(p)}
              ariaLabel={`Attach recipe to ${p.title}`}
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
              <span className="font-num2 text-num2 tabular-nums text-cyan-lite">
                {formatMinutes(rollupProjectMinutes(p, projectMinutes))}
              </span>
            ) : (
              <span className="font-body text-body text-fg">—</span>
            )}
          </td>
          <td className="w-12 px-3 py-2.5">
            {/* Roster rows expose ONLY the delete action (strict-strip vs 4:4).
                Add-sub + focus moved to the Army/Unit flow panel. The invisible
                centered 44px tap area (after:) keeps the touch target above the
                WCAG floor (MUX-004) without bloating the dense desktop row. */}
            <div className="flex items-center justify-end">
              <IconButton
                variant="outlineRed"
                size="sm"
                className="relative h-7 w-7 opacity-70 transition-opacity duration-150 group-hover/row:opacity-100 group-focus-within/row:opacity-100 after:absolute after:left-1/2 after:top-1/2 after:h-11 after:w-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-['']"
                aria-label={`Delete ${p.title}`}
                title="Delete project"
                disabled={pendingDelete}
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleting(p);
                }}
              >
                <Trash2 size={16} aria-hidden />
              </IconButton>
            </div>
          </td>
        </tr>
      );

      const childRows =
        hasChildren && isExpanded ? renderRows(p.children!, depth + 1, group) : [];
      return [row, ...childRows];
    });
  }

  // ── Mobile card view (MUX-002 / MOP-003) ────────────────────────────────
  // Below 600px the dense 9-column table overflows the viewport, so each
  // project renders as a card. Deliberately SPARSE (Ross, 2026-07-27): the card
  // is a door to the project page, not a copy of it. Three fixed bands —
  //   1. title (fills the line) + status
  //   2. progress bar + %
  //   3. recipe swatches + delete
  // TYPE, PRIORITY, model count, logged time and "+ attach" were all pulled;
  // they live on the project page where there's room to read them. Reuses the
  // exact handlers + expand state as the table — no duplicated logic.
  function renderCards(items: Project[], depth: number): ReactNode[] {
    return items.flatMap((p) => {
      const selected = p.id === selectedId;
      const hasChildren = !!p.children && p.children.length > 0;
      const isExpanded = expanded.has(p.id);

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
            // Uniform p-3 on all four sides — the old card indented rows 2-4 by
            // pl-9 to clear the caret, which read as "padding on the right, none
            // on the left". Nothing is indented now.
            "flex cursor-pointer flex-col gap-2 rounded-[6px] border p-3 transition-colors duration-150 focus:outline-none focus-visible:border-cyan focus-visible:ring-1 focus-visible:ring-cyan",
            selected
              ? "border-cyan bg-cyan/10"
              : "border-fg/15 hover:border-cyan/40 hover:bg-cyan/5 active:bg-cyan/10",
          )}
        >
          {/* Title fills the top line; status closes it. */}
          <div className="flex items-center gap-2">
            {hasChildren && (
              <button
                type="button"
                aria-label={`${isExpanded ? "Collapse" : "Expand"} ${p.title}`}
                aria-expanded={isExpanded}
                onClick={(e) => {
                  e.stopPropagation();
                  toggle(p.id);
                }}
                className="-ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-sm text-fg-faint transition-colors duration-150 hover:bg-cyan/15 hover:text-cyan-lite focus:outline-none focus-visible:bg-cyan/15 active:bg-cyan/25"
              >
                <span className={cn("transition-transform duration-150", isExpanded && "rotate-90")}>
                  ▸
                </span>
              </button>
            )}
            <span className="min-w-0 flex-1 break-words font-mono text-[15px] font-bold leading-tight text-fg-bright">
              {p.title}
            </span>
            <StatusText status={p.status} />
          </div>

          <ProgressBar
            percent={p.completionPercent}
            accent={p.completionPercent >= 100 ? "green" : "cyan"}
            showLabel
          />

          <div className="flex items-center gap-2">
            {p.recipeSwatches.length > 0 ? (
              <SwatchStrip swatches={p.recipeSwatches} />
            ) : (
              <span className="font-mono text-[11px] uppercase tracking-wide text-fg-faint">
                no recipe
              </span>
            )}
            <IconButton
              variant="outlineRed"
              size="sm"
              className="relative ml-auto h-7 w-7 after:absolute after:left-1/2 after:top-1/2 after:h-11 after:w-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-['']"
              aria-label={`Delete ${p.title}`}
              title="Delete project"
              disabled={pendingDelete}
              onClick={(e) => {
                e.stopPropagation();
                setDeleting(p);
              }}
            >
              <Trash2 size={16} aria-hidden />
            </IconButton>
          </div>
        </div>
      );

      const childCards =
        hasChildren && isExpanded ? renderCards(p.children!, depth + 1) : [];
      return [card, ...childCards];
    });
  }

  return (
    <>
      {/* Desktop table — shown at ≥600px (MUX-002). */}
      <div className="hidden overflow-x-auto min-[600px]:block">
        <table className="w-full min-w-[680px] border-collapse">
          <thead>
            <tr className="border-b border-border bg-surface">
              {COLS.map((c, i) => (
                <th
                  key={c || `col-${i}`}
                  scope="col"
                  className="px-3 py-3 text-left font-mono text-[11px] font-normal uppercase tracking-wide text-fg-dim"
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

      {/* Confirm-guarded row delete (RF-3) — one dialog, driven by the queued
          project; shared by the table row + the mobile card. */}
      <ConfirmDialog
        open={deleting != null}
        breadcrumb="PROJECT"
        title="Delete project?"
        message={
          deleting
            ? `Delete "${deleting.title}" and its sub-projects? This can't be undone.`
            : ""
        }
        confirmLabel="Delete"
        destructive
        busy={pendingDelete}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
      {toastNode}
    </>
  );
}
