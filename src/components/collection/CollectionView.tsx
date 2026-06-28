"use client";

import type { ReactNode } from "react";
import { Button, Panel } from "@/components/kit";
import { PageHeader } from "@/components/shell";
import type { CollectionItem, CollectionKind, Project, ProjectStatus } from "@/lib/types";
import { CollectionTable } from "./CollectionTable";
import { CollectionStatsBar } from "./CollectionStatsBar";
import { PasteUrlBar } from "./PasteUrlBar";

/** A 24:4 collection section: a coloured accent tick down the left edge over a
 *  bare, unboxed table (no Panel border — the frame stacks two full-width
 *  sections). The table renders its own PAINTS/MODELS + count + filter header. */
function CollectionSection({
  label,
  accent,
  children,
}: {
  label: string;
  accent: "cyan" | "purple";
  children: ReactNode;
}) {
  return (
    <section
      aria-label={label}
      className={accent === "purple" ? "border-l-2 border-purple pl-4" : "border-l-2 border-cyan pl-4"}
    >
      {children}
    </section>
  );
}

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
    <div className="flex h-full flex-col p-6">
      <div className="flex flex-1 flex-col gap-6 pb-4">
      <PageHeader
        title="COLLECTION"
        tagline="// paints & models — track what each costs"
      />

      <PasteUrlBar onAddUrl={onAddUrl} />

      {status === "error" ? (
        <Panel label="ERROR" accent="red" className="max-w-md p-6">
          <p className="font-body text-body text-red">▸ Couldn’t load your collection.</p>
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
        // 24:4 — PAINTS and MODELS stack as two full-width, unboxed sections
        // (not side-by-side bordered cards), each an accent-ticked label over a
        // bare table.
        <div className="flex flex-col gap-10">
          <CollectionSection label="PAINTS" accent="cyan">
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
          </CollectionSection>

          <CollectionSection label="MODELS" accent="purple">
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
          </CollectionSection>
        </div>
      )}
      </div>

      {status === "ready" && (
        <CollectionStatsBar paints={paints} models={models} projects={projects} />
      )}
    </div>
  );
}
