import { clsx } from "clsx";
import { ProgressBar } from "@/components/ProgressBar";
import type { AggregateCounters } from "@/lib/progress";

/**
 * Read-only mirror of `<StageCounter />` for Army / Warband parents
 * that derive their numbers from descendant Units. No buttons, no
 * keyboard shortcuts, no error surface — those belong to the leaf
 * counters down the tree, where the actual mutation happens.
 *
 * Renders five rows (Build / Prime / Paint / Base / Complete) plus an
 * Owned row above. A caption beside each total notes the aggregation
 * source so painters know why this header can't be clicked.
 */

type AggregateStage = "build" | "prime" | "paint" | "base" | "complete";

const AGGREGATE_STAGES: ReadonlyArray<AggregateStage> = [
  "build",
  "prime",
  "paint",
  "base",
  "complete",
];

const STAGE_LABEL: Readonly<Record<AggregateStage | "owned", string>> = {
  owned: "OWNED",
  build: "BUILD",
  prime: "PRIME",
  paint: "PAINT",
  base: "BASE",
  complete: "COMPLETE",
};

function stageValue(
  agg: AggregateCounters,
  stage: AggregateStage,
): number {
  switch (stage) {
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

function leadStage(agg: AggregateCounters): AggregateStage | null {
  if (agg.completeCount > 0) return "complete";
  if (agg.baseCount > 0) return "base";
  if (agg.paintCount > 0) return "paint";
  if (agg.primeCount > 0) return "prime";
  if (agg.buildCount > 0) return "build";
  return null;
}

export function AggregateCountersDisplay({
  aggregate,
  childCount,
}: {
  aggregate: AggregateCounters;
  childCount: number;
}) {
  const lead = leadStage(aggregate);
  const total = aggregate.count;

  // Nothing meaningful to render — the page surfaces its own empty
  // state via the tree component.
  if (total === 0 && aggregate.namedModelCount === 0) {
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
    <div className="space-y-3" aria-label="Aggregated stage counters">
      <ul className="space-y-1.5" role="list">
        <AggregateRow
          label={STAGE_LABEL.owned}
          value={aggregate.ownedCount}
          total={total}
          tone="amber"
          isLead={aggregate.ownedCount > 0}
        />
        {AGGREGATE_STAGES.map((stage) => (
          <AggregateRow
            key={stage}
            label={STAGE_LABEL[stage]}
            value={stageValue(aggregate, stage)}
            total={total}
            tone="green"
            isLead={lead === stage}
          />
        ))}
      </ul>

      <p className="font-mono text-2xs text-[var(--color-fg-subtle)] uppercase tracking-wider">
        {sourceLabel} · read-only — edit counters on each sub-project
      </p>
    </div>
  );
}

function AggregateRow({
  label,
  value,
  total,
  tone,
  isLead,
}: {
  label: string;
  value: number;
  total: number;
  tone: "green" | "amber";
  isLead: boolean;
}) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;
  const leadColor =
    tone === "amber" ? "text-[var(--color-amber)]" : "text-[var(--color-green)]";
  const labelTone = isLead ? leadColor : "text-[var(--color-fg-muted)]";

  return (
    <li
      className={clsx(
        "frame px-3 py-2 grid items-center gap-x-3",
        "grid-cols-[5rem_1fr_auto]",
      )}
    >
      <span
        className={clsx(
          "font-mono text-xs uppercase tracking-wider",
          labelTone,
        )}
      >
        {label}
      </span>
      <span className="min-w-0 flex items-center gap-2">
        <ProgressBar percent={percent} width={20} />
      </span>
      <span className="font-mono text-xs text-[var(--color-fg-muted)] whitespace-nowrap">
        {value} / {total}
      </span>
    </li>
  );
}
