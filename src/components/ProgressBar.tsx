import { clsx } from "clsx";

/**
 * Bracketed terminal-style progress bar. Always 20 cells.
 *
 * The bar tone follows progress: dim until visible, green once paint
 * starts, brighter when most of the way through. Glow only fires when
 * the bar is full to celebrate completion.
 */
export function ProgressBar({
  percent,
  width = 20,
  className,
}: {
  percent: number;
  width?: number;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  const filled = Math.round((clamped / 100) * width);
  const empty = width - filled;
  const tone =
    clamped >= 100
      ? "glow-green"
      : clamped >= 50
        ? "text-[var(--color-green)]"
        : "text-[var(--color-green-dim)]";
  return (
    <span
      className={clsx("font-mono text-xs whitespace-pre", tone, className)}
      aria-label={`${clamped} percent complete`}
    >
      [{"█".repeat(filled)}
      <span className="text-[var(--color-border-strong)]">
        {"░".repeat(empty)}
      </span>
      ]
    </span>
  );
}
