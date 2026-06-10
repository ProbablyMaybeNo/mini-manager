import type { ReactNode } from "react";
import type { Route } from "next";
import { ToolCard, type ToolTone } from "@/components/tools/ToolCard";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  WheelHero,
  MatchHero,
  EyedropperHero,
  GradientHero,
} from "@/components/tools/ToolHeroes";

interface ToolEntry {
  href: Route;
  glyph: string;
  title: string;
  blurb: string;
  tone: ToolTone;
  techLabel: string;
  hero: ReactNode;
}

/** FIGMA-REBUILD §6 — 2×2 launcher grid with bespoke SVG heroes. */
const TOOLS: ReadonlyArray<ToolEntry> = [
  {
    href: "/tools/wheel" as Route,
    glyph: "◍",
    title: "Color wheel",
    blurb: "Pick a hue + harmony, see the closest paint in your library.",
    tone: "green",
    techLabel: "MOD ▸ 01",
    hero: <WheelHero className="h-[88px] w-full" />,
  },
  {
    href: "/tools/match" as Route,
    glyph: "≈",
    title: "Color match",
    blurb: "Paste a hex, get the closest paints ranked across every brand.",
    tone: "yellow",
    techLabel: "MOD ▸ 02",
    hero: <MatchHero className="h-[88px] w-full" />,
  },
  {
    href: "/tools/eyedropper" as Route,
    glyph: "◎",
    title: "Color dropper",
    blurb: "Drop a reference image, extract the dominant colours and paints.",
    tone: "purple",
    techLabel: "MOD ▸ 03",
    hero: <EyedropperHero className="h-[88px] w-full" />,
  },
  {
    href: "/tools/gradient" as Route,
    glyph: "▤",
    title: "Color stacking",
    blurb: "Plan a base → highlight ramp with the closest paint per step.",
    tone: "cyan",
    techLabel: "MOD ▸ 04",
    hero: <GradientHero className="h-[88px] w-full" />,
  },
];

export default function ToolsPage() {
  return (
    <div className="content-cap space-y-6 p-6 md:p-8">
      <PageHeader
        title="TOOLS"
        accent="cyan"
        tagline="Single-purpose colour utilities. Open one mid-recipe, pull a swatch, hand it back into a scheme."
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {TOOLS.map((t) => (
          <ToolCard
            key={t.href}
            href={t.href}
            glyph={t.glyph}
            title={t.title}
            blurb={t.blurb}
            tone={t.tone}
            techLabel={t.techLabel}
            hero={t.hero}
          />
        ))}
      </div>
    </div>
  );
}
