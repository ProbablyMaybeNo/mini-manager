"use client";

import { Button, Panel } from "@/components/kit";
import { PageHeader } from "@/components/shell";
import type { CollectionItem, CollectionKind, Project, ProjectStatus } from "@/lib/types";
import type { ScanImageMediaType } from "@/lib/paints/scanLimits";
import { CollectionTable } from "./CollectionTable";
import { CollectionStatsBar } from "./CollectionStatsBar";
import { PasteUrlBar } from "./PasteUrlBar";
import {
  ScanPaintsFlow,
  type ConfirmedScanPaint,
  type ConfirmScanOutcome,
  type ScanPhotoOutcome,
} from "./ScanPaintsFlow";

export type CollectionStatus = "ready" | "loading" | "error";

export function CollectionView({
  paints,
  models,
  projects,
  status = "ready",
  onAddUrl,
  onScanPhoto,
  onConfirmScan,
  onStatusChange,
  onAssignProject,
  onAttachRecipe,
  onRemove,
  onEdit,
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
  /** "Scan paints" — sends a photo to vision + matches it against the
   *  catalog. Does not persist anything (see ScanPaintsFlow). */
  onScanPhoto: (imageBase64: string, mediaType: ScanImageMediaType) => Promise<ScanPhotoOutcome>;
  /** Confirm dialog's "Add N paints" — persists the confirmed matches. */
  onConfirmScan: (confirmed: ConfirmedScanPaint[]) => Promise<ConfirmScanOutcome>;
  onStatusChange: (item: CollectionItem, status: ProjectStatus) => void;
  onAssignProject: (item: CollectionItem, projectId: string) => void;
  onAttachRecipe: (item: CollectionItem) => void;
  onRemove: (item: CollectionItem) => void;
  onEdit?: (item: CollectionItem) => void;
  onAddPaint: () => void;
  onAddModel: () => void;
  onRetry?: () => void;
  /** Resolve a recipe id to its palette swatches for the RECIPE column. */
  recipeSwatches?: (recipeId: string) => string[];
}) {
  return (
    // Tighter gutters + section gaps on phones (Ross, 2026-07-27) — 24px of
    // padding either side of a 375px screen was 13% of the width, and the
    // dense table needs every pixel it can get.
    <div className="flex h-full flex-col p-3 md:p-6">
      <div className="flex flex-1 flex-col gap-4 pb-4 md:gap-6">
      <PageHeader title="COLLECTION" />

      <PasteUrlBar onAddUrl={onAddUrl} />
      <ScanPaintsFlow onScan={onScanPhoto} onConfirm={onConfirmScan} />

      {status === "error" ? (
        <Panel label="ERROR" accent="red" className="max-w-md p-6">
          <p className="font-body text-body text-red-text">▸ Couldn’t load your collection.</p>
          {onRetry && (
            <div className="mt-4">
              <Button variant="danger" onClick={onRetry}>
                Retry
              </Button>
            </div>
          )}
        </Panel>
      ) : status === "loading" ? (
        <div className="h-64 animate-pulse rounded-[12px] border border-border bg-surface-2" aria-busy="true" />
      ) : (
        // 24:4 — PAINTS and MODELS stack as two full-width, unboxed sections
        // (each table renders its own accent-ticked header), split by a thin
        // full-width divider (24:280).
        <div className="flex flex-col">
          <section aria-label="PAINTS">
            <CollectionTable
              kind="paint"
              items={paints}
              projects={projects}
              onStatusChange={onStatusChange}
              onAssignProject={onAssignProject}
              onAttachRecipe={onAttachRecipe}
              onRemove={onRemove}
              onEdit={onEdit}
              onAdd={onAddPaint}
              recipeSwatches={recipeSwatches}
            />
          </section>

          <div className="my-8 h-px w-full bg-border" aria-hidden />

          <section aria-label="MODELS">
            <CollectionTable
              kind="model"
              items={models}
              projects={projects}
              onStatusChange={onStatusChange}
              onAssignProject={onAssignProject}
              onAttachRecipe={onAttachRecipe}
              onRemove={onRemove}
              onEdit={onEdit}
              onAdd={onAddModel}
            />
          </section>
        </div>
      )}
      </div>

      {status === "ready" && (
        <CollectionStatsBar paints={paints} models={models} projects={projects} />
      )}
    </div>
  );
}
