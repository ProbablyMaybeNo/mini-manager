import "server-only";

import { currentUserId } from "@/lib/auth-stub";
import { recentlyBought } from "@/db/queries/wishlist";

/** "[ last 7 days: 4 items · $87.42 spent ]" — hidden when empty. */
export async function RecentlyBoughtLine({ windowDays = 7 }: { windowDays?: number }) {
  const userId = await currentUserId();
  const { count, totalByCurrency } = await recentlyBought(userId, windowDays);
  if (count === 0) return null;

  const totals = Object.entries(totalByCurrency).map(([code, n]) => formatTotal(n, code));
  return (
    <p className="text-2xs font-mono text-[var(--color-fg-muted)] uppercase tracking-wider">
      [ last {windowDays} days: {count} item{count === 1 ? "" : "s"}
      {totals.length > 0 ? ` · ${totals.join(" · ")} spent` : ""} ]
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
