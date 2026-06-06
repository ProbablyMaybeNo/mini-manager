import { clsx } from "clsx";
import {
  VIZ_STROKE,
  resolveAutoTone,
  vizGlow,
  type VizToneOrAuto,
} from "./vizTokens";

/**
 * RadialGauge — the bespoke "terminal access" radial dial (DESIGN_LANGUAGE
 * §13, moodboard group 20: josh-floyd "cyberspace", *"radial menus like
 * the terminal access element, circular progress elements"*). Supersedes
 * the plain `CircularProgress`: where that drew a single ring, this draws
 * the full HUD dial —
 *
 *   - a concentric TRACK ring (the unfilled dial),
 *   - a ring of TICK MARKS around the dial (major + minor, the diegetic
 *     gauge graduations),
 *   - a glowing phosphor VALUE ARC sweeping clockwise from 12 o'clock,
 *   - the value read out in mono at the centre + an optional caption,
 *   - an optional tiny tech LABEL under the readout for the OSD feel.
 *
 * Pure SVG, SSR-safe (no refs / effects / window / document at module or
 * render scope) so it renders identically on the server and client — drop
 * it into a server component. The mount animation is opt-in and applied
 * via CSS `motion-safe` only, so reduced-motion users get the final frame
 * with no movement and SSR markup is unaffected.
 *
 * Hue: pass an explicit `tone` to lock it (a streak dial that should read
 * green/amber regardless of raw percent), or `tone="auto"` (default) to
 * follow the locked behind/mid/ahead completion set.
 */

export interface RadialGaugeProps {
  /** Current value. Combined with `max` to derive the 0–100 sweep. */
  value: number;
  /** Full-scale value. Default 100 (value reads as a raw percent). */
  max?: number;
  /** Outer diameter in px. Default 96. */
  size?: number;
  /** Value-arc + track thickness in px. Default 7. */
  strokeWidth?: number;
  /** Lock the arc hue, or "auto" for the completion threshold set. */
  tone?: VizToneOrAuto;
  /** Centre readout override. When omitted, the rounded percent + "%". */
  label?: string;
  /** Small caption under the centre figure (e.g. "DONE", "DAYS"). */
  caption?: string;
  /** Tiny tech tag under the caption (e.g. "AVG ▸ 60d") — the OSD detail. */
  techLabel?: string;
  /** Number of major tick graduations around the dial. Default 12. */
  ticks?: number;
  /** Animate the arc sweep + readout on mount (motion-safe only). */
  animate?: boolean;
  /** Accessible name; defaults to "<percent> percent". */
  ariaLabel?: string;
  className?: string;
}

export function RadialGauge({
  value,
  max = 100,
  size = 96,
  strokeWidth = 7,
  tone = "auto",
  label,
  caption,
  techLabel,
  ticks = 12,
  animate = true,
  ariaLabel,
  className,
}: RadialGaugeProps) {
  const safeMax = max > 0 ? max : 1;
  const percent = Math.max(0, Math.min(100, (value / safeMax) * 100));
  const rounded = Math.round(percent);
  const resolved = resolveAutoTone(tone, percent);
  const stroke = VIZ_STROKE[resolved];

  const center = size / 2;
  // The value ring sits a hair inside the tick ring so the graduations
  // frame the arc rather than collide with it.
  const radius = center - strokeWidth / 2 - size * 0.1;
  const circumference = 2 * Math.PI * radius;
  const dash = (percent / 100) * circumference;

  // Tick geometry — a major tick at each graduation, with a faint minor
  // tick between majors. Drawn just outside the value ring.
  const tickOuter = center - 2;
  const majorInner = tickOuter - size * 0.06;
  const minorInner = tickOuter - size * 0.035;
  const tickCount = Math.max(2, Math.round(ticks));
  const tickMarks = Array.from({ length: tickCount * 2 }, (_, i) => {
    const isMajor = i % 2 === 0;
    const angle = (i / (tickCount * 2)) * 2 * Math.PI - Math.PI / 2;
    const inner = isMajor ? majorInner : minorInner;
    return {
      key: i,
      x1: center + Math.cos(angle) * tickOuter,
      y1: center + Math.sin(angle) * tickOuter,
      x2: center + Math.cos(angle) * inner,
      y2: center + Math.sin(angle) * inner,
      isMajor,
    };
  });

  const valueFontPx = Math.max(13, Math.round(size * 0.24));

  return (
    <span
      role="progressbar"
      aria-valuenow={rounded}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel ?? `${rounded} percent`}
      className={clsx(
        "relative inline-flex items-center justify-center",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden
      >
        {/* Tick ring — the dial graduations. Major ticks brighter than
            minor; both in a phosphor-neutral so the value arc stays the
            star. Drawn upright (no group rotation) so SSR markup is
            deterministic. */}
        <g>
          {tickMarks.map((t) => (
            <line
              key={t.key}
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y2}
              stroke={
                t.isMajor
                  ? "color-mix(in srgb, var(--color-cyan) 45%, var(--color-border-strong))"
                  : "var(--color-border-strong)"
              }
              strokeWidth={t.isMajor ? 1.5 : 1}
              opacity={t.isMajor ? 0.9 : 0.5}
            />
          ))}
        </g>

        {/* Rotate ONLY the rings so the sweep starts at 12 o'clock and
            runs clockwise — the transform is on the SVG element, fully
            SSR-deterministic. */}
        <g style={{ transform: "rotate(-90deg)", transformOrigin: "center" }}>
          {/* Track — unfilled remainder of the dial. */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="var(--color-border-strong)"
            strokeWidth={strokeWidth}
            opacity={0.45}
          />
          {/* Value arc — the glowing phosphor sweep. */}
          {percent > 0 ? (
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circumference}`}
              className={animate ? "motion-safe:[animation:viz-arc-in_900ms_ease-out]" : undefined}
              style={{ filter: vizGlow(stroke) }}
            />
          ) : null}
        </g>
      </svg>

      {/* Centre readout — the headline figure + optional caption + tech tag. */}
      <span
        className={clsx(
          "absolute inset-0 flex flex-col items-center justify-center leading-none px-1 text-center",
          animate && "motion-safe:[animation:viz-fade-in_700ms_ease-out]",
        )}
      >
        <span
          className="font-mono font-medium tabular-nums"
          style={{ color: stroke, fontSize: valueFontPx }}
        >
          {label ?? `${rounded}%`}
        </span>
        {caption ? (
          <span className="font-mono text-2xs uppercase tracking-wider text-[var(--color-fg-muted)] mt-0.5">
            {caption}
          </span>
        ) : null}
        {techLabel ? (
          <span className="font-mono text-2xs uppercase tracking-[0.14em] text-[var(--color-fg-subtle)] mt-1 opacity-70">
            {techLabel}
          </span>
        ) : null}
      </span>
    </span>
  );
}
