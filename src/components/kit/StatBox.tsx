import { cn } from "@/lib/cn";
import { accentBorder, accentText, type Accent } from "@/lib/palette";

/** Compact stat box: title + big accent number.
 *
 *  `center` (dashboard trackers) stacks a centered title over a centered
 *  number — just the two values, no sub-content (qHYZN/4g3I/JxHyr). The
 *  border is always a uniform 1px in the box's own accent colour so no single
 *  tracker reads thicker than its neighbours (SrUl). */
export function StatBox({
  label,
  value,
  accent = "cyan",
  center = false,
  className,
}: {
  label: string;
  value: string;
  accent?: Accent;
  center?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border bg-bg/60 px-4 py-3 panel-depth transition-shadow duration-200 hover:panel-depth-glow",
        // Uniform 1px border in the box's accent — keeps every tracker the
        // same weight (SrUl) while giving each its own colour (qHYZN).
        accentBorder[accent],
        center && "flex flex-col items-center justify-center gap-1 text-center",
        className,
      )}
      style={{ borderRadius: "var(--radius-panel)" }}
    >
      <div className="font-osd text-[11px] uppercase tracking-[0.18em] text-fg-dim">
        {label}
      </div>
      <div className={cn("font-display text-xl leading-none", !center && "mt-1", accentText[accent])}>
        {value}
      </div>
    </div>
  );
}
