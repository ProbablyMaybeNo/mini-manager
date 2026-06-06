import "server-only";

import { currentUserId } from "@/lib/auth-stub";
import { recentlyBought } from "@/db/queries/wishlist";

/** "Last 7 days: 4 items · $87.42 spent" — hidden when empty.
 *  P13.10 — dropped the decorative `[ ... ]` bracket-chrome wrapper
 *  per the app-wide bracket retirement. */
export async function RecentlyBoughtLine({ windowDays = 7 }: { windowDays?: number }) {
  const userId = await currentUserId();
  const { count, totalByCurrency } = await recentlyBought(userId, windowDays);
  if (count === 0) return null;

  const totals = Object.entries(totalByCurrency).map(([code, n]) => formatTotal(n, code));
  return (
    <p className="text-2xs font-mono text-[var(--color-fg-muted)] uppercase tracking-wider">
      {/* PHASE-1 cohesion — a cyan ▸ marker reads the passive spend readout
          as a terminal status line, consistent with the screen's other
          coordinate captions. */}
      <span aria-hidden className="text-[var(--color-cyan)]">▸ </span>
      Last {windowDays} days: {count} item{count === 1 ? "" : "s"}
      {totals.length > 0 ? ` · ${totals.join(" · ")} spent` : ""}
    </p>
  );
}

function formatTotal(total: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(total);
  } catch {
    return `${total.toFixed(2)} ${currency}`;
  }
}
