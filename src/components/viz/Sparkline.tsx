import { clsx } from "clsx";
import { VIZ_STROKE, vizGlow, type VizTone } from "./vizTokens";

/**
 * Sparkline — the compact inline trend cue (DESIGN_LANGUAGE §13, moodboard
 * group 27 glanceable readouts). A miniature, axis-less phosphor trace for
 * a streak / completion-over-time figure sitting beside a big number — the
 * "is this going up or down" glance, no grid, no nodes except the latest.
 *
 * Pure SVG, SSR-safe (no refs / effects / window / document). Fixed-width
 * by default (inline sizing) but accepts a `width`. The latest datum gets
 * a glowing end-dot so the eye lands on "now". Draw-on-mount is opt-in and
 * `motion-safe` only.
 */

export interface SparklineProps {
  /** The series. ≥2 points draws a line; fewer renders a flat baseline. */
  data: ReadonlyArray<number>;
  /** Phosphor hue. Default "cyan". */
  tone?: VizTone;
  /** Pixel width. Default 72. */
  width?: number;
  /** Pixel height. Default 22. */
  height?: number;
  /** Draw the glowing end-dot on the latest datum. Default true. */
  endDot?: boolean;
  /** Animate the draw-in on mount (motion-safe only). */
  animate?: boolean;
  /** Accessible description, e.g. "Streak trend, last 14 days". */
  ariaLabel: string;
  className?: string;
}

const PAD = 2;

export function Sparkline({
  data,
  tone = "cyan",
  width = 72,
  height = 22,
  endDot = true,
  animate = true,
  ariaLabel,
  className,
}: SparklineProps) {
  const stroke = VIZ_STROKE[tone];
  const min = data.length ? Math.min(...data) : 0;
  const max = data.length ? Math.max(...data) : 0;
  const span = max - min;
  const usableW = width - PAD * 2;
  const usableH = height - PAD * 2;

  const pts = data.map((v, i) => {
    const x =
      data.length <= 1 ? width / 2 : PAD + (i / (data.length - 1)) * usableW;
    const norm = span === 0 ? 0.5 : (v - min) / span;
    const y = PAD + (1 - norm) * usableH;
    return { x, y };
  });

  const path =
    pts.length >= 2
      ? pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ")
      : "";
  const last = pts[pts.length - 1];

  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={clsx("inline-block align-middle", className)}
    >
      {path ? (
        <path
          d={path}
          fill="none"
          stroke={stroke}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          className={animate ? "motion-safe:[animation:viz-draw_900ms_ease-out]" : undefined}
          style={{ filter: vizGlow(stroke, 2, 45) }}
        />
      ) : (
        <line
          x1={PAD}
          y1={height / 2}
          x2={width - PAD}
          y2={height / 2}
          stroke="var(--color-border-strong)"
          strokeWidth={1}
          opacity={0.6}
        />
      )}
      {endDot && last ? (
        <circle
          cx={last.x}
          cy={last.y}
          r={2}
          fill={stroke}
          style={{ filter: vizGlow(stroke, 2, 60) }}
        />
      ) : null}
    </svg>
  );
}
