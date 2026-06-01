import { clsx } from "clsx";
import type { ProjectType } from "@/db/schema";
import type { DisplayStatus } from "@/lib/progress";
import { ProgressBar } from "@/components/ProgressBar";
import { StatusPill, type StatusPillKind } from "@/components/ui/StatusPill";
import { Button } from "@/components/ui/Button";

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
  "Single Model": "type-chip-purple",
  "Terrain Piece": "type-chip-green",
  Diorama: "type-chip-purple",
};

/** "Add unit" / "Add model" / "Add terrain" / "Add diorama" — picked
 *  from the project's type so the CTA reads naturally for what the
 *  painter expects to add below it. */
function addChildCtaLabel(type: ProjectType): string {
  switch (type) {
    case "Army":
    case "Warband":
      return "+ Add unit";
    case "Unit":
      return "+ Add model";
    case "Terrain Piece":
      return "+ Add terrain";
    case "Diorama":
      return "+ Add scene";
    case "Single Model":
      return "+ Add model";
    default:
      return "+ Add";
  }
}

interface Props {
  projectId: string;
  name: string;
  type: ProjectType;
  faction: string | null;
  status: DisplayStatus;
  percent: number;
  totalModels: number;
  /** When true the "+ Add unit" button shows + links to new-with-parent.
   *  Hidden on leaf "Single Model" projects (you can't add children to
   *  a single model). */
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
  percent,
  totalModels,
  showAddChild,
}: Props) {
  return (
    <header className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <h1
          className="text-3xl tracking-wide text-[var(--color-cyan)]"
          style={{
            textShadow:
              "0 0 12px color-mix(in srgb, var(--color-cyan) 22%, transparent)",
          }}
        >
          {name}
        </h1>
        <span className={clsx("type-chip", TYPE_CHIP[type])}>{type}</span>
        {faction ? (
          <span className="text-xs font-mono text-[var(--color-fg-muted)] uppercase tracking-wider">
            {faction}
          </span>
        ) : null}
        <span className="text-xs font-mono text-[var(--color-fg-muted)] tabular-nums">
          {totalModels} model{totalModels === 1 ? "" : "s"}
        </span>
        <StatusPill status={STATUS_PILL[status]}>{status}</StatusPill>
        {showAddChild ? (
          <Button
            as="a"
            href={`/projects/new?parent=${projectId}`}
            variant="success"
            size="sm"
            className="ml-auto"
          >
            {addChildCtaLabel(type)}
          </Button>
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
    </header>
  );
}
