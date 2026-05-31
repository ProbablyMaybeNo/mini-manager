/**
 * StageCounter readable-label tables (P11.1).
 *
 * Pure constants extracted from `StageCounter.tsx` so they can be
 * unit-tested without dragging the `'use client'` React tree (and its
 * transitive server-action imports) into a Node test environment.
 * The component re-exports these for the existing test surface; this
 * module is the single source of truth for the label contract.
 */

import type { CounterStage } from "@/lib/counters/cascade";

export const PANEL_STAGES = [
  "build",
  "prime",
  "paint",
  "base",
  "complete",
] as const;
export type PanelStage = (typeof PANEL_STAGES)[number];

/**
 * Stage labels as they appear in the UI. `complete` reads as "DONE" —
 * cleaner, more concrete, matches the spoken painter vocabulary. The
 * schema column stays `completeCount`; this is a UI string only.
 */
export const STAGE_LABEL: Readonly<Record<CounterStage, string>> = {
  owned: "OWNED",
  build: "BUILD",
  prime: "PRIME",
  paint: "PAINT",
  base: "BASE",
  complete: "DONE",
};

/**
 * Per-stage tone for the row label, drawn from the locked 5-color
 * palette. Cyan for the early "you're starting" stages; pastel yellow
 * for the painting stages where the model is on the desk; neon green
 * for done.
 */
export const STAGE_TONE: Readonly<Record<PanelStage, string>> = {
  build: "text-[var(--color-cyan)]",
  prime: "text-[var(--color-cyan)]",
  paint: "text-[var(--color-yellow)]",
  base:  "text-[var(--color-yellow)]",
  complete: "text-[var(--color-green)]",
};

/**
 * Per-stage ProgressBar tone matching the row label, so the bar reads
 * as the same colour as the stage name at a glance.
 */
export const STAGE_BAR_TONE: Readonly<
  Record<PanelStage, "info" | "wishlist" | "ok">
> = {
  build: "info",
  prime: "info",
  paint: "wishlist",
  base:  "wishlist",
  complete: "ok",
};

/**
 * Keyboard shortcut glyph shown next to each stage label, small + dim.
 * Used to retire the bracket-chrome `[ B ] build · [ P ] prime` legend
 * in favour of inline-with-the-row annotations.
 */
export const STAGE_SHORTCUT: Readonly<Record<PanelStage, string>> = {
  build: "B",
  prime: "P",
  paint: "A",
  base:  "S",
  complete: "C",
};
