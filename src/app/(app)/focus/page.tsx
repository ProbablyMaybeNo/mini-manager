"use client";

import { Suspense, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FocusView } from "@/components/focus/FocusView";
import { useMockData } from "@/mock/MockProvider";
import { logSession } from "@/lib/actions/paintSessions";

function FocusRoute() {
  const data = useMockData();
  const params = useSearchParams();
  const router = useRouter();
  const [, startTransition] = useTransition();
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
      onLogSession={(seconds) => {
        if (!project || seconds <= 0) return;
        startTransition(async () => {
          await logSession({ projectId: project.id, seconds });
          router.refresh();
        });
      }}
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
