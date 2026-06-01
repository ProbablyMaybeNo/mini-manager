"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import type { Priority, ProjectType } from "@/db/schema";
import { priorities, projectTypes } from "@/db/schema";
import { ProgressBar } from "@/components/ProgressBar";
import { StatusPill, type StatusPillKind } from "@/components/ui/StatusPill";
import {
  InlineCellPopover,
  InlineCellPopoverItem,
} from "@/components/ui/InlineCellPopover";
import type { DisplayStatus } from "@/lib/progress";
import {
  bumpProjectStatus,
  updateProjectPriority,
  updateProjectType,
} from "@/lib/actions/projects";
import {
  AttachRecipeModal,
  type RecipeOption,
} from "@/components/recipes/AttachRecipeModal";
import { DeleteProjectButton } from "@/components/projects/DeleteProjectButton";

const STATUS_ORDER: ReadonlyArray<DisplayStatus> = [
  "WISHLIST",
  "PURCHASED",
  "BUILDING",
  "PRIMING",
  "PAINTING",
  "BASING",
  "COMPLETE",
  "SHELVED",
];

/** Per-row VM. Page builds these server-side from listAllProjects
 *  + getProjectPalettesMap + the existing displayStatus /
 *  progressPercent helpers.
 *
 * `parentId` is null for top-level projects (Army / Unit / Terrain /
 * Diorama / Warband). When set, the row is rendered as a child INSIDE
 * its parent's expanded section. P13.4 — sub-projects are always
 * Unit-typed; the inline Type cell on those rows is read-only.
 *
 * `depth` is computed by the page (0 = top-level, 1 = unit under
 * army, 2 = unit under unit). Used to indent + draw the
 * tree-connector pseudo-element. */
export interface ProjectDashboardRow {
  id: string;
  name: string;
  type: ProjectType;
  faction: string | null;
  priority: Priority | null;
  status: DisplayStatus;
  paletteHexes: string[];
  progressPercent: number;
  totalModels: number;
  updatedAt: number;
  parentId: string | null;
  depth: number;
  /** R7-1 — set when the project already has at least one attached
   *  recipe. Clicking the Recipes cell navigates here. */
  firstAttachedRecipeId: string | null;
}

const STORAGE_KEY = "mm.projects.expanded";

function readExpanded(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return new Set(parsed.map(String));
  } catch {
    /* corrupt entry — ignore */
  }
  return new Set();
}

function writeExpanded(set: ReadonlySet<string>): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    /* quota / disabled — fail silent */
  }
}

const STATUS_PILL: Record<DisplayStatus, StatusPillKind> = {
  WISHLIST: "wishlist",
  PURCHASED: "neutral",
  BUILDING: "info",
  PRIMING: "info",
  PAINTING: "warning",
  BASING: "warning",
  COMPLETE: "ok",
  SHELVED: "neutral",
};

/** Stages flow WISHLIST -> PURCHASED -> BUILDING -> PRIMING -> PAINTING
 *  -> BASING -> COMPLETE. SHELVED sorts last (hibernating). Used for
 *  status-column sort order. */
const STATUS_RANK: Record<DisplayStatus, number> = {
  WISHLIST: 0,
  PURCHASED: 1,
  BUILDING: 2,
  PRIMING: 3,
  PAINTING: 4,
  BASING: 5,
  COMPLETE: 6,
  SHELVED: 7,
};

/** Locked priority order — Urgent first, Low last. */
const PRIORITY_RANK: Record<NonNullable<Priority>, number> = {
  Urgent: 0,
  High: 1,
  Medium: 2,
  Low: 3,
};

const TYPE_CHIP: Readonly<Record<ProjectType, string>> = {
  Army: "type-chip-cyan",
  Warband: "type-chip-cyan",
  Unit: "type-chip-amber",
  "Terrain Piece": "type-chip-green",
  Diorama: "type-chip-purple",
};

type SortKey =
  | "name"
  | "type"
  | "status"
  | "priority"
  | "progressPercent"
  | "updatedAt";
type SortDir = "asc" | "desc";

interface Props {
  rows: ReadonlyArray<ProjectDashboardRow>;
  /** R7-1 — every recipe the user owns, pre-fetched server-side. The
   *  per-row Recipes cell filters to the candidates that aren't yet
   *  attached to THAT project. */
  ownedRecipes: ReadonlyArray<{
    id: string;
    name: string;
    attachedProjectId: string | null;
  }>;
  /** R7-1 — projectId → human name lookup so the AttachRecipeModal can
   *  show "currently attached to <X>" labels. */
  projectNameById: Readonly<Record<string, string>>;
}

