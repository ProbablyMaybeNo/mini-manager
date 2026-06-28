"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Panel } from "@/components/kit";
import { PageHeader } from "@/components/shell";
import { useIsDesktop } from "@/hooks/useBreakpoint";
import type {
  ActivityEntry,
  CalendarEvent,
  DashboardSummary,
  Project,
  ProjectType,
} from "@/lib/types";
import { ContinuePainting } from "./ContinuePainting";
import { CreateProjectView } from "./CreateProjectView";
import { InspectorShell } from "./InspectorShell";
import { PlannerScreen } from "./PlannerScreen";
import { ProjectPanelStack } from "./ProjectPanelStack";
import { ProjectsTable } from "./ProjectsTable";
import { RightRail } from "./RightRail";
import { StatRow } from "./StatRow";
import { UpcomingEventsBar } from "./UpcomingEventsBar";
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
  onFocusProject?: (project: Project) => void;
  onAttachRecipe?: (project: Project) => void;
  onAddProject?: () => void;
  onUploadArmyList?: () => void;
  onStartSession?: (project: Project) => void;
  onAddSubProject?: (parent: Project, childType: ProjectType, name: string) => void;
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
  summary,
  projects,
  events,
  activity,
  projectMinutes = {},
  status = "ready",
  openProjectId,
  onOpenConsumed,
  onProjectCreated,
  autoCreate,
  onAutoCreateConsumed,
  onOpenProject,
  onFocusProject,
  onAttachRecipe,
  onAddProject,
  onUploadArmyList,
  onStartSession,
  onAddSubProject,
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
  // RF-8: "+ New Project" opens the project page in CREATE mode (blank fields);
  // no row is persisted until SAVE. Mutually exclusive with the edit inspector.
  const [creating, setCreating] = useState(false);
  // RF-11: the mobile full-screen PLANNER, opened from the Upcoming-Events bar.
  const [plannerOpen, setPlannerOpen] = useState(false);
  const isDesktop = useIsDesktop();

  // Derive the selected project from the live tree (not a snapshot) so an
  // inline edit + router.refresh() shows fresh data in the open panel.
  const selected = selectedId ? findProject(projects, selectedId) : null;

  // The calendar grid receives the whole current month (so a deadline added
  // earlier this month still draws its dot — d9cfJYAVIx0C). The bottom ticker
  // is a true "upcoming" list, so it filters that same set to today-forward.
  const todayIso = new Date().toISOString().slice(0, 10);
  const upcomingEvents = events.filter((e) => e.date >= todayIso);

  // PP-1: a row click now navigates to the dedicated project PAGE
  // (/projects/[id]) instead of opening the slide-out inspector. Focus is still
  // an explicit per-row action (the ◎ icon); delete / attach / add-sub remain
  // wired through ProjectsTable's own per-row controls.
  function openProject(p: Project) {
    onOpenProject?.(p);
    router.push(`/projects/${p.id}`);
  }

  // RF-8: open the blank create view (closing any open edit inspector first).
  function startCreate() {
    setInspectorOpen(false);
    setSelectedId(null);
    setCreating(true);
    onAddProject?.();
  }

  // RF-8: consume the tour deep-link's one-shot create signal.
  useEffect(() => {
    if (!autoCreate) return;
    setInspectorOpen(false);
    setSelectedId(null);
    setCreating(true);
    onAutoCreateConsumed?.();
  }, [autoCreate, onAutoCreateConsumed]);

  // Open-on-create: a freshly created project arrives via openProjectId. Open
  // its panel once it resolves in the tree, then clear the request.
  useEffect(() => {
    if (!openProjectId) return;
    if (findProject(projects, openProjectId)) {
      // A freshly created project resolved in the tree — leave create mode and
      // open its real edit panel (RF-8's "transition to edit mode").
      setCreating(false);
      setSelectedId(openProjectId);
      setInspectorOpen(true);
      onOpenConsumed?.();
    }
  }, [openProjectId, projects, onOpenConsumed]);

  // Desktop master-detail (DOP-002): when the inspector is open on md+, the
  // pane becomes a persistent in-flow right column (no scrim, table stays
  // visible) and the RightRail steps aside to make room for it. Below md the
  // inspector is an overlay (SlideOutPanel / the bottom sheet) so the RightRail
  // is irrelevant — keep it rendered there.
  const twoPane = isDesktop && (inspectorOpen || creating);

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

  // RF-8 create-mode surface — the project page, blank. Rendered in the same
  // shell as the edit inspector (desktop pane / mobile full-screen). On a
  // successful create, the new id flows back through openProjectId and the
  // effect above swaps this for the real edit panel.
  const createInspector = (
    <InspectorShell
      open={creating}
      title="New Project"
      breadcrumb="DASHBOARD ▸ NEW"
      onClose={() => setCreating(false)}
    >
      <CreateProjectView
        onCreated={(id) => {
          // Hand the new id up; the parent sets openProjectId, and once the row
          // resolves in the tree the auto-open effect swaps create → edit.
          onProjectCreated?.(id);
        }}
      />
    </InspectorShell>
  );

  return (
    // Solid black canvas (vZsx) — overrides the near-black page token for this
    // surface so the dashboard reads as a true terminal background.
    // Top-level flex-row hosts the desktop master-detail pane to the right of
    // the dashboard column; below md the pane is a fixed overlay so this row is
    // a no-op single column.
    <div className="flex h-full bg-bg">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-1 flex-col gap-7 overflow-y-auto p-10">
          {/* No tagline text bar — the "+ New Project" button + the obvious
              PROJECTS panel already make the page's purpose clear (drev). */}
          <PageHeader title="DASHBOARD" />

          {status === "error" ? (
            <ErrorState onRetry={onRetry} />
          ) : status === "loading" ? (
            <LoadingState />
          ) : (
            <div className="flex flex-col gap-6 xl:flex-row">
              {/* @container so StatRow (and any width-sensitive child) reflows to
                  the COLUMN width, not the viewport — it goes 2-up the moment the
                  inspector pane squeezes this column, instead of overlapping. */}
              <div className="@container flex min-w-0 flex-1 flex-col gap-6">
                {/* Skip-safe welcome MOTD (DOP-006) — dismissible, persists. */}
                <WelcomeCard />
                <StatRow summary={summary} />
                <div data-tour="dashboard-projects" className="flex flex-col gap-4">
                  {/* Section header row (4:4): PROJECTS ROSTER label. */}
                  <div className="flex items-center justify-between">
                    <h2 className="label-osd text-fg">PROJECTS ROSTER</h2>
                  </div>
                  {/* Roster table in a bordered 12px container per 4:4. */}
                  <div className="overflow-hidden rounded-[12px] border border-border bg-surface">
                    <ProjectsTable
                      projects={projects}
                      projectMinutes={projectMinutes}
                      selectedId={selected?.id}
                      onOpenProject={openProject}
                      onFocusProject={(p) => onFocusProject?.(p)}
                      onAttachRecipe={(p) => onAttachRecipe?.(p)}
                      onAddSubProject={onAddSubProject}
                      onAddProject={startCreate}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="primary" onClick={startCreate} data-tour="dashboard-new-project">+ NEW PROJECT</Button>
                    {/* Upload-Army-List restored — opens the ArmyImportPanel
                        slide-out wired through onUploadArmyList. */}
                    <Button variant="secondary" onClick={onUploadArmyList}>
                      ⬆ Upload Army List
                    </Button>
                  </div>
                </div>

                {/* DOP-003 — "continue painting" tier fills the previously empty
                    lower half: the projects mid-paint, ready to resume in one
                    click. Renders nothing when nothing's in progress, so a fresh
                    account's dashboard stays clean. */}
                <ContinuePainting
                  projects={projects}
                  projectMinutes={projectMinutes}
                  onResume={(p) => onFocusProject?.(p)}
                  onOpenProject={openProject}
                />
              </div>
              {/* RightRail steps aside while the desktop pane occupies the
                  right column (DOP-002). RF-11: hidden below xl — the mobile
                  dashboard shows only cards + the Upcoming-Events bar, which
                  opens the full-screen PlannerScreen instead. */}
              {!twoPane && (
                <div className="hidden xl:flex">
                  <RightRail events={events} activity={activity} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom UPCOMING-EVENTS ticker. Desktop (xl+): the informational
            ticker. Mobile (RF-11): a tappable bar that opens the full-screen
            PlannerScreen (calendar + +Date + activity tracker). */}
        <div className="hidden xl:block">
          <UpcomingEventsBar events={status === "ready" ? upcomingEvents : []} />
        </div>
        <button
          type="button"
          onClick={() => setPlannerOpen(true)}
          aria-label="Open planner — upcoming events"
          className="flex w-full items-center gap-3 border-t border-border bg-surface px-4 py-3 text-left hover:bg-cyan/5 focus:outline-none focus-visible:bg-cyan/10 xl:hidden"
        >
          <span aria-hidden className="shrink-0 text-cyan">🗓</span>
          <span className="shrink-0 label-osd text-fg">Upcoming events</span>
          <span className="min-w-0 flex-1 truncate font-body text-body text-fg-dim">
            {status === "ready" && upcomingEvents.length > 0
              ? upcomingEvents[0].name
              : "Nothing scheduled"}
          </span>
          <span aria-hidden className="shrink-0 text-cyan">›</span>
        </button>
      </div>

      {inspector}
      {createInspector}
      <PlannerScreen
        open={plannerOpen}
        onClose={() => setPlannerOpen(false)}
        events={events}
        activity={activity}
      />
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[72px] animate-pulse border border-cyan/20 bg-cyan/5" />
        ))}
      </div>
      <div className="h-72 animate-pulse border border-cyan/20 bg-cyan/5" />
      <span className="font-body text-body text-fg">▸ Loading dashboard…</span>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <Panel label="ERROR" accent="red" className="max-w-md p-6">
      <p className="font-body text-body text-red">▸ Couldn’t load your dashboard.</p>
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
