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

/** Sum prices for the rows the painter actually owns (not wishlisted). */
function spentOn(items: CollectionItem[]): number {
  return items.filter((i) => isAcquired(i.status)).reduce((sum, i) => sum + parsePrice(i.price), 0);
}

function money(n: number): string {
  return `$${n.toFixed(2)}`;
}

function Stat({ label, value, accent = "cyan" }: { label: string; value: string; accent?: Accent }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="font-osd text-[12px] uppercase tracking-[0.16em] text-fg-faint">{label}</span>
      <span className={cn("font-mono text-sm tabular-nums", accentText[accent])}>{value}</span>
    </div>
  );
}

/**
 * EJnq/nwVv — bottom overview bar: paints owned + spend, model build-stage
 * counts + spend. The model lifecycle collapses to OWNED + COMPLETE when
 * too many stages are populated to fit cleanly (per the comment's
 * "owned and completed if it's too many").
 */
export function CollectionStatsBar({
  paints,
  models,
}: {
  paints: CollectionItem[];
  models: CollectionItem[];
}) {
  const stats = useMemo(() => {
    const paintsOwned = paints.filter((p) => isAcquired(p.status)).length;
    const paintSpend = spentOn(paints);

    const stage = (s: ProjectStatus) => models.filter((m) => m.status === s).length;
    const stages = {
      built: stage("BUILDING"),
      primed: stage("PRIMING"),
      painted: stage("PAINTING"),
      based: stage("BASING"),
      complete: stage("COMPLETE"),
    };
    const owned = models.filter((m) => isAcquired(m.status)).length;
    const nonZeroStages = Object.values(stages).filter((n) => n > 0).length;
    const modelSpend = spentOn(models);

    return { paintsOwned, paintTotal: paints.length, paintSpend, stages, owned, nonZeroStages, modelSpend, modelTotal: models.length };
  }, [paints, models]);

  // >3 populated stages → collapse to the compact owned + complete summary.
  const compact = stats.nonZeroStages > 3;

  return (
    <div
      className={cn(
        "sticky bottom-0 z-10 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-cyan/30",
        "bg-bg/90 px-4 py-2.5 backdrop-blur-sm",
      )}
    >
      <span className="font-osd text-[12px] uppercase tracking-[0.2em] text-cyan">▸ COLLECTION</span>

      <Stat label="Paints owned" value={`${stats.paintsOwned}/${stats.paintTotal}`} accent="green" />
      <Stat label="Paint spend" value={money(stats.paintSpend)} accent="green" />

      <span aria-hidden className="hidden h-4 w-px bg-fg/20 sm:inline-block" />

      <Stat label="Models" value={`${stats.owned}/${stats.modelTotal}`} accent="cyan" />
      {compact ? (
        <Stat label="Complete" value={String(stats.stages.complete)} accent="purple" />
      ) : (
        <>
          <Stat label="Built" value={String(stats.stages.built)} accent="cyan" />
          <Stat label="Primed" value={String(stats.stages.primed)} accent="purple" />
          <Stat label="Painted" value={String(stats.stages.painted)} accent="yellow" />
          <Stat label="Based" value={String(stats.stages.based)} accent="green" />
          <Stat label="Complete" value={String(stats.stages.complete)} accent="green" />
        </>
      )}
      <Stat label="Model spend" value={money(stats.modelSpend)} accent="cyan" />
    </div>
  );
}
