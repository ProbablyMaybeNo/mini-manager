import Link from "next/link";
import type { Route } from "next";
import { clsx } from "clsx";

import { listWishlistByProject } from "@/db/queries/wishlist";
import { currentUserId } from "@/lib/auth-stub";
import type { WishlistItem, Priority } from "@/db/schema";

const PRIORITY_DOT: Record<Priority, string> = {
  Urgent: "bg-[var(--color-red)]",
  High: "bg-[var(--color-amber)]",
  Medium: "bg-[var(--color-cyan-dim)]",
  Low: "bg-[var(--color-fg-subtle)]",
};

/**
 * Server component: lists wanted items tagged to the given project,
 * with a running total. Empty state shows a one-liner — no need to
 * shout about it.
 */
export async function ShoppingForThisPanel({ projectId }: { projectId: string }) {
  const userId = await currentUserId();
  const items = await listWishlistByProject(userId, projectId);

  return (
    <section className="space-y-3">
      <h2 className="section-title flex items-center justify-between gap-2">
        <span>Shopping for this · {items.length}</span>
        {items.length > 0 ? (
          <span className="normal-case tracking-normal text-[var(--color-fg-muted)]">
            {summariseTotal(items)}
          </span>
        ) : null}
      </h2>
      {items.length === 0 ? (
        <div className="frame px-3 py-2">
          <p className="text-xs font-mono text-[var(--color-fg-muted)]">
            [ Nothing on the wishlist for this project ]
          </p>
        </div>
      ) : (
        <div className="frame">
          {items.map((item) => (
            <WishlistRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}

function WishlistRow({ item }: { item: WishlistItem }) {
  const href = (`/wishlist?item=${item.id}` as unknown) as Route;
  return (
    <Link
      href={href}
      className="grid grid-cols-[14px_minmax(0,1fr)_auto_auto] items-center gap-3 px-3 py-1.5 border-b border-[var(--color-border)] hover:bg-[color-mix(in_srgb,var(--color-fg)_4%,transparent)] text-xs font-mono"
    >
      <span
        className={clsx("h-2.5 w-2.5 rounded-full", PRIORITY_DOT[item.priority])}
        title={item.priority}
      />
      <span className="truncate text-[var(--color-fg)]">{item.title}</span>
      <span className="text-[var(--color-fg-muted)] truncate">
        {item.vendor ?? "—"}
      </span>
      <span className="text-right text-[var(--color-fg)]">
        {formatPrice(item.price, item.currency)}
      </span>
    </Link>
  );
}

function summariseTotal(items: ReadonlyArray<WishlistItem>): string {
  const byCurrency: Record<string, number> = {};
  for (const item of items) {
    if (item.price === null) continue;
    const code = item.currency ?? "USD";
    byCurrency[code] = (byCurrency[code] ?? 0) + item.price / 100;
  }
  const parts = Object.entries(byCurrency).map(([code, total]) => formatTotal(total, code));
  return parts.join(" · ") || "no price set";
}

function formatPrice(priceCents: number | null, currency: string | null): string {
  if (priceCents === null) return "—";
  const dollars = priceCents / 100;
  const code = currency ?? "USD";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: code }).format(dollars);
  } catch {
    return `${dollars.toFixed(2)} ${code}`;
  }
}

function formatTotal(total: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(total);
  } catch {
    return `${total.toFixed(2)} ${currency}`;
  }
}
