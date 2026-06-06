import { clsx } from "clsx";
import {
  VIZ_STROKE,
  resolveAutoTone,
  vizGlow,
  type VizToneOrAuto,
} from "./vizTokens";

/**
 * SegmentedBar — the segmented-block progress / output-rate readout
 * (DESIGN_LANGUAGE §13, the wireframe-globe "OUTPUT RATE" panel + moodboard
 * group 27, *"progress bars… boxes with black or no fill"* — Ross's
 * favourite). NOT a smooth fill: a fixed row of discrete cells where the
 * leading N light up in phosphor (the lit cells glow) and the rest stay as
 * empty outlined boxes. Pairs the color-bar-with-black-text label idiom
 * from the same group for the optional inline label.
 *
 * Pure SVG-free (CSS boxes), SSR-safe (no refs / effects / window). The
 * lit cells animate in left-to-right on mount, motion-safe only, with a
 * per-cell stagger so it reads as a "charging" bar — reduced-motion users
 * get the final lit state instantly.
 *
 * Hue: explicit `tone`, or "auto" to follow the locked completion set.
 */

export interface SegmentedBarProps {
  /** Current value. With `max`, derives how many cells light up. */
  value: number;
  /** Full-scale value. Default 100. */
  max?: number;
  /** Total number of cells in the row. Default 10. */
  segments?: number;
  /** Lock the lit-cell hue, or "auto" for the completion set. */
  tone?: VizToneOrAuto;
  /** Cell height in px. Default 14. */
  height?: number;
  /** Optional label shown left of the bar (e.g. "OUTPUT RATE"). */
  label?: string;
  /** Optional readout shown right of the bar (e.g. "62%"). When `tone`
   *  resolves to a colour, this renders as the color-bar-with-black-text
   *  chip idiom. */
  readout?: string;
  /** Animate the lit cells charging in on mount (motion-safe only). */
  animate?: boolean;
  /** Accessible name; defaults to "<percent> percent". */
  ariaLabel?: string;
  className?: string;
}

export function SegmentedBar({
  value,
  max = 100,
  segments = 10,
  tone = "auto",
  height = 14,
  label,
  readout,
  animate = true,
  ariaLabel,
  className,
}: SegmentedBarProps) {
  const safeMax = max > 0 ? max : 1;
  const percent = Math.max(0, Math.min(100, (value / safeMax) * 100));
  const rounded = Math.round(percent);
  const total = Math.max(1, Math.round(segments));
  // Round so a 1% value still lights the first cell (a non-zero value is
  // never invisible), but a true 0 lights none.
  const lit = percent <= 0 ? 0 : Math.max(1, Math.round((percent / 100) * total));
  const resolved = resolveAutoTone(tone, percent);
  const stroke = VIZ_STROKE[resolved];

  return (
    <div
      role="progressbar"
      aria-valuenow={rounded}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel ?? `${rounded} percent`}
      className={clsx("flex items-center gap-2 min-w-0", className)}
    >
      {label ? (
        <span className="font-mono text-2xs uppercase tracking-wider text-[var(--color-fg-muted)] shrink-0">
          {label}
        </span>
      ) : null}

      <div className="flex items-stretch gap-[2px] flex-1 min-w-0" style={{ height }}>
        {Array.from({ length: total }, (_, i) => {
          const on = i < lit;
          return (
            <span
              key={i}
              aria-hidden
              className={clsx(
                "flex-1 min-w-[3px] rounded-[1px] border",
                on && animate && "motion-safe:[animation:viz-cell-in_360ms_ease-out_both]",
              )}
              style={{
                borderColor: on
                  ? stroke
                  : "var(--color-border-strong)",
                background: on
                  ? `color-mix(in srgb, ${stroke} 80%, transparent)`
                  : "transparent",
                filter: on ? vizGlow(stroke, 2, 40) : undefined,
                // Per-cell stagger for the left-to-right "charge" sweep.
                animationDelay: on && animate ? `${i * 45}ms` : undefined,
              }}
            />
          );
        })}
      </div>

      {readout ? (
        <span
          className="font-mono text-2xs font-semibold tabular-nums shrink-0 px-1.5 py-[1px] rounded-[2px]"
          style={{ background: stroke, color: "var(--color-bg)" }}
        >
          {readout}
        </span>
      ) : null}
    </div>
  );
}
