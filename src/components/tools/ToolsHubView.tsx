"use client";

import Image from "next/image";
import Link from "next/link";
import { Panel } from "@/components/kit";
import { PageHeader } from "@/components/shell";
import { useSubscriber } from "@/lib/billing/SubscriberContext";
import { TOOL_THUMBS } from "./ToolThumbnails";

interface ToolCard {
  href: string;
  title: string;
  blurb: string;
  /** Optional raster thumbnail (from /public) — rendered instead of the
   *  bespoke SVG phosphor thumb when set. Shown object-contain on the black
   *  tile, so a black-background asset blends in seamlessly. */
  image?: string;
}

const TOOLS: ToolCard[] = [
  { href: "/tools/wheel", title: "Color Wheel", blurb: "Explore, experiment, and find the perfect color combos." },
  { href: "/tools/match", title: "Color Match", blurb: "Match paints across companies and harmonies." },
  { href: "/tools/dropper", title: "Color Dropper", blurb: "Use uploaded images to find the perfect paints." },
  { href: "/tools/stacking", title: "Color Stacking", blurb: "Stack paints and determine the perfect layering." },
  {
    href: "/tools/scan",
    title: "Paint Scanner",
    blurb: "Snap a photo of your paints — we read the labels and add them to your collection.",
    image: "/tools/scan.png",
  },
];

export function ToolsHubView() {
  const isSubscriber = useSubscriber();
  return (
    <div className="flex h-full flex-col gap-4 p-3 md:gap-6 md:p-6">
      <PageHeader
        title="TOOLS"
        tagline={
          isSubscriber
            ? "// colour utilities — turn an idea, photo, or colour into named, buyable paints"
            : "// colour utilities — sponsor to unlock the full toolset"
        }
        taglineClassName="hidden md:block"
      />
      <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4">
        {TOOLS.map((t) => {
          // p9DIDc — bespoke phosphor SVG thumbnail per tool, or a raster image.
          const Thumb = TOOL_THUMBS[t.href];
          return (
            <Link key={t.href} href={t.href} className="group">
              <Panel
                label={t.title.toUpperCase()}
                cornerTicks
                className="flex h-full flex-col gap-3 p-3 transition-colors group-hover:border-cyan group-hover:glow-cyan md:gap-4 md:p-6"
              >
                <div className="relative aspect-[16/9] w-full overflow-hidden border border-cyan/20 bg-black transition-transform duration-500 group-hover:scale-[1.02]">
                  {t.image ? (
                    <Image
                      src={t.image}
                      alt=""
                      fill
                      sizes="(max-width: 640px) 100vw, 50vw"
                      className="object-contain"
                    />
                  ) : Thumb ? (
                    <Thumb />
                  ) : null}
                  {!isSubscriber && (
                    <span
                      aria-hidden
                      className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border border-cyan/60 bg-black/70 text-body text-cyan-lite"
                    >
                      🔒
                    </span>
                  )}
                </div>
                <div>
                  <h2 className="label-osd text-cyan-lite">
                    {t.title}
                    {!isSubscriber && <span className="sr-only"> (sponsor access only)</span>}
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
