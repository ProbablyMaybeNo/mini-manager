"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { ArmyImportPanel } from "./ArmyImportPanel";
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
        onProjectCreated={(id) => setOpenId(id)}
        autoCreate={autoCreate}
        onAutoCreateConsumed={() => setAutoCreate(false)}
        onStartSession={(p) => router.push(`/focus?project=${p.id}`)}
        onAttachRecipe={() => router.push("/recipes")}
        onUploadArmyList={() => setImportOpen(true)}
        onRetry={() => router.refresh()}
      />
      <ArmyImportPanel open={importOpen} onClose={() => setImportOpen(false)} />
    </>
  );
}
