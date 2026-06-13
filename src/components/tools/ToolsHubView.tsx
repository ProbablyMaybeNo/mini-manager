"use client";

import Image from "next/image";
import Link from "next/link";
import { Panel } from "@/components/kit";
import { PageHeader } from "@/components/shell";

interface ToolCard {
  href: string;
  title: string;
  blurb: string;
  graphic: string;
}

const TOOLS: ToolCard[] = [
  { href: "/tools/wheel", title: "Color Wheel", blurb: "Explore, experiment, and find the perfect color combos.", graphic: "/tools/wheel.png" },
  { href: "/tools/match", title: "Color Match", blurb: "Match paints across companies and harmonies.", graphic: "/tools/match.png" },
  { href: "/tools/dropper", title: "Color Dropper", blurb: "Use uploaded images to find the perfect paints.", graphic: "/tools/dropper.png" },
  { href: "/tools/stacking", title: "Color Stacking", blurb: "Stack paints and determine the perfect layering.", graphic: "/tools/stacking.png" },
];

export function ToolsHubView() {
  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <PageHeader
        title="TOOLS"
        tagline="Colour utilities — turn an idea, photo, or colour into named, buyable paints."
      />
      <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
        {TOOLS.map((t) => (
          <Link key={t.href} href={t.href} className="group">
            <Panel
              label={t.title.toUpperCase()}
              cornerTicks
              className="flex h-full flex-col gap-4 overflow-hidden p-6 transition-colors group-hover:border-cyan group-hover:glow-cyan"
            >
              <div className="relative aspect-[16/9] w-full overflow-hidden border border-cyan/20 bg-black">
                <Image
                  src={t.graphic}
                  alt={`${t.title} graphic`}
                  fill
                  sizes="(max-width: 640px) 100vw, 50vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <div>
                <h2 className="font-osd text-sm uppercase tracking-[0.18em] text-cyan">
                  {t.title}
                </h2>
                <p className="mt-1 font-mono text-xs text-fg-dim">{t.blurb}</p>
              </div>
            </Panel>
          </Link>
        ))}
      </div>
    </div>
  );
}
