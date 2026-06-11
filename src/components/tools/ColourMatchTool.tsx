"use client";

import { useState } from "react";
import { Button, HexField, Panel, Swatch } from "@/components/kit";
import type { MatchResult, Paint } from "@/lib/types";

/** Hex in → ranked closest paints across brands (host-provided), with brand filter. */
export function ColourMatchTool({
  rankMatches,
  brandOptions,
  onUse,
  onAssign,
}: {
  rankMatches: (hex: string, brand?: string) => MatchResult[];
  brandOptions: string[];
  onUse: (paint: Paint) => void;
  onAssign: (paint: Paint) => void;
}) {
  const [hex, setHex] = useState("#3a6ea5");
  const [brand, setBrand] = useState("");

  const valid = /^#[0-9a-fA-F]{6}$/.test(hex);
  const results = valid ? rankMatches(hex, brand || undefined) : [];
  const maxD = results.length ? Math.max(...results.map((r) => r.distanceScore), 1) : 1;

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <Panel label="INPUT" className="flex flex-col gap-4 p-5">
        <HexField label="Target hex" name="match-hex" value={hex} onChange={(e) => setHex(e.target.value)} />
        <div
          className="h-24 w-full border border-fg/20"
          style={{ backgroundColor: valid ? hex : "transparent" }}
        />
        <label>
          <span className="font-osd text-[10px] uppercase tracking-[0.18em] text-fg-dim">
            Brand filter
          </span>
          <select
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            className="mt-1 w-full border border-cyan/50 bg-bg px-2 py-1 font-mono text-xs text-fg focus:border-cyan focus:outline-none"
          >
            <option value="">All brands</option>
            {brandOptions.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>
      </Panel>

      <Panel label="RANKED MATCHES" cornerTicks className="flex flex-col gap-2 p-5">
        {!valid ? (
          <p className="py-8 text-center font-mono text-xs text-fg-faint">
            Enter a valid 6-digit hex to see matches.
          </p>
        ) : (
          results.map((r) => (
            <div key={r.paint.id} className="flex items-center gap-3 border border-cyan/20 p-2">
              <Swatch hex={r.paint.hex} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-mono text-sm text-fg">{r.paint.name}</div>
                <div className="font-osd text-[10px] uppercase tracking-[0.15em] text-fg-faint">
                  {r.paint.brand}
                </div>
                <div className="mt-1 h-1 w-full bg-bg-raised">
                  <div
                    className="h-full bg-cyan"
                    style={{ width: `${100 - (r.distanceScore / maxD) * 100}%` }}
                  />
                </div>
              </div>
              <span className="font-mono text-[11px] tabular-nums text-fg-faint">
                Δ{r.distanceScore.toFixed(1)}
              </span>
              <Button size="sm" onClick={() => onUse(r.paint)}>
                Use
              </Button>
              <Button size="sm" variant="secondary" onClick={() => onAssign(r.paint)}>
                Assign
              </Button>
            </div>
          ))
        )}
      </Panel>
    </div>
  );
}
