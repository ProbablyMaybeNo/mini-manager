"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Panel } from "@/components/kit";
import { PageHeader } from "@/components/shell";
import { useIsDesktop } from "@/hooks/useBreakpoint";
import { cn } from "@/lib/cn";
import { rollupProjectMinutes } from "@/lib/projectTime";
import {
  projectMatchesRoster,
  sortRoster,
} from "@/lib/rosterStatus";
import type {
  ActivityEntry,
  CalendarEvent,
  DashboardSummary,
  Project,
} from "@/lib/types";
import { PlannerScreen } from "./PlannerScreen";
import { ProjectCreateWalkthrough } from "./ProjectCreateWalkthrough";
import {
  hasSeenWalkthrough,
  shouldShowProjectCreateWalkthrough,
} from "./projectCreateWalkthroughData";
import { ProjectPanelStack } from "./ProjectPanelStack";
import { ProjectsTable } from "./ProjectsTable";
import {
  RosterFilterBar,
  type RosterFilter,
  type RosterSort,
} from "./RosterFilterBar";
import { RightRail } from "./RightRail";
import { WelcomeCard } from "./WelcomeCard";

export type DashboardStatus = "ready" | "loading" | "error";

export interface DashboardViewProps {
  summary: DashboardSummary;
  projects: Project[];
  events: CalendarEvent[];
  activity: ActivityEntry[];
  /** Per-project logged minutes (UX-011) — keyed by project id, rolled up
   *  over sub-projects at render. Defaults to empty so non-data callers work. */
  projectMinutes?: Record<string, number>;
  status?: DashboardStatus;
  /** When set, open this project's detail panel (e.g. just after creation),
   *  then call onOpenConsumed so a refresh doesn't re-trigger it. */
  openProjectId?: string | null;
  onOpenConsumed?: () => void;
  /** RF-8: fired with the new id after createProject succeeds so the parent can
   *  feed it back via openProjectId and the new panel auto-opens. */
  onProjectCreated?: (id: string) => void;
  /** RF-8: one-shot signal to open CREATE mode on mount (tour deep-link). */
  autoCreate?: boolean;
  onAutoCreateConsumed?: () => void;
  onOpenProject?: (project: Project) => void;
  onAttachRecipe?: (project: Project) => void;
  onAddProject?: () => void;
  /** Opens the army-list import panel (re-homed to the dashboard, opposite
   *  + NEW PROJECT, per Ross). */
  onUploadArmyList?: () => void;
  onStartSession?: (project: Project) => void;
  onRetry?: () => void;
}

/** Find a project anywhere in the tree by id (rows + their sub-projects). */
function findProject(list: Project[], id: string): Project | null {
  for (const p of list) {
    if (p.id === id) return p;
    if (p.children) {
      const hit = findProject(p.children, id);
      if (hit) return hit;
    }
  }
  return null;
}

