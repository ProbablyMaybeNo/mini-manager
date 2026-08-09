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
import { guarded } from "@/lib/actionGuard";
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
      //
      // R2-14 (beyond the audit's table — transition named `startDelete`). A
      // crash on a delete is the shape that leaves a painter genuinely unsure
      // whether the project is gone; a toast says plainly that it isn't.
      const res = await guarded(
        () => deleteProject({ id: target.id }),
        "Couldn’t delete that project — check your connection, then try again.",
      );
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

      // R4-8 — this WAS `<tr role="button" tabindex="0" aria-label="Manage …">`.
      // Two things wrong with that, and they compound. `cell` requires a `row`
      // parent, so with a `button` in between every value in the row was
      // orphaned from its `columnheader`: a screen-reader user in table mode
      // got "New Project, Army, —" with no Status:/Priority: to hang it on, on
      // the first surface a signed-in user sees. And ARIA gives `button`
      // presentational children, so the three real controls inside it (attach,
      // priority, delete) were focusable descendants of a button — invalid.
      //
      // The `<tr>` is a row again, and activation moved to a real control in
      // the Title cell, which is how /collection's tables already do it. The
      // row keeps its click handler, so for a mouse it is still one target
      // ("cards are doors"); Enter/Space still open the project, now natively
      // on a button rather than through a hand-rolled keydown.
      const row = (
        <tr
          key={p.id}
          aria-current={selected ? "true" : undefined}
          onClick={() => onOpenProject(p)}
          className={cn(
            "group/row cursor-pointer border-b border-border transition-colors duration-150",
            selected
              ? "bg-cyan/10"
              : cn("bg-surface hover:bg-cyan/[0.06] focus-within:bg-cyan/10", banded && "bg-bg"),
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
                  reads distinct from the coloured TYPE chip. It is also the
                  row's activator (R4-8): the accessible name is "Open <title>"
                  rather than the old "Manage <title>" on the whole row, and it
                  contains the visible label so WCAG 2.5.3 holds. Same
                  typography as before — this changes the a11y tree, not the
                  render. `stopPropagation` so the row's own click doesn't fire
                  a second time behind it. */}
              <button
                type="button"
                aria-label={`Open ${p.title}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenProject(p);
                }}
                className="min-w-0 truncate rounded-sm text-left font-mono text-[13px] font-bold text-fg-bright focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
              >
                {p.title}
              </button>
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

      // R5-2 — this WAS `<div role="button" tabindex="0" aria-label="Manage …">`,
      // which is R4-8's construct surviving on mobile. ARIA gives `button`
      // presentational children, so the real controls inside it — the delete
      // bin always, the expand caret whenever the project has children — were
      // focusable descendants of a button, which is invalid.
      //
      // Same fix shape as R4-8's row, deliberately, so the two surfaces stay
      // one pattern rather than two: the container keeps its click handler,
      // cursor and hover/active treatment, so "cards are doors" (the locked
      // mobile density rule, 2026-07-27) is untouched for a finger or a mouse —
      // and activation moves to a real <button> around the title. The card's
      // highlight moves from `focus-visible` (dead once the div stops being
      // focusable) to `focus-within`, so focusing the title, the caret or the
      // bin still lights the card up.
      //
      // Tab-stop count is unchanged, measured at 375x812: the card itself was
      // a stop and is not one now, and the title took its place. What changes
      // is that both remaining stops are legal, named controls.
      const card = (
        <div
          key={p.id}
          aria-current={selected ? "true" : undefined}
          onClick={() => onOpenProject(p)}
          style={{ marginLeft: depth * INDENT_PX }}
          className={cn(
            // Uniform p-3 on all four sides — the old card indented rows 2-4 by
            // pl-9 to clear the caret, which read as "padding on the right, none
            // on the left". Nothing is indented now.
            "flex cursor-pointer flex-col gap-2 rounded-[6px] border p-3 transition-colors duration-150 focus-within:border-cyan focus-within:ring-1 focus-within:ring-cyan",
            selected
              ? "border-cyan bg-cyan/10"
              : "border-fg/15 hover:border-cyan/40 hover:bg-cyan/5 active:bg-cyan/10",
          )}
        >
          {/* Title fills the top line; status closes it. */}
          <div className="flex items-center gap-2">
            {hasChildren ? (
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
            ) : (
              // Reserves the caret's width so every title starts at the same
              // offset inside its card. Without it a childless sub-project's
              // title began further LEFT than its parent's, so expanding a tree
              // made the indent read backwards (MUX-016).
              <span aria-hidden className="-ml-1 h-7 w-7 shrink-0" />
            )}
            {/* The card's activator (R5-2), matching the desktop row's Title
                cell. "Open <title>" rather than the old "Manage <title>" on the
                whole card: same wording as the desktop row and RecipeCard, and
                it contains the visible label so WCAG 2.5.3 holds. Same
                typography and `break-words` wrapping as the span it replaced —
                this changes the a11y tree, not the render. `stopPropagation` so
                the card's own click doesn't open the project a second time
                behind it. It is drawn smaller than 24px tall, which WCAG 2.2
                §2.5.8 permits here because the enclosing card does the same
                thing at 350x126 — the same reasoning R4-8 shipped on desktop. */}
            <button
              type="button"
              aria-label={`Open ${p.title}`}
              onClick={(e) => {
                e.stopPropagation();
                onOpenProject(p);
              }}
              className="min-w-0 flex-1 break-words rounded-sm text-left font-mono text-[15px] font-bold leading-tight text-fg-bright focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan"
            >
              {p.title}
            </button>
            <StatusText status={p.status} />
            {/* The card's whole purpose is "tap to open", and nothing said so —
                meanwhile the red delete glyph was the loudest thing on it
                (MUX-008). Same '›' the Upcoming-events row on this page uses. */}
            <span aria-hidden className="shrink-0 text-fg-faint">›</span>
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
            {/* Neutral until touched (MUX-008): a red-outlined bin sitting at
                thumb-rest was the highest-contrast element on every card,
                pointing the eye at the one irreversible action. It still turns
                red on hover/press, and delete is confirm-guarded regardless. */}
            {/* h-10 (R3-2): the visible box was 28px — the smallest interactive
                thing in the app, on the card you tap to open the project. The
                `after:` block below already put a 44px hit area here (MUX-004),
                so the tap geometry is unchanged; this only stops the drawn
                control from being half the size of the target it sits in, and
                brings it past the 39px every ordinary button gets. The glyph
                stays 16px, so it reads no louder than before. */}
            <IconButton
              variant="tertiary"
              size="sm"
              className="relative ml-auto h-10 w-10 text-fg-faint no-underline transition-colors hover:text-red hover:no-underline focus-visible:text-red after:absolute after:left-1/2 after:top-1/2 after:h-11 after:w-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-['']"
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
      {/* `roomy:` not `min-[600px]:` — a landscape phone is >600px wide but only
          ~375px tall, and this dense table needs 758px of width and put the
          first row below the fold there (MUX-001). */}
      <div className="hidden overflow-x-auto roomy:block">
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
      <div className="flex flex-col gap-2 roomy:hidden">
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
