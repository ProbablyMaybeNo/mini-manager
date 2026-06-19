"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Panel, Swatch } from "@/components/kit";
import {
  buildHarmony,
  getHarmonyMeta,
  harmonyKeys,
  hexToHsl,
  hslToHex,
  type HarmonyKey,
} from "@/lib/tools/wheel/harmonies";
import { readableText } from "@/lib/color";
import type { Paint } from "@/lib/types";
import { WheelCanvas, type WheelStop } from "./WheelCanvas";

/** Hue offset for a harmony's derived swatch at index i — kept aligned with
 *  the pure generators in lib/tools/wheel/harmonies.ts so the canvas stops
 *  sit under their swatches. */
function offsetForIndex(harmony: HarmonyKey, i: number): number {
  if (i === 0) return 0;
  switch (harmony) {
    case "complementary":
      return [0, 180][i] ?? 0;
    case "analogous":
      return [0, -30, 30][i] ?? 0;
    case "triadic":
      return [0, 120, 240][i] ?? 0;
    case "tetradic":
      return [0, 60, 180, 240][i] ?? 0;
    case "splitComplementary":
      return [0, 150, 210][i] ?? 0;
    case "square":
      return [0, 90, 180, 270][i] ?? 0;
    case "monochromatic":
      return 0;
    case "accentedAnalogous":
      return [0, -30, 30, 180][i] ?? 0;
  }
}

/**
 * Color Wheel (MM-53 / MM-29). Draggable HSL wheel, hue / saturation /
 * lightness sliders, ★pin system, the eight harmonies with live preview
 * strips, per-swatch "assign paint", and `?hex` / `?name` deep-link seeding.
 * Ported from the old `components/tools/wheel/*` into the terminal UI.
 */
