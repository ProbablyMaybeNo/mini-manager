"use client";

import { useMemo } from "react";
import { cn } from "@/lib/cn";
import { accentText, type Accent } from "@/lib/palette";
import type { CollectionItem, Project, ProjectStatus } from "@/lib/types";

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

/** Phone variant of {@link Stat}: compact, but the word is VISIBLE — a bare
 *  colour-coded "6" next to a bare "2" is only decodable if you already know
 *  the legend, and colour alone isn't a legend (MUX-018). At ~8 characters the
 *  pair still fits one 375px line. */
function BareStat({ value, label, accent }: { value: string; label: string; accent: Accent }) {
  return (
    <span className={cn("inline-flex items-baseline gap-1 font-num2 text-num2 tabular-nums", accentText[accent])}>
      {value}
      <span className="font-mono text-[10px] uppercase tracking-wide opacity-80">{label}</span>
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
  projects = [],
}: {
  paints: CollectionItem[];
  models: CollectionItem[];
  /** Projects, for the per-project BUDGET chips (24:4). Omitted → chips hidden. */
  projects?: Project[];
}) {
  // Per-project BUDGET chips (24:4): spent (acquired) + remaining (wishlist),
  // grouped by the item's projectId across both paints + models. Projects carry
  // no stored budget, so each chip shows $spent and the +remaining to-buy; the
  // grand TOTAL SPENT / TOTAL (spent + remaining) trail the row.
  const budget = useMemo(() => {
    const all = [...paints, ...models];
    const byProject = new Map<string, { spent: number; remaining: number }>();
    for (const item of all) {
      if (!item.projectId) continue;
      const cur = byProject.get(item.projectId) ?? { spent: 0, remaining: 0 };
      if (item.status === "WISHLIST") cur.remaining += parsePrice(item.price);
      else if (item.status !== "SHELVED") cur.spent += parsePrice(item.price);
      byProject.set(item.projectId, cur);
    }
    const titleOf = (id: string) => projects.find((p) => p.id === id)?.title ?? "Unassigned";
    const rows = [...byProject.entries()]
      .map(([id, v]) => ({ id, title: titleOf(id), ...v }))
      .filter((r) => r.spent > 0 || r.remaining > 0)
      .sort((a, b) => b.spent - a.spent);
    const totalSpent = rows.reduce((s, r) => s + r.spent, 0);
    const totalRemaining = rows.reduce((s, r) => s + r.remaining, 0);
    return { rows, totalSpent, total: totalSpent + totalRemaining };
  }, [paints, models, projects]);

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
        // STATIC on short viewports (MUX5-002). Pinned, its 66px sat over the
        // table's first row in landscape — the row laid out at y=311 behind a
        // bar occupying y=309–375, so a hit test at the row's centre returned
        // the bar's own "PAINT:" label and /collection showed ZERO rows on the
        // screen whose only job is the list. It pins again from `roomy:` up,
        // where there's height to spare.
        "z-10 flex flex-col gap-y-1.5 border-t border-cyan/30 roomy:sticky roomy:bottom-0",
        // Opaque, not bg/90+blur: table rows read through the translucent bar as
        // it overlapped them, which made the totals look like part of the table
        // (MUX-018).
        "bg-bg px-4 py-1.5 roomy:py-2.5",
      )}
    >
      {/* Phone bar (Ross, 2026-07-27): exactly two lines. The per-project BUDGET
          chips and the TOTAL REMAINING column stay desktop-only — six lines of
          stats on a phone was eating a third of the screen. */}
      <div className="flex flex-col gap-1 md:hidden">
        <div className="flex items-baseline gap-2.5">
          <span className="label-osd shrink-0 text-cyan-lite">PAINT:</span>
          <BareStat value={String(stats.paintOwned)} label="owned" accent="green" />
          <BareStat value={String(stats.paintWishlist)} label="wish" accent="yellow" />
          <span className="ml-auto font-num2 text-num2 tabular-nums text-fg">
            {money(stats.paintSpend)}
            <span className="sr-only"> total spent</span>
          </span>
        </div>
        <div className="flex items-baseline gap-2.5">
          <span className="label-osd shrink-0 text-cyan-lite">MODELS:</span>
          <BareStat value={String(stats.modelOwned)} label="owned" accent="green" />
          <BareStat value={String(stats.modelWishlist)} label="wish" accent="yellow" />
          <span className="ml-auto font-num2 text-num2 tabular-nums text-fg">
            {money(stats.modelSpend)}
            <span className="sr-only"> total spent</span>
          </span>
        </div>
      </div>

      {budget.rows.length > 0 && (
        <div className="hidden flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-border pb-1.5 md:flex">
          <span className="label-osd text-cyan-lite">BUDGET</span>
          {budget.rows.map((r) => (
            <span
              key={r.id}
              className="inline-flex items-center gap-1.5 rounded-[6px] border border-border px-2 py-0.5 font-mono text-[11px] text-fg"
            >
              <span className="text-fg-bright">{r.title}</span>
              <span className="tabular-nums text-green">{money(r.spent)}</span>
              {r.remaining > 0 && (
                <span className="tabular-nums text-yellow">+{money(r.remaining)}</span>
              )}
            </span>
          ))}
          <span className="ml-auto inline-flex items-baseline gap-3">
            <Stat value={money(budget.totalSpent)} label="TOTAL SPENT" accent="green" />
            <Stat value={money(budget.total)} label="TOTAL" accent="cyan" />
          </span>
        </div>
      )}
      <div className="hidden flex-wrap items-baseline gap-x-5 gap-y-1 md:flex">
        <span className="label-osd text-cyan-lite">PAINT:</span>
        <Stat value={String(stats.paintOwned)} label="OWNED" accent="green" />
        <Stat value={String(stats.paintWishlist)} label="WISHLIST" accent="cyan" />
        <Stat value={money(stats.paintSpend)} label="TOTAL SPENT" accent="green" />
        <Stat value={money(stats.paintRemaining)} label="TOTAL REMAINING" accent="yellow" />
      </div>
      <div className="hidden flex-wrap items-baseline gap-x-5 gap-y-1 md:flex">
        <span className="label-osd text-cyan-lite">MODELS:</span>
        <Stat value={String(stats.modelWishlist)} label="WISHLIST" accent="cyan" />
        <Stat value={String(stats.modelOwned)} label="OWNED" accent="green" />
        <Stat value={String(stats.modelComplete)} label="COMPLETE" accent="green" />
        <Stat value={money(stats.modelSpend)} label="TOTAL SPENT" accent="green" />
        <Stat value={money(stats.modelRemaining)} label="TOTAL REMAINING" accent="yellow" />
      </div>
    </div>
  );
}
