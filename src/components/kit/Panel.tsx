import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { accentText, type Accent } from "@/lib/palette";

interface PanelProps {
  children: ReactNode;
  /** Section label rendered as a header row inside the panel (e.g. PROJECTS). */
  label?: string;
  accent?: Accent;
  /** Legacy prop — corner ticks are removed in V2; kept for API stability. */
  cornerTicks?: boolean;
  /** Legacy prop — glow is removed in V2; kept for API stability. */
  glow?: boolean;
  className?: string;
  /** Optional walkthrough anchor — surfaced as a `data-walkthrough` attribute
   *  on the panel root so the first-create coach-marks can spotlight it. */
  "data-walkthrough"?: string;
}

/**
 * V2 "HEX.CODE" card/panel (style guide 1:243): `--surface` fill, white-12%
 * border, 12px radius, soft flat depth. An optional section label renders as a
 * clean header line inside the panel (no notched border, no corner ticks).
 * The `cornerTicks` / `glow` props are retained as no-ops so existing callers
 * keep compiling.
 */
export function Panel({
  children,
  label,
  accent = "cyan",
  className,
  "data-walkthrough": dataWalkthrough,
}: PanelProps) {
  return (
    <div
      data-walkthrough={dataWalkthrough}
      className={cn(
        "relative rounded-[12px] border border-border bg-surface panel-depth",
        className,
      )}
    >
      {label && (
        <span
          className={cn(
            "mb-3 block text-[13px] font-bold uppercase tracking-wide",
            accent === "cyan" ? "text-cyan-lite" : accentText[accent],
          )}
          style={{ fontFamily: "var(--font-section)" }}
        >
          {label}
        </span>
      )}
      {children}
    </div>
  );
}
