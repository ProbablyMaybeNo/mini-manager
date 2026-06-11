"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { FocusView } from "@/components/focus/FocusView";
import { useMockData } from "@/mock/MockProvider";

function FocusRoute() {
  const data = useMockData();
  const params = useSearchParams();
  const projectId = params.get("project");
  const isEmpty = params.get("state") === "empty";

  const project = isEmpty
    ? null
    : (projectId && data.projects.find((p) => p.id === projectId)) || data.projects[0] || null;

  const recipe = project
    ? data.recipes.find((r) => r.assignedProjectId === project.id) ?? data.recipes[0] ?? null
    : null;

  return (
    <FocusView
      project={project}
      recipe={recipe}
      stats={data.sessionStats}
      modelCount={10}
      onLogSession={() => {}}
      onStepChange={() => {}}
      onAddPaint={() => {}}
      onAddInspo={() => {}}
      onRemoveInspo={() => {}}
    />
  );
}

export default function FocusPage() {
  return (
    <Suspense fallback={null}>
      <FocusRoute />
    </Suspense>
  );
}
