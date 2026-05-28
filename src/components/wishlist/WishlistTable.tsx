"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { clsx } from "clsx";

import type { WishlistItem, Priority } from "@/db/schema";
import { TagToProjectMenu } from "./TagToProjectMenu";

export interface WishlistTableProjectOption {
  id: string;
  name: string;
}

const PRIORITY_DOT: Record<Priority, string> = {
  Urgent: "bg-[var(--color-red)]",
  High: "bg-[var(--color-amber)]",
  Medium: "bg-[var(--color-cyan-dim)]",
  Low: "bg-[var(--color-fg-subtle)]",
};

const STATUS_BADGE: Record<WishlistItem["status"], string> = {
  Wanted: "text-[var(--color-cyan)]",
  Bought: "text-[var(--color-green-dim)]",
  Cancelled: "text-[var(--color-fg-muted)] line-through",
};

export function WishlistTable({
  items,
  projects,
}: {
  items: ReadonlyArray<WishlistItem>;
  projects: ReadonlyArray<WishlistTableProjectOption>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function openItem(id: string) {
    const params = new URLSearchParams(sp?.toString() ?? "");
    params.set("item", id);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  if (items.length === 0) {
    return (
      <div className="frame p-8 text-center">
        <p className="text-sm font-mono text-[var(--color-fg-muted)]">
          No wishlist items match the current filters.
        </p>
      </div>
    );
  }

  return (
    <div className="frame overflow-hidden">
      <div
        className="grid items-center gap-3 px-3 py-1.5 border-b border-[var(--color-border-strong)] section-title m-0 bg-[var(--color-bg-elevated)]"
        style={{ gridTemplateColumns: GRID_COLS }}
      >
        <span aria-hidden />
        <span>Title</span>
        <span className="hidden md:inline">Vendor</span>
        <span className="text-right">Price</span>
        <span className="hidden md:inline">Category</span>
        <span className="hidden md:inline">Project</span>
        <span aria-label="Priority">P</span>
        <span>Status</span>
      </div>
      {items.map((item) => (
        <div
          key={item.id}
          role="row"
          tabIndex={0}
          onClick={() => openItem(item.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openItem(item.id);
            }
          }}
          className="grid items-center gap-3 px-3 py-2 border-b border-[var(--color-border)] cursor-pointer hover:bg-[color-mix(in_srgb,var(--color-fg)_4%,transparent)] focus:outline-none focus-visible:bg-[color-mix(in_srgb,var(--color-cyan)_8%,transparent)]"
          style={{ gridTemplateColumns: GRID_COLS }}
        >
          <Thumbnail item={item} />
          <div className="min-w-0">
            <p className="font-mono text-sm truncate text-[var(--color-fg)]">
              {item.title}
            </p>
            {item.sourceUrl ? (
              <p className="text-2xs font-mono text-[var(--color-fg-subtle)] truncate">
                {item.sourceUrl}
              </p>
            ) : null}
          </div>
          <span className="hidden md:inline text-xs font-mono text-[var(--color-fg-muted)] truncate">
            {item.vendor ?? "—"}
          </span>
          <span className="text-xs font-mono text-right text-[var(--color-fg)]">
            {formatPrice(item.price, item.currency)}
          </span>
          <span className="hidden md:inline text-xs font-mono text-[var(--color-fg-muted)] uppercase tracking-wide">
            {item.category}
          </span>
          <span className="hidden md:inline">
            <TagToProjectMenu
              itemId={item.id}
              current={item.projectId}
              projects={projects}
            />
          </span>
          <span
            className={clsx("inline-block h-2.5 w-2.5 rounded-full", PRIORITY_DOT[item.priority])}
            title={`Priority ${item.priority}`}
          />
          <span
            className={clsx(
              "text-2xs font-mono uppercase tracking-wider",
              STATUS_BADGE[item.status],
            )}
          >
            {item.status}
          </span>
        </div>
      ))}
    </div>
  );
}

const GRID_COLS =
  "40px minmax(0, 2fr) minmax(0, 1fr) 90px 90px 110px 14px 80px";

function Thumbnail({ item }: { item: WishlistItem }) {
  if (item.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={item.imageUrl}
        alt=""
        className="h-10 w-10 rounded-sm object-cover border border-[var(--color-border)]"
        loading="lazy"
      />
    );
  }
  const initial = (item.title[0] ?? "?").toUpperCase();
  return (
    <span
      aria-hidden
      className="h-10 w-10 rounded-sm border border-[var(--color-border)] inline-flex items-center justify-center font-mono text-base text-[var(--color-fg-muted)]"
    >
      {initial}
    </span>
  );
}

function formatPrice(priceCents: number | null, currency: string | null): string {
  if (priceCents === null || priceCents === undefined) return "—";
  const dollars = priceCents / 100;
  const code = currency ?? "USD";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: code }).format(
      dollars,
    );
  } catch {
    return `${dollars.toFixed(2)} ${code}`;
  }
}
