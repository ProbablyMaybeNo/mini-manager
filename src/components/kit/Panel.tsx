import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { accentBorder, type Accent } from "@/lib/palette";

/** Accent → the matching phosphor box-glow utility (palette adoption). */
const accentGlow: Record<Accent, string> = {
  cyan: "glow-cyan",
  green: "glow-green",
  yellow: "glow-yellow",
  purple: "glow-purple",
  red: "glow-red",
  dim: "",
};

interface PanelProps {
  children: ReactNode;
  /** Small mono "tech label" rendered on the top border (e.g. PROJECTS, FILE). */
  label?: string;
  accent?: Accent;
  /** Draw cyan corner ticks at the panel corners. */
  cornerTicks?: boolean;
  glow?: boolean;
  className?: string;
}

/**
 * The defining surface of the app: a cyan-bordered, black-fill box with an optional
 * mono tech-label notched into its top border and optional corner ticks.
 */
export function Panel({
  children,
  label,
  accent = "cyan",
  cornerTicks = false,
  glow = false,
  className,
}: PanelProps) {
  return (
    <div
      className={cn(
        "relative border bg-bg/60 panel-depth",
        accentBorder[accent],
        glow && accentGlow[accent],
        className,
      )}
      style={{ borderRadius: "var(--radius-panel)" }}
    >
      {label && (
        <span className="absolute -top-2 left-3 bg-bg px-1.5 label-osd text-fg-dim">
          {label}
        </span>
      )}
      {cornerTicks && <CornerTicks accent={accent} />}
      {children}
    </div>
  );
}

function CornerTicks({ accent }: { accent: Accent }) {
  const border = accentBorder[accent];
  const base = "pointer-events-none absolute h-2 w-2";
  return (
    <>
      <span className={cn(base, "left-0 top-0 border-l border-t", border)} />
      <span className={cn(base, "right-0 top-0 border-r border-t", border)} />
      <span className={cn(base, "bottom-0 left-0 border-b border-l", border)} />
      <span className={cn(base, "bottom-0 right-0 border-b border-r", border)} />
    </>
  );
}
