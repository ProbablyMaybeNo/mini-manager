"use client";

import { useState } from "react";
import { Button, HexField, Panel, Swatch } from "@/components/kit";
import { ramp } from "@/lib/color";
import type { Paint } from "@/lib/types";

/** Base + shadow + highlight → interpolated ramp with the closest paint named per step. */
export function LayeringTool({
  closestPaint,
  onSavePalette,
  onSendToRecipe,
}: {
  closestPaint: (hex: string) => Paint | null;
  onSavePalette: (hexes: string[]) => void;
  onSendToRecipe: (paints: Paint[]) => void;
}) {
  const [shadow, setShadow] = useState("#13243a");
  const [base, setBase] = useState("#3a6ea5");
  const [highlight, setHighlight] = useState("#9fc6ee");
  const [steps, setSteps] = useState(5);

  const valid = [shadow, base, highlight].every((h) => /^#[0-9a-fA-F]{6}$/.test(h));
  const lowerN = Math.ceil(steps / 2);
  const upperN = steps - lowerN + 1;
  const ladder = valid
    ? [...ramp(shadow, base, lowerN), ...ramp(base, highlight, upperN).slice(1)]
    : [];

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <Panel label="STACK" className="flex flex-col gap-3 p-5">
        <HexField label="Shadow" name="shadow" value={shadow} onChange={(e) => setShadow(e.target.value)} />
        <HexField label="Base" name="base" value={base} onChange={(e) => setBase(e.target.value)} />
        <HexField label="Highlight" name="highlight" value={highlight} onChange={(e) => setHighlight(e.target.value)} />
        <label>
          <span className="font-osd text-[10px] uppercase tracking-[0.18em] text-fg-dim">
            Steps {steps}
          </span>
          <input
            type="range"
            min={3}
            max={9}
            value={steps}
            onChange={(e) => setSteps(Number(e.target.value))}
            aria-label="Step count"
            className="mt-1 w-full accent-cyan"
          />
        </label>
      </Panel>

      <Panel label="RAMP" cornerTicks className="flex flex-col gap-4 p-5">
        {!valid ? (
          <p className="py-8 text-center font-mono text-xs text-fg-faint">
            Enter valid shadow / base / highlight hexes.
          </p>
        ) : (
          <>
            <div className="flex gap-1">
              {ladder.map((hex, i) => (
                <div key={i} className="h-12 flex-1" style={{ backgroundColor: hex }} />
              ))}
            </div>
            <ol className="flex flex-col gap-1.5">
              {ladder.map((hex, i) => {
                const paint = closestPaint(hex);
                return (
                  <li key={i} className="flex items-center gap-3 border border-cyan/20 p-2">
                    <span className="w-6 font-osd text-[10px] text-fg-faint">{i + 1}</span>
                    <Swatch hex={hex} />
                    <span aria-hidden className="font-osd text-fg-faint">→</span>
                    {paint ? (
                      <>
                        <Swatch hex={paint.hex} />
                        <span className="flex-1 truncate font-mono text-xs text-fg">
                          {paint.name} · {paint.brand}
                        </span>
                      </>
                    ) : (
                      <span className="flex-1 font-mono text-xs text-fg-faint">No match</span>
                    )}
                  </li>
                );
              })}
            </ol>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => onSavePalette(ladder)}>Save Palette</Button>
              <Button
                variant="secondary"
                onClick={() =>
                  onSendToRecipe(ladder.map(closestPaint).filter((p): p is Paint => p != null))
                }
              >
                Send to Recipe
              </Button>
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}
