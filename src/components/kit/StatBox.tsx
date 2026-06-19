import { cn } from "@/lib/cn";
import { accentBorder, accentText, accentTextGlow, type Accent } from "@/lib/palette";

/** Compact stat box: title + big accent number. The border follows the box's
 *  accent so a row of stat boxes reads multi-colour (palette adoption — defaults
 *  to cyan, so existing call sites are unchanged), softened to a uniform 1px
 *  frame so no single tracker reads thicker than its neighbours (D5/MM-49/SrUl).
 *
 *  `center` (dashboard trackers) stacks a centered title over a centered
 *  number — just the two values, no sub-content (qHYZN/4g3I/JxHyr). */
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
        // Uniform 1px border in the box's accent — each KPI box reads in its
        // own hue (D5/MM-49/qHYZN) while staying the same weight as its
        // neighbours (SrUl); alpha softened so it frames rather than glares.
        accentBorder[accent],
        "border-opacity-40",
        center && "flex flex-col items-center justify-center gap-1 text-center",
        className,
      )}
      style={{ borderRadius: "var(--radius-panel)" }}
    >
      <div className="label-osd text-fg-dim">
        {label}
      </div>
      <div
        className={cn(
          // Hero tracker number — bumped up so the totals read large and
          // glanceable (6hWtJA2oArmz follow-up). Font family stays on
          // --font-display; only the size grows here.
          "font-display text-3xl leading-none lg:text-4xl",
          !center && "mt-1",
          accentText[accent],
          // Subtle per-accent phosphor glow on the hero number (UX-006) —
          // static low-glow token, matches each box's hue.
          accentTextGlow[accent],
        )}
      >
        {value}
      </div>
    </div>
  );
}
