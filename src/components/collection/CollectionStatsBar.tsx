"use client";

import { useMemo } from "react";
import { cn } from "@/lib/cn";
import { accentText, type Accent } from "@/lib/palette";
import type { CollectionItem, ProjectStatus } from "@/lib/types";

/** Parse a formatted price ("$29.99", "£12") to a number; 0 when blank. */
function parsePrice(p: string): number {
  const n = Number.parseFloat(p.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** A status counts as "owned/acquired" once it leaves the wishlist (and
 *  isn't shelved on hold). */
function isAcquired(s: ProjectStatus): boolean {
  return s !== "WISHLIST" && s !== "SHELVED";
}

/** Sum prices for the rows the painter already owns (not wishlisted). */
function spentOn(items: CollectionItem[]): number {
  return items.filter((i) => isAcquired(i.status)).reduce((sum, i) => sum + parsePrice(i.price), 0);
}

/** Sum prices still on the wishlist — what's left to buy. */
function remainingOn(items: CollectionItem[]): number {
  return items
    .filter((i) => i.status === "WISHLIST")
    .reduce((sum, i) => sum + parsePrice(i.price), 0);
}

function money(n: number): string {
  return `$${n.toFixed(2)}`;
}

/** One "<value> <LABEL>" stat — value leads, label trails (d0MWLSNNjDTd). */
function Stat({ value, label, accent = "cyan" }: { value: string; label: string; accent?: Accent }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className={cn("font-num2 text-num2 tabular-nums", accentText[accent])}>{value}</span>
      <span className="label-osd text-fg">{label}</span>
    </span>
  );
}

/**
 * d0MWLSNNjDTd — collection overview bar, two labelled lines (no title, no
 * progress tracking; projects/dashboard own progress):
 *   PAINT:  <owned> OWNED  <wishlist> WISHLIST  $<spent> TOTAL SPENT  $<remaining> TOTAL REMAINING
 *   MODELS: <wishlist> WISHLIST  <owned> OWNED  <complete> COMPLETE  $<spent> TOTAL SPENT  $<remaining> TOTAL REMAINING
 * Counts/sums come from the same owned/wishlist/complete + spend logic the
 * bar already used.
 */
export function CollectionStatsBar({
  paints,
  models,
}: {
  paints: CollectionItem[];
  models: CollectionItem[];
}) {
  const stats = useMemo(() => {
    const wishlist = (items: CollectionItem[]) =>
      items.filter((i) => i.status === "WISHLIST").length;

    return {
      paintOwned: paints.filter((p) => isAcquired(p.status)).length,
      paintWishlist: wishlist(paints),
      paintSpend: spentOn(paints),
      paintRemaining: remainingOn(paints),
      modelWishlist: wishlist(models),
      modelOwned: models.filter((m) => isAcquired(m.status)).length,
      modelComplete: models.filter((m) => m.status === "COMPLETE").length,
      modelSpend: spentOn(models),
      modelRemaining: remainingOn(models),
    };
  }, [paints, models]);

  return (
    <div
      className={cn(
        "sticky bottom-0 z-10 flex flex-col gap-y-1.5 border-t border-cyan/30",
        "bg-bg/90 px-4 py-2.5 backdrop-blur-sm",
      )}
    >
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
        <span className="label-osd text-cyan">PAINT:</span>
        <Stat value={String(stats.paintOwned)} label="OWNED" accent="green" />
        <Stat value={String(stats.paintWishlist)} label="WISHLIST" accent="cyan" />
        <Stat value={money(stats.paintSpend)} label="TOTAL SPENT" accent="green" />
        <Stat value={money(stats.paintRemaining)} label="TOTAL REMAINING" accent="yellow" />
      </div>
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
        <span className="label-osd text-cyan">MODELS:</span>
        <Stat value={String(stats.modelWishlist)} label="WISHLIST" accent="cyan" />
        <Stat value={String(stats.modelOwned)} label="OWNED" accent="green" />
        <Stat value={String(stats.modelComplete)} label="COMPLETE" accent="purple" />
        <Stat value={money(stats.modelSpend)} label="TOTAL SPENT" accent="green" />
        <Stat value={money(stats.modelRemaining)} label="TOTAL REMAINING" accent="yellow" />
      </div>
    </div>
  );
}
