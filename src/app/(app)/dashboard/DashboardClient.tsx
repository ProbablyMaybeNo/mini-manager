"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { deriveDashboardSummary } from "@/mock/derive";
import type {
  ActivityEntry,
  CalendarEvent,
  Project,
  SessionStats,
} from "@/lib/types";
import { NewProjectPanel } from "./NewProjectPanel";
import { ArmyImportPanel } from "./ArmyImportPanel";

/**
 * Dashboard client shell. Receives the signed-in user's REAL data (loaded
 * server-side via loadAppData) and wires the interactive bits: the create /
 * import modals and the navigation callbacks. Creating a project or event
 * calls a server action that revalidates `/dashboard`, so the server
 * component re-runs and this re-renders with fresh data.
 */
export function DashboardClient({
  projects,
  events,
  activity,
  sessionStats,
}: {
  projects: Project[];
  events: CalendarEvent[];
  activity: ActivityEntry[];
  sessionStats: SessionStats;
}) {
  const router = useRouter();
  const [newOpen, setNewOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const summary = deriveDashboardSummary(projects, sessionStats);

  return (
    <>
      <DashboardView
        summary={summary}
        projects={projects}
        events={events}
        activity={activity}
        onStartSession={(p) => router.push(`/focus?project=${p.id}`)}
        onFocusProject={(p) => router.push(`/focus?project=${p.id}`)}
        onAttachRecipe={() => router.push("/recipes")}
        onAddProject={() => setNewOpen(true)}
        onUploadArmyList={() => setImportOpen(true)}
        onRetry={() => router.refresh()}
      />
      <NewProjectPanel open={newOpen} onClose={() => setNewOpen(false)} />
      <ArmyImportPanel open={importOpen} onClose={() => setImportOpen(false)} />
    </>
  );
}
