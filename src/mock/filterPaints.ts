import { hexHue } from "@/lib/palette";
import type { LibraryFilter, Paint } from "@/lib/types";

/** Named hue families → [minDeg, maxDeg] for the filter colour checkboxes. */
const COLOR_RANGES: Record<string, [number, number]> = {
  RED: [345, 15],
  ORANGE: [15, 45],
  YELLOW: [45, 70],
  GREEN: [70, 165],
  CYAN: [165, 200],
  BLUE: [200, 260],
  PURPLE: [260, 300],
  MAGENTA: [300, 345],
};

export const COLOR_OPTIONS = Object.keys(COLOR_RANGES);

function inRange(hue: number, [min, max]: [number, number]): boolean {
  return min > max ? hue >= min || hue < max : hue >= min && hue < max;
}

/** Map a hue (0–360°) to its named colour family — the inverse of the
 *  filter checkboxes. Used by the library's hue rail to jump the filter. */
export function colorFamilyForHue(hue: number): string {
  const h = ((hue % 360) + 360) % 360;
  for (const [name, range] of Object.entries(COLOR_RANGES)) {
    if (inRange(h, range)) return name;
  }
  return "RED";
}

/**
 * Host-side filtering (mock layer, NOT in UI). The real host would do this server-side;
 * the UI just renders the resulting list and emits the filter object.
 */
export function filterPaints(paints: Paint[], filter: LibraryFilter): Paint[] {
  const search = filter.search?.trim().toLowerCase() ?? "";
  return paints.filter((p) => {
    if (filter.brands.length && !filter.brands.includes(p.brand)) return false;
    if (filter.types.length && !filter.types.includes(p.type)) return false;
    if (filter.status.includes("owned") && !p.owned) return false;
    if (filter.status.includes("wishlist") && !p.wishlisted) return false;
    if (filter.colors.length) {
      const hue = hexHue(p.hex);
      if (!filter.colors.some((c) => COLOR_RANGES[c] && inRange(hue, COLOR_RANGES[c]))) {
        return false;
      }
    }
    if (search && !`${p.name} ${p.brand} ${p.line}`.toLowerCase().includes(search)) {
      return false;
    }
    return true;
  });
}
