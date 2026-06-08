"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
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
  // REDESIGN-CLEANUP (fix 3) — Ross: "make the PURCHASED element neon green.
  // Maybe switch it to OWNED." This is a DISPLAY-only restyle: the PURCHASED
  // DisplayStatus is DERIVED (ownedCount > 0), never a stored DB enum, so the
  // tone flips to "ok" (neon green = owned/go per the design language) and the
  // visible label renders "OWNED" via STATUS_LABEL below — the computed key
  // stays "PURCHASED" so the rest of the app (and the wishlist enum) is intact.
  PURCHASED: "ok",
  BUILDING: "info",
  PRIMING: "info",
  PAINTING: "warning",
  BASING: "warning",
  COMPLETE: "ok",
  SHELVED: "neutral",
};

/** REDESIGN-CLEANUP (fix 3) — display-only status labels. The DisplayStatus
 *  KEY stays "PURCHASED" (derived from ownedCount, mirrored by the wishlist
 *  "Bought -> PURCHASED" vocabulary), but the dashboard renders it as
 *  "OWNED" — Ross's preferred wording + how the state reads elsewhere. Every
 *  other status renders verbatim. Use STATUS_LABEL anywhere a status string
 *  is shown to the user (pill text, popover options, aria labels). */
const STATUS_LABEL: Record<DisplayStatus, string> = {
  WISHLIST: "WISHLIST",
  PURCHASED: "OWNED",
  BUILDING: "BUILDING",
  PRIMING: "PRIMING",
  PAINTING: "PAINTING",
  BASING: "BASING",
  COMPLETE: "COMPLETE",
  SHELVED: "SHELVED",
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

/** UX-006 — row hierarchy: a finished or hibernating project is
 *  "settled" work, so its row is dimmed to let active/priority rows carry
 *  the eye in the 5-second scan. The focused row always overrides this
 *  (it stays fully lit + cyan-keyed regardless of status). */
function isSettledStatus(status: DisplayStatus): boolean {
  return status === "COMPLETE" || status === "SHELVED";
}

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
  Model: "type-chip-yellow",
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
  /** UX-006 — the pinned Focus project id. Its row renders the persistent
   *  cyan "active/selected line" (left-border + faint tint) keyed to the
   *  painter's current focus, the most-cited moodboard group-27 detail. */
  focusProjectId?: string | null;
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
  focusProjectId = null,
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
    <>
      {/* UX-901 / M3 — desktop table (md+). Hidden on phones; the mobile
          comparison table below (frozen-first-column, horizontally-
          scrollable) covers the sub-md viewport. M3 replaced the prior
          stacked-card mobile layout, which destroyed cross-record
          comparison [BP §7, §14]. */}
      {/* PHASE-1 — the "mission table": near-black surface inside the
          PROJECTS card.
          REDESIGN-CLEANUP (fix 1) — Ross flagged the "weird double border"
          here: this wrapper carried its OWN phosphor frame WHILE sitting
          inside the bordered PROJECTS `Card`, so the panel read as a box-in-
          a-box. The wrapper border is dropped so the Card supplies the single
          clean frame; the thead bottom-rule below is the only internal line. */}
      <div className="overflow-x-auto hidden md:block bg-[var(--color-bg-elevated)]">
        {/* D1 — mm-density-rows: desktop row height tracks the global
            Comfortable/Compact lever (--density-row-h). D3's library
            table opts in the same way. */}
        <table className="mm-density-rows w-full text-xs font-mono">
          <thead>
            <tr
              className="text-left text-2xs uppercase tracking-wider text-[var(--color-fg-muted)]"
              style={{
                borderBottom:
                  "1px solid color-mix(in srgb, var(--color-cyan) 45%, var(--color-border-strong))",
              }}
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
                  isFocus={row.id === focusProjectId}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      {/* M3 — mobile comparison table (sub-md). Replaces the prior
          stacked card layout, which destroyed cross-record comparison
          [BP §7, §14]. The list is restored as a true table with a
          FROZEN first column (project Name — the human-readable
          identifier [BP §7 task 1]) and the denser Type / Recipes /
          Status / Priority / Completion columns scrolling horizontally
          inside this bounded, labelled region. WCAG 2.2 §1.4.10 forbids
          horizontal scroll of the PAGE, not inside a bounded data region.
          Header row is frozen too; zebra + press-highlight (.mm-cmp-table
          in globals.css) hold the eye across rows. Row editing moves to a
          nonmodal bottom sheet (RowEditSheet) so the trigger never clips
          at the scrolled edge the way InlineCellPopover did. */}
      <div className="md:hidden space-y-3">
        <MobileSortBar
          sortKey={sortKey}
          sortDir={sortDir}
          onChangeKey={(k) => handleSort(k)}
        />
        {/* REDESIGN-CLEANUP (fix 1) — same double-border kill as the desktop
            table: this scroll region lives inside the PROJECTS `Card`, so its
            own frame is dropped and the Card carries the single clean border.
            Kept a faint phosphor focus-ring affordance on keyboard focus so
            the scrollable region still signals focus (WCAG 2.4.7). */}
        <div
          className="overflow-x-auto bg-[var(--color-bg-elevated)] focus-visible:outline-2 focus-visible:outline-[var(--color-cyan)]"
          role="region"
          aria-label="Projects comparison table"
          tabIndex={0}
        >
          <table className="mm-cmp-table w-full text-xs font-mono">
            <thead>
              <tr
                className="text-left text-2xs uppercase tracking-wider text-[var(--color-fg-muted)]"
                style={{ borderBottom: "1px solid var(--color-border-strong)" }}
              >
                <th
                  scope="col"
                  className="mm-cmp-freeze px-3 py-2 min-w-[8.5rem]"
                >
                  Name
                </th>
                <th scope="col" className="px-3 py-2 whitespace-nowrap">
                  Type
                </th>
                <th scope="col" className="px-3 py-2 whitespace-nowrap">
                  Recipes
                </th>
                <th scope="col" className="px-3 py-2 whitespace-nowrap">
                  Status
                </th>
                <th scope="col" className="px-3 py-2 whitespace-nowrap">
                  Priority
                </th>
                <th scope="col" className="px-3 py-2 whitespace-nowrap">
                  Completion
                </th>
                <th
                  scope="col"
                  className="px-3 py-2 text-right whitespace-nowrap"
                  aria-label="Row actions"
                />
              </tr>
            </thead>
            <tbody>
              {renderRows.map((row) => {
                const hasChildren =
                  (childrenByParent.get(row.id) ?? []).length > 0;
                return (
                  <MobileCompRow
                    key={row.id}
                    row={row}
                    hasChildren={hasChildren}
                    expanded={expanded.has(row.id)}
                    onToggleExpand={() => toggleExpanded(row.id)}
                    ownedRecipes={ownedRecipes}
                    projectNameById={projectNameById}
                    isFocus={row.id === focusProjectId}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/**
 * UX-901 — Sort control on the mobile card layout. The table's
 * sortable column headers aren't visible on phones, so this surfaces
 * the same sort keys as a labeled <select> + a direction toggle.
 * Keeps the dashboard sortable on every viewport.
 */
function MobileSortBar({
  sortKey,
  sortDir,
  onChangeKey,
}: {
  sortKey: SortKey;
  sortDir: SortDir;
  onChangeKey: (key: SortKey) => void;
}) {
  const SORT_LABELS: Record<SortKey, string> = {
    name: "Name",
    type: "Type",
    status: "Status",
    priority: "Priority",
    progressPercent: "Completion",
    updatedAt: "Recently updated",
  };
  return (
    <div className="frame px-3 py-2 flex items-center gap-2">
      <label
        htmlFor="mobile-sort-key"
        className="text-2xs font-mono uppercase tracking-wider text-[var(--color-fg-muted)]"
      >
        Sort
      </label>
      <select
        id="mobile-sort-key"
        value={sortKey}
        onChange={(e) => onChangeKey(e.target.value as SortKey)}
        className="flex-1 font-mono text-xs bg-[var(--color-bg)] px-2 py-1 frame"
      >
        {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
          <option key={k} value={k}>
            {SORT_LABELS[k]}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => onChangeKey(sortKey)}
        aria-label={`Toggle sort direction (currently ${sortDir === "asc" ? "ascending" : "descending"})`}
        className="tap-target inline-flex items-center justify-center w-9 h-9 frame text-[var(--color-fg-muted)] hover:text-[var(--color-cyan)] transition-colors"
      >
        <span aria-hidden className="text-xs font-mono">
          {sortDir === "asc" ? "▲" : "▼"}
        </span>
      </button>
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
    // D1 [D §9, §14] — aria-sort belongs on the column header
    // (role=columnheader → the <th>), not the inner button. On a button
    // it is ignored by assistive tech; here a screen reader announces the
    // current sort state when navigating the header.
    <th
      scope="col"
      className="px-3 py-2 text-left"
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={onClick}
        className={clsx(
          // P15.2 — bare text sort triggers had only the text line-height
          // (~16px) as their hit-box. tap-target + inline-flex floors the
          // button at 44px (mobile) / 32px (desktop) inside the header cell.
          "tap-target inline-flex items-center uppercase tracking-wider transition-colors",
          active
            ? "text-[var(--color-cyan)]"
            : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]",
        )}
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

/** UX (2026-06 walkthrough) — clicking anywhere on a row that isn't an
 *  interactive control navigates to the project page. Guards against
 *  descendant buttons / links / inputs / popover menus so inline edits,
 *  the expand caret, the Name link and Delete still do their own thing. */
function isInteractiveTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return Boolean(
    el.closest(
      'a, button, input, select, textarea, [role="menu"], [role="dialog"], [data-row-nav-ignore]',
    ),
  );
}

function DashboardRow({
  row,
  hasChildren,
  expanded,
  onToggleExpand,
  ownedRecipes,
  projectNameById,
  isFocus,
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
  /** UX-006 — true when this is the painter's pinned Focus project. */
  isFocus: boolean;
}) {
  const typeChipClass = TYPE_CHIP[row.type];
  // Tree-connector indent — 16px per depth level. depth 0 = no indent.
  const indentPx = row.depth * 16;
  // UX-006 — settled rows dim unless they're the focused row (focus wins).
  const dimmed = !isFocus && isSettledStatus(row.status);

  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [attachOpen, setAttachOpen] = useState(false);
  // UX-006 — the per-row ▸ overflow menu (currently just Delete) so the
  // destructive action is no longer an always-visible row link.
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

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
      onClick={(e) => {
        // Whole-row navigation: clicking empty row space opens the
        // project. Inline controls (caret, popovers, Name link, Delete)
        // are excluded so they keep their own behaviour.
        if (isInteractiveTarget(e.target)) return;
        router.push(`/projects/${row.id}`);
      }}
      className={clsx(
        // PHASE-1 — the cyan-highlighted hover/active row (the favourite
        // mission-table reference detail): a stronger cyan wash + a 2px
        // cyan left-edge marker via an inset box-shadow so the focused row
        // pops as the "selected" line on the screen.
        "group/row transition-colors cursor-pointer",
        "hover:bg-[color-mix(in_srgb,var(--color-cyan)_10%,transparent)]",
        "hover:[box-shadow:inset_2px_0_0_0_var(--color-cyan)]",
        "focus-within:bg-[color-mix(in_srgb,var(--color-cyan)_10%,transparent)]",
        "focus-within:[box-shadow:inset_2px_0_0_0_var(--color-cyan)]",
        // UX-006 — the PERSISTENT active line: the pinned Focus project's
        // row carries a steady faint-cyan tint + a 2px cyan left edge so it
        // reads as "selected" at rest (not just on hover). Hover still
        // layers its slightly stronger wash on top.
        isFocus &&
          "bg-[color-mix(in_srgb,var(--color-cyan)_8%,transparent)] [box-shadow:inset_2px_0_0_0_var(--color-cyan)]",
        // UX-006 — settled (complete/shelved) rows dim so active work wins
        // the scan. focus overrides (dimmed is false when isFocus).
        dimmed && "opacity-55",
        pending && "opacity-70",
      )}
      style={{ borderBottom: "1px solid var(--color-border)" }}
      data-depth={row.depth}
      data-focus-row={isFocus || undefined}
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
        {/* REDESIGN-CLEANUP (fix 2) — Ross: the project NAME should be white
            so TYPE (cyan chip) is the differentiator. White by default, still
            a link: hover lights it cyan + underlines. */}
        {/* UX-011 — tap-target floors the name link's own hit area to ≥24px
            (44px on mobile) so it clears WCAG 2.2 §2.5.8 instead of the bare
            ~17px text line-height. */}
        <Link
          href={`/projects/${row.id}`}
          className="tap-target group inline-flex items-center gap-1 text-[var(--color-fg)] hover:text-[var(--color-cyan)] hover:underline"
          title={`Open ${row.name}`}
        >
          {row.name}
          {/* UX (2026-06) — ↗ signals the Name (and the row) opens the
              project page. Muted by default, brightens on hover. */}
          <span
            aria-hidden
            className="text-2xs text-[var(--color-fg-subtle)] group-hover:text-[var(--color-cyan)] transition-colors"
          >
            ↗
          </span>
        </Link>
        {row.faction ? (
          <span className="ml-2 text-2xs text-[var(--color-fg-muted)]">
            {row.faction}
          </span>
        ) : null}
        {/* UX-006 — name-cell FOCUS chip reinforces the cyan active line for
            colour-blind users + when the left edge scrolls out of view. */}
        {isFocus ? (
          <span
            className="ml-2 inline-flex items-center font-mono text-2xs uppercase tracking-wider text-[var(--color-bg)] bg-[var(--color-cyan)] px-1.5 py-px rounded-[2px] align-middle"
            title="Your current focus project"
          >
            Focus
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
          // P15.2 — inline recipe-cell trigger had no min hit-box; the
          // palette strip / "+ attach" label are short. tap-target floors
          // the touch area without changing the strip's own footprint.
          className="tap-target inline-flex items-center text-left cursor-pointer hover:opacity-80 transition-opacity"
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
          triggerLabel={`Status · ${STATUS_LABEL[row.status]}`}
          trigger={
            <StatusPill status={STATUS_PILL[row.status]} tone="bar">
              {STATUS_LABEL[row.status]}
            </StatusPill>
          }
        >
          {STATUS_ORDER.map((s) => (
            <InlineCellPopoverItem
              key={s}
              active={s === row.status}
              onClick={() => handleStatus(s)}
            >
              {STATUS_LABEL[s]}
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
      {/* DASHBOARD-REDESIGN (Part B item 2) — completion renders as the
          SOLID ProgressBar (the gold-standard §06 loading bar), not the
          segmented blocks. Ross: "completion should be a solid progress bar
          like the gold-standard, not a thin dial." Stretches to fill a fixed
          column width with a tabular-nums readout chip so the column scans as
          a clean column of bars + numbers. Auto tone = red <25 / yellow
          25-74 / green ≥75. */}
      <td className="px-3 py-2">
        <div className="flex items-center gap-2 min-w-[9rem]">
          <ProgressBar
            percent={row.progressPercent}
            stretch
            height={10}
            className="flex-1"
          />
          <span className="text-2xs font-mono text-[var(--color-fg-muted)] tabular-nums w-9 text-right">
            {row.progressPercent}%
          </span>
        </div>
      </td>
      <td className="px-3 py-2 text-right">
        {/* UX-006 — the destructive Delete moved out of the always-visible
            row into a ▸ overflow menu (revealed on hover/focus, always
            available to keyboard + touch via the button). The
            DeleteProjectModal still owns the confirm step. */}
        <div className="relative inline-block" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={`Row actions for ${row.name}`}
            className={clsx(
              "tap-target inline-flex items-center justify-center w-8 h-8 rounded-sm transition-[color,opacity]",
              "text-[var(--color-fg-muted)] hover:text-[var(--color-cyan)]",
              // Reveal on row hover / keyboard focus; stay visible while open
              // and always for touch (no hover) via focus-visible + open.
              "opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100",
              menuOpen && "opacity-100 text-[var(--color-cyan)]",
            )}
          >
            <span aria-hidden className="text-sm leading-none">
              ▸
            </span>
          </button>
          {menuOpen ? (
            <div
              role="menu"
              aria-label={`Actions · ${row.name}`}
              className="absolute right-0 top-full mt-1 z-30 min-w-[150px] panel bg-[var(--color-bg-panel)] shadow-xl py-1"
            >
              <div role="none" className="px-1">
                <DeleteProjectButton
                  projectId={row.id}
                  projectName={row.name}
                  redirectToProjectsOnSuccess={false}
                  inline
                  label="Delete project"
                />
              </div>
            </div>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

/**
 * M3 — mobile comparison-table row.
 *
 * Replaces the prior `DashboardCard` stack (which destroyed cross-record
 * comparison [BP §7, §14]). One `<tr>` per project inside the frozen-
 * first-column, horizontally-scrollable `.mm-cmp-table`:
 *
 *   FROZEN col: chevron (if has children) + Name link (+ faction)
 *   Scroll cols: Type chip · Recipes strip · Status pill · Priority ·
 *                Completion bar · Delete
 *
 * Inline edits keep the same server actions as the desktop row. Type +
 * Recipes stay as the existing `InlineCellPopover` / AttachRecipeModal
 * (they live in the left/early columns where the popover can't clip).
 * Status + Priority — the cells most likely to sit at the scrolled right
 * edge where `InlineCellPopover` edge-clipped — open a NONMODAL bottom
 * sheet (`RowEditSheet`) instead, keeping the table visible behind it
 * [MOBILE §M3 step 4, BP §6, §7 task 3]. Drill-down + sessionStorage
 * expansion are shared with the desktop row via the parent's
 * `toggleExpanded`.
 */
function MobileCompRow({
  row,
  hasChildren,
  expanded,
  onToggleExpand,
  ownedRecipes,
  projectNameById,
  isFocus,
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
  /** UX-006 — true when this is the painter's pinned Focus project. */
  isFocus: boolean;
}) {
  const typeChipClass = TYPE_CHIP[row.type];
  // Mobile indent is shallower than the desktop table (8px per level) so
  // the frozen name column doesn't get pinched at 320px.
  const indentPx = row.depth * 8;
  // UX-006 — settled rows dim unless they're the focused row (focus wins).
  const dimmed = !isFocus && isSettledStatus(row.status);

  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [attachOpen, setAttachOpen] = useState(false);
  // Which field the row-edit bottom sheet is editing (null = closed).
  const [sheetField, setSheetField] = useState<"status" | "priority" | null>(
    null,
  );
  // UX-006 — per-row ▸ overflow menu (Delete lives here, not inline).
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

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
    setSheetField(null);
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
    setSheetField(null);
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
      onClick={(e) => {
        if (isInteractiveTarget(e.target)) return;
        router.push(`/projects/${row.id}`);
      }}
      className={clsx(
        "transition-colors cursor-pointer",
        // UX-006 — persistent cyan active line for the focused project,
        // mirroring the desktop table so both viewports flag the focus row.
        isFocus &&
          "bg-[color-mix(in_srgb,var(--color-cyan)_8%,transparent)] [box-shadow:inset_2px_0_0_0_var(--color-cyan)]",
        dimmed && "opacity-55",
        pending && "opacity-70",
      )}
      style={{ borderBottom: "1px solid var(--color-border)" }}
      data-depth={row.depth}
      data-focus-row={isFocus || undefined}
    >
      {/* FROZEN — chevron + name. Sticky-left so it stays put while the
          remaining columns scroll horizontally. */}
      <td
        className="mm-cmp-freeze px-3 py-2 align-top min-w-[8.5rem]"
        style={{ paddingLeft: indentPx ? `${12 + indentPx}px` : undefined }}
      >
        <div className="flex items-start gap-1.5">
          {hasChildren ? (
            <button
              type="button"
              onClick={onToggleExpand}
              aria-expanded={expanded}
              aria-label={
                expanded ? `Collapse ${row.name}` : `Expand ${row.name}`
              }
              className="tap-target shrink-0 inline-flex items-center justify-center w-8 h-8 -ml-1 text-[var(--color-fg-muted)] hover:text-[var(--color-cyan)] transition-colors transition-transform motion-reduce:transition-none rounded-sm"
            >
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
            <span aria-hidden className="block w-3 shrink-0" />
          ) : null}
          <span className="min-w-0">
            {/* REDESIGN-CLEANUP (fix 2) — name white (matches desktop); link
                hover lights cyan + underline. */}
            {/* UX-011 — tap-target floors the mobile name link to the 44px
                touch minimum. */}
            <Link
              href={`/projects/${row.id}`}
              className="tap-target group flex items-center gap-1 text-xs font-mono text-[var(--color-fg)] hover:text-[var(--color-cyan)] hover:underline"
              title={`Open ${row.name}`}
            >
              <span className="truncate">{row.name}</span>
              {/* UX (2026-06) — ↗ open-project affordance (matches desktop). */}
              <span
                aria-hidden
                className="shrink-0 text-2xs text-[var(--color-fg-subtle)] group-hover:text-[var(--color-cyan)] transition-colors"
              >
                ↗
              </span>
            </Link>
            {row.faction ? (
              <span className="block text-2xs font-mono text-[var(--color-fg-muted)] truncate">
                {row.faction}
              </span>
            ) : null}
            {isFocus ? (
              <span
                className="mt-0.5 inline-flex items-center font-mono text-2xs uppercase tracking-wider text-[var(--color-bg)] bg-[var(--color-cyan)] px-1.5 py-px rounded-[2px]"
                title="Your current focus project"
              >
                Focus
              </span>
            ) : null}
          </span>
        </div>
      </td>

      {/* Type — InlineCellPopover (early column, no edge-clip risk). */}
      <td className="px-3 py-2 align-top whitespace-nowrap">
        <InlineCellPopover
          triggerLabel={`Type · ${row.type}`}
          trigger={
            <span className={clsx("type-chip", typeChipClass)}>{row.type}</span>
          }
        >
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

      {/* Recipes — palette strip / + attach. */}
      <td className="px-3 py-2 align-top whitespace-nowrap">
        <button
          type="button"
          onClick={handleRecipeCellClick}
          className="tap-target inline-flex items-center text-left cursor-pointer hover:opacity-80 transition-opacity"
          aria-label={
            row.firstAttachedRecipeId ? "Open attached recipe" : "Attach a recipe"
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

      {/* Status — opens the nonmodal bottom sheet (no edge-clip). */}
      <td className="px-3 py-2 align-top whitespace-nowrap">
        <button
          type="button"
          onClick={() => setSheetField("status")}
          aria-haspopup="dialog"
          aria-expanded={sheetField === "status"}
          aria-label={`Edit status · ${STATUS_LABEL[row.status]}`}
          className="tap-target inline-flex items-center cursor-pointer hover:opacity-90 transition-opacity"
        >
          <StatusPill status={STATUS_PILL[row.status]} tone="bar">
            {STATUS_LABEL[row.status]}
          </StatusPill>
        </button>
      </td>

      {/* Priority — opens the nonmodal bottom sheet. */}
      <td className="px-3 py-2 align-top whitespace-nowrap">
        <button
          type="button"
          onClick={() => setSheetField("priority")}
          aria-haspopup="dialog"
          aria-expanded={sheetField === "priority"}
          aria-label={`Edit priority · ${row.priority ?? "Unset"}`}
          className="tap-target inline-flex items-center cursor-pointer hover:opacity-90 transition-opacity"
        >
          <span className="font-mono text-2xs uppercase tracking-wider text-[var(--color-fg-muted)] frame px-2 py-0.5">
            {row.priority ?? "—"}
          </span>
        </button>
      </td>

      {/* Completion — SOLID ProgressBar (Part B item 2), matching the
          desktop treatment. */}
      <td className="px-3 py-2 align-top whitespace-nowrap">
        <span className="inline-flex items-center gap-2">
          <ProgressBar
            percent={row.progressPercent}
            height={10}
            className="w-16"
          />
          <span className="text-2xs font-mono text-[var(--color-fg-muted)] tabular-nums">
            {row.progressPercent}%
          </span>
        </span>
      </td>

      {/* Row actions — ▸ overflow menu holding the (destructive) Delete,
          matching the desktop treatment so phone + desktop agree. */}
      <td className="px-3 py-2 align-top text-right whitespace-nowrap">
        <div className="relative inline-block" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={`Row actions for ${row.name}`}
            className={clsx(
              "tap-target inline-flex items-center justify-center w-8 h-8 rounded-sm transition-colors",
              menuOpen
                ? "text-[var(--color-cyan)]"
                : "text-[var(--color-fg-muted)] hover:text-[var(--color-cyan)]",
            )}
          >
            <span aria-hidden className="text-sm leading-none">
              ▸
            </span>
          </button>
          {menuOpen ? (
            <div
              role="menu"
              aria-label={`Actions · ${row.name}`}
              className="absolute right-0 top-full mt-1 z-30 min-w-[150px] panel bg-[var(--color-bg-panel)] shadow-xl py-1"
            >
              <div role="none" className="px-1">
                <DeleteProjectButton
                  projectId={row.id}
                  projectName={row.name}
                  redirectToProjectsOnSuccess={false}
                  inline
                  label="Delete project"
                />
              </div>
            </div>
          ) : null}
        </div>
      </td>

      {/* Nonmodal row-edit bottom sheet — keeps the table visible behind
          it; mounted lazily only when a Status/Priority cell is tapped. */}
      {sheetField !== null ? (
        <RowEditSheet
          projectName={row.name}
          field={sheetField}
          currentStatus={row.status}
          currentPriority={row.priority}
          onSelectStatus={handleStatus}
          onSelectPriority={handlePriority}
          onClose={() => setSheetField(null)}
        />
      ) : null}
    </tr>
  );
}

/**
 * M3 — nonmodal row-edit bottom sheet for the mobile comparison table.
 *
 * Tapping a row's Status or Priority cell opens this sheet pinned to the
 * viewport bottom (clear of the fixed tab bar) with a visible Close (×)
 * and Escape/click-outside/Back dismissal — it does NOT clip at the
 * scrolled right edge the way the absolute-positioned `InlineCellPopover`
 * did [MOBILE §M3 step 4]. It is NONMODAL: no backdrop, the table stays
 * readable behind it [BP §7 task 3 "a nonmodal side panel keeps the table
 * visible"].
 *
 * Robustness pattern is the one the gap-fill sheet proved (UX-1301):
 * portal to document.body so `position:fixed` is genuinely viewport-
 * relative, and place it via the explicit `.row-edit-sheet` `@media`
 * `!important` rule in globals.css rather than a Tailwind `max-md:`
 * variant (Tailwind v4 drops the important-prefix form, which let the
 * gap-fill sheet clip its header off-screen — twice).
 */
function RowEditSheet({
  projectName,
  field,
  currentStatus,
  currentPriority,
  onSelectStatus,
  onSelectPriority,
  onClose,
}: {
  projectName: string;
  field: "status" | "priority";
  currentStatus: DisplayStatus;
  currentPriority: Priority | null;
  onSelectStatus: (next: DisplayStatus) => void;
  onSelectPriority: (next: Priority | null) => void;
  onClose: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  // Escape + click-outside dismiss — same contract as the gap-fill sheet.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) onClose();
    };
    // Back button (popstate) also dismisses so Android Back closes the
    // sheet rather than navigating away [BP §6 bottom-sheets/Back].
    const onPop = () => onClose();
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDocClick);
    window.addEventListener("popstate", onPop);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDocClick);
      window.removeEventListener("popstate", onPop);
    };
  }, [onClose]);

  const heading =
    field === "status"
      ? `Status · ${projectName}`
      : `Priority · ${projectName}`;

  const sheet = (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="false"
      aria-label={heading}
      className={clsx(
        "row-edit-sheet z-50 frame-strong bg-[var(--color-bg-panel)] shadow-xl",
        "flex flex-col overflow-hidden",
      )}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-[var(--color-border)]">
        <p className="flex-1 min-w-0 truncate text-2xs font-mono uppercase tracking-wider text-[var(--color-fg-muted)]">
          {heading}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close row editor"
          className="tap-target inline-flex items-center justify-center text-sm font-mono text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] px-1"
        >
          ×
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-1" role="menu" aria-label={heading}>
        {field === "status"
          ? STATUS_ORDER.map((s) => (
              <RowEditOption
                key={s}
                active={s === currentStatus}
                onClick={() => onSelectStatus(s)}
              >
                {STATUS_LABEL[s]}
              </RowEditOption>
            ))
          : (
            <>
              {priorities.map((p) => (
                <RowEditOption
                  key={p}
                  active={p === currentPriority}
                  onClick={() => onSelectPriority(p)}
                >
                  {p}
                </RowEditOption>
              ))}
              <RowEditOption destructive onClick={() => onSelectPriority(null)}>
                Clear
              </RowEditOption>
            </>
          )}
      </div>
    </div>
  );

  // Portal to body so `position:fixed` escapes any contained ancestor and
  // the `.row-edit-sheet` media rule resolves against the viewport.
  if (typeof document === "undefined") return sheet;
  return createPortal(sheet, document.body);
}

/** Menu row inside RowEditSheet — mirrors InlineCellPopoverItem's
 *  typography + active/destructive states but floored to a 44px touch
 *  target for the sheet context. */
function RowEditOption({
  active,
  destructive,
  onClick,
  children,
}: {
  active?: boolean;
  destructive?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      aria-current={active || undefined}
      className={clsx(
        "tap-target w-full text-left px-3 py-2 flex items-center font-mono text-xs uppercase tracking-wider transition-colors",
        destructive
          ? "text-[var(--color-red)] hover:bg-[color-mix(in_srgb,var(--color-red)_12%,transparent)]"
          : "text-[var(--color-fg)] hover:bg-[color-mix(in_srgb,var(--color-cyan)_10%,transparent)]",
        active && !destructive && "text-[var(--color-cyan)]",
      )}
    >
      <span aria-hidden className="mr-1">
        {active ? "▸" : " "}
      </span>
      {children}
    </button>
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
