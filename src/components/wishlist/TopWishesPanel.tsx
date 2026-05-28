import Link from "next/link";
import type { Route } from "next";
import { clsx } from "clsx";

import { listTopWishes } from "@/db/queries/wishlist";
import { currentUserId } from "@/lib/auth-stub";
import type { WishlistItem, Priority } from "@/db/schema";

const PRIORITY_DOT: Record<Priority, string> = {
  Urgent: "bg-[var(--color-red)]",
  High: "bg-[var(--color-amber)]",
  Medium: "bg-[var(--color-cyan-dim)]",
  Low: "bg-[var(--color-fg-subtle)]",
};

export async function TopWishesPanel({ limit = 5 }: { limit?: number }) {
  const userId = await currentUserId();
  const items = await listTopWishes(userId, limit);
  if (items.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="section-title flex items-center gap-3">
        <span>Top wishes</span>
        <span className="normal-case tracking-normal text-[var(--color-fg-muted)]">
          · top {items.length} by priority
        </span>
      </h2>
      <div className="frame">
        {items.map((item) => (
          <Row key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}

function Row({ item }: { item: WishlistItem }) {
  const href = (`/wishlist?item=${item.id}` as unknown) as Route;
  return (
    <Link
      href={href}
      className="grid grid-cols-[14px_minmax(0,1fr)_auto] items-center gap-3 px-3 py-1.5 border-b border-[var(--color-border)] hover:bg-[color-mix(in_srgb,var(--color-fg)_4%,transparent)] text-xs font-mono"
    >
      <span
        className={clsx("h-2.5 w-2.5 rounded-full", PRIORITY_DOT[item.priority])}
        title={item.priority}
      />
      <span className="truncate text-[var(--color-fg)]">{item.title}</span>
      <span className="text-[var(--color-fg-muted)] truncate">
        {item.vendor ?? "—"}
      </span>
    </Link>
  );
}
