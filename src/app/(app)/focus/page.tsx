"use client";

import { Suspense, useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FocusView } from "@/components/focus/FocusView";
import { useToast } from "@/components/kit";
import { useMockData } from "@/mock/MockProvider";
import type { InspoRef } from "@/lib/types";
import { logSession } from "@/lib/actions/paintSessions";
import { addInspo, deleteInspo } from "@/lib/actions/recipeInspo";

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
    : (projectId && data.projects.find((p) => p.id === projectId)) || data.projects[0] || null;

  const recipe = project
    ? data.recipes.find((r) => r.assignedProjectId === project.id) ?? data.recipes[0] ?? null
    : null;

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
        recipe={recipe}
        stats={data.sessionStats}
        modelCount={10}
        inspo={inspo}
        onLogSession={(seconds) => {
          if (!project || seconds <= 0) return;
          startTransition(async () => {
            await logSession({ projectId: project.id, seconds });
            router.refresh();
          });
        }}
        onStepChange={() => {}}
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
