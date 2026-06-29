"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { ArmyImportPanel } from "./ArmyImportPanel";
import { useToast } from "@/components/kit";
import { createProject } from "@/lib/actions/projects";
import { deriveDashboardSummary } from "@/mock/derive";
import type {
  ActivityEntry,
  CalendarEvent,
  Project,
  SessionStats,
} from "@/lib/types";

/**
 * Dashboard client shell. Receives the signed-in user's REAL data (loaded
 * server-side via loadAppData) and wires the interactive bits: the create flow
 * and navigation callbacks. Creating a project or event calls a server action
 * that revalidates `/dashboard`, so the server component re-runs and this
 * re-renders with fresh data.
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
  // A freshly created project to auto-open in the detail panel.
  const [openId, setOpenId] = useState<string | null>(null);
  // RF-8: the tour deep-link opens CREATE mode (the project page, blank). A
  // one-shot signal that DashboardView consumes once on mount.
  const [autoCreate, setAutoCreate] = useState(false);
  // Army-list import panel (re-homed to the dashboard "⬆ Upload Army" button).
  const [importOpen, setImportOpen] = useState(false);
  const [, creatingProject] = useTransition();
  const { toast, node: toastNode } = useToast();

  // "+ New Project" now creates a draft immediately and opens its editable
  // panel (the open-on-create effect picks up the new id). No separate
  // create form — the panel itself is where name/type/units are set (Ross).
  function handleAddProject() {
    creatingProject(async () => {
      const res = await createProject({ name: "New Project", type: "Army", count: 0 });
      if (res.ok && res.data?.id) {
        setOpenId(res.data.id);
        router.refresh();
      } else if (!res.ok) {
        toast(res.error ?? "Couldn’t create the project.", "red");
      }
    });
  }

  // Final tutorial step lands here as `/dashboard?tour=create` to open the
  // create-project flow. Trigger create mode once, then strip the param so a
  // refresh / back doesn't re-trigger it.
  useEffect(() => {
    if (searchParams.get("tour") === "create") {
      setAutoCreate(true);
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
        openProjectId={openId}
        onOpenConsumed={() => setOpenId(null)}
        onAddProject={handleAddProject}
        autoCreate={autoCreate}
        onAutoCreateConsumed={() => setAutoCreate(false)}
        onStartSession={(p) => router.push(`/focus?project=${p.id}`)}
        onAttachRecipe={() => router.push("/recipes")}
        onUploadArmyList={() => setImportOpen(true)}
        onRetry={() => router.refresh()}
      />
      <ArmyImportPanel open={importOpen} onClose={() => setImportOpen(false)} />
      {toastNode}
    </>
  );
}
