"use client";

import { clsx } from "clsx";
import type { ProjectType } from "@/db/schema";
import type { DisplayStatus } from "@/lib/progress";
import { ProgressBar } from "@/components/ProgressBar";
import { StatusPill, type StatusPillKind } from "@/components/ui/StatusPill";
import { CircularProgress } from "@/components/ui/CircularProgress";
import { EditableProjectTitle } from "@/components/EditableProjectTitle";
import { useLiveProgressPercent } from "@/components/projects/StageProgressContext";
import { AddChildMenu } from "@/components/projects/AddChildMenu";

const STATUS_PILL: Record<DisplayStatus, StatusPillKind> = {
  WISHLIST: "wishlist",
  PURCHASED: "neutral",
  BUILDING: "info",
  PRIMING: "info",
  PAINTING: "warning",
  BASING: "warning",
  COMPLETE: "ok",
  SHELVED: "neutral",
};

const TYPE_CHIP: Readonly<Record<ProjectType, string>> = {
  Army: "type-chip-cyan",
  Warband: "type-chip-cyan",
  Unit: "type-chip-amber",
  Model: "type-chip-yellow",
  "Terrain Piece": "type-chip-green",
  Diorama: "type-chip-purple",
};

interface Props {
  projectId: string;
  name: string;
  type: ProjectType;
  faction: string | null;
  status: DisplayStatus;
  percent: number;
  totalModels: number;
  /** When true the unified "+ Add ▾" menu shows (Add unit / Add terrain
   *  / Add model). Hidden on Terrain Piece / Diorama (top-level leaves
   *  with no children). Item 1 consolidated every add affordance behind
   *  this single header control. */
  showAddChild: boolean;
}

/**
 * P12.8 — Project detail header strip.
 *
 * Top row: cyan project title (h1, big), then the stat row inline:
 *   type chip · faction · N models · status pill · + Add unit (green)
 *
 * Below the row: full-width ProgressBar with the percent overlay
 * centered. Tone follows the locked red < 25 / yellow 25-75 / green
 * >= 75 thresholds from P12.6.
 *
 * Replaces the bespoke header on /projects/<id>. Layout intentionally
 * matches Ross's brief verbatim — keeps the title + stats compact at
 * the top so the table below gets the space.
 */
export function ProjectHeaderStrip({
  projectId,
  name,
  type,
  faction,
  status,
  percent: serverPercent,
  totalModels,
  showAddChild,
}: Props) {
  // v6-4 bug fix — the StageCounter publishes its optimistic percent into
  // StageProgressContext on every bump, so the header bar tracks stage
  // completion instantly instead of waiting for the revalidatePath
  // round-trip. Falls back to the server `percent` when nothing has been
  // published yet (or for container/aggregate views with no StageCounter).
  const percent = useLiveProgressPercent(projectId, serverPercent);
  return (
    // PHASE-2 — the project-detail header is the page's mission banner: a
    // near-black terminal `.panel` with corner ticks + a coordinate-style
    // tech label on the top border (DESIGN_LANGUAGE §5/§7), so the unit
    // workspace opens on a lit command-control surface rather than a bare
    // heading. The headline completion reads as a phosphor CircularProgress
    // dial (§7.1) on the right; the dense linear bar stays beneath the stat
    // row for the at-a-glance fill.
    <header className="panel panel-ticks relative p-4 md:p-5">
      <span className="panel-label" aria-hidden>
        SYS ▸ UNIT
      </span>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <EditableProjectTitle projectId={projectId} name={name} />
            <span className={clsx("type-chip", TYPE_CHIP[type])}>{type}</span>
            {faction ? (
              <span className="text-xs font-mono text-[var(--color-fg-muted)] uppercase tracking-wider">
                {faction}
              </span>
            ) : null}
            <span className="text-xs font-mono text-[var(--color-fg-muted)] tabular-nums">
              {totalModels} model{totalModels === 1 ? "" : "s"}
            </span>
            {/* Status as the signature solid colour-bar with black text
                (§7.2) — the mission-table status idiom, applied to the
                project's headline status. */}
            <StatusPill status={STATUS_PILL[status]} tone="bar">
              {status}
            </StatusPill>
            {showAddChild ? (
              <AddChildMenu projectId={projectId} parentType={type} />
            ) : null}
          </div>
          <div className="relative">
            <ProgressBar percent={percent} stretch height={14} />
            <span
              aria-hidden
              className="absolute inset-0 flex items-center justify-center text-2xs font-mono tabular-nums text-[var(--color-fg)]"
              style={{
                textShadow:
                  "0 0 4px color-mix(in srgb, var(--color-bg) 80%, transparent)",
              }}
            >
              {percent}%
            </span>
          </div>
        </div>
        {/* Headline completion dial — the recurring moodboard gauge. The
            auto tone tracks the behind/mid/ahead threshold set the linear
            bar shares, so the dial and the bar read the same colour. */}
        <CircularProgress
          percent={percent}
          caption="DONE"
          ariaLabel={`${percent} percent complete`}
          size={72}
          className="shrink-0"
        />
      </div>
    </header>
  );
}
