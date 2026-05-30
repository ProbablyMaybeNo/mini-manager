"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { clsx } from "clsx";

import type { WishlistItem, Priority, ProjectType } from "@/db/schema";
import { TagToProjectMenu } from "./TagToProjectMenu";
import { MarkBoughtModal, type MarkBoughtProjectOption } from "./MarkBoughtModal";

export interface WishlistTableProjectOption {
  id: string;
  name: string;
  type: ProjectType;
  count: number;
  ownedCount: number;
  parentId: string | null;
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
  hasActiveFilters = false,
}: {
  items: ReadonlyArray<WishlistItem>;
  projects: ReadonlyArray<WishlistTableProjectOption>;
  hasActiveFilters?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [boughtFor, setBoughtFor] = useState<WishlistItem | null>(null);

  function openItem(id: string) {
    const params = new URLSearchParams(sp?.toString() ?? "");
    params.set("item", id);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const modalProjects: MarkBoughtProjectOption[] = projects.map((p) => ({
    id: p.id,
    name: p.name,
    type: p.type,
    count: p.count,
    ownedCount: p.ownedCount,
    parentId: p.parentId,
  }));

  if (items.length === 0) {
    return (
      <div className="frame p-8 text-center">
        <p className="text-sm font-mono text-[var(--color-fg-muted)]">
          {hasActiveFilters
            ? "No wishlist items match the current filters."
            : "Nothing on your shopping list yet. Paste a vendor URL above, or type a title to add manually."}
        </p>
      </div>
    );
  }

  return (
    <div className="frame overflow-hidden">
      <div
        className={clsx(
          "grid items-center gap-3 px-3 py-1.5 border-b border-[var(--color-border-strong)] section-title m-0 bg-[var(--color-bg-elevated)]",
          GRID_CLASS,
        )}
      >
        <span aria-hidden />
        <span>Title</span>
        <span className="hidden md:inline">Vendor</span>
        <span className="text-right">Price</span>
        <span className="hidden md:inline">Category</span>
        <span className="hidden md:inline">Project</span>
        <span aria-label="Priority" title="Priority">P</span>
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
          className={clsx(
            "grid items-center gap-3 px-3 py-2 border-b border-[var(--color-border)] cursor-pointer hover:bg-[color-mix(in_srgb,var(--color-fg)_4%,transparent)] focus:outline-none focus-visible:bg-[color-mix(in_srgb,var(--color-cyan)_8%,transparent)]",
            GRID_CLASS,
          )}
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
            {item.status === "Wanted" ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setBoughtFor(item);
                }}
                className="hover:text-[var(--color-accent)] hover:underline underline-offset-2"
                title="Mark bought"
              >
                {item.status} →
              </button>
            ) : (
              item.status
            )}
          </span>
        </div>
      ))}
      {boughtFor ? (
        <MarkBoughtModal
          open
          onClose={() => setBoughtFor(null)}
          itemId={boughtFor.id}
          title={boughtFor.title}
          projects={modalProjects}
        />
      ) : null}
    </div>
  );
}

/**
 * Mobile collapses the table to thumb / title / price / priority / status —
 * the hidden md: columns (Vendor, Category, Project) drop to 0 because the
 * spans above also have `hidden md:inline`. Desktop restores all eight cols.
 */
const GRID_CLASS =
  "grid-cols-[40px_minmax(0,2fr)_70px_14px_56px] md:grid-cols-[40px_minmax(0,2fr)_minmax(0,1fr)_90px_90px_110px_14px_80px]";

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
