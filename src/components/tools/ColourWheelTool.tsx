"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Panel, Swatch } from "@/components/kit";
import { cn } from "@/lib/cn";
import {
  buildHarmony,
  getHarmonyMeta,
  harmonyKeys,
  hexToHsl,
  hslToHex,
  type HarmonyKey,
} from "@/lib/tools/wheel/harmonies";
import { captionScrim, readableText } from "@/lib/color";
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
  rankPaints,
  onSavePalette,
  onSendToRecipe,
  onGenerateRecipe,
  onAssignPaint,
  seedHex,
}: {
  closestPaint: (hex: string) => Paint | null;
  /** DOP-013 — ranked alternative paints for a harmony swatch (CIEDE2000),
   *  beyond the single closest. Fills the right panel's lower void with the
   *  "more matches" each pick has across brands. When omitted, only the single
   *  closest paint is shown (back-compat). */
  rankPaints?: (hex: string, n: number) => Paint[];
  onSavePalette: (hexes: string[]) => void;
  onSendToRecipe: (paints: Paint[]) => void;
  /** Generate a full layered recipe from the current harmony palette — the
   *  colour-first path (buildLayerRamp → ground → save). Omit to hide. */
  onGenerateRecipe?: (hexes: string[]) => void;
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
  // DOP-013 — which harmony hexes have their "more matches" alternates expanded.
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

  function toggleExpanded(hex: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(hex)) next.delete(hex);
      else next.add(hex);
      return next;
    });
  }

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
      <Panel label="PICK" className="flex min-w-0 flex-col items-center gap-4 p-5">
        {/* Constrain the wheel to the column width on mobile so it never
            forces horizontal overflow (UX-002). The canvas keeps its 300px
            intrinsic size but scales down via max-w-full inside this box. */}
        <div className="relative aspect-square w-[min(100%,320px)] border border-cyan/30 p-2">
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
          <span className="label-osd text-fg">
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
                  <span className="flex-1 truncate font-body text-body text-fg">{meta.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </Panel>

      <Panel label="HARMONY · CLOSEST PAINTS" cornerTicks className="flex min-w-0 flex-col gap-4 p-5">
        <div className="flex flex-col gap-2">
          {picks.map(({ hex, paint }, i) => {
            const isPinned = pinned.has(hex);
            // DOP-013 — alternates = the next-closest paints after the primary
            // match, so each harmony swatch offers a few real substitutes
            // (different brands / shades) instead of one lonely row.
            const isExpanded = expanded.has(hex);
            const alternates = rankPaints
              ? rankPaints(hex, 5).filter((p) => p.id !== paint?.id).slice(0, 4)
              : [];
            return (
              <div className="flex flex-col gap-2 border border-cyan/20 p-2" key={i}>
              <div className="flex flex-wrap items-center gap-3 gap-y-2">
                <button
                  type="button"
                  aria-pressed={isPinned}
                  aria-label={isPinned ? `Unpin ${hex}` : `Pin ${hex}`}
                  onClick={() => togglePin(hex)}
                  className={cn(
                    // min-h-11 min-w-11 → 44px target for the dense pin toggle
                    // (was 13x24, under the WCAG 2.2 §2.5.8 floor) — UX-009.
                    "inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center transition-colors",
                    isPinned ? "text-yellow" : "text-fg-faint hover:text-yellow",
                  )}
                >
                  {isPinned ? "★" : "☆"}
                </button>
                <span
                  className="inline-flex h-10 min-w-[88px] items-center justify-center border border-fg/20 px-2 font-body text-body font-bold"
                  style={{
                    backgroundColor: hex,
                    color: readableText(hex),
                    // AA scrim — keeps the caption ≥4.5:1 on saturated mid-tone
                    // reds where pure white/black text alone dips under (MUX-009).
                    textShadow: captionScrim(hex),
                  }}
                  title={hex}
                >
                  {hex}
                </span>
                <span aria-hidden className="font-osd text-fg-faint">→</span>
                {/* Paint identity stays one unit with a min width, so the Assign
                    button reflows onto its own line at ≤390px instead of
                    overlapping the brand label (UX-003). */}
                <div className="flex min-w-[8rem] flex-1 items-center gap-3">
                  {paint ? (
                    <>
                      <Swatch hex={paint.hex} size="lg" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-body text-body text-fg">{paint.name}</div>
                        <div className="truncate label-osd text-fg">
                          {paint.brand}
                        </div>
                      </div>
                    </>
                  ) : (
                    <span className="font-body text-body text-fg">No match</span>
                  )}
                </div>
                {onAssignPaint && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="ml-auto shrink-0"
                    onClick={() => onAssignPaint(hex)}
                  >
                    Assign
                  </Button>
                )}
              </div>

              {/* DOP-013 — "more matches": a disclosure of the next-closest
                  paints for this harmony swatch, filling the right panel's
                  lower void with real substitutes rather than dead space. */}
              {alternates.length > 0 && (
                <div className="flex flex-col gap-1.5 border-t border-cyan/10 pt-2">
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    onClick={() => toggleExpanded(hex)}
                    className="flex min-h-11 items-center gap-1 self-start label-osd text-fg-faint hover:text-cyan-lite md:min-h-6"
                  >
                    <span aria-hidden className={cn("transition-transform", isExpanded && "rotate-90")}>
                      ▸
                    </span>
                    {isExpanded ? "Fewer matches" : `Matches (${alternates.length})`}
                  </button>
                  {isExpanded && (
                    <ul className="flex flex-wrap gap-2">
                      {alternates.map((alt) => (
                        <li key={alt.id}>
                          <button
                            type="button"
                            onClick={onAssignPaint ? () => onAssignPaint(alt.hex) : undefined}
                            disabled={!onAssignPaint}
                            title={`${alt.brand} ${alt.name} · ${alt.hex}`}
                            className={cn(
                              "flex items-center gap-2 border border-cyan/20 p-1.5 text-left",
                              onAssignPaint
                                ? "hover:border-cyan/60 hover:bg-cyan/5"
                                : "cursor-default",
                            )}
                          >
                            <Swatch hex={alt.hex} size="md" />
                            <span className="min-w-0">
                              <span className="block max-w-[10rem] truncate font-body text-body text-fg">
                                {alt.name}
                              </span>
                              <span className="block truncate label-osd text-fg-faint">
                                {alt.brand}
                              </span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Save Palette = +COLOR SCHEME → neon green; Send to Recipe = +RECIPE
              → pastel purple attach (9lgIwII2oBy7 / CiBUwVgwwQRD). DePixel Klein
              font kept (ruling #1). */}
          {/* Generate Recipe is the single primary action; Save Palette + Send
              to Recipe demote to outline so there's one clear CTA (UX-004). */}
          {onGenerateRecipe && (
            <Button variant="primary" onClick={() => onGenerateRecipe(ordered)}>
              Generate Recipe
            </Button>
          )}
          <Button variant="secondary" onClick={() => onSavePalette(ordered)}>Save Palette</Button>
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
      <span className="label-osd text-fg">
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
