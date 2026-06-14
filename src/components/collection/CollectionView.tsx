"use client";

import { Button, Panel } from "@/components/kit";
import { PageHeader } from "@/components/shell";
import type { CollectionItem, CollectionKind, Project, ProjectStatus } from "@/lib/types";
import { CollectionTable } from "./CollectionTable";
import { PasteUrlBar } from "./PasteUrlBar";

export type CollectionStatus = "ready" | "loading" | "error";

export function CollectionView({
  paints,
  models,
  projects,
  status = "ready",
  onAddUrl,
  onStatusChange,
  onAssignProject,
  onAttachRecipe,
  onRemove,
  onAddPaint,
  onAddModel,
  onRetry,
  recipeSwatches,
}: {
  paints: CollectionItem[];
  models: CollectionItem[];
  projects: Project[];
  status?: CollectionStatus;
  onAddUrl: (url: string, kind: CollectionKind) => void;
  onStatusChange: (item: CollectionItem, status: ProjectStatus) => void;
  onAssignProject: (item: CollectionItem, projectId: string) => void;
  onAttachRecipe: (item: CollectionItem) => void;
  onRemove: (item: CollectionItem) => void;
  onAddPaint: () => void;
  onAddModel: () => void;
  onRetry?: () => void;
  /** Resolve a recipe id to its palette swatches for the RECIPE column. */
  recipeSwatches?: (recipeId: string) => string[];
}) {
  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <PageHeader
        title="COLLECTION"
        tagline="Track what you own, want, and what each cost — paints and models."
      />

      <PasteUrlBar onAddUrl={onAddUrl} />

      {status === "error" ? (
        <Panel label="ERROR" accent="red" className="max-w-md p-6">
          <p className="font-mono text-sm text-red">▸ Couldn’t load your collection.</p>
          {onRetry && (
            <div className="mt-4">
              <Button variant="danger" onClick={onRetry}>
                Retry
              </Button>
            </div>
          )}
        </Panel>
      ) : status === "loading" ? (
        <div className="h-64 animate-pulse border border-cyan/20 bg-cyan/5" aria-busy="true" />
      ) : (
        <>
          <Panel label="MY PAINT COLLECTION" cornerTicks className="p-4">
            <CollectionTable
              kind="paint"
              items={paints}
              projects={projects}
              onStatusChange={onStatusChange}
              onAssignProject={onAssignProject}
              onAttachRecipe={onAttachRecipe}
              onRemove={onRemove}
              onAdd={onAddPaint}
              recipeSwatches={recipeSwatches}
            />
          </Panel>

          <Panel label="MY MODEL COLLECTION" cornerTicks className="p-4">
            <CollectionTable
              kind="model"
              items={models}
              projects={projects}
              onStatusChange={onStatusChange}
              onAssignProject={onAssignProject}
              onAttachRecipe={onAttachRecipe}
              onRemove={onRemove}
              onAdd={onAddModel}
            />
          </Panel>
        </>
      )}
    </div>
  );
}
