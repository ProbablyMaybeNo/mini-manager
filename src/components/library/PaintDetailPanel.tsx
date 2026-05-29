"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { clsx } from "clsx";

import type { Paint } from "@/lib/paints/types";
import { TypeIcon } from "./TypeIcon";
import { HexConfidenceDot } from "./HexConfidenceDot";
import { InventoryControls } from "./InventoryControls";
import { _internal } from "@/lib/paints/filters";

/**
 * Right-side slide-in detail panel. Shows the full paint metadata,
 * an 8-swatch harmonies strip (HSL rotation, no extra deps), and a
 * placeholder for cross-brand matches (full ΔE2000 lands in Phase 4).
 */
export function PaintDetailPanel({
  paint,
  similarInOtherBrands,
  inventory,
}: {
  paint: Paint | null;
  similarInOtherBrands: ReadonlyArray<Paint>;
  inventory?: { ownedCount: number; isWishlisted: boolean } | undefined;
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

  const harmonies = useMemo(() => (paint ? buildHarmonies(paint.hex) : []), [paint]);

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
          className="text-sm font-mono px-2 py-1 hover:text-[var(--color-amber)] tap-target"
          aria-label="Close detail panel"
        >
          [ × ]
        </button>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-5">
        <div
          className="h-48 w-full rounded-sm border border-[var(--color-border)]"
          style={{ background: paint.hex }}
          aria-label={`Swatch ${paint.hex}`}
        />

        <section className="flex items-center gap-3">
          <TypeIcon type={paint.type} className="text-[var(--color-fg)] text-base" />
          <span className="text-sm font-mono">{paint.type}</span>
          <span className="grow" />
          <HexConfidenceDot confidence={paint.hexConfidence} source={paint.hexSource} />
          <span className="text-2xs font-mono text-[var(--color-fg-muted)] uppercase">
            {paint.hexConfidence}
          </span>
        </section>

        <section>
          <h3 className="section-title">Hex</h3>
          <div className="flex items-center gap-2">
            <code className="font-mono text-base text-[var(--color-fg)]">{paint.hex}</code>
            <button
              type="button"
              onClick={copyHex}
              className="text-xs font-mono px-2 py-1 frame hover:bg-[color-mix(in_srgb,var(--color-green)_10%,transparent)]"
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
          <div className="flex gap-1">
            {harmonies.map((h, i) => (
              <span
                key={i}
                className="h-8 flex-1 rounded-sm border border-[var(--color-border)]"
                style={{ background: h }}
                title={h}
                aria-label={`Harmony ${i + 1} ${h}`}
              />
            ))}
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
