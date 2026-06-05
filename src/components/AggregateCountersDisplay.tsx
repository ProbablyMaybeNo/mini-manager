import { clsx } from "clsx";
import type { AggregateCounters } from "@/lib/progress";

/**
 * Read-only mirror of `<StageCounter />` for Army / Warband / Unit
 * parents that derive their numbers from descendant Units. No buttons,
 * no keyboard shortcuts, no error surface — those belong to the leaf
 * counters down the tree.
 *
 * P13.5 — Ross flagged the panel as too tall ("could be much smaller").
 * Collapsed from six stacked rows (one per stage) into a single dense
 * grid row with six stage cells. Each cell shows label / value-of-total
 * and a slim stage-tinted fill bar underneath. Same information, ~1/6
 * the vertical footprint.
 */

type AggregateStage = "owned" | "build" | "prime" | "paint" | "base" | "complete";

const AGGREGATE_STAGES: ReadonlyArray<AggregateStage> = [
  "owned",
  "build",
  "prime",
  "paint",
  "base",
  "complete",
];

const STAGE_LABEL: Readonly<Record<AggregateStage, string>> = {
  owned: "OWNED",
  build: "BUILD",
  prime: "PRIME",
  paint: "PAINT",
  base: "BASE",
  complete: "DONE",
};

/**
 * Stage tints follow the StageCounter contract (P11.1):
 *   amber for OWNED (the "minis on the desk" tier)
 *   cyan for BUILD / PRIME (early stages)
 *   yellow for PAINT / BASE (the model is on the desk)
 *   green for DONE
 */
const STAGE_TINT: Readonly<Record<AggregateStage, string>> = {
  owned: "var(--color-amber)",
  build: "var(--color-cyan)",
  prime: "var(--color-cyan)",
  paint: "var(--color-yellow)",
  base: "var(--color-yellow)",
  complete: "var(--color-green)",
};

function stageValue(agg: AggregateCounters, stage: AggregateStage): number {
  switch (stage) {
    case "owned":
      return agg.ownedCount;
    case "build":
      return agg.buildCount;
    case "prime":
      return agg.primeCount;
    case "paint":
      return agg.paintCount;
    case "base":
      return agg.baseCount;
    case "complete":
      return agg.completeCount;
  }
}

/** Most-advanced stage with any progress — gets the bold label. */
function leadStage(agg: AggregateCounters): AggregateStage | null {
  if (agg.completeCount > 0) return "complete";
  if (agg.baseCount > 0) return "base";
  if (agg.paintCount > 0) return "paint";
  if (agg.primeCount > 0) return "prime";
  if (agg.buildCount > 0) return "build";
  if (agg.ownedCount > 0) return "owned";
  return null;
}

export function AggregateCountersDisplay({
  aggregate,
  childCount,
}: {
  aggregate: AggregateCounters;
  childCount: number;
}) {
  const total = aggregate.count;
  const lead = leadStage(aggregate);

  if (total === 0) {
    return (
      <div className="frame p-4 text-xs font-mono text-[var(--color-fg-muted)]">
        No models registered across this Army yet. Add a child Unit with
        a model count, and its counters will roll up here.
      </div>
    );
  }

  const sourceLabel =
    childCount === 0
      ? "(no sub-projects)"
      : `(aggregated from ${childCount} sub-project${childCount === 1 ? "" : "s"})`;

  return (
    <div className="space-y-2" aria-label="Aggregated stage counters">
      <div
        className={clsx(
          "frame grid gap-2 p-2",
          // Six cells: stack to 3-col on small screens, full row on md+.
          "grid-cols-3 sm:grid-cols-6",
        )}
        role="list"
      >
        {AGGREGATE_STAGES.map((stage) => {
          const value = stageValue(aggregate, stage);
          const tint = STAGE_TINT[stage];
          const isLead = lead === stage;
          const percent =
            total > 0 ? Math.max(0, Math.min(100, (value / total) * 100)) : 0;
          const label = STAGE_LABEL[stage];
          return (
            <div
              key={stage}
              role="listitem"
              className={clsx(
                "flex flex-col gap-1 px-2 py-1.5 rounded-sm overflow-hidden",
                "border border-[var(--color-border)]",
                "bg-[var(--color-bg-panel)]",
              )}
            >
              {/* min-w-0 on the row + label lets the label truncate instead
                  of pushing the value past the cell border on narrow (3-col)
                  layouts; the value stays whole via shrink-0. */}
              <div className="flex items-baseline justify-between gap-1.5 min-w-0">
                <span
                  className={clsx(
                    "font-mono text-2xs uppercase tracking-wider min-w-0 truncate",
                    isLead ? "font-bold" : "text-[var(--color-fg-muted)]",
                  )}
                  style={isLead ? { color: tint } : undefined}
                >
                  {label}
                </span>
                <span className="font-mono text-xs text-[var(--color-fg)] whitespace-nowrap tabular-nums shrink-0">
                  {value}
                  <span className="text-[var(--color-fg-subtle)]">/{total}</span>
                </span>
              </div>
              <span
                role="progressbar"
                aria-valuenow={Math.round(percent)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${label} ${value} of ${total}`}
                className="relative block h-1.5 rounded-sm overflow-hidden bg-[color-mix(in_srgb,var(--color-border)_60%,transparent)]"
              >
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 transition-[width] duration-300 ease-out"
                  style={{
                    width: `${percent}%`,
                    backgroundColor: tint,
                    boxShadow:
                      percent > 0
                        ? `0 0 6px color-mix(in srgb, ${tint} 35%, transparent)`
                        : undefined,
                  }}
                />
              </span>
            </div>
          );
        })}
      </div>

      <p className="font-mono text-2xs text-[var(--color-fg-subtle)] uppercase tracking-wider">
        {sourceLabel} · read-only — edit counters on each sub-project
      </p>
    </div>
  );
}