export function ColourWheelTool({
  closestPaint,
  onSavePalette,
  onSendToRecipe,
  onAssignPaint,
  seedHex,
}: {
  closestPaint: (hex: string) => Paint | null;
  onSavePalette: (hexes: string[]) => void;
  onSendToRecipe: (paints: Paint[]) => void;
  /** Opens the shared ColorPicker to assign a real paint to a planned swatch. */
  onAssignPaint?: (hex: string) => void;
  /** Deep-link seed (`?hex`/resolved `?name`) — sets the primary pick. */
  seedHex?: string | null;
}) {
  const [hue, setHue] = useState(0);
  const [sat, setSat] = useState(90);
  const [light, setLight] = useState(50);
  const [harmony, setHarmony] = useState<HarmonyKey>("complementary");
  const [pinned, setPinned] = useState<ReadonlySet<string>>(new Set());

  // Seed the primary pick once from a deep-link hex.
  useEffect(() => {
    if (!seedHex) return;
    const hsl = hexToHsl(seedHex);
    if (hsl) {
      setHue(hsl.h);
      setSat(hsl.s);
      setLight(Math.round(hsl.l));
    }
  }, [seedHex]);

  const swatches = useMemo(
    () => buildHarmony(harmony, hue, sat, light),
    [harmony, hue, sat, light],
  );

  const stops: WheelStop[] = useMemo(
    () =>
      swatches.map((_, i) => ({
        id: i === 0 ? "p" : `d-${i}`,
        hue: hue + offsetForIndex(harmony, i),
        saturation: sat,
        isPrimary: i === 0,
      })),
    [swatches, harmony, hue, sat],
  );

  const picks = swatches.map((hex) => ({ hex, paint: closestPaint(hex) }));

  // Pinned swatches lead the saved/sent palette so curated picks come first.
  const ordered = useMemo(() => {
    if (pinned.size === 0) return swatches;
    return [...swatches].sort(
      (a, b) => (pinned.has(a) ? 0 : 1) - (pinned.has(b) ? 0 : 1),
    );
  }, [swatches, pinned]);

  function togglePin(hex: string) {
    setPinned((prev) => {
      const next = new Set(prev);
      if (next.has(hex)) next.delete(hex);
      else next.add(hex);
      return next;
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <Panel label="PICK" className="flex flex-col items-center gap-4 p-5">
        <div className="relative border border-cyan/30 p-2">
          <WheelCanvas
            size={300}
            lightness={light}
            stops={stops}
            activeId="p"
            onPrimaryChange={({ hue: h, saturation: s }) => {
              setHue(h);
              setSat(s);
            }}
          />
        </div>

        <Slider label="Hue" value={Math.round(hue)} suffix="°" min={0} max={360} onChange={setHue} />
        <Slider label="Saturation" value={Math.round(sat)} suffix="%" min={0} max={100} onChange={setSat} />
        <Slider label="Lightness" value={light} suffix="%" min={10} max={90} onChange={setLight} />

        <div className="w-full">
          <span className="font-osd text-[12px] uppercase tracking-[0.18em] text-fg-dim">
            Harmony
          </span>
          <div role="radiogroup" aria-label="Harmony" className="mt-1 flex flex-col gap-1">
            {harmonyKeys.map((key) => {
              const meta = getHarmonyMeta(key);
              const preview = buildHarmony(key, hue, sat, light);
              const active = key === harmony;
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setHarmony(key)}
                  className={
                    "flex items-center gap-2 border px-2 py-1 text-left transition-colors " +
                    (active
                      ? "border-cyan bg-cyan/15"
                      : "border-cyan/20 hover:border-cyan/60 hover:bg-cyan/5")
                  }
                >
                  <span aria-hidden className="flex h-5 w-16 shrink-0 overflow-hidden border border-fg/20">
                    {preview.map((hex, i) => (
                      <span key={i} className="flex-1" style={{ backgroundColor: hex }} />
                    ))}
                  </span>
                  <span className="flex-1 truncate font-mono text-xs text-fg">{meta.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </Panel>

      <Panel label="HARMONY · CLOSEST PAINTS" cornerTicks className="flex flex-col gap-4 p-5">
        <div className="flex flex-col gap-2">
          {picks.map(({ hex, paint }, i) => {
            const isPinned = pinned.has(hex);
            return (
              <div key={i} className="flex items-center gap-3 border border-cyan/20 p-2">
                <button
                  type="button"
                  aria-pressed={isPinned}
                  aria-label={isPinned ? `Unpin ${hex}` : `Pin ${hex}`}
                  onClick={() => togglePin(hex)}
                  className={isPinned ? "text-yellow" : "text-fg-faint hover:text-yellow"}
                >
                  {isPinned ? "★" : "☆"}
                </button>
                <span
                  className="inline-flex h-10 min-w-[88px] items-center justify-center border border-fg/20 px-2 font-mono text-[12px]"
                  style={{ backgroundColor: hex, color: readableText(hex) }}
                  title={hex}
                >
                  {hex}
                </span>
                <span aria-hidden className="font-osd text-fg-faint">→</span>
                {paint ? (
                  <>
                    <Swatch hex={paint.hex} size="lg" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-mono text-sm text-fg">{paint.name}</div>
                      <div className="font-osd text-[12px] uppercase tracking-[0.15em] text-fg-faint">
                        {paint.brand}
                      </div>
                    </div>
                  </>
                ) : (
                  <span className="flex-1 font-mono text-xs text-fg-faint">No match</span>
                )}
                {onAssignPaint && (
                  <Button size="sm" variant="secondary" onClick={() => onAssignPaint(hex)}>
                    Assign
                  </Button>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => onSavePalette(ordered)}>Save Palette</Button>
          <Button
            variant="secondary"
            onClick={() =>
              onSendToRecipe(picks.map((p) => p.paint).filter((p): p is Paint => p != null))
            }
          >
            Send to Recipe
          </Button>
        </div>
      </Panel>
    </div>
  );
}

function Slider({
  label,
  value,
  suffix,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  suffix: string;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="w-full">
      <span className="font-osd text-[12px] uppercase tracking-[0.18em] text-fg-dim">
        {label} {value}
        {suffix}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="mt-1 w-full accent-cyan"
      />
    </label>
  );
}

export { hslToHex };
