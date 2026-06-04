"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ProjectsDashboardTable,
  type ProjectDashboardRow,
} from "@/components/ProjectsDashboardTable";
import { ProjectInspector } from "@/components/projects/ProjectInspector";
import { CollapsibleSection } from "@/components/projects/CollapsibleSection";

/**
 * D2 — `/projects` master-detail workspace (Decisions 2026-06-03 §2).
 *
 * Single owner of the project table so it is never double-mounted across
 * breakpoints. The breakpoint branch is a true conditional MOUNT (driven
 * by matchMedia, the codebase's SSR-safe pattern) — not CSS `hidden` —
 * so the inactive layout adds zero DOM nodes (keeps the D2 <300
 * interactive-node budget after the 7,144-button grid left for /planner).
 *
 *   - Desktop ≥1024 (lg): two-pane master-detail. Left = filter + the
 *     project table (Name SELECTS, swapping the inspector WITHOUT
 *     navigation). Right = ProjectInspector with a Detail / Focus tab
 *     (Detail is the default home state; Focus is the FOCUS bench tab).
 *     PLANNER is NOT here on desktop — it lives at its own /planner route
 *     (D6). FOCUS is the inspector's Focus tab, not a stacked section.
 *
 *   - Mobile <1024: single pane. The table, then the collapsed-by-default
 *     FOCUS + PLANNER progressive-disclosure sections (M4). No inspector;
 *     the painter taps a row Name to navigate to `/projects/[id]`.
 *
 * The FOCUS bench + PLANNER cluster are passed in as server-rendered
 * nodes (`focusBench`, `plannerSection`) so this client shell stays
 * presentational and the heavy data-fetching stays on the server page.
 *
 * SSR-safe: starts desktop-first (`isDesktop = true`) so the server
 * markup === the first client render; an effect reads matchMedia and
 * flips to the mobile single-pane on narrow viewports. The selection +
 * filter state are client-only and don't affect hydration.
 */

interface Props {
  rows: ReadonlyArray<ProjectDashboardRow>;
  ownedRecipes: ReadonlyArray<{
    id: string;
    name: string;
    attachedProjectId: string | null;
  }>;
  projectNameById: Readonly<Record<string, string>>;
  /** Optional quick-add bar (server-composed). The page header already
   *  carries one, so this is normally omitted; kept for flexibility. */
  quickAdd?: ReactNode;
  /** The FOCUS bench (FocusPicker + FocusPanel + Stopwatch) — the
   *  inspector's Focus tab on desktop, the collapsed FOCUS section on
   *  mobile. */
  focusBench: ReactNode;
  /** The shared PLANNER cluster — the collapsed PLANNER section on mobile
   *  only (desktop PLANNER lives at /planner). */
  plannerSection: ReactNode;
  /** Sits below the workspace in both layouts (Top Wishes + recently
   *  bought line). */
  belowTable: ReactNode;
  /** The id of the painter's currently-focused project, used to seed the
   *  desktop inspector selection so it opens on something useful. */
  initialSelectedId: string | null;
  /** Summary line for the collapsed mobile FOCUS section header. */
  focusSummary: string;
}

export function ProjectsWorkspace({
  rows,
  ownedRecipes,
  projectNameById,
  quickAdd = null,
  focusBench,
  plannerSection,
  belowTable,
  initialSelectedId,
  focusSummary,
}: Props) {
  const [isDesktop, setIsDesktop] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setIsDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const [query, setQuery] = useState("");
  // Seed selection with the focused project (else first row) so the
  // desktop inspector opens on something meaningful.
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSelectedId ?? (rows.length > 0 ? rows[0]!.id : null),
  );

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    // Keep parents of matching children visible so the tree stays
    // navigable: match on name OR faction.
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.faction ? r.faction.toLowerCase().includes(q) : false),
    );
  }, [rows, query]);

  const selectedRow = useMemo(
    () => rows.find((r) => r.id === selectedId) ?? null,
    [rows, selectedId],
  );

  const filterInput = (
    <label className="frame flex items-center gap-2 px-3 py-2">
      <span className="text-2xs font-mono uppercase tracking-wider text-[var(--color-fg-muted)]">
        Filter
      </span>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter projects by name…"
        aria-label="Filter projects by name"
        className="flex-1 bg-transparent font-mono text-xs text-[var(--color-fg)] placeholder:text-[var(--color-fg-subtle)] focus:outline-none"
      />
    </label>
  );

  if (isDesktop) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
          {/* Left — quick add + filter + selectable table. */}
          <div className="min-w-0 space-y-3">
            {quickAdd}
            {filterInput}
            <ProjectsDashboardTable
              rows={filteredRows}
              ownedRecipes={ownedRecipes}
              projectNameById={projectNameById}
              selectedId={selectedId}
              onSelectProject={setSelectedId}
            />
          </div>
          {/* Right — project-detail inspector (Detail / Focus tab). Sticky
              so it stays in view while the painter scrolls a long list. */}
          <div className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)]">
            <ProjectInspector selected={selectedRow} focusTab={focusBench} />
          </div>
        </div>
        {belowTable}
      </div>
    );
  }

  // Mobile single pane: filter + table, then the collapsed FOCUS +
  // PLANNER disclosure sections (M4), then the below-table content.
  return (
    <div className="space-y-6">
      {quickAdd}
      {filterInput}
      <ProjectsDashboardTable
        rows={filteredRows}
        ownedRecipes={ownedRecipes}
        projectNameById={projectNameById}
      />
      <CollapsibleSection
        title="FOCUS"
        accentColor="green"
        summary={focusSummary}
      >
        {focusBench}
      </CollapsibleSection>
      <CollapsibleSection title="PLANNER" accentColor="amber">
        {plannerSection}
      </CollapsibleSection>
      {belowTable}
    </div>
  );
}
