/**
 * Colour-first recipe generation — the deterministic core.
 *
 * Given a few colours the painter picked, this module does the colour-theory
 * maths with zero LLM / catalog dependency so it's instant, free, and unit
 * testable:
 *   - `buildLayerRamp`  — one painted colour → a base/shade/layer/highlight/edge
 *     ramp using *tinted* ramping (cool shadows, warm highlights), not a flat
 *     value slider. This is the "how do I layer this" answer.
 *   - `scoreHarmony`    — classify a set of picks against the wheel harmonies and
 *     flag muddy clashes. This is the "do these look good together" answer.
 *   - `expandPalette`   — when the painter picks only one or two colours, propose
 *     cohesive companions off the wheel.
 *
 * Grounding a ramp to real catalog paints (via `findClosestPaints`) lives in a
 * separate step so this module stays pure. All hex output is upper-case #RRGGBB,
 * matching `harmonies.ts`.
 */

import {
  buildHarmony,
  clampHue,
  harmonyKeys,
  hexToHsl,
  hslToHex,
  type HarmonyKey,
} from "@/lib/tools/wheel/harmonies";
import { classifyConfidence, type MatchConfidence } from "@/lib/tools/match/find";
import { deltaE2000, hexToLab } from "@/lib/tools/match/deltaE";
import type { Hex } from "@/lib/types";

/** The paint-technique role a ramp step maps to — matches the recipe slot
 *  `layer` field the editor + AI creator already use. Ordered dark → light. */
export type LayerRole = "shade" | "base" | "layer" | "highlight" | "edge";

export const LAYER_ROLE_ORDER: readonly LayerRole[] = [
  "shade",
  "base",
  "layer",
  "highlight",
  "edge",
];

export interface RampStep {
  role: LayerRole;
  hex: Hex;
  /** The HSL the step was generated at — handy for grounding + debugging. */
  hsl: { h: number; s: number; l: number };
}

export interface LayerRamp {
  /** The picked colour this ramp was derived from. */
  source: Hex;
  steps: RampStep[];
}

/** Temperature anchors on the wheel. Shadows drift toward cool blue, highlights
 *  toward warm yellow — the painter's "cool shadows / warm light" rule. */
const COOL_ANCHOR = 250; // blue
const WARM_ANCHOR = 50; // yellow

/**
 * How each role is derived from the base HSL. Shade keeps saturation and rotates
 * toward cool (rich shadows); highlight/edge drop saturation and rotate toward
 * warm (sunlit, not chalky-grey). Rotating *toward an anchor* — rather than by a
 * fixed signed amount — keeps the direction correct for every base hue (a red at
 * ~5° and a blue at ~210° both cool their shadows the right way). Tunable here.
 */
const RAMP_RULES: ReadonlyArray<{
  role: LayerRole;
  dl: number; // lightness delta (percent points)
  ds: number; // saturation delta (percent points)
  anchor: number | null; // hue to rotate toward (null = hold the base hue)
  rot: number; // max degrees to rotate toward the anchor (shortest arc)
}> = [
  { role: "shade", dl: -26, ds: +4, anchor: COOL_ANCHOR, rot: 14 },
  { role: "base", dl: 0, ds: 0, anchor: null, rot: 0 },
  { role: "layer", dl: +9, ds: -2, anchor: WARM_ANCHOR, rot: 4 },
  { role: "highlight", dl: +22, ds: -14, anchor: WARM_ANCHOR, rot: 12 },
  { role: "edge", dl: +34, ds: -28, anchor: WARM_ANCHOR, rot: 16 },
];

function clamp(n: number, min: number, max: number): number {
  return n < min ? min : n > max ? max : n;
}

/** Rotate hue `h` toward `target` by at most `amt` degrees along the shortest
 *  arc — never overshoots past the anchor. */
function rotateToward(h: number, target: number, amt: number): number {
  const diff = ((target - h + 540) % 360) - 180; // signed shortest delta
  const step = Math.sign(diff) * Math.min(amt, Math.abs(diff));
  return clampHue(h + step);
}

/**
 * Build a 5-step painting ramp from one picked colour. Returns null when the
 * hex can't be parsed — callers drop the pick rather than emit a broken ramp.
 */
export function buildLayerRamp(source: string): LayerRamp | null {
  const hsl = hexToHsl(source);
  if (!hsl) return null;

  const steps: RampStep[] = RAMP_RULES.map(({ role, dl, ds, anchor, rot }) => {
    // Keep lightness inside 6–94 so shade/edge never crush to pure black/white;
    // saturation clamps to 0–100; hue rotates toward the temperature anchor.
    const h = anchor === null ? hsl.h : rotateToward(hsl.h, anchor, rot);
    const s = clamp(hsl.s + ds, 0, 100);
    const l = clamp(hsl.l + dl, 6, 94);
    return { role, hex: hslToHex(h, s, l), hsl: { h, s, l } };
  });

  return { source: hslToHex(hsl.h, hsl.s, hsl.l), steps };
}

