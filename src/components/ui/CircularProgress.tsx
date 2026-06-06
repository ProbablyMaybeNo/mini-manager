import { clsx } from "clsx";

/**
 * CircularProgress — the recurring moodboard "circular gauge / dial"
 * (DESIGN_LANGUAGE §7.1). A phosphor ring that fills clockwise from 12
 * o'clock to show a headline completion / streak figure, with the number
 * read out in the centre.
 *
 * Pure SVG, SSR-safe (no refs / effects / window), so it renders
 * identically on the server and client — drop it straight into a server
 * component. The fill hue follows the same "behind / mid / ahead"
 * threshold set the linear `ProgressBar` locked (Ross's P12.6 set):
 *   neutral when empty · danger < 25 · warning 25–74 · ok ≥ 75
 * Pass an explicit `tone` to lock the hue (e.g. a streak dial that should
 * always read green / amber regardless of the raw percent).
 *
 * Reuse: dense table rows keep the linear `ProgressBar`; this dial is for
 * the HEADLINE figure on a panel (the completion / streak hero), per the
 * spec's "circular for headline, linear for dense rows" rule.
 */

export type CircularProgressTone =
  | "auto"
  | "ok"
  | "warning"
  | "danger"
  | "info"
  | "purple"
  | "neutral";

/** Maps a tone to its phosphor stroke colour (a CSS token reference). */
const TONE_STROKE: Record<Exclude<CircularProgressTone, "auto">, string> = {
  ok: "var(--status-ok)",
  warning: "var(--status-warning)",
  danger: "var(--status-danger)",
  info: "var(--status-info)",
  purple: "var(--status-purple)",
  neutral: "var(--color-fg-muted)",
};

function resolveTone(
  tone: CircularProgressTone,
  clamped: number,
): Exclude<CircularProgressTone, "auto"> {
  if (tone !== "auto") return tone;
  if (clamped === 0) return "neutral";
  if (clamped >= 75) return "ok";
  if (clamped >= 25) return "warning";
  return "danger";
}

export interface CircularProgressProps {
  /** 0–100. Drives the arc sweep + (when label omitted) the centre text. */
  percent: number;
  /** Outer diameter in px. Default 72 (panel-headline size). */
  size?: number;
  /** Ring thickness in px. Default 6. */
  strokeWidth?: number;
  /** Lock the ring hue; defaults to the auto threshold set. */
  tone?: CircularProgressTone;
  /** Centre text override (e.g. a raw streak count "12"). When omitted the
   *  rounded percent is shown with a trailing %. */
  label?: string;
  /** Small caption under the centre figure (e.g. "DAYS", "DONE"). */
  caption?: string;
  /** Accessible name; defaults to "<percent> percent". */
  ariaLabel?: string;
  className?: string;
}

export function CircularProgress({
  percent,
  size = 72,
  strokeWidth = 6,
  tone = "auto",
  label,
  caption,
  ariaLabel,
  className,
}: CircularProgressProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const resolved = resolveTone(tone, clamped);
  const stroke = TONE_STROKE[resolved];

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  // Arc length to draw for the current percent; the remainder is the track.
  const dash = (clamped / 100) * circumference;
  const center = size / 2;

  return (
    <span
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel ?? `${clamped} percent`}
      className={clsx("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden
        // Start the sweep at 12 o'clock and run clockwise.
        style={{ transform: "rotate(-90deg)" }}
      >
        {/* Track — the unfilled remainder, near-black panel ring. */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--color-border-strong)"
          strokeWidth={strokeWidth}
          opacity={0.5}
        />
        {/* Fill — the phosphor arc. A drop-shadow gives the dial a CRT
            bloom that matches the rest of the screen. */}
        {clamped > 0 ? (
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            style={{
              filter: `drop-shadow(0 0 3px color-mix(in srgb, ${stroke} 55%, transparent))`,
            }}
          />
        ) : null}
      </svg>
      {/* Centre readout — the headline figure + optional caption. */}
      <span className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span
          className="font-mono font-medium tabular-nums"
          style={{
            color: stroke,
            fontSize: Math.max(12, Math.round(size * 0.26)),
          }}
        >
          {label ?? `${clamped}%`}
        </span>
        {caption ? (
          <span className="font-mono text-2xs uppercase tracking-wider text-[var(--color-fg-muted)] mt-0.5">
            {caption}
          </span>
        ) : null}
      </span>
    </span>
  );
}
