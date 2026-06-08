import type { StatusPillKind } from "@/components/ui/StatusPill";

/**
 * COLLECTIONS status → StatusPill colour-kind mapping.
 *
 * Drives the vibrant solid colour-bar selects in both tables. Mirrors the
 * project stage palette so a model's lifecycle reads the same on the
 * COLLECTIONS page as it does on the dashboard:
 *   WISHLIST  → yellow  (wanted, not yet bought)
 *   OWNED     → cyan    (in the cupboard, untouched)
 *   HOLD      → neutral (paused / parked — paints only)
 *   BUILT     → info    (assembled)
 *   PRIMED    → purple  (undercoated)
 *   PAINTED   → ok      (the bulk of the work done)
 *   BASED     → ok      (basing done)
 *   COMPLETE  → ok      (finished)
 */
export const COLLECTION_STATUS_PILL: Record<string, StatusPillKind> = {
  WISHLIST: "wishlist",
  OWNED: "info",
  HOLD: "neutral",
  BUILT: "info",
  PRIMED: "purple",
  PAINTED: "ok",
  BASED: "ok",
  COMPLETE: "ok",
  // legacy
  PURCHASED: "ok",
};

export function statusPillKind(status: string): StatusPillKind {
  return COLLECTION_STATUS_PILL[status] ?? "neutral";
}