/* ============================================================
   Harmony scoring — "do these picks look good together?"
   ============================================================ */

export interface HarmonyScore {
  /** Best-matching harmony, or null when the picks don't resemble any. */
  harmony: HarmonyKey | null;
  /** 0–1 — how cleanly the picks fit that harmony (1 = textbook). */
  cohesion: number;
  /** Pairs that read muddy together (close hue, close value) — 0-indexed into
   *  the input array. Empty = no clashes detected. */
  clashes: Array<{ a: number; b: number; reason: string }>;
}

/** Smallest absolute distance between two hues on the 360° wheel. */
function hueGap(a: number, b: number): number {
  const d = Math.abs(clampHue(a) - clampHue(b)) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * Classify a set of picked colours against the wheel harmonies and flag muddy
 * pairs. Heuristic + deterministic — the point is a helpful label and a warning,
 * not a proof. A single pick is trivially "monochromatic" with no clashes.
 */
export function scoreHarmony(hexes: ReadonlyArray<string>): HarmonyScore {
  const hsls = hexes.map(hexToHsl).filter((v): v is NonNullable<typeof v> => v !== null);
  if (hsls.length <= 1) {
    return { harmony: hsls.length === 1 ? "monochromatic" : null, cohesion: 1, clashes: [] };
  }

  const hues = hsls.map((c) => c.h);

  // Fit the picks against each harmony's ideal hue-offset signature (relative to
  // the first pick) and keep the closest. Lower mean offset error → higher fit.
  const SIGNATURES: Partial<Record<HarmonyKey, number[]>> = {
    complementary: [0, 180],
    analogous: [0, 30, -30],
    triadic: [0, 120, 240],
    splitComplementary: [0, 150, 210],
    tetradic: [0, 60, 180, 240],
    square: [0, 90, 180, 270],
  };

  let best: { key: HarmonyKey; err: number } | null = null;
  for (const key of harmonyKeys) {
    const sig = SIGNATURES[key];
    if (!sig || sig.length !== hues.length) continue;
    // Match each pick to its nearest signature slot (order-independent).
    const targets = sig.map((offset) => clampHue(hues[0] + offset));
    const used = new Set<number>();
    let err = 0;
    for (const h of hues) {
      let bestSlot = -1;
      let bestD = Infinity;
      targets.forEach((t, i) => {
        if (used.has(i)) return;
        const d = hueGap(h, t);
        if (d < bestD) {
          bestD = d;
          bestSlot = i;
        }
      });
      used.add(bestSlot);
      err += bestD;
    }
    err /= hues.length;
    if (!best || err < best.err) best = { key, err };
  }

  // Muddy-pair detector: two colours 18–55° apart at similar value read as an
  // indistinct smudge — warn so the painter can push the value or hue apart.
  const clashes: HarmonyScore["clashes"] = [];
  for (let i = 0; i < hsls.length; i++) {
    for (let j = i + 1; j < hsls.length; j++) {
      const gap = hueGap(hsls[i].h, hsls[j].h);
      const dv = Math.abs(hsls[i].l - hsls[j].l);
      if (gap >= 18 && gap <= 55 && dv < 12) {
        clashes.push({
          a: i,
          b: j,
          reason: "close hue + close value — nudge one lighter/darker or further round the wheel",
        });
      }
    }
  }

  // Convert the mean hue error (0° perfect … ~60°+ unrelated) into 0–1.
  const cohesion = best ? clamp(1 - best.err / 60, 0, 1) : 0;
  return { harmony: best ? best.key : null, cohesion, clashes };
}

/* ============================================================
   Palette expansion — companions for a sparse pick
   ============================================================ */

/** Harmonies worth offering when the painter has only one anchor colour. */
const COMPANION_HARMONIES: readonly HarmonyKey[] = [
  "analogous",
  "triadic",
  "complementary",
  "splitComplementary",
];

export interface PaletteSuggestion {
  harmony: HarmonyKey;
  /** Full ordered swatch set (anchor first). */
  swatches: Hex[];
}

/**
 * When the painter picks a single colour, propose cohesive companion palettes
 * off the wheel so they don't have to invent the rest. Returns [] for an
 * unparseable anchor or when they already picked ≥2 colours (nothing to expand).
 */
export function expandPalette(hexes: ReadonlyArray<string>): PaletteSuggestion[] {
  if (hexes.length !== 1) return [];
  const hsl = hexToHsl(hexes[0]);
  if (!hsl) return [];
  return COMPANION_HARMONIES.map((harmony) => ({
    harmony,
    swatches: buildHarmony(harmony, hsl.h, hsl.s, hsl.l),
  }));
}

/* ============================================================
   Grounding — theoretical ramp hex → real catalog paint
   ============================================================ */

/** The minimal paint shape grounding reads. Both the client `@/lib/types` Paint
 *  and the server `@/lib/paints/types` Paint satisfy it, so grounding works with
 *  either catalog without a cast. */
export interface GroundablePaint {
  id: string;
  brand: string;
  name: string;
  hex: string;
}

/** A ramp step matched to its nearest real catalog paint. `paint` is null when
 *  the catalog is empty or nothing parsed; `confidence` mirrors the ΔE band. */
export interface GroundedStep<P extends GroundablePaint = GroundablePaint> extends RampStep {
  paint: P | null;
  deltaE: number | null;
  confidence: MatchConfidence | null;
}

export interface GroundedColor<P extends GroundablePaint = GroundablePaint> {
  source: Hex;
  steps: GroundedStep<P>[];
}

/**
 * Ground every ramp step to the nearest catalog paint by CIEDE2000. This is the
 * seam that turns "shade = #56111A" into "the closest real bottle you can buy",
 * with a confidence badge the UI can show. Pure — the catalog is passed in, not
 * fetched, so it unit-tests with a fixture. Generic over the paint type so the
 * client and server catalogs both flow through.
 */
export function groundRampToCatalog<P extends GroundablePaint>(
  ramps: ReadonlyArray<LayerRamp>,
  catalog: ReadonlyArray<P>,
  opts: { brands?: ReadonlyArray<string> } = {},
): GroundedColor<P>[] {
  const brandSet = opts.brands?.length ? new Set(opts.brands) : null;
  // Convert the (filtered) catalog to Lab once, up front — one pass instead of
  // re-parsing every paint for every ramp step.
  const lab = catalog
    .filter((p) => !brandSet || brandSet.has(p.brand))
    .map((p) => ({ paint: p, lab: hexToLab(p.hex) }))
    .filter((x): x is { paint: P; lab: NonNullable<typeof x.lab> } => x.lab !== null);

  return ramps.map((ramp) => ({
    source: ramp.source,
    steps: ramp.steps.map((step) => {
      const target = hexToLab(step.hex);
      let best: { paint: P; d: number } | null = null;
      if (target) {
        for (const entry of lab) {
          const d = deltaE2000(target, entry.lab);
          if (!best || d < best.d) best = { paint: entry.paint, d };
        }
      }
      return {
        ...step,
        paint: best?.paint ?? null,
        deltaE: best ? best.d : null,
        confidence: best ? classifyConfidence(best.d) : null,
      };
    }),
  }));
}

/* ============================================================
   Slot mapping — grounded colours → recipe slots
   ============================================================ */

/** Ramp role → the free-text `layer` label `saveRecipe` maps to a technique
 *  (base→basecoat, shade→wash, layer→layer, highlight→highlight,
 *  edge→edge_highlight). Keeping the label here keeps the save path honest. */
export const ROLE_TO_LAYER: Record<LayerRole, string> = {
  shade: "shade",
  base: "base",
  layer: "layer",
  highlight: "highlight",
  edge: "edge highlight",
};

/** A recipe slot ready for `saveRecipe` — a real paint, or a custom-hex slot
 *  when the nearest match is too far to trust. */
export interface GeneratedSlot {
  paintId: string | null;
  hex: Hex;
  layer: string;
  role: LayerRole;
}

/**
 * Flatten grounded colours into an ordered recipe slot list. Each colour
 * contributes its ramp dark→light. A high/medium-confidence match persists as a
 * real paint slot; a low-confidence or unmatched step falls back to a custom-hex
 * slot (the theoretical colour beats a visibly-wrong bottle). `minConfidence`
 * tunes that cutoff — default keeps high+medium.
 */
export function groundedColorsToSlots<P extends GroundablePaint>(
  colors: ReadonlyArray<GroundedColor<P>>,
  opts: { minConfidence?: MatchConfidence } = {},
): GeneratedSlot[] {
  const min = opts.minConfidence ?? "medium";
  const rank: Record<MatchConfidence, number> = { low: 0, medium: 1, high: 2 };
  const slots: GeneratedSlot[] = [];
  for (const color of colors) {
    for (const step of color.steps) {
      const trust =
        step.paint !== null &&
        step.confidence !== null &&
        rank[step.confidence] >= rank[min];
      slots.push({
        paintId: trust ? step.paint!.id : null,
        hex: trust ? step.paint!.hex : step.hex,
        layer: ROLE_TO_LAYER[step.role],
        role: step.role,
      });
    }
  }
  return slots;
}
