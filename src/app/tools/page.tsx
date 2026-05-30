import type { Route } from "next";
import { ToolCard } from "@/components/tools/ToolCard";

interface ToolEntry {
  href: Route;
  glyph: string;
  title: string;
  blurb: string;
}

/**
 * The four colour tools a painter opens mid-recipe and hands back into a
 * scheme. Wheel and Match are ports from v1; Eyedropper and Gradient are
 * new. Each tool's page handles its own input → output → "send to recipe"
 * action loop.
 */
const TOOLS: ReadonlyArray<ToolEntry> = [
  {
    href: "/tools/wheel" as Route,
    glyph: "◍",
    title: "Colour Wheel",
    blurb:
      "Pick a hue + harmony — complementary, triadic, analogous, eight modes total — and find the closest paint in your library for each swatch.",
  },
  {
    href: "/tools/match" as Route,
    glyph: "≈",
    title: "Cross-brand Match",
    blurb:
      "Paste a hex (or pick a paint) and see the top matches across every brand, ranked by ΔE2000 with a traffic-light confidence dot.",
  },
  {
    href: "/tools/eyedropper" as Route,
    glyph: "◎",
    title: "Image Eyedropper",
    blurb:
      "Drop a reference image. K-means extracts six dominant colours and surfaces the three closest paints for each.",
  },
  {
    href: "/tools/gradient" as Route,
    glyph: "▤",
    title: "Gradient Builder",
    blurb:
      "Pick base + shadow + highlight; get a 3–7 step Lab-space ramp with the closest paint per step. Plan transitions before you mix.",
  },
];

export default function ToolsPage() {
  return (
    <div className="p-6 md:p-8 max-w-6xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl tracking-wide">TOOLS</h1>
        <p className="text-sm text-[var(--color-fg-muted)] max-w-2xl font-sans">
          Single-purpose colour utilities. Open one mid-recipe, pull a
          swatch, hand it back into a scheme. Every tool ends in one
          click → recipe.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {TOOLS.map((t) => (
          <ToolCard
            key={t.href}
            href={t.href}
            glyph={t.glyph}
            title={t.title}
            blurb={t.blurb}
          />
        ))}
      </div>
    </div>
  );
}
