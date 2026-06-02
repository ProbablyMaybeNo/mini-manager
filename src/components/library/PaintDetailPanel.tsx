"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { clsx } from "clsx";

import type { Paint } from "@/lib/paints/types";
import { TypeIcon } from "./TypeIcon";
import { HexConfidenceDot } from "./HexConfidenceDot";
import { InventoryControls } from "./InventoryControls";
import { StatusPill, type StatusPillKind } from "@/components/ui/StatusPill";

const PAINT_TYPE_PILL: Record<string, StatusPillKind> = {
  Paint: "info",
  Wash: "warning",
  Contrast: "info",
  Metallic: "info",
  Air: "info",
  Primer: "neutral",
  Varnish: "neutral",
  Pigment: "neutral",
  Effect: "info",
  Ink: "info",
  Lacquer: "neutral",
};
import { _internal } from "@/lib/paints/filters";
import {
  COLOR_PICKER_HARMONY_LABELS,
  buildPickerHarmony,
} from "@/lib/colorPicker/harmonies";
import type { ColorPickerHarmony } from "@/lib/colorPicker/types";
import { fastMatchByHueBand } from "@/lib/colorPicker/matchPaints";

/**
 * Right-side slide-in detail panel. Shows the full paint metadata,
 * an 8-swatch harmonies strip (HSL rotation, no extra deps), and a
 * placeholder for cross-brand matches (full ΔE2000 lands in Phase 4).
 */
