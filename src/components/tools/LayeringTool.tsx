"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Checkbox, CloseButton, HexField, Panel, SegmentedToggle, Swatch, useToast } from "@/components/kit";
import { readableText } from "@/lib/color";
import { buildRamp, MAX_STEPS, MIN_STEPS } from "@/lib/tools/gradient/interpolate";
import { computeVennFills } from "@/lib/tools/layering/venn";
import { deriveLanesFromSeed, type LaneKey } from "@/lib/tools/layering/deriveLanes";
import { groundLane } from "@/lib/tools/layering/groundLane";
import { closestPaint, rankMatchesMulti, similarInOtherBrands } from "@/lib/toolMatch";
import { loadOwnedPaintIds } from "@/lib/actions/inventory";
import { AssignPaintMenu, type AssignedResult } from "@/components/recipe/AssignPaintMenu";
import type { Paint, ToolSwatch } from "@/lib/types";
import type { ColorPickerSelection } from "@/lib/colorPicker/types";
import { useCatalog } from "@/app/(app)/tools/useCatalog";
import { ColorPickerPanel } from "./ColorPickerPanel";
import { GlazeVenn, type VennLayer } from "./GlazeVenn";

const HEX6 = /^#[0-9a-fA-F]{6}$/;
const MAX_LAYERS = 6;
/** MATCH button alternatives — "a handful" per lane (Ross's spec). */
const LANE_ALT_COUNT = 4;

const LANE_SEED_OPTIONS: { value: LaneKey; label: string }[] = [
  { value: "shadow", label: "Shadow" },
  { value: "base", label: "Base" },
  { value: "highlight", label: "Highlight" },
];

/** Other-brand-ranked alternatives for a lane's grounded paint. With a brand
 *  filter active, ranks across exactly those brands (may include the
 *  grounded paint's own brand); with no filter, falls back to the "closest
 *  equivalents from OTHER brands" default (reuses `similarInOtherBrands`). */
function laneAlternatives(
  paint: Paint | null,
  catalog: Paint[],
  brands: ReadonlySet<string>,
): Paint[] {
  if (!paint || catalog.length === 0) return [];
  if (brands.size > 0) {
    return rankMatchesMulti(paint.hex, catalog, [...brands], LANE_ALT_COUNT)
      .map((m) => m.paint)
      .filter((p) => p.id !== paint.id);
  }
  return similarInOtherBrands(paint, catalog, LANE_ALT_COUNT);
}

interface Anchor {
  hex: string;
  /** Catalog paint id backing this anchor, or `null` for a raw hex pick /
   *  hand-typed value (lvIX6p is reversed — paints are now assignable
   *  directly, not just colours). */
  paintId: string | null;
}

interface StackLayer {
  id: string;
  label: string;
  hex: string;
  /** Catalog paint id backing this layer's colour, or `null` for raw hex. */
  paintId: string | null;
  alpha: number;
}

/**
 * Color Stacking + Layering (MM-35 / Wave 2 item 7). Two sections, both able
 * to assign a real catalog PAINT per lane/layer — not just a raw hex (lvIX6p
 * reversed on Ross's request: the Library sub-panel is now open in both
 * ColorPickerPanels below). Raw wheel/harmony/hand-typed hex still works;
 * it just carries no `paintId`.
 *  - LAYERING: a perceptual Lab-space ramp (shadow → base → highlight).
 *  - STACKING: N renamable "LAYER #" glazes, stacked bottom → top over a
 *    fixed substrate, predicting the painted result (optical mix). Rendered
 *    as an N-circle Venn (ESVDHH6Wg78p) — no more "undercoat" special-case;
 *    every layer is equal, and the centre where every circle overlaps IS the
 *    predicted result, shown from a single layer up.
 * Ported from old `components/tools/gradient/*` + `lib/tools/layering`.
 */