export function DashboardView({
  projects,
  events,
  activity,
  projectMinutes = {},
  status = "ready",
  openProjectId,
  onOpenConsumed,
  autoCreate,
  onAutoCreateConsumed,
  onOpenProject,
  onAttachRecipe,
  onAddProject,
  onUploadArmyList,
  onStartSession,
  onRetry,
}: DashboardViewProps) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // PP-1 cleanup flag: the slide-out edit inspector is no longer opened by a
  // dashboard row-click (rows now navigate to /projects/[id]). `inspectorOpen`
  // is kept only for the open-on-create transition below; the row-click path
  // that previously set it is gone. Safe to remove the inspector entirely once
  // the create flow stops routing through InspectorShell (follow-up).
  const [inspectorOpen, setInspectorOpen] = useState(false);
  // RF-11: the mobile full-screen PLANNER, opened from the Upcoming-Events bar.
  const [plannerOpen, setPlannerOpen] = useState(false);
  // Roster filter-chip row + SORT (4:4). Filter buckets are derived from each
  // project's completion + lifecycle status (see lib/rosterStatus); SORT
  // reorders the visible top-level rows. Both are view-only — they never mutate
  // the underlying data, so a row's stored status pill is unchanged.
  const [rosterFilter, setRosterFilter] = useState<RosterFilter>("ALL");
  const [rosterSort, setRosterSort] = useState<RosterSort>("completion-desc");
  // Phase 2: the project FLOW panel (Army/Unit, 440px overlay). A row-click
  // First-create walkthrough: armed by the open-on-create effect the FIRST
  // time a draft panel opens (gated by the localStorage "seen" flag). The
  // overlay scopes its anchor lookup to this dashboard subtree.
  const [walkthroughOpen, setWalkthroughOpen] = useState(false);
  const dashboardRef = useRef<HTMLDivElement>(null);
  const isDesktop = useIsDesktop();

  // Derive the selected project from the live tree (not a snapshot) so an
  // inline edit + router.refresh() shows fresh data in the open panel.
  const selected = selectedId ? findProject(projects, selectedId) : null;

  // The calendar grid receives the whole current month (so a deadline added
  // earlier this month still draws its dot — d9cfJYAVIx0C). The bottom ticker
  // is a true "upcoming" list, so it filters that same set to today-forward.
  const todayIso = new Date().toISOString().slice(0, 10);
  const upcomingEvents = events.filter((e) => e.date >= todayIso);

  // Roster filter + sort applied to the TOP-LEVEL rows. A container matches a
  // filter if it or any sub-project matches, so a filtered Army still drills.
  const visibleProjects = useMemo(() => {
    const filtered =
      rosterFilter === "ALL"
        ? projects
        : projects.filter((p) => projectMatchesRoster(p, rosterFilter, undefined, todayIso));
    return sortRoster(filtered, rosterSort, (p) => rollupProjectMinutes(p, projectMinutes));
  }, [projects, rosterFilter, rosterSort, projectMinutes, todayIso]);

  // A row click opens the full project inspector (ProjectPanelStack →
  // ProjectWorkspaceBody) — one panel with everything editable: name, type,
  // status, priority, model count, sub-projects, recipes, painting stages. Focus
  // stays an explicit per-row action (the ◎ icon); delete / attach / add-sub
  // remain wired through ProjectsTable.
  function openProject(p: Project) {
    onOpenProject?.(p);
    setSelectedId(p.id);
    setInspectorOpen(true);
  }

  // "+ New Project" creates a draft project immediately; the open-on-create
  // effect below opens its editable panel. No separate create form (Ross).
  function startCreate() {
    setInspectorOpen(false);
    setSelectedId(null);
    onAddProject?.();
  }

  // The tour deep-link's one-shot create signal — kicks the same draft-create.
  useEffect(() => {
    if (!autoCreate) return;
    setInspectorOpen(false);
    setSelectedId(null);
    onAddProject?.();
    onAutoCreateConsumed?.();
  }, [autoCreate, onAddProject, onAutoCreateConsumed]);

  // Open-on-create: a freshly created project arrives via openProjectId. Open
  // its panel once it resolves in the tree, then clear the request.
  useEffect(() => {
    if (!openProjectId) return;
    if (findProject(projects, openProjectId)) {
      // The freshly created draft resolved in the tree — open its editable panel.
      setSelectedId(openProjectId);
      setInspectorOpen(true);
      onOpenConsumed?.();
      // Arm the first-create walkthrough the first time a draft panel opens.
      // Gated on the localStorage "seen" flag + a webdriver guard so it never
      // auto-shows in E2E. Deferred a frame so the panel's anchors mount first.
      const isWebdriver =
        typeof navigator !== "undefined" && navigator.webdriver === true;
      if (
        shouldShowProjectCreateWalkthrough({
          seen: hasSeenWalkthrough(),
          isWebdriver,
        })
      ) {
        window.requestAnimationFrame(() => setWalkthroughOpen(true));
      }
    }
  }, [openProjectId, projects, onOpenConsumed]);

  // Desktop master-detail (DOP-002): when the inspector is open on md+, the
  // pane becomes a persistent in-flow right column (no scrim, table stays
  // visible) and the RightRail steps aside to make room for it. Below md the
  // inspector is an overlay (SlideOutPanel / the bottom sheet) so the RightRail
  // is irrelevant — keep it rendered there.
  const twoPane = isDesktop && inspectorOpen;

  const inspector = (
    <ProjectPanelStack
      projects={projects}
      rootId={selected?.id ?? null}
      projectMinutes={projectMinutes}
      open={inspectorOpen}
      onClose={() => setInspectorOpen(false)}
      onStartSession={(p) => {
        setInspectorOpen(false);
        onStartSession?.(p);
      }}
      onAttachRecipe={(p) => onAttachRecipe?.(p)}
    />
  );

  return (
    // Solid black canvas (vZsx) — overrides the near-black page token for this
    // surface so the dashboard reads as a true terminal background.
    // Top-level flex-row hosts the desktop master-detail pane to the right of
    // the dashboard column; below md the pane is a fixed overlay so this row is
    // a no-op single column.
    <div ref={dashboardRef} className="flex h-full bg-bg">
      <div className="flex min-w-0 flex-1 flex-col">
        {/* When the inspector squeezes this column (twoPane), tighten the
            padding so the roster + welcome card keep a usable content width and
            don't collapse into a cramped, momentarily-broken-looking wrap
            (UX-014). Full-width dashboard keeps the roomy p-10. */}
        <div
          className={cn(
            "flex flex-1 flex-col gap-7 overflow-y-auto",
            twoPane ? "px-5 py-6" : "p-10",
          )}
        >
          {/* No tagline text bar — the "+ New Project" button + the obvious
              PROJECTS panel already make the page's purpose clear (drev). */}
          <PageHeader title="DASHBOARD" />

          {status === "error" ? (
            <ErrorState onRetry={onRetry} />
          ) : status === "loading" ? (
            <LoadingState />
          ) : (
            // @container so StatRow (and any width-sensitive child) reflows to
            // the COLUMN width, not the viewport — it goes 2-up the moment the
            // inspector pane squeezes this column, instead of overlapping.
            <div className="@container flex min-w-0 flex-1 flex-col gap-6">
              {/* Skip-safe welcome MOTD (DOP-006) — dismissible, persists.
                  Collapses to a slim bar once the painter has a project so the
                  roster isn't pushed below the fold (UX-010). */}
              <WelcomeCard hasProjects={projects.length > 0} />
              <div data-tour="dashboard-projects" className="flex flex-col gap-4">
                {/* Section header row (4:58): PROJECTS ROSTER label + filter /
                    add-project icon affordances at the right edge. */}
                <div className="flex items-center justify-between">
                  <h2 className="label-osd text-fg">PROJECTS ROSTER</h2>
                  {/* ≥24px padded hit area around the 16px glyph (UX-003 /
                      WCAG 2.2 §2.5.8); gap-2 keeps the two targets from
                      colliding. The glyph size is unchanged — only the button
                      box grows. */}
                  <div className="flex items-center gap-2 text-fg-dim">
                    <button
                      type="button"
                      aria-label="Filter roster"
                      title="Filter roster"
                      onClick={() => setRosterFilter((f) => (f === "ALL" ? "IN PROGRESS" : "ALL"))}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-[6px] transition-colors hover:bg-fg/5 hover:text-cyan-lite focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan md:h-9 md:w-9"
                    >
                      <FilterIcon />
                    </button>
                    <button
                      type="button"
                      aria-label="New project"
                      title="New project"
                      onClick={startCreate}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-[6px] transition-colors hover:bg-fg/5 hover:text-cyan-lite focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan md:h-9 md:w-9"
                    >
                      <PlusCircleIcon />
                    </button>
                  </div>
                </div>
                {/* Filter-chip row + SORT (4:4). Hidden when the painter has no
                    projects yet — the empty roster CTA carries the moment. */}
                {projects.length > 0 && (
                  <RosterFilterBar
                    filter={rosterFilter}
                    sort={rosterSort}
                    onFilterChange={setRosterFilter}
                    onSortChange={setRosterSort}
                  />
                )}
                {/* Roster table in a bordered 12px container per 4:4. */}
                <div className="overflow-hidden rounded-[12px] border border-border bg-surface">
                  {projects.length > 0 && visibleProjects.length === 0 ? (
                    // Filtered to zero, but the painter HAS projects — show a
                    // filter-aware empty hint instead of the first-run CTA.
                    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
                      <p className="label-osd text-fg-dim">No projects match “{rosterFilter}”</p>
                      <button
                        type="button"
                        onClick={() => setRosterFilter("ALL")}
                        className="font-mono text-body text-cyan-lite underline-offset-4 hover:underline"
                      >
                        Clear filter
                      </button>
                    </div>
                  ) : (
                    <ProjectsTable
                      projects={visibleProjects}
                      projectMinutes={projectMinutes}
                      selectedId={selected?.id}
                      onOpenProject={openProject}
                      onAttachRecipe={(p) => onAttachRecipe?.(p)}
                      onAddProject={startCreate}
                    />
                  )}
                </div>
                {/* In the empty state the welcome card + the table's
                    "+ Create your first project" CTA already carry create, so
                    the cyan + NEW PROJECT button is hidden until there's a
                    roster (Ross). Upload Army stays — import is a valid first move. */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {projects.length > 0 && (
                    <Button variant="primary" onClick={startCreate} data-tour="dashboard-new-project">+ NEW PROJECT</Button>
                  )}
                  {onUploadArmyList && (
                    <Button variant="secondary" onClick={onUploadArmyList}>⬆ Upload Army</Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Upcoming events live ONLY in the right rail now (strict Figma 4:4 —
            no bottom ticker section in main). The button below stays mobile-only
            (xl:hidden), opening the full-screen PlannerScreen where the rail is
            hidden. */}
        <button
          type="button"
          onClick={() => setPlannerOpen(true)}
          aria-label="Open planner — upcoming events"
          className="flex w-full items-center gap-3 border-t border-border bg-surface px-4 py-3 text-left hover:bg-cyan/5 focus:outline-none focus-visible:bg-cyan/10 xl:hidden"
        >
          <span aria-hidden className="shrink-0 text-cyan-lite">🗓</span>
          <span className="shrink-0 label-osd text-fg">Upcoming events</span>
          <span className="min-w-0 flex-1 truncate font-body text-body text-fg-dim">
            {status === "ready" && upcomingEvents.length > 0
              ? upcomingEvents[0].name
              : "Nothing scheduled"}
          </span>
          <span aria-hidden className="shrink-0 text-cyan-lite">›</span>
        </button>
      </div>

      {/* Right rail (4:184) — a full-height dedicated side panel flush to the
          right edge with its own left hairline + inset, NOT a card inside the
          scrolling content. Steps aside while the desktop master-detail pane
          owns the right column (DOP-002); hidden below xl, where the mobile
          dashboard surfaces the planner via the bottom button above (RF-11). */}
      {!twoPane && status === "ready" && (
        <div className="hidden xl:flex">
          <RightRail events={events} activity={activity} />
        </div>
      )}

      {inspector}
      <PlannerScreen
        open={plannerOpen}
        onClose={() => setPlannerOpen(false)}
        events={events}
        activity={activity}
      />
      {/* First-create walkthrough — only while the draft panel is open. */}
      {walkthroughOpen && inspectorOpen && (
        <ProjectCreateWalkthrough
          containerRef={dashboardRef}
          onDismiss={() => setWalkthroughOpen(false)}
        />
      )}
    </div>
  );
}

/** Filter-funnel icon by the PROJECTS ROSTER header (4:327). */
function FilterIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M1.5 2.5h13l-5 6v4l-3 1.5V8.5l-5-6z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Plus-in-circle icon by the PROJECTS ROSTER header (4:330). */
function PlusCircleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 5v6M5 8h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-[72px] animate-pulse rounded-[12px] border border-border bg-surface-2"
          />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-[12px] border border-border bg-surface-2" />
      <span className="font-body text-body text-fg-dim">▸ Loading dashboard…</span>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <Panel label="ERROR" accent="red" className="max-w-md p-6">
      <p className="font-body text-body text-red-text">▸ Couldn’t load your dashboard.</p>
      <p className="mt-2 font-body text-body text-fg">
        The connection dropped. Check your network and try again.
      </p>
      {onRetry && (
        <div className="mt-4">
          <Button variant="danger" onClick={onRetry}>
            Retry
          </Button>
        </div>
      )}
    </Panel>
  );
}
