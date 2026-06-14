"use client";

import { useState } from "react";
import { Button, Panel, Swatch } from "@/components/kit";
import { harmonies, HARMONY_SCHEMES, hslToHex, type HarmonyScheme } from "@/lib/color";
import type { Paint } from "@/lib/types";

/** Pick a hue + harmony → closest library paint per swatch. Inputs out, results in. */
export function ColourWheelTool({
  closestPaint,
  onSavePalette,
  onSendToRecipe,
}: {
  closestPaint: (hex: string) => Paint | null;
  onSavePalette: (hexes: string[]) => void;
  onSendToRecipe: (paints: Paint[]) => void;
}) {
  const [hue, setHue] = useState(200);
  const [scheme, setScheme] = useState<HarmonyScheme>("Complementary");

  const base = hslToHex(hue, 70, 50);
  const swatches = harmonies(base, scheme);
  const picks = swatches.map((hex) => ({ hex, paint: closestPaint(hex) }));

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <Panel label="PICK" className="flex flex-col items-center gap-4 p-5">
        <div
          className="h-40 w-40 rounded-full border border-cyan/40"
          style={{ background: "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)" }}
        >
          <div
            className="relative h-full w-full rounded-full"
            style={{ background: "radial-gradient(circle, #06080a 18%, transparent 60%)" }}
          />
        </div>
        <label className="w-full">
          <span className="font-osd text-[10px] uppercase tracking-[0.18em] text-fg-dim">
            Hue {Math.round(hue)}°
          </span>
          <input
            type="range"
            min={0}
            max={360}
            value={hue}
            onChange={(e) => setHue(Number(e.target.value))}
            aria-label="Hue"
            className="mt-1 w-full accent-cyan"
          />
        </label>
        <label className="w-full">
          <span className="font-osd text-[10px] uppercase tracking-[0.18em] text-fg-dim">
            Harmony
          </span>
          <select
            value={scheme}
            onChange={(e) => setScheme(e.target.value as HarmonyScheme)}
            className="mt-1 w-full border border-cyan/50 bg-bg px-2 py-1 font-mono text-xs text-fg focus:border-cyan focus:outline-none"
          >
            {HARMONY_SCHEMES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </Panel>

      <Panel label="CLOSEST PAINTS" cornerTicks className="flex flex-col gap-4 p-5">
        <div className="flex flex-col gap-2">
          {picks.map(({ hex, paint }, i) => (
            <div key={i} className="flex items-center gap-3 border border-cyan/20 p-2">
              <Swatch hex={hex} size="lg" />
              <span aria-hidden className="font-osd text-fg-faint">
                →
              </span>
              {paint ? (
                <>
                  <Swatch hex={paint.hex} size="lg" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono text-sm text-fg">{paint.name}</div>
                    <div className="font-osd text-[10px] uppercase tracking-[0.15em] text-fg-faint">
                      {paint.brand}
                    </div>
                  </div>
                </>
              ) : (
                <span className="font-mono text-xs text-fg-faint">No match</span>
              )}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => onSavePalette(swatches)}>Save Palette</Button>
          <Button
            variant="secondary"
            onClick={() => onSendToRecipe(picks.map((p) => p.paint).filter((p): p is Paint => p != null))}
          >
            Send to Recipe
          </Button>
        </div>
      </Panel>
    </div>
  );
}
