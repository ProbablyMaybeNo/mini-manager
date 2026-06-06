import { clsx } from "clsx";

export function PriceFooter({
  count,
  totalByCurrency,
}: {
  count: number;
  totalByCurrency: Record<string, number>;
}) {
  const entries = Object.entries(totalByCurrency).sort((a, b) => b[1] - a[1]);
  return (
    // Terminal readout strip — a cyan-tinted top rule + a tracked-out
    // mono caption, with the spend totals lit in phosphor green so the
    // bottom of the queue reads as a live status bar.
    <div
      className={clsx(
        "sticky bottom-0 px-4 py-2 border-t",
        "bg-[var(--color-bg-elevated)] flex items-center gap-4 text-xs font-mono",
      )}
      style={{
        borderTopColor:
          "color-mix(in srgb, var(--color-cyan) 28%, var(--color-border))",
      }}
    >
      <span className="text-2xs uppercase tracking-[0.14em] text-[var(--color-cyan)]">
        ▸ SUM
      </span>
      <span className="text-[var(--color-fg-muted)] uppercase tracking-wider">
        Σ {count} item{count === 1 ? "" : "s"}
      </span>
      <span className="grow" />
      {entries.length === 0 ? (
        <span className="text-[var(--color-fg-subtle)]">no prices set</span>
      ) : (
        entries.map(([currency, total]) => (
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

function formatTotal(total: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(total);
  } catch {
    return `${total.toFixed(2)} ${currency}`;
  }
}
