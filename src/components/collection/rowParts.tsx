"use client";

import { clsx } from "clsx";
import { ExternalLink } from "lucide-react";
import type { WishlistItem } from "@/db/schema";

/**
 * COLLECTION table cell fragments (FIGMA-REBUILD, REBUILD_SPEC §8).
 * Shared between the PAINT and MODEL tables. All colour comes from
 * tokens / currentColor so the `.dt` selected-row flip (cyan bg, black
 * text) carries through every fragment without per-cell overrides.
 */

/** IMAGE cell — the item photo at 40px, or an empty bordered tile (the
 *  mock's unfilled image box) when no scrape image exists. */
export function ItemImage({ item }: { item: WishlistItem }) {
  if (item.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={item.imageUrl}
        alt=""
        className="h-10 w-10 shrink-0 border border-[var(--color-border-strong)] object-cover"
        loading="lazy"
      />
    );
  }
  return (
    <span
      aria-hidden
      className="inline-block h-10 w-10 shrink-0 border border-[var(--color-border-strong)]"
    />
  );
}

/** NAME cell body — plain mono text; the LINK column owns the outbound
 *  affordance so the name stays readable inside a selected (cyan) row. */
export function ItemName({ item }: { item: WishlistItem }) {
  return (
    <span className="block max-w-full truncate font-mono" title={item.title}>
      {item.title}
    </span>
  );
}

/** LINK cell — outbound source-page icon link, or a muted dash. */
export function SourceLink({ item }: { item: WishlistItem }) {
  if (!item.sourceUrl) {
    return (
      <span aria-hidden className="font-mono text-[var(--color-fg-subtle)]">
        —
      </span>
    );
  }
  return (
    <a
      href={item.sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      title={`Open ${item.title} source page`}
      aria-label={`Open ${item.title} source page`}
      className={clsx(
        "tap-target inline-flex items-center justify-center align-middle",
        "text-[var(--color-cyan)] transition-colors motion-reduce:transition-none",
        "hover:brightness-125 focus:outline-none",
        "focus-visible:[box-shadow:0_0_0_2px_var(--color-cyan)]",
      )}
    >
      <ExternalLink size={15} strokeWidth={1.75} aria-hidden />
    </a>
  );
}

/** RECIPE cell — up to two recipe-name chips + a "+n" overflow marker.
 *  Chips ride currentColor so they flip to black inside a selected row. */
export function RecipeChips({ recipes }: { recipes: ReadonlyArray<string> }) {
  if (recipes.length === 0) {
    return (
      <span aria-hidden className="font-mono text-[var(--color-fg-subtle)]">
        —
      </span>
    );
  }
  const shown = recipes.slice(0, 2);
  const extra = recipes.length - shown.length;
  return (
    <span
      className="inline-flex max-w-full items-center gap-1 text-[var(--color-cyan)]"
      title={recipes.join(", ")}
    >
      {shown.map((name) => (
        <span
          key={name}
          className="inline-block max-w-[110px] truncate border border-current px-1.5 py-0.5 font-mono text-2xs uppercase tracking-wider"
        >
          {name}
        </span>
      ))}
      {extra > 0 ? (
        <span className="font-mono text-2xs">+{extra}</span>
      ) : null}
    </span>
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
