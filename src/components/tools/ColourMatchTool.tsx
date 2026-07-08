"use client";

import { useMemo, useState } from "react";
import { Button, HexField, Panel, Swatch } from "@/components/kit";
import { cn } from "@/lib/cn";
import { readableText } from "@/lib/color";
import { resolveMatchTypeFilter } from "@/lib/toolMatch";
import { PaintPickerPanel } from "./PaintPickerPanel";
import {
  buildHarmony,
  getHarmonyMeta,
  harmonyKeys,
  hexToHsl,
  type HarmonyKey,
} from "@/lib/tools/wheel/harmonies";
import type { MatchResult, Paint } from "@/lib/types";

const PAGE_SIZE = 50;

// In harmony mode the painter gets several target hues at once, so a single
// "best" paint per hue leaves them no room to choose. Offer the top few ranked
// matches per harmony colour instead (rkhilarysignups-8609 review — "more than
// one match possibility for each color").
const HARMONY_MATCHES_PER_HUE = 3;

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
  typeOptions = [],
  enableLibraryPick = false,
  onUse,
  onAssign,
}: {
  rankMatches: (hex: string, brands: string[], types: string[], limit: number) => MatchResult[];
  brandOptions: string[];
  /** 4kCdsj — paint TYPE facet (mirrors the Library's). Omit/empty hides the
   *  section entirely and disables the incompatible-type default (used by the
   *  embedded recipe-slot picker, which wants every type visible). */
  typeOptions?: string[];
  /** Show a "Pick from library" button that opens the full wheel + searchable
   *  catalog + eyedropper to set the target colour. On the standalone Match
   *  page; off in the recipe-slot picker, which already has its own library
   *  tab (avoids stacking a second slide-out over the Pick & Paint panel). */
  enableLibraryPick?: boolean;
  onUse: (paint: Paint) => void;
  /** MM-33 — opens a recipe dropdown to assign the paint into, in place. */
  onAssign: (paint: Paint) => void;
}) {
  const [hex, setHex] = useState("#3a6ea5");
  const [brands, setBrands] = useState<ReadonlySet<string>>(new Set());
  const [types, setTypes] = useState<ReadonlySet<string>>(new Set());
  const [harmony, setHarmony] = useState<HarmonyKey | "off">("off");
  const [page, setPage] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);

  const valid = /^#[0-9a-fA-F]{6}$/.test(hex);
  const brandList = useMemo(() => [...brands], [brands]);
  // 4kCdsj — the painter's own TYPE checks win outright; with none checked,
  // fall back to hiding varnish/wash/primer/texture-style "incompatible"
  // finishes from ranked matches by default.
  const effectiveTypes = useMemo(
    () => resolveMatchTypeFilter([...types], typeOptions),
    [types, typeOptions],
  );

  // MM-30 — when a harmony is selected, show the closest paint per harmony
  // hue; otherwise rank the single target across the catalog.
  const harmonyHexes = useMemo(() => {
    if (harmony === "off" || !valid) return [];
    const hsl = hexToHsl(hex);
    if (!hsl) return [];
    return buildHarmony(harmony, hsl.h, hsl.s, hsl.l);
  }, [harmony, hex, valid]);

  const results = useMemo(
    () => (valid && harmony === "off" ? rankMatches(hex, brandList, effectiveTypes, 500) : []),
    [valid, harmony, hex, brandList, effectiveTypes, rankMatches],
  );

  const harmonyRows = useMemo(
    () =>
      harmonyHexes.map((h) => ({
        hex: h,
        matches: rankMatches(h, brandList, effectiveTypes, HARMONY_MATCHES_PER_HUE),
      })),
    [harmonyHexes, brandList, effectiveTypes, rankMatches],
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

  function toggleType(t: string) {
    setTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
    setPage(0);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
      <Panel label="INPUT" className="flex min-w-0 flex-col gap-4 p-5">
        <HexField label="Target hex" name="match-hex" value={hex} onChange={(e) => setHex(e.target.value)} />
        {enableLibraryPick ? (
          // The colour preview IS the picker trigger — click it to open the
          // wheel + full searchable library + eyedropper and set the target.
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            aria-label="Choose a paint from the library to match against"
            className="group relative h-24 w-full border border-fg/20 transition-colors hover:border-cyan focus:border-cyan focus:outline-none"
            style={{ backgroundColor: valid ? hex : "transparent" }}
          >
            <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              {/* Fully opaque chip (bg-bg, not bg-bg/80) so the cyan-lite label
                  keeps a stable dark ground and clears AA regardless of the
                  live target-colour fill behind it (UX-002 / MUX-002). */}
              <span className="border border-cyan/60 bg-bg px-2 py-1 font-button text-button text-cyan-lite">
                ◈ Pick from library
              </span>
            </span>
          </button>
        ) : (
          <div className="h-24 w-full border border-fg/20" style={{ backgroundColor: valid ? hex : "transparent" }} />
        )}

        {/* MM-30 — harmony modes */}
        <label>
          <span className="label-osd text-fg">Harmony</span>
          <select
            value={harmony}
            onChange={(e) => {
              setHarmony(e.target.value as HarmonyKey | "off");
              setPage(0);
            }}
            className="mt-1 w-full border border-cyan/50 bg-bg px-2 py-1.5 font-body text-body text-fg focus:border-cyan focus:outline-none"
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
            <span className="label-osd text-fg">
              Brands {brands.size > 0 ? `· ${brands.size}` : "· all"}
            </span>
            {brands.size > 0 && (
              <button
                type="button"
                onClick={() => setBrands(new Set())}
                className="font-button text-button text-red hover:underline"
              >
                Clear
              </button>
            )}
          </div>
          <div className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
            {brandOptions.map((b) => {
              const active = brands.has(b);
              return (
                <button
                  key={b}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleBrand(b)}
                  className={cn(
                    "truncate border px-2 py-1 text-left font-button text-button transition-colors",
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

        {/* 4kCdsj — paint TYPE facet, same pattern as the Library's. With
            nothing checked, ranked matches quietly hide varnish/wash/primer/
            texture-style finishes by default (INCOMPATIBLE_MATCH_TYPES) —
            check a box here to override and bring any of them back. */}
        {typeOptions.length > 0 && (
          <div>
            <div className="flex items-center justify-between">
              <span className="label-osd text-fg">
                Type {types.size > 0 ? `· ${types.size}` : "· default"}
              </span>
              {types.size > 0 && (
                <button
                  type="button"
                  onClick={() => setTypes(new Set())}
                  className="font-button text-button text-red hover:underline"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
              {typeOptions.map((t) => {
                const active = types.has(t);
                return (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleType(t)}
                    className={cn(
                      "truncate border px-2 py-1 text-left font-button text-button transition-colors",
                      active
                        ? "border-green bg-green/15 text-green"
                        : "border-cyan/20 text-fg hover:border-cyan/60",
                    )}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
            {types.size === 0 && (
              <p className="mt-1 font-body text-body text-fg-faint">
                Default hides varnish/wash/primer/texture-style finishes as
                colour swaps — check a type above to include it.
              </p>
            )}
          </div>
        )}
      </Panel>

      <Panel label="RANKED MATCHES" cornerTicks className="flex min-w-0 flex-col gap-2 p-5">
        {!valid ? (
          <p className="py-8 text-center font-body text-body text-fg">
            Enter a valid 6-digit hex to see matches.
          </p>
        ) : harmony !== "off" ? (
          // MM-30 — closest paint per harmony hue
          <div className="flex flex-col gap-2">
            {harmonyRows.map(({ hex: h, matches }, i) => (
              <div key={i} className="flex items-start gap-3 border border-cyan/20 p-2">
                <span
                  className="inline-flex h-10 min-w-[80px] items-center justify-center border border-fg/20 px-2 font-body text-body"
                  style={{ backgroundColor: h, color: readableText(h) }}
                >
                  {h}
                </span>
                <span aria-hidden className="pt-3 font-osd text-fg-faint">→</span>
                {matches.length > 0 ? (
                  // Stack the top few ranked paints per harmony hue so the
                  // painter can choose, not just accept the single closest.
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    {matches.map((m) => (
                      <div key={m.paint.id} className="flex items-center gap-3">
                        <MatchRow result={m} onUse={onUse} onAssign={onAssign} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="flex-1 pt-2 font-body text-body text-fg">No match</span>
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
                <span className="font-body text-body text-fg">
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

      {enableLibraryPick && (
        // The PAINT PICKER PANEL (same tabbed panel the recipe paint picker uses)
        // — not the wheel-only COLOR PICKER PANEL. No Match tab here: this panel
        // only sets the target colour for the Match tool that opened it.
        <PaintPickerPanel
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          title="Pick a paint to match"
          breadcrumb="MATCH ▸ PAINT PICKER"
          note="// choosing a paint sets the colour to match"
          initialHex={valid ? hex : null}
          closeOnSelect
          onSelect={(sel) => setHex(sel.hex)}
        />
      )}
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
      <Swatch hex={result.paint.hex} size="lg" className="shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span aria-hidden className={cn("inline-block h-2 w-2 shrink-0 rounded-full", dotColor)} />
          {/* The dot is colour-only; name the confidence level for SR (UX-008). */}
          <span className="sr-only">{conf} confidence match</span>
          <span className="truncate font-body text-body text-fg" title={result.paint.name}>
            {result.paint.name}
          </span>
        </div>
        <div className="label-osd truncate text-fg" title={result.paint.brand}>
          {result.paint.brand}
        </div>
        {/* MM-31 — neon-green bar + "NN% color match" label */}
        <div className="mt-1 flex items-center gap-2">
          <div className="h-1.5 flex-1 bg-bg-raised">
            <div className="h-full bg-green" style={{ width: `${pct}%` }} />
          </div>
          <span className="shrink-0 font-body text-body tabular-nums text-green">
            {pct}% color match
          </span>
        </div>
      </div>
      {/* ΔE + actions in their own shrink-0 lane so they never collapse onto or
          overlap the name/brand block in a narrow panel (Pick & Paint). */}
      <div className="flex shrink-0 items-center gap-2">
        {/* The raw ΔE duplicates the % bar and reads as jargon — annotate it in
            plain language for both sighted (title) and SR (aria-label) users
            without dropping the number (UX-008). */}
        <span
          className="font-num2 text-num2 tabular-nums text-fg"
          title="Colour distance (Δ) — lower means a closer match"
          aria-label={`Colour distance ${dE.toFixed(1)} — lower means a closer match`}
        >
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
      </div>
    </>
  );
}
