/**
 * Pure paint filter helpers. Composed by the library page; each takes
 * `(paints, ...filter)` and returns a new array. AND semantics across
 * helpers — the page chains them.
 */
import type { Paint, PaintFilter, PaintType } from "./types";

/** Eight hue bands of 45° each, named after the rainbow. */
export interface HueBand {
  name: string;
  /** Start hue in degrees, inclusive. */
  start: number;
  /** End hue in degrees, exclusive. Last band wraps past 360 → 360. */
  end: number;
  /** Representative swatch for the chip. */
  swatch: string;
}

export const HUE_BANDS: readonly HueBand[] = [
  { name: "Red", start: 345, end: 22, swatch: "#ff3344" },
  { name: "Orange", start: 22, end: 45, swatch: "#ff8844" },
  { name: "Yellow", start: 45, end: 67, swatch: "#ffcc33" },
  { name: "Green", start: 67, end: 165, swatch: "#33dd66" },
  { name: "Cyan", start: 165, end: 200, swatch: "#33cccc" },
  { name: "Blue", start: 200, end: 255, swatch: "#3366ff" },
  { name: "Violet", start: 255, end: 290, swatch: "#7733cc" },
  { name: "Magenta", start: 290, end: 345, swatch: "#dd44aa" },
] as const;

/** Internal: parse `#rrggbb` → `[r,g,b]` 0-255. Returns null on garbage. */
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

/** Internal: RGB → HSL hue in degrees (0–360). Returns null for greyscale. */
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

function hueInBand(hue: number, band: HueBand): boolean {
  if (band.start <= band.end) return hue >= band.start && hue < band.end;
  // Wraparound band (Red): 345 → 22 means [345, 360) ∪ [0, 22)
  return hue >= band.start || hue < band.end;
}

/** Crude perceptual distance — sum of squared RGB differences. */
function rgbDistance(a: [number, number, number], b: [number, number, number]): number {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

export function filterByBrand(paints: Paint[], brands: string[]): Paint[] {
  if (brands.length === 0) return paints;
  const set = new Set(brands);
  return paints.filter((p) => set.has(p.brand));
}

export function filterByLine(paints: Paint[], lines: string[]): Paint[] {
  if (lines.length === 0) return paints;
  const set = new Set(lines);
  return paints.filter((p) => p.line && set.has(p.line));
}

export function filterByType(paints: Paint[], types: PaintType[]): Paint[] {
  if (types.length === 0) return paints;
  const set = new Set(types);
  return paints.filter((p) => set.has(p.type));
}

export function filterByHueBand(paints: Paint[], bandNames: string[]): Paint[] {
  if (bandNames.length === 0) return paints;
  const bands = HUE_BANDS.filter((b) => bandNames.includes(b.name));
  if (bands.length === 0) return paints;
  return paints.filter((p) => {
    const rgb = parseHex(p.hex);
    if (!rgb) return false;
    const hue = rgbToHue(...rgb);
    if (hue === null) return false;
    return bands.some((b) => hueInBand(hue, b));
  });
}

/**
 * Hex proximity filter. Rough match — we keep paints within `maxDistance`
 * RGB units of the query. The Tools/Match page in Phase 4 does the proper
 * ΔE2000 work; this is good-enough for "show me anything bluish".
 */
export function filterByHex(paints: Paint[], hex: string, maxDistance = 80): Paint[] {
  const target = parseHex(hex);
  if (!target) return paints;
  return paints.filter((p) => {
    const rgb = parseHex(p.hex);
    if (!rgb) return false;
    return rgbDistance(rgb, target) <= maxDistance;
  });
}

export function filterByText(paints: Paint[], query: string): Paint[] {
  const q = query.trim().toLowerCase();
  if (!q) return paints;
  return paints.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q) ||
      (p.line ?? "").toLowerCase().includes(q) ||
      (p.sku ?? "").toLowerCase().includes(q),
  );
}

/**
 * Owned-only filter — requires the caller to provide the inventory map
 * (paintId → ownedCount). Wired up properly in P2.3; until then the page
 * passes an empty map and this returns the unfiltered list.
 */
export function filterByOwned(
  paints: Paint[],
  ownedOnly: boolean,
  ownedCountByPaint: ReadonlyMap<string, number>,
): Paint[] {
  if (!ownedOnly) return paints;
  return paints.filter((p) => (ownedCountByPaint.get(p.id) ?? 0) > 0);
}

/**
 * Apply the full filter set in one call. Mostly a convenience for pages
 * that don't need to interleave with other steps.
 */
export function applyAllFilters(
  paints: Paint[],
  filter: PaintFilter,
  ownedCountByPaint: ReadonlyMap<string, number>,
): Paint[] {
  let out = paints;
  out = filterByBrand(out, filter.brands);
  out = filterByLine(out, filter.lines);
  out = filterByType(out, filter.types);
  out = filterByHueBand(out, filter.hueBands);
  out = filterByHex(out, filter.hexQuery);
  out = filterByText(out, filter.textQuery);
  out = filterByOwned(out, filter.ownedOnly, ownedCountByPaint);
  return out;
}

// Exported for downstream components (detail panel harmonies, etc).
export const _internal = { parseHex, rgbToHue };
