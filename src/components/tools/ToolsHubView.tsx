"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Panel } from "@/components/kit";
import { PageHeader } from "@/components/shell";
import { SubscribeGateDialog } from "@/components/billing/SubscribeGateDialog";
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
  /** True for tools that spend AI tokens per use, and so stay behind the
   *  sponsor gate. Only the Paint Scanner qualifies — the four colour tools
   *  are client-side maths and cost nothing to run. */
  requiresPro?: boolean;
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
    requiresPro: true,
  },
];

export function ToolsHubView() {
  const isSubscriber = useSubscriber();
  const [gateOpen, setGateOpen] = useState(false);
  return (
    <div className="flex h-full flex-col gap-4 p-3 md:gap-6 md:p-6">
      <PageHeader
        title="TOOLS"
        tagline="// colour utilities — turn an idea, photo, or colour into named, buyable paints"
      />
      {/* Names the ONE tool that costs money, not the whole hub. The banner
          used to say "these tools unlock when you sponsor" while locking all
          five; four are free now, so saying that would be false — and a lock
          the user can't explain is worse than no lock at all. The phone
          reasoning from paywall audit MUX-P08 still holds: PageHeader's
          tagline is `roomy:`-gated and therefore invisible on a phone, so the
          price has to live outside the tagline slot. */}
      {!isSubscriber && (
        <Panel accent="cyan" className="p-3">
          <button
            type="button"
            onClick={() => setGateOpen(true)}
            className="flex min-h-12 w-full items-center justify-between gap-2 text-left font-body text-body text-cyan-lite transition-colors hover:text-glow-cyan"
          >
            <span>
              🔒 Every tool here is free except the Paint Scanner, which reads
              your photos with AI · $3.99/mo
            </span>
            <span aria-hidden>→</span>
          </button>
        </Panel>
      )}
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
                  {t.requiresPro && !isSubscriber && (
                    <span
                      aria-hidden
                      className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border border-cyan/60 bg-black/70 text-body text-cyan-lite"
                    >
                      🔒
                    </span>
                  )}
                </div>
                {/* The Panel label above already prints the tool name, so this
                    heading repeated it verbatim on every card — six cards, each
                    saying its own name twice, over a 1763px scroll for what is a
                    six-item menu (MUX-011). The name survives for screen readers
                    via the sr-only heading, which also keeps the h2 outline. */}
                <div>
                  <h2 className="sr-only">
                    {t.title}
                    {t.requiresPro && !isSubscriber && (
                      <span> (sponsor access only)</span>
                    )}
                  </h2>
                  <p className="font-body text-body text-fg">{t.blurb}</p>
                </div>
              </Panel>
            </Link>
          );
        })}
      </div>
      <SubscribeGateDialog open={gateOpen} onClose={() => setGateOpen(false)} />
    </div>
  );
}
