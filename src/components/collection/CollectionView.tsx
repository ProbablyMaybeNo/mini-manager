"use client";

import { useState } from "react";
import { Button, Panel } from "@/components/kit";
import { PageHeader } from "@/components/shell";
import { cn } from "@/lib/cn";
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
  /** Phone-only disclosure for the paste-URL + scan-photo bulk-add paths. */
  const [addOpen, setAddOpen] = useState(false);
  return (
    // Tighter gutters + section gaps on phones (Ross, 2026-07-27) — 24px of
    // padding either side of a 375px screen was 13% of the width, and the
    // dense table needs every pixel it can get.
    <div className="flex h-full flex-col p-3 md:p-6">
      <div className="flex flex-1 flex-col gap-4 pb-4 md:gap-6">
      <PageHeader title="COLLECTION" />

      {/* The two bulk-import paths sit behind one disclosure on phones
          (MUX-022). Three add-paint entry points competed above the table —
          paste-a-URL, SCAN PAINTS, and "+ PAINT" — with the most niche given
          the most prominent placement. "+ PAINT" on the section header is the
          primary; these are the power tools, one tap away.

          Explicit state, NOT <details>: the first attempt wrapped these in a
          <details> whose body carried `flex`, and an explicit display overrides
          the UA rule that hides a closed <details>' children — so the paste bar
          rendered anyway, unstyled and stacked under the PAINTS heading where
          it was invisible to pointers but still in the a11y tree (MUX2-005). */}
      <div className="flex flex-col gap-4 roomy:contents">
        <button
          type="button"
          aria-expanded={addOpen}
          aria-controls="collection-bulk-add"
          onClick={() => setAddOpen((v) => !v)}
          className="flex min-h-11 items-center gap-2 rounded-[8px] border border-border px-3 font-mono text-[12px] uppercase tracking-wide text-fg-dim transition-colors hover:border-cyan/40 hover:text-fg roomy:hidden"
        >
          <span aria-hidden className={cn("text-cyan-lite transition-transform", addOpen && "rotate-90")}>
            ▸
          </span>
          Add from a link or a photo
        </button>
        <div
          id="collection-bulk-add"
          className={cn(addOpen ? "flex" : "hidden", "flex-col gap-4 roomy:contents")}
        >
          <PasteUrlBar onAddUrl={onAddUrl} />
          <ScanPaintsFlow onScan={onScanPhoto} onConfirm={onConfirmScan} />
        </div>
      </div>

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
