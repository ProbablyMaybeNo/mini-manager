/**
 * Founder-counter read helper.
 *
 * P10.3 — /pricing reads `meta_counters.founder_sold` server-side to
 * render "X of 100 remaining". Wrapped here so the route file stays
 * lean + the read shape stays consistent for P10.7 (admin page) and
 * P10.5 (webhook writer).
 *
 * The seed migration (drizzle 0012) stamps `founder_sold = 0` so the
 * row should always exist; we still defensively fall through to 0 if
 * the read returns nothing — better to render "100 of 100 remaining"
 * on a fresh DB than to crash the marketing page.
 */

import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { metaCounters } from "@/db/schema";

/** Hard cap — see PHASE10_PLAN.md. Locked at 100 by Ross. */
export const FOUNDER_TOTAL_SEATS = 100;

export interface FounderInventory {
  /** How many Founder seats have been claimed so far (0 ≤ sold ≤ 100). */
  sold: number;
  /** How many Founder seats remain available (0 ≤ remaining ≤ 100). */
  remaining: number;
  /** Convenience flag — true when the cap is hit and the tier is closed. */
  soldOut: boolean;
}

export async function readFounderInventory(): Promise<FounderInventory> {
  const row = await db
    .select({ value: metaCounters.value })
    .from(metaCounters)
    .where(eq(metaCounters.key, "founder_sold"))
    .limit(1);
  const sold = Math.max(0, Math.min(FOUNDER_TOTAL_SEATS, row[0]?.value ?? 0));
  const remaining = FOUNDER_TOTAL_SEATS - sold;
  return {
    sold,
    remaining,
    soldOut: remaining <= 0,
  };
}
