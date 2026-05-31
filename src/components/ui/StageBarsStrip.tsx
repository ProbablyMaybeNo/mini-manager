import { clsx } from "clsx";

/**
 * StageBarsStrip — 5 small stage-tinted squares that visualise a
 * project's per-stage count proportions at a glance. Replaces the
 * `─ ─ ─ ─ ─` text-dash placeholder on the project list row with a
 * real semantic signal: how full each stage is, by colour.
 *
 * Per Phase 11 spec (P11.5):
 *   - Each square = one stage (build / prime / paint / base / done).
 *   - Tint follows the locked 5-color palette: build + prime = cyan,
 *     paint + base = pastel yellow, done = neon green.
 *   - Empty stages render as a dim version of the same tint so the
 *     strip's structure stays readable even on brand-new projects.
 *   - Filled-stage opacity scales with `count / total` so a half-built
 *     unit reads as roughly half-bright.
 *
 * Sizing: 12px squares with 2px gaps — fits inside the existing
 * ProjectRow grid without changing the row height.
 */

const STAGES = ["build", "prime", "paint", "base", "complete"] as const;
type Stage = (typeof STAGES)[number];

const STAGE_BG: Readonly<Record<Stage, string>> = {
  build: "bg-[var(--color-cyan)]",
  prime: "bg-[var(--color-cyan)]",
  paint: "bg-[var(--color-yellow)]",
  base:  "bg-[var(--color-yellow)]",
  complete: "bg-[var(--color-green)]",
};

const STAGE_LABEL: Readonly<Record<Stage, string>> = {
  build: "Build",
  prime: "Prime",
  paint: "Paint",
  base: "Base",
  complete: "Done",
};

export type StageBarsCounts = {
  buildCount: number;
  primeCount: number;
  paintCount: number;
  baseCount: number;
  completeCount: number;
  /** Project's total model count — denominator for the per-stage
   *  fill ratio. Pass the same `count` value the workspace uses. */
  total: number;
};

/**
 * Convert a 0..1 ratio to a discrete opacity step so the squares don't
 * jitter visually as a single +1 bump nudges a tiny percentage change.
 * 4 buckets: ghost / quarter / half / full.
 */
function ratioToOpacity(ratio: number): number {
  if (ratio <= 0) return 0.18;
  if (ratio < 0.25) return 0.38;
  if (ratio < 0.5) return 0.58;
  if (ratio < 0.85) return 0.8;
  return 1;
}

export function StageBarsStrip({
  counts,
  className,
}: {
  counts: StageBarsCounts;
  className?: string;
}) {
  const perStage: Readonly<Record<Stage, number>> = {
    build: counts.buildCount,
    prime: counts.primeCount,
    paint: counts.paintCount,
    base: counts.baseCount,
    complete: counts.completeCount,
  };
  const total = counts.total;

  return (
    <div
      role="img"
      aria-label="Stage progress: 5 squares, one per stage, opacity scaled by count"
      className={clsx("inline-flex items-center gap-[2px]", className)}
    >
      {STAGES.map((stage) => {
        const value = perStage[stage];
        const ratio = total > 0 ? Math.min(1, value / total) : 0;
        const opacity = ratioToOpacity(ratio);
        const filled = value > 0;
        return (
          <span
            key={stage}
            className={clsx(
              "inline-block w-3 h-3 rounded-[1px]",
              STAGE_BG[stage],
            )}
            style={{ opacity }}
            title={`${STAGE_LABEL[stage]}: ${value}${total > 0 ? ` / ${total}` : ""}`}
            aria-hidden={!filled}
          />
        );
      })}
    </div>
  );
}
