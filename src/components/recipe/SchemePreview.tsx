"use client";

import { Swatch } from "@/components/kit";
import { captionScrim, readableText } from "@/lib/color";
import type { RecipeSlot } from "@/lib/types";

/**
 * DOP-011 — a live preview of the ordered scheme as the painter builds it.
 * Renders the slots base→highlight as a stacked run of labelled swatches so the
 * whole layering reads at a glance, the way it will on the recipe list / card.
 * Pure display; the editor stays the source of truth.
 */
export function SchemePreview({ slots }: { slots: RecipeSlot[] }) {
  if (slots.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 border border-cyan/20 bg-bg/40 p-3">
      <span className="label-osd text-cyan">▸ Live scheme · base → highlight</span>
      {/* The continuous strip mirrors the recipe-list preview — one block per
          layer, in order, with the layer label printed on the swatch in a
          contrast-safe ink. */}
      <div className="flex h-12 w-full overflow-hidden border border-fg/20">
        {slots.map((s, i) => (
          <span
            key={i}
            className="flex flex-1 items-center justify-center px-1 text-center leading-tight"
            style={{
              backgroundColor: s.swatch,
              color: readableText(s.swatch),
              textShadow: captionScrim(s.swatch),
            }}
            title={`${i + 1}. ${s.name}${s.layer ? " · " + s.layer : ""}`}
          >
            <span className="truncate label-osd opacity-90">{s.layer || s.name}</span>
          </span>
        ))}
      </div>
      {/* A compact index legend so a tiny strip cell still maps to a paint. */}
      <ol className="flex flex-wrap gap-x-3 gap-y-1">
        {slots.map((s, i) => (
          <li key={i} className="flex items-center gap-1.5 font-body text-body text-fg">
            <Swatch hex={s.swatch} size="sm" />
            <span className="text-fg-faint">{i + 1}.</span>
            <span className="truncate">{s.layer ? `${s.layer} — ${s.name}` : s.name}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * DOP-011 — the empty-state slot for a brand-new recipe: a worked example of a
 * three-layer scheme (base → midtone → highlight) so the painter sees what a
 * "good" recipe looks like before adding their first paint.
 */
export function EmptySchemeExample() {
  const example: { hex: string; layer: string; name: string }[] = [
    { hex: "#3a2a1e", layer: "Base", name: "Dark brown basecoat" },
    { hex: "#8a5a32", layer: "Layer", name: "Mid leather" },
    { hex: "#d9a566", layer: "Highlight", name: "Bone highlight" },
  ];
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <span aria-hidden className="font-osd text-3xl text-fg-faint/40">
        ⌖
      </span>
      <p className="label-osd tracking-[0.18em] text-fg">No slots yet</p>
      <p className="max-w-md font-body text-body text-fg">
        A recipe is an ordered stack of paints — base coat first, highlights
        last. Add your first paint layer to start. For example:
      </p>
      {/* The example is decorative/illustrative only — no interactive slots,
          so it never persists into the recipe. */}
      <div
        aria-label="Example three-layer scheme"
        className="flex h-12 w-full max-w-md overflow-hidden border border-fg/20 opacity-90"
      >
        {example.map((s, i) => (
          <span
            key={i}
            className="flex flex-1 items-center justify-center px-1 text-center leading-tight"
            style={{ backgroundColor: s.hex, color: readableText(s.hex), textShadow: captionScrim(s.hex) }}
          >
            <span className="truncate label-osd opacity-90">{s.layer}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
