"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { useToast } from "@/components/kit";
import { deriveDashboardSummary } from "@/mock/derive";
import { createProject } from "@/lib/actions/projects";
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
  projectMinutes,
}: {
  projects: Project[];
  events: CalendarEvent[];
  activity: ActivityEntry[];
  sessionStats: SessionStats;
  projectMinutes: Record<string, number>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast, node } = useToast();
  const [, startTransition] = useTransition();
  const [newOpen, setNewOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  // Final tutorial step lands here as `/dashboard?tour=create` to open the
  // create-project flow. Auto-open the panel once, then strip the param so a
  // refresh / back doesn't re-trigger it.
  useEffect(() => {
    if (searchParams.get("tour") === "create") {
      setNewOpen(true);
      router.replace("/dashboard");
    }
  }, [searchParams, router]);

  const summary = deriveDashboardSummary(projects, sessionStats);

  return (
    <>
      <DashboardView
        summary={summary}
        projects={projects}
        events={events}
        activity={activity}
        projectMinutes={projectMinutes}
        onStartSession={(p) => router.push(`/focus?project=${p.id}`)}
        onFocusProject={(p) => router.push(`/focus?project=${p.id}`)}
        onAttachRecipe={() => router.push("/recipes")}
        onAddProject={() => setNewOpen(true)}
        onUploadArmyList={() => setImportOpen(true)}
        onAddSubProject={(parent, childType, name) => {
          // D3 / OR6fdf — add a Unit under an Army/Warband, or a Model under a
          // Unit. The picker only ever yields "Unit" / "Model" (both valid DB
          // project types); guard the rest so the cast is sound.
          if (childType !== "Unit" && childType !== "Model") return;
          startTransition(async () => {
            const res = await createProject({
              name,
              type: childType,
              // Seed a single model so the new sub-project has a non-zero
              // denominator; the painter can adjust the count later.
              count: 1,
              parentId: parent.id,
            });
            if (res.ok) router.refresh();
            else toast(res.error, "red");
          });
        }}
        onRetry={() => router.refresh()}
      />
      <NewProjectPanel open={newOpen} onClose={() => setNewOpen(false)} />
      <ArmyImportPanel open={importOpen} onClose={() => setImportOpen(false)} />
      {node}
    </>
  );
}
