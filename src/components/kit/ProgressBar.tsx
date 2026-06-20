import { cn } from "@/lib/cn";
import type { Accent } from "@/lib/palette";

const fillColor: Record<Accent, string> = {
  cyan: "bg-cyan",
  green: "bg-green",
  yellow: "bg-yellow",
  orange: "bg-orange",
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
        // Bar height +50% (h-2 → h-3) to match the larger % label (kdV6XB6eFsRS).
        className="h-3 flex-1 border border-fg/20 bg-bg"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={cn("h-full", fillColor[tone])} style={{ width: `${pct}%` }} />
      </div>
      {showLabel && (
        // % label +50% (12px → 18px); widen the box so the larger digits fit.
        <span className="w-12 text-right font-num2 text-num2 tabular-nums text-fg">
          {pct}%
        </span>
      )}
    </div>
  );
}
