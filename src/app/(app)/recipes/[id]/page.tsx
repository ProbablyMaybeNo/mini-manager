"use client";

import { Suspense, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { RecipeEditorView } from "@/components/recipe/RecipeEditorView";
import { PageHeader } from "@/components/shell";
import { Button, Panel } from "@/components/kit";
import { useMockData } from "@/mock/MockProvider";
import type { Recipe } from "@/lib/types";

function blankRecipe(name: string): Recipe {
  return { id: "new", name: name || "Untitled recipe", slots: [], inspoLinks: [], notes: "" };
}

function EditorRoute() {
  const data = useMockData();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const nameParam = useSearchParams().get("name") ?? "";

  const id = params.id;
  const initial = useMemo<Recipe | null>(() => {
    if (id === "new") return blankRecipe(nameParam);
    return data.recipes.find((r) => r.id === id) ?? null;
  }, [id, nameParam, data.recipes]);

  const [recipe, setRecipe] = useState<Recipe | null>(initial);

  if (!recipe) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <PageHeader title="RECIPE NOT FOUND" />
        <Panel label="ERROR" accent="red" className="max-w-md p-6">
          <p className="font-mono text-sm text-red">▸ No recipe with id “{id}”.</p>
          <div className="mt-4">
            <Button variant="secondary" onClick={() => router.push("/recipes")}>
              ← Back to recipes
            </Button>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <RecipeEditorView
      recipe={recipe}
      projects={data.projects}
      paints={data.paints}
      onChange={setRecipe}
      onShare={() => {}}
      onSave={() => router.push("/recipes")}
      onBack={() => router.push("/recipes")}
    />
  );
}

export default function RecipeEditorPage() {
  return (
    <Suspense fallback={null}>
      <EditorRoute />
    </Suspense>
  );
}
