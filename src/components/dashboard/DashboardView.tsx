"use client";

import { useState } from "react";
import { Button, Panel } from "@/components/kit";
import { PageHeader } from "@/components/shell";
import type {
  ActivityEntry,
  CalendarEvent,
  DashboardSummary,
  Project,
  ProjectType,
} from "@/lib/types";
import { rollupProjectMinutes } from "@/lib/projectTime";
import { ProjectInspector } from "./ProjectInspector";
import { ProjectsTable } from "./ProjectsTable";
import { RightRail } from "./RightRail";
import { StatRow } from "./StatRow";
import { UpcomingEventsBar } from "./UpcomingEventsBar";

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
  onOpenProject,
  onFocusProject,
  onAttachRecipe,
  onAddProject,
  onUploadArmyList,
  onStartSession,
  onAddSubProject,
  onRetry,
}: DashboardViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);

  // Derive the selected project from the live tree (not a snapshot) so an
  // inline edit + router.refresh() shows fresh data in the open panel.
  const selected = selectedId ? findProject(projects, selectedId) : null;

  // The calendar grid receives the whole current month (so a deadline added
  // earlier this month still draws its dot — d9cfJYAVIx0C). The bottom ticker
  // is a true "upcoming" list, so it filters that same set to today-forward.
  const todayIso = new Date().toISOString().slice(0, 10);
  const upcomingEvents = events.filter((e) => e.date >= todayIso);

  // Row click manages the project (opens the inspector) — it deliberately no
  // longer jumps to the focus bench. Reaching focus is now an explicit
  // per-row action (the ◎ icon) or the inspector's "Start session" button.
  function openProject(p: Project) {
    setSelectedId(p.id);
    setInspectorOpen(true);
    onOpenProject?.(p);
  }

  return (
    // Solid black canvas (vZsx) — overrides the near-black page token for this
    // surface so the dashboard reads as a true terminal background.
    <div className="flex h-full flex-col bg-black">
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
        {/* No tagline text bar — the "+ New Project" button + the obvious
            PROJECTS panel already make the page's purpose clear (drev). */}
        <PageHeader title="DASHBOARD" />

        {status === "error" ? (
          <ErrorState onRetry={onRetry} />
        ) : status === "loading" ? (
          <LoadingState />
        ) : (
          <div className="flex flex-col gap-6 xl:flex-row">
            <div className="flex min-w-0 flex-1 flex-col gap-6">
              <StatRow summary={summary} />
              <Panel label="PROJECTS" cornerTicks className="p-4">
                <ProjectsTable
                  projects={projects}
                  projectMinutes={projectMinutes}
                  selectedId={selected?.id}
                  onOpenProject={openProject}
                  onFocusProject={(p) => onFocusProject?.(p)}
                  onAttachRecipe={(p) => onAttachRecipe?.(p)}
                  onAddSubProject={onAddSubProject}
                />
                <div className="mt-4 flex flex-wrap gap-2 border-t border-cyan/20 pt-4">
                  <Button variant="add" onClick={onAddProject}>+ New Project</Button>
                  {/* Upload-Army-List restored — opens the ArmyImportPanel
                      slide-out wired through onUploadArmyList. */}
                  <Button variant="secondary" onClick={onUploadArmyList}>
                    ⬆ Upload Army List
                  </Button>
                </div>
              </Panel>
            </div>
            <RightRail events={events} activity={activity} />
          </div>
        )}
      </div>

      {/* Bottom UPCOMING-EVENTS ticker restored — surfaces the dashboard's
          calendar events so newly-added dates show up immediately. */}
      <UpcomingEventsBar events={status === "ready" ? upcomingEvents : []} />

      <ProjectInspector
        project={selected}
        loggedMinutes={selected ? rollupProjectMinutes(selected, projectMinutes) : 0}
        open={inspectorOpen}
        onClose={() => setInspectorOpen(false)}
        onStartSession={(p) => {
          setInspectorOpen(false);
          onStartSession?.(p);
        }}
        onAttachRecipe={(p) => onAttachRecipe?.(p)}
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
      <span className="font-mono text-xs text-fg-faint">▸ Loading dashboard…</span>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <Panel label="ERROR" accent="red" className="max-w-md p-6">
      <p className="font-mono text-sm text-red">▸ Couldn’t load your dashboard.</p>
      <p className="mt-2 font-mono text-xs text-fg-dim">
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
