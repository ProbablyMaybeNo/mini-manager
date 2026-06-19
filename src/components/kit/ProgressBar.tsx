import { cn } from "@/lib/cn";
import type { Accent } from "@/lib/palette";

const fillColor: Record<Accent, string> = {
  cyan: "bg-cyan",
  green: "bg-green",
  yellow: "bg-yellow",
  purple: "bg-purple",
  red: "bg-red",
  dim: "bg-fg-faint",
};

/** Solid progress bar + percent label. When no accent is given, the fill
 *  ramps with completion (UX audit #1, matching the Figma mission-table):
 *  red early → yellow mid → green near-done; empty bars stay dim. */
export function ProgressBar({
  percent,
  accent,
  showLabel = true,
  className,
}: {
  percent: number;
  accent?: Accent;
  showLabel?: boolean;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, percent));
  const tone: Accent =
    accent ??
    (pct >= 67 ? "green" : pct >= 34 ? "yellow" : pct > 0 ? "red" : "dim");
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className="h-2 flex-1 border border-fg/20 bg-bg"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={cn("h-full", fillColor[tone])} style={{ width: `${pct}%` }} />
      </div>
      {showLabel && (
        <span className="w-9 text-right font-mono text-[12px] tabular-nums text-fg-dim">
          {pct}%
        </span>
      )}
    </div>
  );
}