export function PaintDetailPanel({
  paint,
  similarInOtherBrands,
  inventory,
  allPaints,
}: {
  paint: Paint | null;
  similarInOtherBrands: ReadonlyArray<Paint>;
  inventory?: { ownedCount: number; isWishlisted: boolean } | undefined;
  /** P12.22 — the full catalog so the harmonies dropdown can show
   *  library paints matching a clicked harmony swatch's hue. Pure-
   *  client filter; only used when one of the inline harmony hues
   *  is clicked. */
  allPaints?: ReadonlyArray<Paint>;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const pathname = usePathname();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1200);
    return () => clearTimeout(id);
  }, [copied]);

  // P12.22 — pickable harmony scheme (mono / analogous / complementary
  // / triadic / split / square / tetradic). Default is complementary
  // because it's the most-used / most-readable starter harmony.
  const [harmonyKey, setHarmonyKey] = useState<ColorPickerHarmony>("complementary");
  const [selectedHarmonyHex, setSelectedHarmonyHex] = useState<string | null>(
    null,
  );

  // Reset the harmony selection when the paint changes (otherwise the
  // dropdown stays on whatever the painter picked for the previous
  // paint, which surprises them).
  useEffect(() => {
    setSelectedHarmonyHex(null);
  }, [paint?.id]);

  const harmonySwatches = useMemo(() => {
    if (!paint) return [];
    const hsl = _internal.parseHex(paint.hex);
    if (!hsl) return [];
    const [r, g, b] = hsl;
    const fullHsl = rgbToHsl(r, g, b);
    if (!fullHsl) return [];
    const [h, s, l] = fullHsl;
    return buildPickerHarmony(harmonyKey, h, s * 100, l * 100);
  }, [paint, harmonyKey]);

  const harmonyPaintMatches = useMemo(() => {
    if (!selectedHarmonyHex || !allPaints) return [];
    return fastMatchByHueBand(selectedHarmonyHex, allPaints, { limit: 12 });
  }, [selectedHarmonyHex, allPaints]);

  function close() {
    const params = new URLSearchParams(sp?.toString() ?? "");
    params.delete("paint");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  async function copyHex() {
    if (!paint) return;
    try {
      await navigator.clipboard.writeText(paint.hex);
      setCopied(true);
    } catch {
      // Clipboard API rejects in some browsers without HTTPS — silently noop.
    }
  }

  if (!paint) return null;

  return (
    <aside
      className={clsx(
        "fixed inset-y-0 right-0 z-50 w-full md:w-[420px] bg-[var(--color-bg-panel)]",
        "border-l border-[var(--color-border-strong)] shadow-2xl",
        "flex flex-col pb-20 md:pb-0",
      )}
      aria-label={`${paint.brand} ${paint.name} detail`}
    >
      <header className="flex items-start justify-between gap-2 p-4 border-b border-[var(--color-border)]">
        <div className="min-w-0">
          <p className="text-2xs font-mono text-[var(--color-fg-muted)] uppercase tracking-wider">
            {paint.brand}
            {paint.line ? ` · ${paint.line}` : ""}
          </p>
          <h2 className="font-mono text-lg text-[var(--color-fg)] truncate mt-0.5">
            {paint.name}
          </h2>
          {paint.sku ? (
            <p className="text-2xs font-mono text-[var(--color-fg-subtle)] mt-0.5">
              SKU {paint.sku}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={close}
          className="text-base font-mono px-2 py-1 text-[var(--color-fg-muted)] hover:text-[var(--color-cyan)] tap-target"
          aria-label="Close detail panel"
        >
          ×
        </button>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-5">
        <div
          className="h-48 w-full rounded-sm border border-[var(--color-border)]"
          style={{ background: paint.hex }}
          aria-label={`Swatch ${paint.hex}`}
        />

        <section
          className="flex items-center gap-3"
          aria-label="Paint type and hex confidence"
        >
          <span
            className="inline-flex items-center gap-2"
            title={`${paint.type} — paint type / medium`}
          >
            <TypeIcon type={paint.type} className="text-[var(--color-fg)] text-base" />
            <StatusPill status={PAINT_TYPE_PILL[paint.type] ?? "neutral"}>
              {paint.type}
            </StatusPill>
          </span>
          <span className="grow" />
          <span
            className="inline-flex items-center gap-2"
            title={`Hex confidence: ${paint.hexConfidence.toLowerCase()} — how sure we are this hex matches the real paint (source: ${paint.hexSource})`}
          >
            <HexConfidenceDot
              confidence={paint.hexConfidence}
              source={paint.hexSource}
            />
            <span
              className="text-2xs font-mono text-[var(--color-fg-muted)] uppercase"
            >
              {paint.hexConfidence} CONFIDENCE
            </span>
          </span>
        </section>

        <section>
          <h3 className="section-title">Hex</h3>
          <div className="flex items-center gap-2">
            <code className="font-mono text-base text-[var(--color-fg)]">{paint.hex}</code>
            <button
              type="button"
              onClick={copyHex}
              aria-label={`Copy hex code ${paint.hex}`}
              className="tap-target inline-flex items-center text-xs font-mono px-2 py-1 frame hover:bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)]"
            >
              {copied ? "✓ copied" : "copy"}
            </button>
          </div>
        </section>

        <section>
          <h3 className="section-title">Inventory</h3>
          <InventoryControls paintId={paint.id} initial={inventory} variant="full" />
        </section>

        <section>
          <h3 className="section-title">Harmonies</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label
                htmlFor="paint-harmony-scheme"
                className="text-2xs font-mono uppercase tracking-wider text-[var(--color-fg-muted)]"
              >
                Scheme
              </label>
              <select
                id="paint-harmony-scheme"
                value={harmonyKey}
                onChange={(e) => {
                  setHarmonyKey(e.target.value as ColorPickerHarmony);
                  setSelectedHarmonyHex(null);
                }}
                className="font-mono text-xs bg-[var(--color-bg)] px-2 py-1 frame"
              >
                {COLOR_PICKER_HARMONY_LABELS.map((h) => (
                  <option key={h.key} value={h.key}>
                    {h.label}
                  </option>
                ))}
              </select>
            </div>
            <div
              className="flex gap-1 flex-wrap"
              role="listbox"
              aria-label={`${harmonyKey} swatches`}
            >
              {harmonySwatches.map((hex) => {
                const active = selectedHarmonyHex === hex;
                return (
                  <button
                    key={hex}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() =>
                      setSelectedHarmonyHex(active ? null : hex)
                    }
                    className="tap-target h-8 flex-1 min-w-[32px] rounded-sm transition-transform hover:scale-105 cursor-pointer"
                    style={{
                      background: hex,
                      border: active
                        ? "2px solid var(--color-cyan)"
                        : "1px solid var(--color-border-strong)",
                    }}
                    title={hex}
                    aria-label={`Harmony swatch ${hex}`}
                  />
                );
              })}
            </div>
            {selectedHarmonyHex && harmonyPaintMatches.length > 0 ? (
              <div
                className="mt-1 space-y-0.5 max-h-40 overflow-y-auto"
                aria-label="Library paints matching the selected harmony swatch"
              >
                <p className="text-2xs font-mono text-[var(--color-fg-subtle)] uppercase tracking-wider">
                  Library matches for {selectedHarmonyHex}
                </p>
                {harmonyPaintMatches.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-2 px-2 py-1 frame"
                  >
                    <span
                      aria-hidden
                      className="h-3 w-3 rounded-sm shrink-0"
                      style={{
                        background: p.hex,
                        border: "1px solid var(--color-border-strong)",
                      }}
                    />
                    <span className="text-2xs font-mono text-[var(--color-fg-muted)] truncate">
                      {p.brand}
                    </span>
                    <span className="text-2xs font-mono text-[var(--color-fg)] truncate">
                      {p.name}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
            {selectedHarmonyHex && harmonyPaintMatches.length === 0 ? (
              <p className="text-2xs font-mono text-[var(--color-fg-muted)]">
                No library paints in that hue band.
              </p>
            ) : null}
          </div>
        </section>

        {similarInOtherBrands.length > 0 ? (
          <section>
            <h3 className="section-title">Similar in other brands</h3>
            <div className="flex flex-col gap-1">
              {similarInOtherBrands.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-2 px-2 py-1 frame"
                >
                  <span
                    className="h-4 w-4 rounded-sm border border-[var(--color-border)] shrink-0"
                    style={{ background: s.hex }}
                  />
                  <span className="text-xs font-mono text-[var(--color-fg-muted)] truncate">
                    {s.brand}
                  </span>
                  <span className="text-xs font-mono text-[var(--color-fg)] truncate">
                    {s.name}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section>
          <h3 className="section-title">Source</h3>
          <a
            href={paint.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-mono text-[var(--color-cyan)] hover:underline break-all"
          >
            {paint.sourceUrl}
          </a>
        </section>
      </div>
    </aside>
  );
}

/**
 * Generate eight harmony swatches by rotating around the HSL hue wheel.
 * Returns CSS `hsl()` strings so they can render without any colour lib.
 */
function buildHarmonies(hex: string): string[] {
  const rgb = _internal.parseHex(hex);
  if (!rgb) return [];
  const [r, g, b] = rgb;
  const hsl = rgbToHsl(r, g, b);
  if (!hsl) return [];
  const [h, s, l] = hsl;
  const out: string[] = [];
  for (let i = 0; i < 8; i++) {
    const hue = (h + i * 45) % 360;
    out.push(`hsl(${hue.toFixed(1)} ${(s * 100).toFixed(0)}% ${(l * 100).toFixed(0)}%)`);
  }
  return out;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] | null {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return [h, s, l];
}
