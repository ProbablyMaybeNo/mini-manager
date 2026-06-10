import { phase12LayerLabel, type Phase12LayerKey, type TechniqueKey } from "@/db/schema";

/**
 * FIGMA-REBUILD task #8 — pure helpers for the /focus full page
 * (REBUILD_SPEC §7 + docs/redesign-refs/Focus.png). No React, no DB —
 * unit-testable in isolation.
 */

/** Always-HH:MM:SS session clock (the mock's `01:23:04` readout). */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/** Compact "1h 47m" rollup for the Today · This week line. */
export function formatRollup(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  if (s === 0) return "0m";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

/** Completion percentage, integer 0–100; 0 models reports 0%. */
export function progressPercent(complete: number, count: number): number {
  if (count <= 0) return 0;
  const clamped = Math.max(0, Math.min(complete, count));
  return Math.round((clamped / count) * 100);
}

/** REBUILD_SPEC §7 — progress-bar colour band: red <34, yellow <67,
 *  green ≥67. */
export type ProgressBand = "red" | "yellow" | "green";

export function progressBand(percent: number): ProgressBand {
  if (percent < 34) return "red";
  if (percent < 67) return "yellow";
  return "green";
}

/** Segmented-bar block count (DESIGN_LANGUAGE §13 — "segmented blocks,
 *  not a smooth fill"). One block per model up to 24; larger forces and
 *  the zero-count placeholder quantise to a fixed 24/12-block track. */
export function segmentCount(totalModels: number): number {
  if (totalModels <= 0) return 12;
  return Math.min(totalModels, 24);
}

/** How many of `segments` blocks light up at `percent`. */
export function filledSegments(percent: number, segments: number): number {
  const pct = Math.max(0, Math.min(percent, 100));
  return Math.round((pct / 100) * segments);
}

/**
 * Readable text colour for a solid paint-fill card. The mock shows black
 * text on every card, but black-on-dark-paint fails WCAG-AA — best
 * practices win (REBUILD_SPEC preamble), so dark fills flip to white.
 * Picks whichever of black/white has the higher WCAG contrast ratio
 * against the fill. Unparseable hex falls back to white (cards without a
 * resolvable colour render on the near-black hatch).
 */
export function readableTextOn(hex: string): "#000000" | "#FFFFFF" {
  const rgb = parseHex(hex);
  if (!rgb) return "#FFFFFF";
  const l = relativeLuminance(rgb);
  const contrastBlack = (l + 0.05) / 0.05;
  const contrastWhite = 1.05 / (l + 0.05);
  return contrastBlack >= contrastWhite ? "#000000" : "#FFFFFF";
}

function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let v = m[1]!;
  if (v.length === 3) v = v.split("").map((c) => c + c).join("");
  return [
    parseInt(v.slice(0, 2), 16),
    parseInt(v.slice(2, 4), 16),
    parseInt(v.slice(4, 6), 16),
  ];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const chan = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
}

function isPhase12Layer(key: TechniqueKey): key is Phase12LayerKey {
  return key in phase12LayerLabel;
}

/** Human label for a slot technique (mirrors the bench FocusPanel's
 *  resolution so legacy keys still read cleanly). */
export function techniqueLabel(key: TechniqueKey): string {
  if (isPhase12Layer(key)) return phase12LayerLabel[key];
  return key
    .split("_")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}
