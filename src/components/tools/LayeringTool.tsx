"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Checkbox, CloseButton, HexField, Panel, Swatch, useToast } from "@/components/kit";
import { cn } from "@/lib/cn";
import { captionScrim, readableText } from "@/lib/color";
import { buildRamp, MAX_STEPS, MIN_STEPS } from "@/lib/tools/gradient/interpolate";
import { computeVennFills } from "@/lib/tools/layering/venn";
import { deriveLanesFromSeed, type LaneKey } from "@/lib/tools/layering/deriveLanes";
import { groundLane } from "@/lib/tools/layering/groundLane";
import {
  closestPaint,
  INCOMPATIBLE_MATCH_TYPES,
  rankMatchesMulti,
  similarInOtherBrands,
} from "@/lib/toolMatch";
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
 * Color Stacking + Layering (MM-35 / Wave 2 item 7). Two sections:
 *  - LAYERING: the painter picks ONE layer — whichever paint they actually
 *    own — and the other two are derived in Lab space and grounded to real
 *    catalog paints, as is every step of the ramp between them. Nothing here
 *    is a bare colour: the tool's entire job is naming paints you can buy,
 *    and a hex answers a question nobody asked.
 *  - LAYERING is a perceptual Lab-space ramp (shadow → base → highlight).
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
  // All three start EMPTY. The tool's job is "tell me which paints to use",
  // so it opens asking a question rather than presenting three hexes the
  // painter never chose and has no reason to trust.
  const [shadow, setShadow] = useState<Anchor | null>(null);
  const [base, setBase] = useState<Anchor | null>(null);
  const [highlight, setHighlight] = useState<Anchor | null>(null);
  const [steps, setSteps] = useState(5);
  // Per-lane colour picker — which lane the shared ColorPicker is editing.
  const [pickingLane, setPickingLane] = useState<LaneKey | null>(null);
  /** The lane the painter actually chose; the other two are derived from it. */
  const [seedLane, setSeedLane] = useState<LaneKey | null>(null);

  const laneSetters: Record<LaneKey, (a: Anchor) => void> = {
    shadow: setShadow,
    base: setBase,
    highlight: setHighlight,
  };
  const lanes: Record<LaneKey, Anchor | null> = { shadow, base, highlight };

  const valid =
    !!shadow && !!base && !!highlight && [shadow, base, highlight].every((a) => HEX6.test(a.hex));
  const ladder = useMemo(
    () =>
      valid
        ? buildRamp({ shadow: shadow!.hex, base: base!.hex, highlight: highlight!.hex, steps })
        : [],
    [valid, shadow, base, highlight, steps],
  );

  const laneAnchor = pickingLane ? lanes[pickingLane] : null;

  /* ---------- pick one lane, derive the other two ---------- */
  const { toast: laneToast, node: laneToastNode } = useToast();
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
  // An empty lane grounds to nothing — there is no colour to be near yet.
  function groundAnchor(anchor: Anchor | null): Paint | null {
    if (!anchor) return null;
    return (
      resolvePaint(anchor.paintId) ??
      (catalog.length ? closestPaint(anchor.hex, catalog) : null) ??
      null
    );
  }
  const groundedShadow = useMemo(() => groundAnchor(shadow), [shadow, catalog]);
  const groundedBase = useMemo(() => groundAnchor(base), [base, catalog]);
  const groundedHighlight = useMemo(() => groundAnchor(highlight), [highlight, catalog]);
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

  /**
   * The pool the derived lanes and ramp steps may be grounded to.
   *
   * Nearest-ΔE over the RAW catalog gives answers that are numerically right
   * and useless on a brush: seeding Mephiston Red produced "Bronze (Tamiya)"
   * as the shadow and "Flesh Wash (Reaper)" as a ramp step. A wash is not a
   * shade coat and a metallic is not a shadow for a red.
   *
   * So: drop the utility finishes the Match tool already treats as
   * incompatible, and let the seed's own family decide about metallics —
   * a metallic base SHOULD shade and highlight with metallics (that is
   * exactly how Ionic's Real Heavy Metal triads are sold), while a standard
   * acrylic never should.
   *
   * Only the DERIVED lanes are constrained. Whatever the painter picks for
   * themselves stands, wash or metallic or otherwise.
   */
  function poolFor(seedPaint: Paint | null): Paint[] {
    const banned = new Set<string>(INCOMPATIBLE_MATCH_TYPES);
    const usable = catalog.filter((p) => !banned.has(p.type));
    return seedPaint?.type === "Metallic"
      ? usable.filter((p) => p.type === "Metallic")
      : usable.filter((p) => p.type !== "Metallic");
  }

  /**
   * Set one lane from a real paint and fill the other two with the best
   * catalog paints for those roles. This is the whole tool: the painter
   * answers one question ("which paint am I using?") and gets told exactly
   * what to shade and highlight it with.
   *
   * `ownedFirst` is passed rather than read from state so the checkbox can
   * re-derive with its NEW value in the same click, instead of re-deriving
   * one render late off a stale closure.
   */
  function seedLanes(lane: LaneKey, anchor: Anchor, preferOwned: boolean) {
    setSeedLane(lane);
    laneSetters[lane](anchor);

    const derived = deriveLanesFromSeed(lane, anchor.hex);
    if (!derived) return;
    // Computed from the anchor being applied, not from `seedLane` state —
    // that setter hasn't landed yet in this same handler.
    const pool = poolFor(resolvePaint(anchor.paintId) ?? closestPaint(anchor.hex, catalog) ?? null);
    for (const other of ["shadow", "base", "highlight"] as LaneKey[]) {
      if (other === lane) continue;
      // Ground the derived hex to a REAL paint. Falls back to the bare hex
      // only while the catalog is still loading — a lane should never rest on
      // a colour nobody sells.
      const paint = pool.length
        ? groundLane(derived[other], pool, ownedIds, preferOwned)
        : null;
      laneSetters[other](
        paint
          ? { hex: paint.hex.toUpperCase(), paintId: paint.id }
          : { hex: derived[other], paintId: null },
      );
    }
  }

  function applyLane(sel: ColorPickerSelection) {
    if (!pickingLane) return;
    seedLanes(
      pickingLane,
      { hex: sel.hex.toUpperCase(), paintId: sel.paintId ?? null },
      ownedFirst,
    );
  }

  /** Re-run the derivation when the owned-first preference flips, so the two
   *  derived lanes change under the painter instead of going stale. */
  function applyOwnedFirst(next: boolean) {
    setOwnedFirst(next);
    const seed = seedLane ? lanes[seedLane] : null;
    if (seedLane && seed) seedLanes(seedLane, seed, next);
  }

  /** Every ramp step resolved to a real paint — the tool's actual output.
   *  A bare ladder of hexes tells a painter nothing they can buy. */
  const rampRows = useMemo(() => {
    const pool = poolFor(seedLane ? groundAnchor(lanes[seedLane]) : null);
    return ladder.map((hex) => ({
      hex,
      paint: pool.length ? groundLane(hex, pool, ownedIds, ownedFirst) : null,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ladder, catalog, ownedIds, ownedFirst, seedLane, shadow, base, highlight]);

  const rampSwatches = (): ToolSwatch[] =>
    rampRows.map((r) =>
      r.paint ? { hex: r.paint.hex, paintId: r.paint.id, name: r.paint.name } : { hex: r.hex },
    );

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
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        {/* LEFT — alternatives, sectioned per lane. Swapping the sides puts
            the answer (which paints to use) in the big panel and the
            substitutions in the narrow one, instead of the other way round. */}
        <Panel label="ALTERNATIVES" className="flex min-w-0 flex-col gap-3 p-5">
          <p className="font-body text-body text-fg-faint">
            Other paints close enough to stand in for each layer.
          </p>
          {(
            [
              { key: "shadow" as const, label: "Shadow", grounded: groundedShadow, alts: shadowAlternatives },
              { key: "base" as const, label: "Base", grounded: groundedBase, alts: baseAlternatives },
              { key: "highlight" as const, label: "Highlight", grounded: groundedHighlight, alts: highlightAlternatives },
            ]
          ).map(({ key, label, grounded, alts }) => (
            <LaneAlternatives
              key={key}
              label={label}
              grounded={grounded}
              alternatives={alts}
              brandOptions={brandOptions}
              selectedBrands={laneBrandFilters[key]}
              onToggleBrand={(b) => toggleLaneBrand(key, b)}
              onClearBrands={() => clearLaneBrands(key)}
              onAssigned={handleLaneAssigned}
            />
          ))}
        </Panel>

        {/* RIGHT — the three layers themselves, then the ramp. */}
        <Panel label="LAYERS" cornerTicks className="flex min-w-0 flex-col gap-4 p-5">
          <p className="font-body text-body text-fg">
            Pick the paint you already have — the other two layers fill in with
            the closest real paints to shade and highlight it.
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <LanePaintTile
              label="Shadow"
              anchor={shadow}
              paint={groundedShadow}
              isSeed={seedLane === "shadow"}
              onPick={() => setPickingLane("shadow")}
            />
            <LanePaintTile
              label="Base"
              anchor={base}
              paint={groundedBase}
              isSeed={seedLane === "base"}
              onPick={() => setPickingLane("base")}
            />
            <LanePaintTile
              label="Highlight"
              anchor={highlight}
              paint={groundedHighlight}
              isSeed={seedLane === "highlight"}
              onPick={() => setPickingLane("highlight")}
            />
          </div>

          <label className="flex min-h-11 w-fit items-center gap-1.5">
            <Checkbox
              checked={ownedFirst}
              onChange={applyOwnedFirst}
              ariaLabel="Owned first — prefer paints you already own"
            />
            <span className="label-osd text-fg">Owned first</span>
          </label>

          {!valid ? (
            <p className="border border-dashed border-cyan/25 py-8 text-center font-body text-body text-fg-faint">
              Click a layer above and choose a paint.
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-2 border-t border-cyan/10 pt-4">
                <label>
                  <span className="label-osd text-fg">Ramp steps {steps}</span>
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
              </div>

              <div className="flex gap-1">
                {rampRows.map((r, i) => (
                  <div
                    key={i}
                    className="flex h-14 min-w-0 flex-1 items-center justify-center overflow-hidden"
                    style={{
                      backgroundColor: r.paint?.hex ?? r.hex,
                      color: readableText(r.paint?.hex ?? r.hex),
                      textShadow: captionScrim(r.paint?.hex ?? r.hex),
                    }}
                  >
                    <span className="max-w-full truncate px-1 text-center font-body text-body">
                      {r.paint?.name ?? r.hex}
                    </span>
                  </div>
                ))}
              </div>

              {/* The ramp names PAINTS. The in-between steps are Lab-space
                  interpolation, so each one is grounded to its closest catalog
                  paint — a ladder of hexes tells a painter nothing they can
                  buy, which is the whole point of the tool. */}
              <ol className="flex flex-col gap-1.5">
                {rampRows.map((r, i) => (
                  <li key={i} className="flex items-center gap-3 border border-cyan/20 p-2">
                    <span className="w-6 font-num2 text-num2 text-fg">{i + 1}</span>
                    <Swatch hex={r.paint?.hex ?? r.hex} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="break-words font-body text-body text-fg">
                        {r.paint?.name ?? r.hex}
                      </span>
                      {r.paint && (
                        <span className="label-osd text-fg-dim">{r.paint.brand}</span>
                      )}
                    </span>
                    {r.paint && (
                      <AssignPaintMenu
                        swatch={{ hex: r.paint.hex, paintId: r.paint.id, name: r.paint.name }}
                        onAssigned={handleLaneAssigned}
                        buttonSize="sm"
                      />
                    )}
                  </li>
                ))}
              </ol>

              <div className="flex flex-wrap gap-2">
                <Button onClick={() => onSavePalette(rampRows.map((r) => r.paint?.hex ?? r.hex))}>
                  Save Palette
                </Button>
                {onCreateRecipe && (
                  <Button variant="secondary" onClick={() => onCreateRecipe(rampSwatches())}>
                    Create Recipe
                  </Button>
                )}
                {onAssignRecipe && (
                  <Button variant="secondary" onClick={() => onAssignRecipe(rampSwatches())}>
                    Assign to Recipe
                  </Button>
                )}
              </div>
            </>
          )}
        </Panel>
      </div>

      {/* ===================== STACKING ===================== */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        <Panel label="STACKING" accent="purple" className="flex min-w-0 flex-col gap-3 p-5">
          <p className="font-body text-body text-fg">
            Paint is see-through, so what you see is every layer showing
            through the ones above it. Stack layers bottom (LAYER 1) to top —
            this previews the colour you&apos;d actually get once they&apos;re all
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

        <Panel label="RESULT" cornerTicks accent="purple" className="flex min-w-0 flex-col gap-4 p-5">
          <div
            className="flex h-28 items-center justify-center border border-fg/20"
            style={{
              backgroundColor: HEX6.test(resultFill) ? resultFill : "transparent",
              color: readableText(resultFill),
              textShadow: captionScrim(resultFill),
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
        // A layer holds a PAINT, never a bare colour — the tool's answer has
        // to be something the painter can buy. Same flag the recipe surfaces
        // use, for the same reason.
        paintsOnly
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

/**
 * One layer square: SHADOW / BASE / HIGHLIGHT. Empty until the painter picks,
 * and it shows a PAINT — name and brand — never a hex. Clicking it reopens the
 * wheel + library so any layer can be re-chosen, which is also how the derived
 * two get overridden.
 *
 * There is deliberately no hex field here any more. A layer that holds a
 * colour nobody sells cannot be painted, and the tool exists to answer
 * "which paint do I buy".
 */
function LanePaintTile({
  label,
  anchor,
  paint,
  isSeed,
  onPick,
}: {
  label: string;
  anchor: Anchor | null;
  /** The lane's catalog paint — the pick itself, or the closest match to a
   *  derived colour. Null while empty or before the catalog loads. */
  paint: Paint | null;
  /** True for the lane the painter chose; the other two are derived from it. */
  isSeed: boolean;
  onPick: () => void;
}) {
  const filled = !!anchor;
  const swatchHex = paint?.hex ?? anchor?.hex ?? null;
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="label-osd text-fg">{label}</span>
        {isSeed && (
          <span className="border border-green/40 bg-green/15 px-1.5 py-0.5 font-button text-button text-green">
            Yours
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={onPick}
        aria-label={
          paint
            ? `${label}: ${paint.name} by ${paint.brand}. Choose a different paint`
            : `Choose a ${label.toLowerCase()} paint`
        }
        className={cn(
          "flex h-24 w-full items-center justify-center border transition-colors focus:outline-none focus-visible:border-cyan",
          filled
            ? "border-fg/20 hover:border-cyan"
            : "border-dashed border-cyan/40 bg-transparent hover:border-cyan",
        )}
        style={swatchHex ? { backgroundColor: swatchHex } : undefined}
      >
        {!filled && <span className="font-body text-body text-fg-faint">+ Pick paint</span>}
      </button>
      {paint ? (
        <span className="min-w-0 break-words font-body text-body text-fg" title={`${paint.name} · ${paint.brand}`}>
          {paint.name}
          <span className="block label-osd text-fg-dim">{paint.brand}</span>
        </span>
      ) : (
        <span className="font-body text-body text-fg-faint">—</span>
      )}
    </div>
  );
}

/** One lane's section in the ALTERNATIVES column: the paints that could stand
 *  in for that layer, ΔE-ranked and brand-filterable. Renders a placeholder
 *  rather than vanishing when the lane is empty, so the column keeps the same
 *  three sections and the painter can see what is still unanswered. */
function LaneAlternatives({
  label,
  grounded,
  alternatives,
  brandOptions,
  selectedBrands,
  onToggleBrand,
  onClearBrands,
  onAssigned,
}: {
  label: string;
  grounded: Paint | null;
  alternatives: Paint[];
  brandOptions: string[];
  selectedBrands: ReadonlySet<string>;
  onToggleBrand: (brand: string) => void;
  onClearBrands: () => void;
  onAssigned: (result: AssignedResult) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5 border-t border-cyan/10 pt-2 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between gap-2">
        <span className="label-osd text-cyan-lite">{label}</span>
        {grounded && (
          <BrandFilterPopover
            brandOptions={brandOptions}
            selected={selectedBrands}
            onToggle={onToggleBrand}
            onClear={onClearBrands}
          />
        )}
      </div>

      {!grounded ? (
        <span className="font-body text-body text-fg-faint">Not chosen yet.</span>
      ) : alternatives.length === 0 ? (
        <span className="font-body text-body text-fg-faint">
          No close match in the selected brands.
        </span>
      ) : (
        <ul className="flex flex-col gap-1">
          {alternatives.map((alt) => (
            <li key={alt.id} className="flex items-center gap-2 border border-cyan/10 px-1.5 py-1">
              <Swatch hex={alt.hex} size="sm" />
              <span
                className="min-w-0 flex-1 break-words font-body text-body text-fg"
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
