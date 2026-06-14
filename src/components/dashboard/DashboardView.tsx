"use client";

import { useState } from "react";
import { Button, Panel } from "@/components/kit";
import { PageHeader } from "@/components/shell";
import type {
  ActivityEntry,
  CalendarEvent,
  DashboardSummary,
  Project,
} from "@/lib/types";
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
  status?: DashboardStatus;
  onOpenProject?: (project: Project) => void;
  onAttachRecipe?: (project: Project) => void;
  onAddProject?: () => void;
  onUploadArmyList?: () => void;
  onStartSession?: (project: Project) => void;
  onRetry?: () => void;
}

const TAGLINE = "Project hub, everything you need to manage your painting progress.";

export function DashboardView({
  summary,
  projects,
  events,
  activity,
  status = "ready",
  onOpenProject,
  onAttachRecipe,
  onAddProject,
  onUploadArmyList,
  onStartSession,
  onRetry,
}: DashboardViewProps) {
  const [selected, setSelected] = useState<Project | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);

  function openProject(p: Project) {
    setSelected(p);
    setInspectorOpen(true);
    onOpenProject?.(p);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
        <PageHeader title="DASHBOARD" tagline={TAGLINE} />

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
                  selectedId={selected?.id}
                  onOpenProject={openProject}
                  onAttachRecipe={(p) => onAttachRecipe?.(p)}
                />
                <div className="mt-4 flex flex-wrap gap-2 border-t border-cyan/20 pt-4">
                  <Button onClick={onAddProject}>+ Add Project</Button>
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

      <UpcomingEventsBar events={status === "ready" ? events : []} />

      <ProjectInspector
        project={selected}
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