/**
 * P12.6 — Single sortable dashboard table. Replaces the prior three-
 * card layout (Backlog / Active / All projects) with one dense
 * surface Ross's brief locks: Name / Type / Recipes / Status /
 * Priority / Completion (bar).
 *
 * Default sort = updatedAt DESC. Click any header to toggle asc/desc.
 * Completion bar tone Ross locked: red < 25%, pastel-yellow 25-75%,
 * neon-green >= 75%. The ProgressBar primitive's tone="auto" mode now
 * implements this threshold set (P12.6 update).
 *
 * Expandable hierarchy rows (Army > Units > Models) land in P12.7.
 */
export function ProjectsDashboardTable({
  rows,
  ownedRecipes,
  projectNameById,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("updatedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // P12.7 — expanded-set state, hydrated from sessionStorage on mount
  // so navigating away + back to /projects preserves the open Army
  // expansions. We start with an empty Set on first render to keep
  // server/client markup identical; the useEffect bumps state from
  // storage right after.
  const [expanded, setExpandedState] = useState<Set<string>>(new Set());
  useEffect(() => {
    setExpandedState(readExpanded());
  }, []);
  const setExpanded = (next: Set<string>) => {
    setExpandedState(next);
    writeExpanded(next);
  };
  const toggleExpanded = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };

  // Partition rows once: top-level vs nested. Children indexed by
  // parentId in a Map for O(1) lookup during sort iteration.
  const { topLevel, childrenByParent } = useMemo(() => {
    const top: ProjectDashboardRow[] = [];
    const children = new Map<string, ProjectDashboardRow[]>();
    for (const r of rows) {
      if (r.parentId === null || r.parentId === undefined) {
        top.push(r);
      } else {
        const arr = children.get(r.parentId) ?? [];
        arr.push(r);
        children.set(r.parentId, arr);
      }
    }
    return { topLevel: top, childrenByParent: children };
  }, [rows]);

  const sortedTopLevel = useMemo(() => {
    const arr = topLevel.slice();
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "type":
          cmp = a.type.localeCompare(b.type);
          break;
        case "status":
          cmp = STATUS_RANK[a.status] - STATUS_RANK[b.status];
          break;
        case "priority":
          cmp =
            (a.priority ? PRIORITY_RANK[a.priority] : 99) -
            (b.priority ? PRIORITY_RANK[b.priority] : 99);
          break;
        case "progressPercent":
          cmp = a.progressPercent - b.progressPercent;
          break;
        case "updatedAt":
          cmp = a.updatedAt - b.updatedAt;
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [topLevel, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      // Name + type default to asc; numeric/status/priority/updatedAt to desc.
      setSortDir(key === "name" || key === "type" ? "asc" : "desc");
    }
  };

  // Walk top-level + recursively expanded children in render order.
  // Children keep their natural array order (createdAt asc from the
  // SQL query); sort only governs the top-level rows so the Army
  // hierarchy stays visually intact.
  const renderRows = useMemo(() => {
    const out: ProjectDashboardRow[] = [];
    const walk = (row: ProjectDashboardRow) => {
      out.push(row);
      if (!expanded.has(row.id)) return;
      const kids = childrenByParent.get(row.id) ?? [];
      for (const k of kids) walk(k);
    };
    for (const top of sortedTopLevel) walk(top);
    return out;
  }, [sortedTopLevel, childrenByParent, expanded]);

  return (
    <div className="frame overflow-x-auto">
      <table className="w-full text-xs font-mono">
        <thead>
          <tr
            className="text-left text-2xs uppercase tracking-wider text-[var(--color-fg-muted)]"
            style={{ borderBottom: "1px solid var(--color-border-strong)" }}
          >
            <th scope="col" className="w-8 px-2 py-2" aria-label="Expand" />
            <Th
              label="Name"
              active={sortKey === "name"}
              dir={sortDir}
              onClick={() => handleSort("name")}
            />
            <Th
              label="Type"
              active={sortKey === "type"}
              dir={sortDir}
              onClick={() => handleSort("type")}
            />
            <th scope="col" className="px-3 py-2">
              Recipes
            </th>
            <Th
              label="Status"
              active={sortKey === "status"}
              dir={sortDir}
              onClick={() => handleSort("status")}
            />
            <Th
              label="Priority"
              active={sortKey === "priority"}
              dir={sortDir}
              onClick={() => handleSort("priority")}
            />
            <Th
              label="Completion"
              active={sortKey === "progressPercent"}
              dir={sortDir}
              onClick={() => handleSort("progressPercent")}
            />
            <th
              scope="col"
              className="px-3 py-2 text-right"
              aria-label="Row actions"
            />
          </tr>
        </thead>
        <tbody>
          {renderRows.map((row) => {
            const hasChildren = (childrenByParent.get(row.id) ?? []).length > 0;
            return (
              <DashboardRow
                key={row.id}
                row={row}
                hasChildren={hasChildren}
                expanded={expanded.has(row.id)}
                onToggleExpand={() => toggleExpanded(row.id)}
                ownedRecipes={ownedRecipes}
                projectNameById={projectNameById}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Th({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}) {
  return (
    <th scope="col" className="px-3 py-2 text-left">
      <button
        type="button"
        onClick={onClick}
        className={clsx(
          "uppercase tracking-wider transition-colors",
          active
            ? "text-[var(--color-cyan)]"
            : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]",
        )}
        aria-sort={
          active ? (dir === "asc" ? "ascending" : "descending") : "none"
        }
      >
        {label}
        {active ? (
          <span aria-hidden className="ml-1">
            {dir === "asc" ? "▲" : "▼"}
          </span>
        ) : null}
      </button>
    </th>
  );
}

function DashboardRow({
  row,
  hasChildren,
  expanded,
  onToggleExpand,
  ownedRecipes,
  projectNameById,
}: {
  row: ProjectDashboardRow;
  hasChildren: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  ownedRecipes: ReadonlyArray<{
    id: string;
    name: string;
    attachedProjectId: string | null;
  }>;
  projectNameById: Readonly<Record<string, string>>;
}) {
  const typeChipClass = TYPE_CHIP[row.type];
  // Tree-connector indent — 16px per depth level. depth 0 = no indent.
  const indentPx = row.depth * 16;

  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [attachOpen, setAttachOpen] = useState(false);

  const attachCandidates: ReadonlyArray<RecipeOption> = useMemo(() => {
    return ownedRecipes
      .filter((r) => r.attachedProjectId !== row.id)
      .map((r) => {
        const label = r.attachedProjectId
          ? projectNameById[r.attachedProjectId] ?? "(project)"
          : null;
        return { id: r.id, name: r.name, attachmentLabel: label };
      });
  }, [ownedRecipes, projectNameById, row.id]);

  const handleStatus = (next: DisplayStatus) => {
    startTransition(async () => {
      const result = await bumpProjectStatus({ id: row.id, status: next });
      if (result.ok) router.refresh();
    });
  };

  const handleType = (next: ProjectType) => {
    startTransition(async () => {
      const result = await updateProjectType({ id: row.id, type: next });
      if (result.ok) router.refresh();
    });
  };

  const handlePriority = (next: Priority | null) => {
    startTransition(async () => {
      const result = await updateProjectPriority({ id: row.id, priority: next });
      if (result.ok) router.refresh();
    });
  };

  const handleRecipeCellClick = () => {
    if (row.firstAttachedRecipeId) {
      router.push(`/recipes/${row.firstAttachedRecipeId}`);
    } else {
      setAttachOpen(true);
    }
  };

  return (
    <tr
      className={clsx(
        "hover:bg-[color-mix(in_srgb,var(--color-cyan)_4%,transparent)] transition-colors",
        pending && "opacity-70",
      )}
      style={{ borderBottom: "1px solid var(--color-border)" }}
      data-depth={row.depth}
    >
      <td className="px-2 py-2 w-10 text-center">
        {hasChildren ? (
          <button
            type="button"
            onClick={onToggleExpand}
            aria-expanded={expanded}
            aria-label={
              expanded ? `Collapse ${row.name}` : `Expand ${row.name}`
            }
            className="inline-flex items-center justify-center w-9 h-9 mx-auto text-[var(--color-fg-muted)] hover:text-[var(--color-cyan)] transition-colors transition-transform motion-reduce:transition-none rounded-sm"
          >
            {/* R7-011 — caret rotates 90deg on expand instead of swapping
                glyphs. Single ▸ glyph stays put; CSS rotation gives the
                state cue. Gated on prefers-reduced-motion (motion-reduce
                snaps the rotation without a tween). The 36×36 hit box
                clears WCAG 2.5.8 (Target Size, ≥24×24). */}
            <span
              aria-hidden
              className={clsx(
                "inline-block leading-none transition-transform",
                "motion-reduce:transition-none",
                expanded ? "rotate-90" : "rotate-0",
              )}
            >
              ▸
            </span>
          </button>
        ) : row.depth > 0 ? (
          <span
            aria-hidden
            className="block w-9 h-9 mx-auto text-[var(--color-fg-subtle)] opacity-40"
            title="No children"
          >
            ·
          </span>
        ) : null}
      </td>
      <td
        className="px-3 py-2 relative"
        style={{ paddingLeft: indentPx ? `${12 + indentPx}px` : undefined }}
      >
        {row.depth > 0 ? (
          <span
            aria-hidden
            className="absolute left-0 top-0 bottom-0 pointer-events-none"
            style={{
              left: `${4 + (row.depth - 1) * 16}px`,
              borderLeft: "1px dashed var(--color-border-strong)",
            }}
          />
        ) : null}
        <Link
          href={`/projects/${row.id}`}
          className="text-[var(--color-cyan)] hover:underline"
        >
          {row.name}
        </Link>
        {row.faction ? (
          <span className="ml-2 text-2xs text-[var(--color-fg-muted)]">
            {row.faction}
          </span>
        ) : null}
      </td>
      <td className="px-3 py-2">
        <InlineCellPopover
          triggerLabel={`Type · ${row.type}`}
          trigger={
            <span className={clsx("type-chip", typeChipClass)}>{row.type}</span>
          }
        >
          {/* P13.4 sub-project type rule: rows with a parent can only
              be Unit. Top-level rows can be any project type. */}
          {(row.parentId ? (["Unit"] as const) : projectTypes).map((t) => (
            <InlineCellPopoverItem
              key={t}
              active={t === row.type}
              onClick={() => handleType(t)}
            >
              {t}
            </InlineCellPopoverItem>
          ))}
        </InlineCellPopover>
      </td>
      <td className="px-3 py-2">
        <button
          type="button"
          onClick={handleRecipeCellClick}
          className="text-left cursor-pointer hover:opacity-80 transition-opacity"
          aria-label={
            row.firstAttachedRecipeId
              ? "Open attached recipe"
              : "Attach a recipe"
          }
        >
          {row.paletteHexes.length > 0 ? (
            <PaletteStrip hexes={row.paletteHexes} />
          ) : (
            <span className="text-2xs font-mono uppercase tracking-wider text-[var(--color-fg-muted)] hover:text-[var(--color-cyan)] transition-colors">
              + attach
            </span>
          )}
        </button>
        <AttachRecipeModal
          mode="project"
          projectId={row.id}
          open={attachOpen}
          onClose={() => setAttachOpen(false)}
          candidates={attachCandidates}
        />
      </td>
      <td className="px-3 py-2">
        <InlineCellPopover
          triggerLabel={`Status · ${row.status}`}
          trigger={
            <StatusPill status={STATUS_PILL[row.status]}>
              {row.status}
            </StatusPill>
          }
        >
          {STATUS_ORDER.map((s) => (
            <InlineCellPopoverItem
              key={s}
              active={s === row.status}
              onClick={() => handleStatus(s)}
            >
              {s}
            </InlineCellPopoverItem>
          ))}
        </InlineCellPopover>
      </td>
      <td className="px-3 py-2">
        <InlineCellPopover
          triggerLabel={`Priority · ${row.priority ?? "Unset"}`}
          trigger={
            <span className="font-mono text-xs text-[var(--color-fg-muted)]">
              {row.priority ?? "—"}
            </span>
          }
        >
          {priorities.map((p) => (
            <InlineCellPopoverItem
              key={p}
              active={p === row.priority}
              onClick={() => handlePriority(p)}
            >
              {p}
            </InlineCellPopoverItem>
          ))}
          <InlineCellPopoverItem
            destructive
            onClick={() => handlePriority(null)}
          >
            Clear
          </InlineCellPopoverItem>
        </InlineCellPopover>
      </td>
      <td className="px-3 py-2">
        <span className="inline-flex items-center gap-2">
          <ProgressBar percent={row.progressPercent} width={22} />
          <span className="text-2xs font-mono text-[var(--color-fg-muted)] tabular-nums">
            {row.progressPercent}%
          </span>
        </span>
      </td>
      <td className="px-3 py-2 text-right">
        {/* P13.3 — per-row Delete trigger. Inline + red so the dashboard
            stays scannable; the modal handles the destructive confirm. */}
        <DeleteProjectButton
          projectId={row.id}
          projectName={row.name}
          redirectToProjectsOnSuccess={false}
          inline
          label="Delete"
        />
      </td>
    </tr>
  );
}

function PaletteStrip({ hexes }: { hexes: ReadonlyArray<string> }) {
  if (hexes.length === 0) {
    return (
      <span className="text-2xs text-[var(--color-fg-muted)] opacity-50">
        no recipes
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1"
      role="list"
      aria-label={`Palette · ${hexes.length} swatch${hexes.length === 1 ? "" : "es"}`}
    >
      {hexes.slice(0, 8).map((hex, i) => (
        <span
          key={`${i}-${hex}`}
          role="listitem"
          aria-label={hex}
          title={hex}
          className="block w-3 h-3 rounded-sm"
          style={{
            background: hex,
            border: "1px solid var(--color-border-strong)",
          }}
        />
      ))}
    </span>
  );
}
