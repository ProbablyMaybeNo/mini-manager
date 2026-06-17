"use client";

import { useMemo, useState } from "react";
import { Button, HexField, Panel, Swatch } from "@/components/kit";
import { cn } from "@/lib/cn";
import { readableText } from "@/lib/color";
import {
  buildHarmony,
  getHarmonyMeta,
  harmonyKeys,
  hexToHsl,
  type HarmonyKey,
} from "@/lib/tools/wheel/harmonies";
import type { MatchResult, Paint } from "@/lib/types";

const PAGE_SIZE = 50;

/** ΔE2000 → "NN% color match" (MM-31). 0 ΔE = 100%; scaled so ~ΔE 20+ → 0%. */
function matchPercent(deltaE: number): number {
  return Math.max(0, Math.round(100 - (deltaE / 20) * 100));
}

/** ΔE2000 → confidence bucket (restored green/amber/grey dot). */
function confidence(deltaE: number): "high" | "medium" | "low" {
  if (deltaE < 2) return "high";
  if (deltaE < 5) return "medium";
  return "low";
}

/**
 * Color Match. Hex (or harmony) in → ranked closest paints across brands.
 * Restores from the old match tool: multi-brand chips, confidence dots, exact
 * ΔE, pagination, "NN% color match" + neon-green bars (MM-31), harmony modes
 * (MM-30), and ASSIGN → pastel-purple recipe dropdown (MM-33). USE is green
 * (MM-32, host-styled).
 */
