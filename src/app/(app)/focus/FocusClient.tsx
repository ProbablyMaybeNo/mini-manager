"use client";

import { Suspense, useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FocusView } from "@/components/focus/FocusView";
import { useToast } from "@/components/kit";
import type { InspoRef, Project, Recipe, SessionStats } from "@/lib/types";
import { guarded } from "@/lib/actionGuard";
import { rollupProjectMinutes } from "@/lib/projectTime";
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

function FocusRoute(data: FocusData) {
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
          //
          // R2-14 — every write on this bench used to `await` bare: offline the
          // rejection escaped the transition into the route error boundary and
          // replaced the whole app with the fault screen, mid-session. Guarded,
          // a dropped connection is a toast and the bench stays exactly as it
          // was — including the timer and anything typed into it.
          startTransition(async () => {
            const res = await guarded(
              () => setFocusProject({ projectId: id }),
              "Couldn’t pin that project — check your connection, then try again.",
            );
            if (!res.ok) toast(res.error, "red");
          });
          router.push(`/focus?project=${id}`);
        }}
        onClearFocus={() => {
          startTransition(async () => {
            const res = await guarded(
              clearFocusProject,
              "Couldn’t clear the pin — check your connection, then try again.",
            );
            if (!res.ok) toast(res.error, "red");
          });
          router.push(`/focus?state=empty`);
        }}
        onLogSession={(seconds) => {
          if (!project || seconds <= 0) return;
          startTransition(async () => {
            const res = await guarded(
              () => logSession({ projectId: project.id, seconds }),
              "Couldn’t log that session — check your connection, then try again.",
            );
            if (!res.ok) {
              toast(res.error, "red");
              return;
            }
            router.refresh();
          });
        }}
        onStepChange={(step) => {
          if (!project) return;
          startTransition(async () => {
            const res = await guarded(
              () => setProjectComplete({ id: project.id, complete: step }),
              "Couldn’t update progress — check your connection, then try again.",
            );
            if (!res.ok) toast(res.error, "red");
          });
        }}
        onAddPaint={() => router.push(recipe ? `/recipes/${recipe.id}` : "/recipes")}
        onAddInspo={(url) => {
          if (!recipe) {
            toast("Attach a recipe before adding inspo.", "red");
            return;
          }
          startTransition(async () => {
            const res = await guarded(
              () => addInspo({ recipeId: recipe.id, url }),
              "Couldn’t add that inspo — check your connection, then try again.",
            );
            if (res.ok) setInspo((l) => [...l, { id: res.data.id, url: res.data.url }]);
            else toast(res.error, "red");
          });
        }}
        onRemoveInspo={(id) => {
          if (!id) return;
          // Optimistic removal, so a failed delete has to put the reference
          // back where it was — otherwise the bench shows it gone and the
          // next refresh brings it back.
          const index = inspo.findIndex((x) => x.id === id);
          const removed = index < 0 ? null : inspo[index];
          setInspo((l) => l.filter((x) => x.id !== id));
          startTransition(async () => {
            const res = await guarded(
              () => deleteInspo({ id }),
              "Couldn’t remove that inspo — check your connection, then try again.",
            );
            if (res.ok) return;
            if (removed) {
              setInspo((l) =>
                l.some((x) => x.id === id)
                  ? l
                  : [...l.slice(0, index), removed, ...l.slice(index)],
              );
            }
            toast(res.error, "red");
          });
        }}
      />
      {node}
    </>
  );
}

/**
 * The focus bench's data arrives as PROPS from its server page, not through
 * MockProvider (Ross, 2026-08-02 — "make it faster"). The provider used to be
 * fed by the app layout, which loaded the whole account on every route just so
 * two screens could read four fields from it.
 */
export interface FocusData {
  projects: Project[];
  recipes: Recipe[];
  projectMinutes: Record<string, number>;
  sessionStats: SessionStats;
}

export function FocusClient(props: FocusData) {
  return (
    <Suspense fallback={null}>
      <FocusRoute {...props} />
    </Suspense>
  );
}
