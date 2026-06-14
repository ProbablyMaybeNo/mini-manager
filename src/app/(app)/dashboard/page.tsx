"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DashboardView, type DashboardStatus } from "@/components/dashboard/DashboardView";
import { useMockData } from "@/mock/MockProvider";
import { deriveDashboardSummary } from "@/mock/derive";
import { zeroSessionStats } from "@/mock/fixtures";
import { NewProjectPanel } from "./NewProjectPanel";

function DashboardRoute() {
  const data = useMockData();
  const router = useRouter();
  const params = useSearchParams();
  const preview = params.get("state"); // loading | error | empty
  const [newOpen, setNewOpen] = useState(false);

  const isEmpty = preview === "empty";
  const status: DashboardStatus =
    preview === "loading" ? "loading" : preview === "error" ? "error" : "ready";

  const projects = isEmpty ? [] : data.projects;
  const events = isEmpty ? [] : data.events;
  const activity = isEmpty ? [] : data.activity;
  const stats = isEmpty ? zeroSessionStats : data.sessionStats;
  const summary = deriveDashboardSummary(projects, stats);

  return (
    <>
      <DashboardView
        summary={summary}
        projects={projects}
        events={events}
        activity={activity}
        status={status}
        onStartSession={() => router.push("/focus")}
        onOpenProject={(p) => router.push(`/focus?project=${p.id}`)}
        onAttachRecipe={() => router.push("/recipes")}
        onAddProject={() => setNewOpen(true)}
        onUploadArmyList={() => setNewOpen(true)}
        onRetry={() => router.refresh()}
      />
      <NewProjectPanel open={newOpen} onClose={() => setNewOpen(false)} />
    </>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardRoute />
    </Suspense>
  );
}
