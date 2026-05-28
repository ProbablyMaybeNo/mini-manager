import type { TechniqueKey } from "@/db/schema";

const LABELS: Record<TechniqueKey, string> = {
  basecoat: "Basecoat",
  layer: "Layer",
  wash: "Wash",
  drybrush: "Drybrush",
  edge_highlight: "Edge Highlight",
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
