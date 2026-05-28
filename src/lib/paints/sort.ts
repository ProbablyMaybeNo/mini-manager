/**
 * Library sort modes. Default is brand → line → name so each brand's
 * lineup reads naturally; hue mode walks the colour wheel; recent uses
 * paint id as a coarse "newest scraped" proxy.
 */
import type { Paint } from "./types";
import { _internal } from "./filters";

export const sortModes = ["brand", "hue", "name", "recent"] as const;
export type SortMode = (typeof sortModes)[number];

export function sortPaints(paints: Paint[], mode: SortMode): Paint[] {
  const copy = paints.slice();
  switch (mode) {
    case "brand":
      copy.sort((a, b) => {
        const byBrand = a.brand.localeCompare(b.brand);
        if (byBrand !== 0) return byBrand;
        const byLine = (a.line ?? "").localeCompare(b.line ?? "");
        if (byLine !== 0) return byLine;
        return a.name.localeCompare(b.name);
      });
      break;
    case "hue":
      copy.sort((a, b) => hueOf(a) - hueOf(b));
      break;
    case "name":
      copy.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "recent":
      copy.sort((a, b) => Number(b.id) - Number(a.id));
      break;
  }
  return copy;
}

function hueOf(p: Paint): number {
  const rgb = _internal.parseHex(p.hex);
  if (!rgb) return 999; // greyscale / invalid floats to the end
  const h = _internal.rgbToHue(...rgb);
  return h ?? 999;
}
