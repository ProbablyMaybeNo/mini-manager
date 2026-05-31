import type { Route } from "next";
import { ToolCard, type ToolTone } from "@/components/tools/ToolCard";

interface ToolEntry {
  href: Route;
  glyph: string;
  title: string;
  blurb: string;
  tone: ToolTone;
}

/**
 * The four colour tools a painter opens mid-recipe and hands back into a
 * scheme. Each tool gets one slot in the locked 5-color palette so the
 * index reads as a coloured launcher: wheel = pastel purple ("special"),
 * match = cyan ("primary action"), eyedropper = neon green ("complete
 * / capture"), gradient = pastel yellow ("wanted / planning"). One
 * line of plain prose per tool, ≤ ~80 chars. P11.8 + P11.12.
 */
const TOOLS: ReadonlyArray<ToolEntry> = [
  {
    href: "/tools/wheel" as Route,
    glyph: "◍",
    title: "Colour Wheel",
    blurb: "Pick a hue + harmony, see the closest paint in your library.",
    tone: "purple",
  },
  {
    href: "/tools/match" as Route,
    glyph: "≈",
    title: "Cross-brand Match",
    blurb: "Paste a hex, get the closest paints ranked across every brand.",
    tone: "cyan",
  },
  {
    href: "/tools/eyedropper" as Route,
    glyph: "◎",
    title: "Image Eyedropper",
    blurb: "Drop a reference image, extract the dominant colours and paints.",
    tone: "green",
  },
  {
    href: "/tools/gradient" as Route,
    glyph: "▤",
    title: "Gradient Builder",
    blurb: "Plan a base → highlight ramp with the closest paint per step.",
    tone: "yellow",
  },
];

export default function ToolsPage() {
  return (
    <div className="p-6 md:p-8 max-w-6xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl tracking-wide">TOOLS</h1>
        <p className="text-sm text-[var(--color-fg-muted)] max-w-2xl font-sans leading-snug">
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
            tone={t.tone}
          />
        ))}
      </div>
    </div>
  );
}
