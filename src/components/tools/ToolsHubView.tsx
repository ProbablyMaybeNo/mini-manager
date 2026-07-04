"use client";

import Link from "next/link";
import { Panel } from "@/components/kit";
import { PageHeader } from "@/components/shell";
import { TOOL_THUMBS } from "./ToolThumbnails";

interface ToolCard {
  href: string;
  title: string;
  blurb: string;
}

const TOOLS: ToolCard[] = [
  { href: "/tools/wheel", title: "Color Wheel", blurb: "Explore, experiment, and find the perfect color combos." },
  { href: "/tools/match", title: "Color Match", blurb: "Match paints across companies and harmonies." },
  { href: "/tools/dropper", title: "Color Dropper", blurb: "Use uploaded images to find the perfect paints." },
  { href: "/tools/stacking", title: "Color Stacking", blurb: "Stack paints and determine the perfect layering." },
];

export function ToolsHubView() {
  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <PageHeader
        title="TOOLS"
        tagline="// colour utilities — turn an idea, photo, or colour into named, buyable paints"
      />
      <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
        {TOOLS.map((t) => {
          // p9DIDc — bespoke phosphor SVG thumbnail per tool.
          const Thumb = TOOL_THUMBS[t.href];
          return (
            <Link key={t.href} href={t.href} className="group">
              <Panel
                label={t.title.toUpperCase()}
                cornerTicks
                className="flex h-full flex-col gap-4 p-6 transition-colors group-hover:border-cyan group-hover:glow-cyan"
              >
                <div className="relative aspect-[16/9] w-full overflow-hidden border border-cyan/20 bg-black transition-transform duration-500 group-hover:scale-[1.02]">
                  {Thumb ? <Thumb /> : null}
                </div>
                <div>
                  <h2 className="label-osd text-cyan-lite">
                    {t.title}
                  </h2>
                  <p className="mt-1 font-body text-body text-fg">{t.blurb}</p>
                </div>
              </Panel>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
