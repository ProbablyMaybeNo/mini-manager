import type { MatchResult as EngineMatch } from "@/lib/tools/match/find";
import type { MatchResult } from "@/lib/types";
import { toPaint, type InventoryFlags } from "./paint";

/** Colour-engine MatchResult (CatalogPaint + ΔE2000) → contract MatchResult. */
export function toMatchResult(m: EngineMatch, inv?: InventoryFlags): MatchResult {
  return { paint: toPaint(m.paint, inv), distanceScore: m.deltaE };
}
