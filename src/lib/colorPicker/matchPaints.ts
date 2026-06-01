/**
 * Paint-match helpers for the ColorPicker primitive (P12.1).
 *
 * Two-tier match strategy, per Ross's confirmed answer:
 *   1. Hue-band first pass — quick categorical filter, ~instant on the
 *      full catalog. Returns every paint whose hue falls inside the
 *      same 45° band as the picked hex.
 *   2. ΔE2000 "Show closer matches" — runs the perceptual-distance
 *      sort against ALL paints (not just the hue-band subset, so it
 *      catches near-grey / cross-band matches the band misses), then
 *      surfaces the top 20.
 *
 * Pure functions. No catalog fetch here — caller passes the paint
 * array (paginated or full, doesn't matter). Identical contract to
 * the existing match-tool helpers so the picker can swap between
 * them without surprising the consumer.
 */

import type { Paint } from "@/lib/paints/types";
import { HUE_BANDS } from "@/lib/paints/filters";
import { findClosestPaints, type MatchResult } from "@/lib/tools/match/find";

/* ---------- hex / hue helpers (parse + classify) ---------- */

function parseHex(hex: string): [number, number, number] | null {
  if (!hex) return null;
  const s = hex.startsWith("#") ? hex.slice(1) : hex;
  if (s.length !== 6) return null;
  const r = parseInt(s.slice(0, 2), 16);
  const g = parseInt(s.slice(2, 4), 16);
  const b = parseInt(s.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
  return [r, g, b];
}

function rgbToHue(r: number, g: number, b: number): number | null {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  if (d === 0) return null;
  let h: number;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return h;
}

function hueInBand(
  hue: number,
  band: { start: number; end: number },
): boolean {
  if (band.start <= band.end) return hue >= band.start && hue < band.end;
  return hue >= band.start || hue < band.end;
}

/**
 * Identify the hue band that contains the picked hex. Returns null when
 * the hex is greyscale (no hue → not band-classifiable) or malformed.
 * Exposed for the picker UI so it can show the band name as a hint.
 */
export function bandForHex(hex: string): string | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  const hue = rgbToHue(...rgb);
  if (hue === null) return null;
  const band = HUE_BANDS.find((b) => hueInBand(hue, b));
  return band?.name ?? null;
}

/* ---------- match strategies ---------- */

export interface FastMatchOptions {
  /** Cap on returned rows. Default 50 — keeps the side-panel scroll
   *  list bounded. Caller can raise for an "expand" toggle. */
  limit?: number;
}

/**
 * Hue-band fast pass. Returns paints whose hue falls in the same 45°
 * band as the picked hex. No perceptual sorting — output order is the
 * input order so the picker can hand-pick a stable secondary sort
 * (alphabetical by brand+name, typically).
 *
 * Greyscale picks (no detectable hue) fall back to returning the whole
 * paint list capped at `limit`, because the caller's "what looks close
 * to white" intent isn't a band query — it's a perceptual one — and we
 * don't want the side-panel to show 0 results.
 */
export function fastMatchByHueBand(
  hex: string,
  paints: ReadonlyArray<Paint>,
  opts: FastMatchOptions = {},
): Paint[] {
  const limit = Math.max(1, opts.limit ?? 50);
  const rgb = parseHex(hex);
  if (!rgb) return [];
  const hue = rgbToHue(...rgb);
  if (hue === null) {
    // Greyscale fallback: just hand back the first `limit` paints. The
    // caller usually layers a brand / type filter on top of this anyway.
    return paints.slice(0, limit);
  }
  const band = HUE_BANDS.find((b) => hueInBand(hue, b));
  if (!band) return paints.slice(0, limit);
  const out: Paint[] = [];
  for (const p of paints) {
    if (out.length >= limit) break;
    const prgb = parseHex(p.hex);
    if (!prgb) continue;
    const phue = rgbToHue(...prgb);
    if (phue === null) continue;
    if (hueInBand(phue, band)) out.push(p);
  }
  return out;
}

/**
 * ΔE2000 "show closer matches" pass. Delegates to the existing
 * `findClosestPaints` helper from the match tool — single source of
 * truth for perceptual ranking across the app.
 *
 * Default limit 20 is Ross's locked answer ("top 20 ranked"). Anything
 * past that is noise for picker-quick-glance use.
 */
export function closerMatchesDeltaE(
  hex: string,
  paints: ReadonlyArray<Paint>,
  limit = 20,
): MatchResult[] {
  return findClosestPaints(hex, paints, { limit });
}
