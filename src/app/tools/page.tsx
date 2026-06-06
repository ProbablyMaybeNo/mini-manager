import type { Route } from "next";
import { ToolCard, type ToolTone } from "@/components/tools/ToolCard";

interface ToolEntry {
  href: Route;
  glyph: string;
  title: string;
  blurb: string;
  tone: ToolTone;
  /** Diegetic port tag rendered on the tile's top border (terminal chrome). */
  techLabel: string;
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
    techLabel: "MOD ▸ 01",
  },
  {
    href: "/tools/match" as Route,
    glyph: "≈",
    title: "Cross-brand Match",
    blurb: "Paste a hex, get the closest paints ranked across every brand.",
    tone: "cyan",
    techLabel: "MOD ▸ 02",
  },
  {
    href: "/tools/eyedropper" as Route,
    glyph: "◎",
    title: "Image Eyedropper",
    blurb: "Drop a reference image, extract the dominant colours and paints.",
    tone: "green",
    techLabel: "MOD ▸ 03",
  },
  {
    href: "/tools/gradient" as Route,
    glyph: "▤",
    title: "Layering",
    blurb: "Plan a base → highlight ramp with the closest paint per step.",
    tone: "yellow",
    techLabel: "MOD ▸ 04",
  },
];

export default function ToolsPage() {
  return (
    <div className="p-6 md:p-8 max-w-6xl space-y-6">
      {/* Terminal banner — coordinate caption above the display-font title,
          mirroring the Library / Dashboard heroes so Tools reads as the
          same mission-control surface. */}
      <header className="space-y-2">
        <p className="font-mono text-2xs uppercase tracking-[0.2em] text-[var(--color-cyan)]">
          SYS ▸ TOOLS / 04
        </p>
        <h1 className="title-display text-base md:text-lg">TOOLS</h1>
        <p className="text-sm text-[var(--color-fg-muted)] max-w-2xl font-sans leading-snug pt-1">
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
            techLabel={t.techLabel}
          />
        ))}
      </div>
    </div>
  );
}
