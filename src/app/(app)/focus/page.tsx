"use client";

import { Suspense, useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FocusView } from "@/components/focus/FocusView";
import { useToast } from "@/components/kit";
import { useMockData } from "@/mock/MockProvider";
import type { InspoRef, Project } from "@/lib/types";
import { logSession } from "@/lib/actions/paintSessions";
import { addInspo, deleteInspo } from "@/lib/actions/recipeInspo";
import { setProjectComplete } from "@/lib/actions/projects";
import { clearFocusProject, setFocusProject } from "@/lib/actions/focus";

/** Depth-first lookup so a focus target can be any tier — an Army, or a
 *  nested Unit / Model that only exists inside its parent's `children`. */
function findProjectById(list: Project[], id: string): Project | undefined {
  for (const p of list) {
    if (p.id === id) return p;
    if (p.children) {
      const hit = findProjectById(p.children, id);
      if (hit) return hit;
    }
  }
  return undefined;
}

/** Logged minutes for a project rolled up over itself + every sub-project
 *  (A5qzb — Focus per-project time). */
function rollupProjectMinutes(
  project: Project,
  minutesById: Record<string, number>,
): number {
  let total = minutesById[project.id] ?? 0;
  for (const child of project.children ?? []) {
    total += rollupProjectMinutes(child, minutesById);
  }
  return total;
}

function FocusRoute() {
  const data = useMockData();
  const params = useSearchParams();
  const router = useRouter();
  const { toast, node } = useToast();
  const [, startTransition] = useTransition();
  const projectId = params.get("project");
  const isEmpty = params.get("state") === "empty";

  const project = isEmpty
    ? null
    : (projectId && findProjectById(data.projects, projectId)) || data.projects[0] || null;

  const recipe = project
    ? data.recipes.find((r) => r.assignedProjectId === project.id) ?? data.recipes[0] ?? null
    : null;

  const projectMinutes = project
    ? rollupProjectMinutes(project, data.projectMinutes)
    : undefined;

  // Inspo is edited inline on the bench, so the controller owns it (optimistic
  // add/remove backed by the recipe_inspo actions). Re-seed when the focused
  // recipe changes.
  const [inspo, setInspo] = useState<InspoRef[]>(recipe?.inspo ?? []);
  useEffect(() => {
    setInspo(recipe?.inspo ?? []);
  }, [recipe?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <FocusView
        project={project}
        projects={data.projects}
        recipe={recipe}
        stats={data.sessionStats}
        modelCount={project?.modelCount ?? 0}
        projectMinutes={projectMinutes}
        inspo={inspo}
        onFocusProject={(id) => {
          // Persist the pin server-side AND reflect it in the URL so a refresh
          // / share lands on the same bench (MM-23).
          startTransition(async () => {
            await setFocusProject({ projectId: id });
          });
          router.push(`/focus?project=${id}`);
        }}
        onClearFocus={() => {
          startTransition(async () => {
            await clearFocusProject();
          });
          router.push(`/focus?state=empty`);
        }}
        onLogSession={(seconds) => {
          if (!project || seconds <= 0) return;
          startTransition(async () => {
            await logSession({ projectId: project.id, seconds });
            router.refresh();
          });
        }}
        onStepChange={(step) => {
          if (!project) return;
          startTransition(async () => {
            await setProjectComplete({ id: project.id, complete: step });
          });
        }}
        onAddPaint={() => router.push(recipe ? `/recipes/${recipe.id}` : "/recipes")}
        onAddInspo={(url) => {
          if (!recipe) {
            toast("Attach a recipe before adding inspo.", "red");
            return;
          }
          startTransition(async () => {
            const res = await addInspo({ recipeId: recipe.id, url });
            if (res.ok) setInspo((l) => [...l, { id: res.data.id, url: res.data.url }]);
            else toast(res.error, "red");
          });
        }}
        onRemoveInspo={(id) => {
          if (!id) return;
          setInspo((l) => l.filter((x) => x.id !== id));
          startTransition(async () => {
            await deleteInspo({ id });
          });
        }}
      />
      {node}
    </>
  );
}

export default function FocusPage() {
  return (
    <Suspense fallback={null}>
      <FocusRoute />
    </Suspense>
  );
}
