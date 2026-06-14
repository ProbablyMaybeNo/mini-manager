"use client";

import { useState } from "react";
import { Button, Input, Panel, SlideOutPanel } from "@/components/kit";
import { PageHeader } from "@/components/shell";
import type { Project, Recipe } from "@/lib/types";
import { RecipeIndexTable } from "./RecipeIndexTable";

export type RecipeStatus = "ready" | "loading" | "error";

export function RecipeIndexView({
  recipes,
  projects,
  status = "ready",
  onOpenRecipe,
  onAssignProject,
  onShare,
  onCreateRecipe,
  onRetry,
}: {
  recipes: Recipe[];
  projects: Project[];
  status?: RecipeStatus;
  onOpenRecipe: (recipe: Recipe) => void;
  onAssignProject: (recipe: Recipe, projectId: string) => void;
  onShare: (recipe: Recipe) => void;
  onCreateRecipe: (name: string) => void;
  onRetry?: () => void;
}) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreateRecipe(trimmed);
    setName("");
    setCreating(false);
  }

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <PageHeader
        title="RECIPE"
        tagline="Build, manage, and share repeatable paint schemes."
        actions={<Button onClick={() => setCreating(true)}>+ Recipe</Button>}
      />

      {status === "error" ? (
        <Panel label="ERROR" accent="red" className="max-w-md p-6">
          <p className="font-mono text-sm text-red">▸ Couldn’t load your recipes.</p>
          {onRetry && (
            <div className="mt-4">
              <Button variant="danger" onClick={onRetry}>
                Retry
              </Button>
            </div>
          )}
        </Panel>
      ) : (
        <Panel label="RECIPES" cornerTicks className="p-4">
          {status === "loading" ? (
            <div className="h-48 animate-pulse bg-cyan/5" aria-busy="true" />
          ) : (
            <RecipeIndexTable
              recipes={recipes}
              projects={projects}
              onOpenRecipe={onOpenRecipe}
              onAssignProject={onAssignProject}
              onShare={onShare}
              onCreate={() => setCreating(true)}
            />
          )}
        </Panel>
      )}

      {/* Create flow — name first */}
      <SlideOutPanel
        open={creating}
        onClose={() => setCreating(false)}
        title="New recipe"
        breadcrumb="RECIPE ▸ CREATE"
        width="max-w-sm"
        footer={
          <Button className="w-full" onClick={submit} disabled={!name.trim()}>
            Create &amp; open editor
          </Button>
        }
      >
        <div className="flex flex-col gap-3">
          <Input
            label="Recipe name"
            name="recipe-name"
            autoFocus
            placeholder="e.g. Ultramarines Battle-Ready"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          <p className="font-mono text-[11px] text-fg-faint">
            ▸ Name it first, then add paint slots, notes, and inspiration in the editor.
          </p>
        </div>
      </SlideOutPanel>
    </div>
  );
}
