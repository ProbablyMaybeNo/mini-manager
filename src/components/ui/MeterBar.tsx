import { clsx } from "clsx";

/** Usage-meter level — gold-standard §06. The image colours the readout
 *  (and fill) by LEVEL, where high is hot:
 *    low   (< 60%)  cyan   — comfortable headroom.
 *    mid   (60–84%) yellow — getting full.
 *    high  (>= 85%) red    — near capacity.
 *  Note this is the inverse of completion progress (where high = green);
 *  a meter measures consumption, so use it for CPU / memory / storage /
 *  budget-style readouts. Pass an explicit `tone` to lock a colour. */
export type MeterTone = "auto" | "info" | "warning" | "danger" | "ok";

const TONE_TOKEN: Record<Exclude<MeterTone, "auto">, string> = {
  info: "var(--status-info)",
  warning: "var(--status-warning)",
  danger: "var(--status-danger)",
  ok: "var(--status-ok)",
};

function resolveTone(percent: number): Exclude<MeterTone, "auto"> {
  if (percent >= 85) return "danger";
  if (percent >= 60) return "warning";
  return "info";
}

export interface MeterBarProps {
  /** Row label shown top-left, uppercase mono (e.g. "CPU USAGE"). */
  label: string;
  /** 0–100. Clamped. */
  percent: number;
  /** Colour by usage LEVEL ("auto", default) or lock a tone. */
  tone?: MeterTone;
  /** Bar thickness in px. Default 6 (the image's thin bar). */
  height?: number;
  /** Override the right-hand readout text. Defaults to "NN%". */
  readout?: string;
  className?: string;
}

/**
 * MeterBar — the gold-standard §06 labeled usage meter: a label on the
 * left, a level-coloured percentage on the right, and a thin smooth bar
 * below (coloured fill on a dark track). Matches the spec image's
 * CPU/MEMORY/STORAGE rows (42% cyan · 76% yellow · 91% red).
 *
 * Pure CSS, SSR-safe (no refs / effects / window). The fill carries an
 * in-hue phosphor glow; both glow + the width transition are motion-safe
 * (reduced-motion users get the final state with no animation).
 */
export function MeterBar({
  label,
  percent,
  tone = "auto",
  height = 6,
  readout,
  className,
}: MeterBarProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  const resolved = tone === "auto" ? resolveTone(clamped) : tone;
  const color = TONE_TOKEN[resolved];
  const text = readout ?? `${Math.round(clamped)}%`;

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${label}: ${Math.round(clamped)} percent`}
      className={clsx("meter", className)}
    >
      <div className="meter-head">
        <span className="meter-label">{label}</span>
        <span className="meter-readout" style={{ color }}>
          {text}
        </span>
      </div>
      <div className="meter-track" style={{ height: `${height}px` }}>
        <span
          aria-hidden
          className="meter-fill motion-safe:transition-[width] motion-safe:duration-300 motion-safe:ease-out"
          style={{
            width: `${clamped}%`,
            background: color,
            boxShadow:
              clamped > 0
                ? `0 0 6px -1px color-mix(in srgb, ${color} 60%, transparent)`
                : undefined,
          }}
        />
      </div>
    </div>
  );
}