export function LayeringTool({
  onSavePalette,
  onCreateRecipe,
  onAssignRecipe,
}: {
  onSavePalette: (hexes: string[]) => void;
  /** Start a brand-new recipe from the discovered colours. Omit to hide the
   *  button (the embedded recipe-slot picker doesn't show it). */
  onCreateRecipe?: (swatches: ToolSwatch[]) => void;
  /** Append the discovered colours to an existing recipe. Omit to hide. */
  onAssignRecipe?: (swatches: ToolSwatch[]) => void;
}) {
  // The paint catalog, for resolving a lane/layer's `paintId` back to a
  // displayable name + brand. Empty until it resolves (tools degrade
  // gracefully — see useCatalog).
  const catalog = useCatalog();
  function resolvePaint(paintId: string | null): Paint | undefined {
    if (!paintId) return undefined;
    return catalog.find((p) => p.id === paintId);
  }

  /* ---------- Layering (Lab ramp) ---------- */
  const [shadow, setShadow] = useState<Anchor>({ hex: "#13243a", paintId: null });
  const [base, setBase] = useState<Anchor>({ hex: "#3a6ea5", paintId: null });
  const [highlight, setHighlight] = useState<Anchor>({ hex: "#9fc6ee", paintId: null });
  const [steps, setSteps] = useState(5);
  // Per-lane colour picker — which lane the shared ColorPicker is editing.
  const [pickingLane, setPickingLane] = useState<"shadow" | "base" | "highlight" | null>(null);

  const valid = [shadow, base, highlight].every((a) => HEX6.test(a.hex));
  const ladder = valid
    ? buildRamp({ shadow: shadow.hex, base: base.hex, highlight: highlight.hex, steps })
    : [];

  const laneAnchor =
    pickingLane === "shadow"
      ? shadow
      : pickingLane === "base"
        ? base
        : pickingLane === "highlight"
          ? highlight
          : null;

  function applyLane(sel: ColorPickerSelection) {
    const hex = sel.hex.toUpperCase();
    const paintId = sel.paintId ?? null;
    if (pickingLane === "shadow") setShadow({ hex, paintId });
    else if (pickingLane === "base") setBase({ hex, paintId });
    else if (pickingLane === "highlight") setHighlight({ hex, paintId });
  }

  /* ---------- MATCH button — seed one lane, derive the other two ---------- */
  const { toast: laneToast, node: laneToastNode } = useToast();
  const [seedLane, setSeedLane] = useState<LaneKey>("base");
  // Owned-first grounding toggle (default OFF — closest catalog match
  // regardless of ownership). Owned paint ids load once on mount; a
  // signed-out visitor (guest preview) just gets an empty set, so the
  // toggle quietly behaves like "closest match" for them.
  const [ownedFirst, setOwnedFirst] = useState(false);
  const [ownedIds, setOwnedIds] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    let alive = true;
    loadOwnedPaintIds().then((res) => {
      if (alive && res.ok) setOwnedIds(new Set(res.data));
    });
    return () => {
      alive = false;
    };
  }, []);

  // Per-lane brand multi-select filter for the "alternatives" lists below.
  const [laneBrandFilters, setLaneBrandFilters] = useState<Record<LaneKey, ReadonlySet<string>>>({
    shadow: new Set(),
    base: new Set(),
    highlight: new Set(),
  });
  function toggleLaneBrand(lane: LaneKey, brand: string) {
    setLaneBrandFilters((prev) => {
      const next = new Set(prev[lane]);
      if (next.has(brand)) next.delete(brand);
      else next.add(brand);
      return { ...prev, [lane]: next };
    });
  }
  function clearLaneBrands(lane: LaneKey) {
    setLaneBrandFilters((prev) => ({ ...prev, [lane]: new Set() }));
  }
  const brandOptions = useMemo(
    () => Array.from(new Set(catalog.map((p) => p.brand))).sort(),
    [catalog],
  );

  // Every lane always shows a "grounded" catalog paint — the one it's
  // explicitly set to (a Library pick), or, failing that, the closest
  // catalog match to its raw hex — so the alternatives list + ASSIGN below
  // always has a paint to rank against, even for a hand-typed hex.
  const groundedShadow = useMemo(
    () => resolvePaint(shadow.paintId) ?? (catalog.length ? closestPaint(shadow.hex, catalog) : null) ?? null,
    [shadow, catalog],
  );
  const groundedBase = useMemo(
    () => resolvePaint(base.paintId) ?? (catalog.length ? closestPaint(base.hex, catalog) : null) ?? null,
    [base, catalog],
  );
  const groundedHighlight = useMemo(
    () => resolvePaint(highlight.paintId) ?? (catalog.length ? closestPaint(highlight.hex, catalog) : null) ?? null,
    [highlight, catalog],
  );
  const shadowAlternatives = useMemo(
    () => laneAlternatives(groundedShadow, catalog, laneBrandFilters.shadow),
    [groundedShadow, catalog, laneBrandFilters.shadow],
  );
  const baseAlternatives = useMemo(
    () => laneAlternatives(groundedBase, catalog, laneBrandFilters.base),
    [groundedBase, catalog, laneBrandFilters.base],
  );
  const highlightAlternatives = useMemo(
    () => laneAlternatives(groundedHighlight, catalog, laneBrandFilters.highlight),
    [groundedHighlight, catalog, laneBrandFilters.highlight],
  );

  function handleLaneAssigned(result: AssignedResult) {
    laneToast(result.created ? `Created ${result.name}` : `Added to ${result.name}`, "green");
  }

  const seedAnchor = seedLane === "shadow" ? shadow : seedLane === "base" ? base : highlight;
  const matchEnabled = HEX6.test(seedAnchor.hex);

  /** Ground one derived hex to a real catalog paint (owned-first per the
   *  toggle) and land it on the given lane setter. Falls back to the raw
   *  derived hex with no paintId when the catalog hasn't loaded yet. */
  function applyDerivedLane(setter: (a: Anchor) => void, derivedHex: string) {
    const paint = catalog.length ? groundLane(derivedHex, catalog, ownedIds, ownedFirst) : null;
    setter(paint ? { hex: paint.hex.toUpperCase(), paintId: paint.id } : { hex: derivedHex, paintId: null });
  }

  function handleMatch() {
    if (!matchEnabled) return;
    const derived = deriveLanesFromSeed(seedLane, seedAnchor.hex);
    if (!derived) return;
    if (seedLane !== "shadow") applyDerivedLane(setShadow, derived.shadow);
    if (seedLane !== "base") applyDerivedLane(setBase, derived.base);
    if (seedLane !== "highlight") applyDerivedLane(setHighlight, derived.highlight);
  }

  /* ---------- Stacking (optical glaze mix, N renamable layers) ---------- */
  const layerSeq = useRef(0);
  function nextLayerId(): string {
    layerSeq.current += 1;
    return `layer-${layerSeq.current}`;
  }
  const [layers, setLayers] = useState<StackLayer[]>(() => [
    { id: nextLayerId(), label: "LAYER 1", hex: "#8a1f1f", paintId: null, alpha: 0.6 },
  ]);
  // Which layer's colour the shared ColorPicker is editing.
  const [pickingLayer, setPickingLayer] = useState<number | null>(null);

  const { resultFill } = computeVennFills(layers);
  const pickingLayerData = typeof pickingLayer === "number" ? (layers[pickingLayer] ?? null) : null;
  const stackHex = pickingLayerData?.hex ?? null;
  const stackPaintId = pickingLayerData?.paintId ?? null;

  function applyLayerColor(sel: ColorPickerSelection) {
    const hex = sel.hex.toUpperCase();
    const paintId = sel.paintId ?? null;
    if (typeof pickingLayer === "number") {
      const idx = pickingLayer;
      setLayers((prev) => prev.map((l, k) => (k === idx ? { ...l, hex, paintId } : l)));
    }
  }

  function addLayer() {
    setLayers((prev) => {
      if (prev.length >= MAX_LAYERS) return prev;
      return [
        ...prev,
        { id: nextLayerId(), label: `LAYER ${prev.length + 1}`, hex: "#ffffff", paintId: null, alpha: 0.5 },
      ];
    });
  }

  function removeLayer(index: number) {
    setLayers((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  function renameLayer(index: number, label: string) {
    setLayers((prev) => prev.map((l, i) => (i === index ? { ...l, label } : l)));
  }

  const vennLayers: VennLayer[] = layers.map((l) => ({
    id: l.id,
    label: l.label,
    hex: l.hex,
    alpha: l.alpha,
  }));

  // A layer's swatch carries its paint into the recipe when one is picked
  // AND still resolves in the catalog; otherwise it's a plain hex swatch —
  // the computed RESULT fill never carries a paint (it's a derived mix, not
  // a pick).
  function layerToSwatch(l: StackLayer): ToolSwatch {
    const paint = resolvePaint(l.paintId);
    return paint ? { hex: l.hex, paintId: paint.id, name: paint.name } : { hex: l.hex };
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ===================== LAYERING ===================== */}
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Panel label="LAYERING" className="flex flex-col gap-3 p-5">
          <p className="font-body text-body text-fg">
            Perceptual Lab-space ramp — even transitions across the eye.
          </p>
          <LaneField
            label="Shadow"
            anchor={shadow}
            paint={resolvePaint(shadow.paintId)}
            groundedPaint={groundedShadow}
            alternatives={shadowAlternatives}
            brandOptions={brandOptions}
            selectedBrands={laneBrandFilters.shadow}
            onToggleBrand={(b) => toggleLaneBrand("shadow", b)}
            onClearBrands={() => clearLaneBrands("shadow")}
            onChange={(hex) => setShadow({ hex, paintId: null })}
            onPick={() => setPickingLane("shadow")}
            onAssigned={handleLaneAssigned}
          />
          <LaneField
            label="Base"
            anchor={base}
            paint={resolvePaint(base.paintId)}
            groundedPaint={groundedBase}
            alternatives={baseAlternatives}
            brandOptions={brandOptions}
            selectedBrands={laneBrandFilters.base}
            onToggleBrand={(b) => toggleLaneBrand("base", b)}
            onClearBrands={() => clearLaneBrands("base")}
            onChange={(hex) => setBase({ hex, paintId: null })}
            onPick={() => setPickingLane("base")}
            onAssigned={handleLaneAssigned}
          />
          <LaneField
            label="Highlight"
            anchor={highlight}
            paint={resolvePaint(highlight.paintId)}
            groundedPaint={groundedHighlight}
            alternatives={highlightAlternatives}
            brandOptions={brandOptions}
            selectedBrands={laneBrandFilters.highlight}
            onToggleBrand={(b) => toggleLaneBrand("highlight", b)}
            onClearBrands={() => clearLaneBrands("highlight")}
            onChange={(hex) => setHighlight({ hex, paintId: null })}
            onPick={() => setPickingLane("highlight")}
            onAssigned={handleLaneAssigned}
          />

          {/* MATCH — seed one lane above, derive the other two in Lab space
              and ground them to real catalog paints. */}
          <div className="flex flex-col gap-2 border-t border-cyan/10 pt-3">
            <SegmentedToggle
              options={LANE_SEED_OPTIONS}
              value={seedLane}
              onChange={setSeedLane}
              aria-label="Seed lane for MATCH"
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="solidGreen"
                size="sm"
                disabled={!matchEnabled}
                onClick={handleMatch}
              >
                Match
              </Button>
              {/* min-h-11 gives the whole clickable label a ≥44px tap target
                  (MUX-001) — the checkbox glyph itself stays ~16px. */}
              <label className="flex min-h-11 items-center gap-1.5">
                <Checkbox
                  checked={ownedFirst}
                  onChange={setOwnedFirst}
                  ariaLabel="Owned first — prefer paints you already own"
                />
                <span className="label-osd text-fg">Owned first</span>
              </label>
            </div>
            <p className="font-body text-body text-fg-faint">
              Derives the other two lanes from the {seedLane} lane, grounded
              to {ownedFirst ? "a paint you own when one's close enough" : "the closest catalog paint"}.
            </p>
          </div>

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
              {/* Ramp steps are computed Lab-space interpolation, not direct
                  paint picks — even when an anchor is paint-backed, the
                  in-between steps carry no paintId; a step becomes a real
                  paint once it's sent to a recipe. */}
              <ol className="flex flex-col gap-1.5">
                {ladder.map((hex, i) => (
                  <li key={i} className="flex items-center gap-3 border border-cyan/20 p-2">
                    <span className="w-6 font-num2 text-num2 text-fg">{i + 1}</span>
                    <Swatch hex={hex} />
                    <span className="flex-1 font-body text-body text-fg">{hex}</span>
                  </li>
                ))}
              </ol>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => onSavePalette(ladder)}>Save Palette</Button>
                {onCreateRecipe && (
                  <Button
                    variant="secondary"
                    onClick={() => onCreateRecipe(ladder.map((hex) => ({ hex })))}
                  >
                    Create Recipe
                  </Button>
                )}
                {onAssignRecipe && (
                  <Button
                    variant="secondary"
                    onClick={() => onAssignRecipe(ladder.map((hex) => ({ hex })))}
                  >
                    Assign to Recipe
                  </Button>
                )}
              </div>
            </>
          )}
        </Panel>
      </div>

      {/* ===================== STACKING ===================== */}
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Panel label="STACKING" accent="purple" className="flex flex-col gap-3 p-5">
          <p className="font-body text-body text-fg">
            Paint is see-through, so what you see is every layer showing
            through the ones above it. Stack layers bottom (LAYER 1) to top —
            this previews the colour you'd actually get once they're all
            painted on.
          </p>
          {layers.map((layer, i) => (
            <div key={layer.id} className="flex flex-col gap-2 border border-purple/20 p-2">
              <div className="flex items-center justify-between gap-2">
                <input
                  type="text"
                  value={layer.label}
                  onChange={(e) => renameLayer(i, e.target.value)}
                  aria-label={`Layer ${i + 1} name`}
                  className="min-w-0 flex-1 border border-transparent bg-transparent label-osd text-fg focus:border-purple/40 focus:outline-none"
                />
                <CloseButton
                  tone="destructive"
                  aria-label={`Remove ${layer.label}`}
                  disabled={layers.length <= 1}
                  onClick={() => removeLayer(i)}
                />
              </div>
              <HexField
                name={`layer-${layer.id}`}
                aria-label={`${layer.label} hex`}
                value={layer.hex}
                onChange={(e) =>
                  setLayers((prev) =>
                    prev.map((l, k) =>
                      k === i ? { ...l, hex: e.target.value, paintId: null } : l,
                    ),
                  )
                }
                onSwatchClick={() => setPickingLayer(i)}
                swatchLabel={`Pick ${layer.label} colour`}
              />
              <PaintLabel paint={resolvePaint(layer.paintId)} />
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
                    setLayers((prev) =>
                      prev.map((l, k) => (k === i ? { ...l, alpha: Number(e.target.value) / 100 } : l)),
                    )
                  }
                  aria-label={`${layer.label} opacity`}
                  className="mt-1 w-full accent-purple"
                />
              </label>
            </div>
          ))}
          <Button variant="add" disabled={layers.length >= MAX_LAYERS} onClick={addLayer}>
            + Add layer
          </Button>
        </Panel>

        <Panel label="RESULT" cornerTicks accent="purple" className="flex flex-col gap-4 p-5">
          <div
            className="flex h-28 items-center justify-center border border-fg/20"
            style={{
              backgroundColor: HEX6.test(resultFill) ? resultFill : "transparent",
              color: readableText(resultFill),
            }}
          >
            <span className="font-body text-body">{resultFill.toUpperCase()}</span>
          </div>
          <div className="flex flex-col gap-1 border-t border-purple/20 pt-3">
            <span className="label-osd text-fg">
              {layers.length} layer{layers.length === 1 ? "" : "s"} — the centre where every
              circle overlaps is the result
            </span>
            <GlazeVenn
              layers={vennLayers}
              onPick={(_target, hex) => onSavePalette([hex.toUpperCase()])}
            />
            <span className="text-center font-body text-body text-fg">
              Click a circle or the centre to save its colour.
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => onSavePalette([resultFill.toUpperCase()])}>
              Save result
            </Button>
            {onCreateRecipe && (
              <Button
                variant="secondary"
                onClick={() =>
                  onCreateRecipe([...layers.map(layerToSwatch), { hex: resultFill }])
                }
              >
                Create Recipe
              </Button>
            )}
            {onAssignRecipe && (
              <Button
                variant="secondary"
                onClick={() =>
                  onAssignRecipe([...layers.map(layerToSwatch), { hex: resultFill }])
                }
              >
                Assign to Recipe
              </Button>
            )}
          </div>
        </Panel>
      </div>

      {/* Per-lane shared ColorPicker for the layering lanes — Library is on
          so a lane can be assigned a real catalog paint, not just a hex
          (lvIX6p reversed). Eyedropper stays hidden; these lanes aren't
          image-sourced. */}
      <ColorPickerPanel
        open={pickingLane != null}
        onClose={() => setPickingLane(null)}
        title="Pick a paint"
        breadcrumb="LAYERING ▸ PAINT PICKER"
        contextLabel={pickingLane ?? undefined}
        initialHex={laneAnchor?.hex ?? null}
        initialPaintId={laneAnchor?.paintId ?? null}
        pickerKey={pickingLane ? `lane:${pickingLane}` : null}
        showLibrary
        showEyedropper={false}
        closeOnSelect
        onSelect={applyLane}
      />

      {/* Shared ColorPicker for each stacking layer — same Library-on cut. */}
      <ColorPickerPanel
        open={pickingLayer != null}
        onClose={() => setPickingLayer(null)}
        title="Pick a paint"
        breadcrumb="STACKING ▸ PAINT PICKER"
        contextLabel={typeof pickingLayer === "number" ? layers[pickingLayer]?.label : undefined}
        initialHex={stackHex}
        initialPaintId={stackPaintId}
        pickerKey={typeof pickingLayer === "number" ? `stack:${pickingLayer}` : null}
        showLibrary
        showEyedropper={false}
        closeOnSelect
        onSelect={applyLayerColor}
      />
      {laneToastNode}
    </div>
  );
}

