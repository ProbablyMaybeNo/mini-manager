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
  // V2 ramp (4:4): cyan while in progress, green at/near 100%; empty stays dim.
  const tone: Accent =
    accent ?? (pct >= 100 ? "green" : pct > 0 ? "cyan" : "dim");
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        // Rounded 4px track on the border-grey rail (HEX.CODE progress bar).
        className="h-1 flex-1 overflow-hidden rounded-full bg-border"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn("h-full rounded-full", fillColor[tone])}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <span className="w-10 text-right font-mono text-[11px] tabular-nums text-fg">
          {pct}%
        </span>
      )}
    </div>
  );
}
