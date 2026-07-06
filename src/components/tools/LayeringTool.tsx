"use client";

import { useState } from "react";
import { Button, CloseButton, HexField, Panel, Swatch } from "@/components/kit";
import { readableText } from "@/lib/color";
import { buildRamp, MAX_STEPS, MIN_STEPS } from "@/lib/tools/gradient/interpolate";
import { mixLayers, DEFAULT_SUBSTRATE, type GlazeLayer } from "@/lib/tools/layering/opticalMix";
import type { Paint } from "@/lib/types";
import type { ColorPickerSelection } from "@/lib/colorPicker/types";
import { ColorPickerPanel } from "./ColorPickerPanel";
import { GlazeVenn } from "./GlazeVenn";

const HEX6 = /^#[0-9a-fA-F]{6}$/;

/**
 * Color Stacking + Layering (MM-35). Two sections:
 *  - LAYERING: a perceptual Lab-space ramp (shadow → base → highlight) with
 *    per-step hex labels + closest library paint, per-lane colour-picker.
 *  - STACKING: transparent glaze layers stacked over a substrate, predicting
 *    the painted-result hex (optical mix). A distinct section alongside the
 *    layering ramp, per the Vercel thread.
 * Ported from old `components/tools/gradient/*` + `lib/tools/layering`.
 */
