/**
 * viz kit — shared tone → phosphor-token map.
 *
 * The bespoke SVG data-viz kit (DESIGN_LANGUAGE §13) draws strokes/fills
 * exclusively from the 5 locked CRT-phosphor tokens. Centralising the
 * tone→token lookup here keeps every component (RadialGauge, LineGraph,
 * AreaGraph, Sparkline, SegmentedBar) on the same palette so a "cyan"
 * line and a "cyan" gauge are literally the same hue, and a future tone
 * is added in one place.
 *
 * `auto` is resolved per-component against the locked behind/mid/ahead
 * threshold set the linear ProgressBar + CircularProgress already use
 * (neutral 0 · danger <25 · warning 25–74 · ok ≥75) — see `resolveAutoTone`.
 */

export type VizTone =
  | "cyan"
  | "green"
  | "yellow"
  | "amber"
  | "purple"
  | "red"
  | "neutral";

/** A tone that may defer to the auto completion-threshold set. */
export type VizToneOrAuto = VizTone | "auto";

/** Maps a concrete tone to its phosphor stroke colour (a CSS var ref). */
export const VIZ_STROKE: Record<VizTone, string> = {
  cyan: "var(--color-cyan)",
  green: "var(--color-green)",
  yellow: "var(--color-yellow)",
  amber: "var(--color-amber)",
  purple: "var(--color-purple-pastel)",
  red: "var(--color-red)",
  neutral: "var(--color-fg-muted)",
};

/**
 * Resolve an `auto` tone against a 0–100 ratio using the locked
 * completion threshold set (same as CircularProgress). Concrete tones
 * pass straight through.
 */
export function resolveAutoTone(tone: VizToneOrAuto, percent: number): VizTone {
  if (tone !== "auto") return tone;
  if (percent <= 0) return "neutral";
  if (percent >= 75) return "green";
  if (percent >= 25) return "amber";
  return "red";
}

/** A restrained CRT bloom around an active arc/line, in the stroke hue. */
export function vizGlow(stroke: string, px = 3, mix = 55): string {
  return `drop-shadow(0 0 ${px}px color-mix(in srgb, ${stroke} ${mix}%, transparent))`;
}
