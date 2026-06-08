"use client";

import { useTransition } from "react";
import { clsx } from "clsx";
import { ExternalLink, X } from "lucide-react";
import type { WishlistItem } from "@/db/schema";
import { deleteWishlistItem } from "@/lib/actions/wishlist";

/** 40px thumbnail — image if present, else the title's initial in a
 *  bordered tile (matching the old wishlist look). */
export function Thumbnail({ item }: { item: WishlistItem }) {
  if (item.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={item.imageUrl}
        alt=""
        className="h-10 w-10 rounded-sm object-cover border border-[var(--color-border)] shrink-0"
        loading="lazy"
      />
    );
  }
  const initial = (item.title[0] ?? "?").toUpperCase();
  return (
    <span
      aria-hidden
      className="h-10 w-10 rounded-sm border border-[var(--color-border)] inline-flex items-center justify-center font-mono text-base text-[var(--color-fg-muted)] shrink-0"
    >
      {initial}
    </span>
  );
}

/** The item name. Hyperlinks to the source URL if one exists, otherwise
 *  renders as plain text. */
export function ItemName({ item }: { item: WishlistItem }) {
  const cls =
    "font-mono text-sm truncate block max-w-full text-[var(--color-fg)]";
  if (item.sourceUrl) {
    return (
      <a
        href={item.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className={clsx(
          cls,
          "text-[var(--color-cyan)] underline-offset-2 hover:underline",
        )}
        title={item.title}
      >
        {item.title}
      </a>
    );
  }
  return (
    <span className={cls} title={item.title}>
      {item.title}
    </span>
  );
}

/** Small "link" cell — a single icon linking out to the source URL.
 *  Renders a muted dash when no URL is set so the column stays aligned. */
export function SourceLinkCell({ url }: { url: string | null }) {
  if (!url) {
    return (
      <span className="text-[var(--color-fg-subtle)] font-mono text-xs" aria-hidden>
        —
      </span>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      title="Open source page"
      aria-label="Open source page"
      className="tap-target inline-flex items-center justify-center text-[var(--color-fg-muted)] hover:text-[var(--color-cyan)] transition-colors"
    >
      <ExternalLink size={14} strokeWidth={1.75} aria-hidden />
    </a>
  );
}

/** Small destructive X that deletes the row. */
export function DeleteButton({ item }: { item: WishlistItem }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={(e) => {
        e.stopPropagation();
        startTransition(async () => {
          await deleteWishlistItem({ id: item.id });
        });
      }}
      onKeyDown={(e) => e.stopPropagation()}
      title={`Delete ${item.title}`}
      aria-label={`Delete ${item.title}`}
      className={clsx(
        "tap-target inline-flex items-center justify-center rounded-sm",
        "text-[var(--color-fg-subtle)] hover:text-[var(--color-red)]",
        "hover:[box-shadow:0_0_0_1px_var(--color-red)] focus-visible:[box-shadow:0_0_0_2px_var(--color-red)]",
        "transition-[color,box-shadow] focus:outline-none disabled:opacity-50",
      )}
    >
      <X size={14} strokeWidth={2} aria-hidden />
    </button>
  );
}

export function formatPrice(
  priceCents: number | null,
  currency: string | null,
): string {
  if (priceCents === null || priceCents === undefined) return "—";
  const dollars = priceCents / 100;
  const code = currency ?? "USD";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
    }).format(dollars);
  } catch {
    return `${dollars.toFixed(2)} ${code}`;
  }
}
