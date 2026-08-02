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

/**
 * UX-908 — Library-match defaults for the ColorPicker side panel.
 *
 * The old default was `fastMatchByHueBand` which returns up to 50
 * same-hue-band paints in catalog order, including very-far matches
 * (picking magenta surfaced "Rubber Black" because both sit in the
 * red-purple band). Cap by perceptual distance, not band membership.
 *
 * `MATCH_DEFAULT_DELTAE` — the painter's "could pass as the same colour"
 * threshold. ΔE2000 < 5 reads "medium" confidence in the match-tool's
 * existing classifier; 10 stretches that into "useful family" without
 * letting drastically-off paints pad the list.
 *
 * `MATCH_EXPANDED_DELTAE` — used when the painter asks for more matches.
 * Loosens to 30 (still well below the match-tool's "top 20 always" cap)
 * so cross-band approximations and dramatic-shadow alternatives show up.
 */
export const MATCH_DEFAULT_DELTAE = 10;
export const MATCH_EXPANDED_DELTAE = 30;

/** Ceiling on rows the picker's library list will render, whichever way the
 *  list was built. Already the effective ceiling of the ΔE window (its inner
 *  perceptual sort caps at this), so a text search rendering the same maximum
 *  keeps the panel's weight where it was. */
export const LIBRARY_ROW_CAP = 200;

/**
 * UX-908 — Return paints sorted ascending by ΔE2000, capped at the given
 * perceptual threshold. Reuses `findClosestPaints` (single source of
 * truth for perceptual ranking) and then trims by ΔE rather than by row
 * count. Result count is "however many paints actually qualify", which
 * is the user-facing fix: an unrelated colour gets fewer matches, not 50
 * random in-band rows.
 */
export function matchesWithinDeltaE(
  hex: string,
  paints: ReadonlyArray<Paint>,
  maxDeltaE = MATCH_DEFAULT_DELTAE,
): MatchResult[] {
  // Pull a generous top-N from the perceptual sort, then prune by ΔE.
  // The hard cap on the inner call exists to bound the worst-case
  // sort+slice work; it's never the user-facing limit.
  const ranked = findClosestPaints(hex, paints, { limit: LIBRARY_ROW_CAP });
  return ranked.filter((m) => m.deltaE <= maxDeltaE);
}

/** One row of the ColorPicker's library sub-panel. */
export interface LibraryRow {
  paint: Paint;
  /** ΔE2000 from the picked colour. `null` only when the paint's own hex can't
   *  be measured — reachable from a text search, which does not go through the
   *  perceptual sort's "skip unparseable" path. The row renders without a
   *  match badge rather than being dropped. */
  deltaE: number | null;
}

export interface LibraryMatchOptions {
  /** Free-text query over name / brand / line. When present it searches the
   *  WHOLE catalog and the ΔE window does not apply. */
  query?: string;
  /** Company facet — AND-composed with everything else. */
  brands?: ReadonlyArray<string>;
  /** ΔE ceiling for the no-query case. */
  maxDeltaE?: number;
}

/**
 * Rows for the ColorPicker's library sub-panel.
 *
 * Audit B3 — the search box used to filter INSIDE the ΔE window, so a paint
 * that exists but isn't near the slot's current colour was unfindable by name.
 * Measured on a new recipe's first slot: no search → 200 rows, "Abaddon" → 0,
 * "Mephiston" → 0, both of which are real catalog paints. The placeholder
 * promises "Search by paint name, brand, or line…", so the search has to mean
 * the catalog.
 *
 * Two modes, deliberately not blended:
 *   - no query  → the ΔE window, unchanged. "What's near this colour?"
 *   - a query   → the whole catalog, still SORTED by ΔE so the nearest match
 *                 to the current colour leads. "Where is this paint?"
 *
 * Results keep their distance either way, so the match badges still read.
 */
export function libraryMatches(
  hex: string,
  paints: ReadonlyArray<Paint>,
  opts: LibraryMatchOptions = {},
): LibraryRow[] {
  const brandSet = opts.brands?.length ? new Set(opts.brands) : null;
  const pool = brandSet ? paints.filter((p) => brandSet.has(p.brand)) : paints;

  const q = opts.query?.trim().toLowerCase() ?? "";
  if (!q) {
    return matchesWithinDeltaE(hex, pool, opts.maxDeltaE).map((m) => ({
      paint: m.paint,
      deltaE: m.deltaE,
    }));
  }

  const hits = pool.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q) ||
      (p.line ?? "").toLowerCase().includes(q),
  );

  const ranked = findClosestPaints(hex, hits, { limit: LIBRARY_ROW_CAP });
  const rows: LibraryRow[] = ranked.map((m) => ({ paint: m.paint, deltaE: m.deltaE }));

  // findClosestPaints drops anything it can't measure. For a colour query that
  // is correct; for a NAME query it would hide a paint the painter searched for
  // by name, so those come back on the end without a distance.
  if (rows.length < LIBRARY_ROW_CAP) {
    const rankedIds = new Set(ranked.map((m) => m.paint.id));
    for (const p of hits) {
      if (rows.length >= LIBRARY_ROW_CAP) break;
      if (!rankedIds.has(p.id)) rows.push({ paint: p, deltaE: null });
    }
  }
  return rows;
}