export function ColourMatchTool({
  rankMatches,
  brandOptions,
  onUse,
  onAssign,
}: {
  rankMatches: (hex: string, brands: string[], limit: number) => MatchResult[];
  brandOptions: string[];
  onUse: (paint: Paint) => void;
  /** MM-33 — opens a recipe dropdown to assign the paint into, in place. */
  onAssign: (paint: Paint) => void;
}) {
  const [hex, setHex] = useState("#3a6ea5");
  const [brands, setBrands] = useState<ReadonlySet<string>>(new Set());
  const [harmony, setHarmony] = useState<HarmonyKey | "off">("off");
  const [page, setPage] = useState(0);

  const valid = /^#[0-9a-fA-F]{6}$/.test(hex);
  const brandList = useMemo(() => [...brands], [brands]);

  // MM-30 — when a harmony is selected, show the closest paint per harmony
  // hue; otherwise rank the single target across the catalog.
  const harmonyHexes = useMemo(() => {
    if (harmony === "off" || !valid) return [];
    const hsl = hexToHsl(hex);
    if (!hsl) return [];
    return buildHarmony(harmony, hsl.h, hsl.s, hsl.l);
  }, [harmony, hex, valid]);

  const results = useMemo(
    () => (valid && harmony === "off" ? rankMatches(hex, brandList, 500) : []),
    [valid, harmony, hex, brandList, rankMatches],
  );

  const harmonyRows = useMemo(
    () =>
      harmonyHexes.map((h) => ({
        hex: h,
        best: rankMatches(h, brandList, 1)[0] ?? null,
      })),
    [harmonyHexes, brandList, rankMatches],
  );

  const pageCount = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const pageSafe = Math.min(page, pageCount - 1);
  const paged = results.slice(pageSafe * PAGE_SIZE, (pageSafe + 1) * PAGE_SIZE);

  function toggleBrand(b: string) {
    setBrands((prev) => {
      const next = new Set(prev);
      if (next.has(b)) next.delete(b);
      else next.add(b);
      return next;
    });
    setPage(0);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
      <Panel label="INPUT" className="flex flex-col gap-4 p-5">
        <HexField label="Target hex" name="match-hex" value={hex} onChange={(e) => setHex(e.target.value)} />
        <div className="h-24 w-full border border-fg/20" style={{ backgroundColor: valid ? hex : "transparent" }} />

        {/* MM-30 — harmony modes */}
        <label>
          <span className="font-osd text-[10px] uppercase tracking-[0.18em] text-fg-dim">Harmony</span>
          <select
            value={harmony}
            onChange={(e) => {
              setHarmony(e.target.value as HarmonyKey | "off");
              setPage(0);
            }}
            className="mt-1 w-full border border-cyan/50 bg-bg px-2 py-1 font-mono text-xs text-fg focus:border-cyan focus:outline-none"
          >
            <option value="off">Single match</option>
            {harmonyKeys.map((k) => (
              <option key={k} value={k}>
                {getHarmonyMeta(k).label}
              </option>
            ))}
          </select>
        </label>

        {/* Multi-brand chips (restored) */}
        <div>
          <div className="flex items-center justify-between">
            <span className="font-osd text-[10px] uppercase tracking-[0.18em] text-fg-dim">
              Brands {brands.size > 0 ? `· ${brands.size}` : "· all"}
            </span>
            {brands.size > 0 && (
              <button
                type="button"
                onClick={() => setBrands(new Set())}
                className="font-mono text-[10px] text-red hover:underline"
              >
                Clear
              </button>
            )}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1">
            {brandOptions.map((b) => {
              const active = brands.has(b);
              return (
                <button
                  key={b}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleBrand(b)}
                  className={cn(
                    "truncate border px-2 py-1 text-left font-mono text-[10px] transition-colors",
                    active
                      ? "border-green bg-green/15 text-green"
                      : "border-cyan/20 text-fg hover:border-cyan/60",
                  )}
                >
                  {b}
                </button>
              );
            })}
          </div>
        </div>
      </Panel>

      <Panel label="RANKED MATCHES" cornerTicks className="flex flex-col gap-2 p-5">
        {!valid ? (
          <p className="py-8 text-center font-mono text-xs text-fg-faint">
            Enter a valid 6-digit hex to see matches.
          </p>
        ) : harmony !== "off" ? (
          // MM-30 — closest paint per harmony hue
          <div className="flex flex-col gap-2">
            {harmonyRows.map(({ hex: h, best }, i) => (
              <div key={i} className="flex items-center gap-3 border border-cyan/20 p-2">
                <span
                  className="inline-flex h-10 min-w-[80px] items-center justify-center border border-fg/20 px-2 font-mono text-[11px]"
                  style={{ backgroundColor: h, color: readableText(h) }}
                >
                  {h}
                </span>
                <span aria-hidden className="font-osd text-fg-faint">→</span>
                {best ? (
                  <MatchRow result={best} onUse={onUse} onAssign={onAssign} />
                ) : (
                  <span className="flex-1 font-mono text-xs text-fg-faint">No match</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <>
            {paged.map((r) => (
              <div key={r.paint.id} className="flex items-center gap-3 border border-cyan/20 p-2">
                <MatchRow result={r} onUse={onUse} onAssign={onAssign} />
              </div>
            ))}
            {pageCount > 1 && (
              <div className="flex items-center justify-center gap-3 pt-2">
                <Button
                  variant="tertiary"
                  size="sm"
                  disabled={pageSafe === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  ← Prev
                </Button>
                <span className="font-mono text-[11px] text-fg-faint">
                  Page {pageSafe + 1} / {pageCount}
                </span>
                <Button
                  variant="tertiary"
                  size="sm"
                  disabled={pageSafe >= pageCount - 1}
                  onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                >
                  Next →
                </Button>
              </div>
            )}
          </>
        )}
      </Panel>
    </div>
  );
}

/** A single ranked match row: swatch + brand/name + confidence dot + neon-green
 *  "NN% color match" bar + exact ΔE + USE (green) + ASSIGN (pastel purple). */
function MatchRow({
  result,
  onUse,
  onAssign,
}: {
  result: MatchResult;
  onUse: (paint: Paint) => void;
  onAssign: (paint: Paint) => void;
}) {
  const dE = result.distanceScore;
  const conf = confidence(dE);
  const pct = matchPercent(dE);
  const dotColor = conf === "high" ? "bg-green" : conf === "medium" ? "bg-yellow" : "bg-fg-faint";

  return (
    <>
      <Swatch hex={result.paint.hex} size="lg" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span aria-hidden className={cn("inline-block h-2 w-2 rounded-full", dotColor)} />
          <span className="truncate font-mono text-sm text-fg">{result.paint.name}</span>
        </div>
        <div className="font-osd text-[10px] uppercase tracking-[0.15em] text-fg-faint">
          {result.paint.brand}
        </div>
        {/* MM-31 — neon-green bar + "NN% color match" label */}
        <div className="mt-1 flex items-center gap-2">
          <div className="h-1.5 flex-1 bg-bg-raised">
            <div className="h-full bg-green" style={{ width: `${pct}%` }} />
          </div>
          <span className="shrink-0 font-mono text-[10px] tabular-nums text-green">
            {pct}% color match
          </span>
        </div>
      </div>
      <span className="font-mono text-[11px] tabular-nums text-fg-faint" title="CIEDE2000 distance (lower = closer)">
        Δ{dE.toFixed(1)}
      </span>
      {/* MM-32 — USE is neon green (host-styled via the green token). */}
      <Button
        size="sm"
        onClick={() => onUse(result.paint)}
        className="border-green bg-green/15 text-green hover:bg-green/25"
      >
        Use
      </Button>
      {/* MM-33 — ASSIGN is pastel purple; opens a recipe dropdown. */}
      <Button
        size="sm"
        onClick={() => onAssign(result.paint)}
        className="border-purple bg-purple/15 text-purple hover:bg-purple/25"
      >
        Assign
      </Button>
    </>
  );
}
