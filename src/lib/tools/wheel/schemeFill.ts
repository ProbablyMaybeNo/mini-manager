/**
 * Scheme auto-fill — the pure logic behind the wheel's "Generate" flow
 * (Wave 2 / thread 8tB-qrqkOfMm). The painter sets a slot count, picks one
 * seed colour, then chooses a harmony; every UNLOCKED slot fills from that
 * harmony's hue/lightness pattern, cycled to cover however many slots they
 * asked for. LOCKED slots are the caller's concern (this module only
 * computes what a fresh, unlocked run of N slots would be) — see
 * `ColourWheelTool`'s `fillSlots` for how locked slots are preserved.
 *
 * Reuses the exact deltas already defined for each harmony in
 * `harmonies.ts` (same numbers `buildHarmony`/`offsetForIndex` use) — this
 * module doesn't invent new colour theory, it just generalises "N swatches"
 * to "however many the painter wants" by cycling the harmony's canonical
 * pattern instead of stopping at its natural swatch count.
 */

import { clampHue, hslToHex, type HarmonyKey } from "@/lib/tools/wheel/harmonies";

export interface Hsl {
  h: number;
  s: number;
  l: number;
}

/** One step of a harmony's canonical pattern: hue offset from the seed, and
 *  a lightness delta (only `monochromatic` varies lightness instead of hue). */
interface HarmonyStep {
  dh: number;
  dl: number;
}

/** Mirrors the offsets in `harmonies.ts`'s generator functions exactly —
 *  the seed (index 0) is always `{dh:0, dl:0}`. */
const HARMONY_PATTERNS: Record<HarmonyKey, readonly HarmonyStep[]> = {
  complementary: [{ dh: 0, dl: 0 }, { dh: 180, dl: 0 }],
  analogous: [{ dh: 0, dl: 0 }, { dh: -30, dl: 0 }, { dh: 30, dl: 0 }],
  triadic: [{ dh: 0, dl: 0 }, { dh: 120, dl: 0 }, { dh: 240, dl: 0 }],
  tetradic: [
    { dh: 0, dl: 0 },
    { dh: 60, dl: 0 },
    { dh: 180, dl: 0 },
    { dh: 240, dl: 0 },
  ],
  splitComplementary: [{ dh: 0, dl: 0 }, { dh: 150, dl: 0 }, { dh: 210, dl: 0 }],
  square: [
    { dh: 0, dl: 0 },
    { dh: 90, dl: 0 },
    { dh: 180, dl: 0 },
    { dh: 270, dl: 0 },
  ],
  monochromatic: [
    { dh: 0, dl: 0 },
    { dh: 0, dl: -25 },
    { dh: 0, dl: -12 },
    { dh: 0, dl: 12 },
    { dh: 0, dl: 25 },
  ],
  accentedAnalogous: [
    { dh: 0, dl: 0 },
    { dh: -30, dl: 0 },
    { dh: 30, dl: 0 },
    { dh: 180, dl: 0 },
  ],
};

function clamp(n: number, min: number, max: number): number {
  return n < min ? min : n > max ? max : n;
}

/**
 * The HSL a fresh (unlocked) slot at position `index` would take, given a
 * seed HSL and harmony. Cycles the harmony's canonical pattern via modulo so
 * any slot count works, not just the harmony's "natural" swatch count (e.g. a
 * 6-slot complementary scheme alternates the seed/opposite pair three times).
 */
export function harmonySlotHsl(harmony: HarmonyKey, seed: Hsl, index: number): Hsl {
  const pattern = HARMONY_PATTERNS[harmony];
  const step = pattern[index % pattern.length]!;
  return {
    h: clampHue(seed.h + step.dh),
    s: seed.s,
    l: clamp(seed.l + step.dl, 6, 94),
  };
}

/** The harmony's natural swatch count (its canonical pattern length) — e.g.
 *  complementary=2, triadic=3, tetradic=4, monochromatic=5. Drives "Generate"
 *  auto-adding enough slots that a single click always yields a visible
 *  multi-colour scheme instead of silently filling just 1 slot. */
export function harmonyNaturalSlotCount(harmony: HarmonyKey): number {
  return HARMONY_PATTERNS[harmony].length;
}

/**
 * Fill `count` slots from a seed + harmony. Index 0 is always the seed
 * itself (every harmony pattern starts at `{dh:0, dl:0}`).
 */
export function fillHarmonyHexes(harmony: HarmonyKey, seed: Hsl, count: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const hsl = harmonySlotHsl(harmony, seed, i);
    out.push(hslToHex(hsl.h, hsl.s, hsl.l));
  }
  return out;
}