export function LayeringTool({
  closestPaint,
  onSavePalette,
  onSendToRecipe,
}: {
  closestPaint: (hex: string) => Paint | null;
  onSavePalette: (hexes: string[]) => void;
  onSendToRecipe: (paints: Paint[]) => void;
}) {
  /* ---------- Layering (Lab ramp) ---------- */
  const [shadow, setShadow] = useState("#13243a");
  const [base, setBase] = useState("#3a6ea5");
  const [highlight, setHighlight] = useState("#9fc6ee");
  const [steps, setSteps] = useState(5);
  // Per-lane colour picker — which lane the shared ColorPicker is editing.
  const [pickingLane, setPickingLane] = useState<"shadow" | "base" | "highlight" | null>(null);
  // Per-stacking-target colour picker — the substrate or a glaze-layer index.
  const [pickingStack, setPickingStack] = useState<number | "substrate" | null>(null);

  const valid = [shadow, base, highlight].every((h) => HEX6.test(h));
  const ladder = valid ? buildRamp({ shadow, base, highlight, steps }) : [];

  const laneHex =
    pickingLane === "shadow"
      ? shadow
      : pickingLane === "base"
        ? base
        : pickingLane === "highlight"
          ? highlight
          : null;

  function applyLane(sel: ColorPickerSelection) {
    const hex = sel.hex.toUpperCase();
    if (pickingLane === "shadow") setShadow(hex);
    else if (pickingLane === "base") setBase(hex);
    else if (pickingLane === "highlight") setHighlight(hex);
  }

  /* ---------- Stacking (optical glaze mix) ---------- */
  const [substrate, setSubstrate] = useState(DEFAULT_SUBSTRATE);
  const [layers, setLayers] = useState<GlazeLayer[]>([
    { hex: "#8a1f1f", alpha: 0.4 },
    { hex: "#c01010", alpha: 0.85 },
  ]);
  const stackResult = mixLayers(layers, substrate);

  const stackHex =
    pickingStack === "substrate"
      ? substrate
      : typeof pickingStack === "number"
        ? (layers[pickingStack]?.hex ?? null)
        : null;

  function applyStack(sel: ColorPickerSelection) {
    const hex = sel.hex.toUpperCase();
    if (pickingStack === "substrate") setSubstrate(hex);
    else if (typeof pickingStack === "number") {
      const idx = pickingStack;
      setLayers((p) => p.map((l, k) => (k === idx ? { ...l, hex } : l)));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ===================== LAYERING ===================== */}
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Panel label="LAYERING" className="flex flex-col gap-3 p-5">
          <p className="font-body text-body text-fg">
            Perceptual Lab-space ramp — even transitions across the eye.
          </p>
          <LaneField label="Shadow" value={shadow} onChange={setShadow} onPick={() => setPickingLane("shadow")} />
          <LaneField label="Base" value={base} onChange={setBase} onPick={() => setPickingLane("base")} />
          <LaneField label="Highlight" value={highlight} onChange={setHighlight} onPick={() => setPickingLane("highlight")} />
          <label>
            <span className="label-osd text-fg">Steps {steps}</span>
            <input
              type="range"
              min={MIN_STEPS}
              max={MAX_STEPS}
              value={steps}
              onChange={(e) => setSteps(Number(e.target.value))}
              aria-label="Step count"
              className="mt-1 w-full accent-cyan"
            />
          </label>
        </Panel>

        <Panel label="RAMP" cornerTicks className="flex flex-col gap-4 p-5">
          {!valid ? (
            <p className="py-8 text-center font-body text-body text-fg">
              Enter valid shadow / base / highlight hexes.
            </p>
          ) : (
            <>
              {/* Ramp bar with per-segment hex labels in legible black/white. */}
              <div className="flex gap-1">
                {ladder.map((hex, i) => (
                  <div
                    key={i}
                    className="flex h-14 flex-1 items-center justify-center"
                    style={{ backgroundColor: hex, color: readableText(hex) }}
                  >
                    <span className="font-body text-body">{hex}</span>
                  </div>
                ))}
              </div>
              <ol className="flex flex-col gap-1.5">
                {ladder.map((hex, i) => {
                  const paint = closestPaint(hex);
                  return (
                    <li key={i} className="flex items-center gap-3 border border-cyan/20 p-2">
                      <span className="w-6 font-num2 text-num2 text-fg">{i + 1}</span>
                      <Swatch hex={hex} />
                      <span aria-hidden className="font-osd text-fg-faint">→</span>
                      {paint ? (
                        <>
                          <Swatch hex={paint.hex} />
                          <span className="flex-1 truncate font-body text-body text-fg">
                            {paint.name} · {paint.brand}
                          </span>
                        </>
                      ) : (
                        <span className="flex-1 font-body text-body text-fg">No match</span>
                      )}
                    </li>
                  );
                })}
              </ol>
              <div className="flex flex-wrap gap-2">
                {/* +COLOR SCHEME → neon green; +RECIPE → pastel purple (CiBUwVgwwQRD). */}
                <Button variant="add" onClick={() => onSavePalette(ladder)}>Save Palette</Button>
                <Button
                  variant="attach"
                  onClick={() => onSendToRecipe(ladder.map(closestPaint).filter((p): p is Paint => p != null))}
                >
                  Send to Recipe
                </Button>
              </div>
            </>
          )}
        </Panel>
      </div>

      {/* ===================== STACKING ===================== */}
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Panel label="STACKING" accent="purple" className="flex flex-col gap-3 p-5">
          <p className="font-body text-body text-fg">
            Stack transparent glaze layers over an undercoat to predict the
            painted result (optical mix, bottom → top).
          </p>
          <HexField
            label="Undercoat"
            name="substrate"
            value={substrate}
            onChange={(e) => setSubstrate(e.target.value)}
            onSwatchClick={() => setPickingStack("substrate")}
            swatchLabel="Pick undercoat colour"
          />
          {layers.map((layer, i) => (
            <div key={i} className="flex flex-col gap-2 border border-purple/20 p-2">
              <div className="flex items-center justify-between">
                <span className="label-osd text-fg">
                  Layer {i + 1}
                </span>
                <CloseButton
                  tone="destructive"
                  aria-label={`Remove layer ${i + 1}`}
                  onClick={() => setLayers((p) => p.filter((_, k) => k !== i))}
                />
              </div>
              <HexField
                name={`layer-${i}`}
                value={layer.hex}
                onChange={(e) =>
                  setLayers((p) => p.map((l, k) => (k === i ? { ...l, hex: e.target.value } : l)))
                }
                onSwatchClick={() => setPickingStack(i)}
                swatchLabel={`Pick layer ${i + 1} colour`}
              />
              <label>
                <span className="label-osd text-fg">
                  Opacity {Math.round(layer.alpha * 100)}%
                </span>
                <input
                  type="range"
                  min={5}
                  max={100}
                  value={Math.round(layer.alpha * 100)}
                  onChange={(e) =>
                    setLayers((p) =>
                      p.map((l, k) => (k === i ? { ...l, alpha: Number(e.target.value) / 100 } : l)),
                    )
                  }
                  aria-label={`Layer ${i + 1} opacity`}
                  className="mt-1 w-full accent-purple"
                />
              </label>
            </div>
          ))}
          <Button
            variant="add"
            disabled={layers.length >= 6}
            onClick={() => setLayers((p) => [...p, { hex: "#ffffff", alpha: 0.5 }])}
          >
            + Add layer
          </Button>
        </Panel>

        <Panel label="PREDICTED RESULT" cornerTicks accent="purple" className="flex flex-col gap-4 p-5">
          <div
            className="flex h-28 items-center justify-center border border-fg/20"
            style={{
              backgroundColor: HEX6.test(stackResult) ? stackResult : "transparent",
              color: readableText(stackResult),
            }}
          >
            <span className="font-body text-body">{stackResult.toUpperCase()}</span>
          </div>
          {(() => {
            const paint = closestPaint(stackResult);
            return paint ? (
              <div className="flex items-center gap-3 border border-purple/20 p-2">
                <Swatch hex={paint.hex} size="lg" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-body text-body text-fg">{paint.name}</div>
                  <div className="label-osd text-fg">
                    {paint.brand}
                  </div>
                </div>
              </div>
            ) : (
              <span className="font-body text-body text-fg">No close paint match.</span>
            );
          })()}
          {layers.length >= 2 && (
            <div className="flex flex-col gap-1 border-t border-purple/20 pt-3">
              <span className="label-osd text-fg">
                Optical mix — undercoat ∩ top glaze
              </span>
              <GlazeVenn
                undercoat={{ ...layers[0]!, label: "UNDERCOAT" }}
                top={{ ...layers[1]!, label: "TOP GLAZE" }}
                substrate={substrate}
                onPick={(_region, hex) => onSavePalette([hex.toUpperCase()])}
              />
              <span className="text-center font-body text-body text-fg">
                Click a region to save its colour.
              </span>
            </div>
          )}
          <Button variant="secondary" onClick={() => onSavePalette([stackResult.toUpperCase()])}>
            Save result
          </Button>
        </Panel>
      </div>

      {/* Per-lane shared ColorPicker for the layering lanes. */}
      <ColorPickerPanel
        open={pickingLane != null}
        onClose={() => setPickingLane(null)}
        title="Pick a colour"
        breadcrumb="LAYERING ▸ COLOR PICKER"
        contextLabel={pickingLane ?? undefined}
        initialHex={laneHex}
        pickerKey={pickingLane ? `lane:${pickingLane}` : null}
        closeOnSelect
        onSelect={applyLane}
      />

      {/* Shared ColorPicker for the stacking substrate + glaze layers. */}
      <ColorPickerPanel
        open={pickingStack != null}
        onClose={() => setPickingStack(null)}
        title="Pick a colour"
        breadcrumb="STACKING ▸ COLOR PICKER"
        contextLabel={
          pickingStack === "substrate"
            ? "undercoat"
            : typeof pickingStack === "number"
              ? `layer ${pickingStack + 1}`
              : undefined
        }
        initialHex={stackHex}
        pickerKey={pickingStack != null ? `stack:${pickingStack}` : null}
        closeOnSelect
        onSelect={applyStack}
      />
    </div>
  );
}

function LaneField({
  label,
  value,
  onChange,
  onPick,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
  onPick: () => void;
}) {
  return (
    <HexField
      label={label}
      name={label.toLowerCase()}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onSwatchClick={onPick}
      swatchLabel={`Pick ${label} colour`}
    />
  );
}
