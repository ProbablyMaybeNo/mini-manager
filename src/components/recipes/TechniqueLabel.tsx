import type { TechniqueKey } from "@/db/schema";

const LABELS: Record<TechniqueKey, string> = {
  // Phase-12 locked layer set (P12.3)
  undercoat: "Undercoat",
  basecoat: "Basecoat",
  midcoat: "Midcoat",
  highlight: "Highlight",
  edge_highlight: "Edge Highlight",
  wash: "Wash",
  detail: "Detail",
  metallic: "Metallic",
  // Legacy keys — kept so already-saved recipes still render
  layer: "Layer",
  drybrush: "Drybrush",
  glaze: "Glaze",
  stipple: "Stipple",
  wet_blend: "Wet Blend",
  two_thin_coats: "Two Thin Coats",
  zenithal_prime: "Zenithal Prime",
};

export function techniqueLabel(key: TechniqueKey): string {
  return LABELS[key];
}

export function TechniqueLabel({ value }: { value: TechniqueKey }) {
  return (
    <span className="font-mono text-xs uppercase tracking-wider">
      {LABELS[value]}
    </span>
  );
}