function LaneField({
  label,
  anchor,
  paint,
  groundedPaint,
  alternatives,
  brandOptions,
  selectedBrands,
  onToggleBrand,
  onClearBrands,
  onChange,
  onPick,
  onAssigned,
}: {
  label: string;
  anchor: Anchor;
  paint: Paint | undefined;
  /** The lane's catalog paint for alternatives/ASSIGN — the paintId pick if
   *  set, else the closest catalog match to the raw hex. Null while the
   *  catalog hasn't loaded. */
  groundedPaint: Paint | null;
  /** ΔE-ranked "other similar paints" for the grounded paint, respecting
   *  `selectedBrands` when set. */
  alternatives: Paint[];
  brandOptions: string[];
  selectedBrands: ReadonlySet<string>;
  onToggleBrand: (brand: string) => void;
  onClearBrands: () => void;
  onChange: (hex: string) => void;
  onPick: () => void;
  onAssigned: (result: AssignedResult) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <HexField
        label={label}
        name={label.toLowerCase()}
        value={anchor.hex}
        onChange={(e) => onChange(e.target.value)}
        onSwatchClick={onPick}
        swatchLabel={`Pick ${label} colour`}
      />
      <PaintLabel paint={paint} />

      {groundedPaint && (
        <div className="flex flex-col gap-1.5 border-t border-cyan/10 pt-1.5">
          <div className="flex items-center justify-between gap-2">
            <span
              className="min-w-0 truncate label-osd text-fg-dim"
              title={`${groundedPaint.name} · ${groundedPaint.brand}`}
            >
              {groundedPaint.name} · {groundedPaint.brand}
            </span>
            <AssignPaintMenu
              swatch={{ hex: groundedPaint.hex, paintId: groundedPaint.id, name: groundedPaint.name }}
              onAssigned={onAssigned}
              buttonSize="sm"
            />
          </div>

          {alternatives.length > 0 && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <span className="label-osd text-fg-faint">Alternatives</span>
                <BrandFilterPopover
                  brandOptions={brandOptions}
                  selected={selectedBrands}
                  onToggle={onToggleBrand}
                  onClear={onClearBrands}
                />
              </div>
              <ul className="flex flex-col gap-1">
                {alternatives.map((alt) => (
                  <li
                    key={alt.id}
                    className="flex items-center gap-2 border border-cyan/10 px-1.5 py-1"
                  >
                    <Swatch hex={alt.hex} size="sm" />
                    <span
                      className="min-w-0 flex-1 truncate font-body text-body text-fg"
                      title={`${alt.name} · ${alt.brand}`}
                    >
                      {alt.name} <span className="text-fg-faint">· {alt.brand}</span>
                    </span>
                    <AssignPaintMenu
                      swatch={{ hex: alt.hex, paintId: alt.id, name: alt.name }}
                      onAssigned={onAssigned}
                      buttonSize="sm"
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** `Mephiston Red · Citadel` — shown under a lane/layer's hex field only
 *  when it's backed by a real catalog paint. Renders nothing for a raw
 *  hex pick or hand-typed value. */
function PaintLabel({ paint }: { paint: Paint | undefined }) {
  if (!paint) return null;
  return (
    <span className="label-osd text-fg-dim">
      {paint.name} · {paint.brand}
    </span>
  );
}

/** Small terminal-styled checkbox popover — per-lane brand multi-select
 *  filter for the MATCH alternatives list. No shared brand-multi-select
 *  primitive exists yet in the kit, so this is self-contained (same
 *  open/close-on-outside-click idiom as {@link AssignPaintMenu}). */
function BrandFilterPopover({
  brandOptions,
  selected,
  onToggle,
  onClear,
}: {
  brandOptions: string[];
  selected: ReadonlySet<string>;
  onToggle: (brand: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="border border-cyan/30 px-1.5 py-0.5 font-button text-button text-fg-dim transition-colors hover:border-cyan/60 hover:text-fg"
      >
        Brands{selected.size > 0 ? ` · ${selected.size}` : ""}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Filter alternatives by brand"
          className="absolute right-0 top-full z-30 mt-1 max-h-52 w-44 overflow-y-auto border border-dotted border-cyan/60 bg-bg p-2 panel-depth motion-safe:animate-menu-in"
        >
          {selected.size > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="mb-1 block font-button text-button text-red hover:underline"
            >
              Clear
            </button>
          )}
          <ul className="flex flex-col gap-1">
            {brandOptions.map((b) => (
              <li key={b}>
                <label className="flex min-h-6 items-center gap-2 font-body text-body text-fg">
                  <Checkbox checked={selected.has(b)} onChange={() => onToggle(b)} ariaLabel={b} />
                  <span className="min-w-0 truncate">{b}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
