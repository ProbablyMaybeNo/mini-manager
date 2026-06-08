import { clsx } from "clsx";
import type { CollectionStats } from "@/db/queries/collections";

/**
 * COLLECTIONS bottom overview/stats bar. A sticky terminal readout strip:
 * paints owned · models by build stage · total spent (per currency). The
 * model stage breakdown collapses to "owned + completed" when there are
 * too many non-zero buckets to fit cleanly.
 */
export function StatsBar({ stats }: { stats: CollectionStats }) {
  const {
    paintsOwned,
    paintsTotal,
    modelsByStatus,
    modelsTotal,
    spentByCurrency,
  } = stats;

  // Build stage chips in lifecycle order. If more than 4 non-zero stages,
  // collapse to a compact owned + complete summary so the bar never wraps
  // into a cluttered mess (the brief: "owned+completed if too many").
  const STAGE_ORDER = [
    "WISHLIST",
    "OWNED",
    "BUILT",
    "PRIMED",
    "PAINTED",
    "BASED",
    "COMPLETE",
  ] as const;
  const nonZero = STAGE_ORDER.filter((s) => (modelsByStatus[s] ?? 0) > 0);
  const compact = nonZero.length > 4;

  const stageChips = compact
    ? [
        { label: "Owned", n: ownedish(modelsByStatus) },
        { label: "Complete", n: modelsByStatus.COMPLETE ?? 0 },
      ]
    : nonZero.map((s) => ({
        label: titleCase(s),
        n: modelsByStatus[s] ?? 0,
      }));

  const spend = Object.entries(spentByCurrency).sort((a, b) => b[1] - a[1]);

  return (
    <div
      className={clsx(
        "sticky bottom-0 px-4 py-2 border-t bg-[var(--color-bg-elevated)]",
        "flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono",
      )}
      style={{
        borderTopColor:
          "color-mix(in srgb, var(--color-cyan) 28%, var(--color-border))",
      }}
    >
      <span className="text-2xs uppercase tracking-[0.14em] text-[var(--color-cyan)]">
        ▸ COLLECTION
      </span>

      <Stat label="Paints owned" value={`${paintsOwned}/${paintsTotal}`} />

      <span
        aria-hidden
        className="h-3 w-px bg-[var(--color-border-strong)] hidden sm:inline-block"
      />

      <Stat label="Models" value={String(modelsTotal)} />
      {stageChips.map((c) => (
        <Stat key={c.label} label={c.label} value={String(c.n)} muted />
      ))}

      <span className="grow" />

      <span className="text-2xs uppercase tracking-wider text-[var(--color-fg-muted)]">
        Total spent
      </span>
      {spend.length === 0 ? (
        <span className="text-[var(--color-fg-subtle)]">—</span>
      ) : (
        spend.map(([currency, total]) => (
          <span
            key={currency}
            className="text-[var(--color-green)] font-medium tracking-wide"
          >
            {formatTotal(total, currency)}
          </span>
        ))
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-2xs uppercase tracking-wider text-[var(--color-fg-subtle)]">
        {label}
      </span>
      <span
        className={clsx(
          "tabular-nums",
          muted ? "text-[var(--color-fg-muted)]" : "text-[var(--color-cyan)]",
        )}
      >
        {value}
      </span>
    </span>
  );
}

/** "Owned" in the compact summary = everything acquired (OWNED + every
 *  build stage), i.e. not still on the wishlist. */
function ownedish(byStatus: Record<string, number>): number {
  return [
    "OWNED",
    "BUILT",
    "PRIMED",
    "PAINTED",
    "BASED",
    "COMPLETE",
    "PURCHASED",
  ].reduce((sum, s) => sum + (byStatus[s] ?? 0), 0);
}

function titleCase(s: string): string {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

function formatTotal(total: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(total);
  } catch {
    return `${total.toFixed(2)} ${currency}`;
  }
}
