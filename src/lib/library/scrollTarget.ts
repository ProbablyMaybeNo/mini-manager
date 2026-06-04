/**
 * LIB-COLORMAP — pure scroll-to-hue target resolver.
 *
 * No React, no DB — unit-tested in isolation (the library table/grid are
 * client modules that pull in the inventory server actions, so this logic
 * lives here to stay importable in the node unit env).
 *
 * Given the CURRENT (filtered) list and a colour-map pick, returns the
 * list index to scroll to:
 *
 *   1. Exact match: the picked paint is in the list → its index.
 *   2. Filtered out but the picked Paint object is known → the nearest
 *      in-list paint by hue, so the list jumps to the right colour
 *      neighbourhood instead of no-opping.
 *   3. Filtered out, no Paint object → head of the list (graceful).
 *
 * Returns -1 only for an empty list.
 */
import type { Paint } from "@/lib/paints/types";
import { compareHueSortKey, hueSortKey } from "@/lib/paints/hue";

export function nearestVisibleIndex(
  paints: ReadonlyArray<Paint>,
  paintId: string,
  target?: Paint | null,
): number {
  if (paints.length === 0) return -1;
  const exact = paints.findIndex((p) => p.id === paintId);
  if (exact >= 0) return exact;
  if (!target) return 0;
  const targetKey = hueSortKey(target);
  let best = 0;
  let bestKey = hueSortKey(paints[0]!);
  let bestDelta = Number.POSITIVE_INFINITY;
  for (let i = 0; i < paints.length; i++) {
    const p = paints[i];
    if (!p) continue;
    const k = hueSortKey(p);
    // Coarse perceptual delta: the spectrum/neutral band gap dominates,
    // then hue distance. compareHueSortKey gives a deterministic tie-break.
    const delta =
      Math.abs(k.band - targetKey.band) * 1000 + Math.abs(k.h - targetKey.h);
    if (
      delta < bestDelta ||
      (delta === bestDelta && compareHueSortKey(k, bestKey) < 0)
    ) {
      bestDelta = delta;
      best = i;
      bestKey = k;
    }
  }
  return best;
}
