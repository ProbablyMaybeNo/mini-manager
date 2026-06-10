import type { StatusPillKind } from "@/components/ui/StatusPill";

/**
 * COLLECTION page status → colour-bar kind mapping (REBUILD_SPEC §8:
 * "STATUS dropdown WISHLIST/OWNED, yellow/green").
 *
 *   WISHLIST  → yellow  (wanted, not yet bought)
 *   OWNED     → green   (in the cupboard — spec §8 pins OWNED to green)
 *   HOLD      → neutral (parked — paints only)
 *   BUILT     → cyan    (assembled)
 *   PRIMED    → purple  (undercoated)
 *   PAINTED / BASED / COMPLETE → green (work done)
 */
const STATUS_KIND: Record<string, StatusPillKind> = {
  WISHLIST: "wishlist",
  OWNED: "ok",
  HOLD: "neutral",
  BUILT: "info",
  PRIMED: "purple",
  PAINTED: "ok",
  BASED: "ok",
  COMPLETE: "ok",
  // legacy rows predating the COLLECTION rebuild
  PURCHASED: "ok",
};

export function collectionStatusKind(status: string): StatusPillKind {
  return STATUS_KIND[status] ?? "neutral";
}
