"use client";

import { useState } from "react";
import { Panel } from "@/components/kit";
import { hexHue } from "@/lib/palette";
import type { Paint } from "@/lib/types";

/** Coarse hue-band name for a 0–360 hue — the hover readout's label. */
function hueName(hue: number): string {
  const bands: [number, string][] = [
    [15, "Red"],
    [45, "Orange"],
    [70, "Yellow"],
    [160, "Green"],
    [200, "Cyan"],
    [255, "Blue"],
    [290, "Violet"],
    [330, "Magenta"],
    [360, "Red"],
  ];
  for (const [max, name] of bands) if (hue < max) return name;
  return "Red";
}

/**
 * Hue coverage map: a vertical spectrum with owned/wishlisted paints overlaid by hue.
 * Clicking a region emits the hue so the host/grid can jump to it.
 *
 * DOP-008 — the rail now gives hover feedback: a tracking guide line + a live
 * hue readout (degrees + band name) follows the cursor so the click target is
 * legible before you commit, and each coverage dot carries a tooltip naming the
 * paint it represents.
 */
export function ColorMapRail({
  paints,
  onJumpHue,
}: {
  paints: Paint[];
  onJumpHue?: (hue: number) => void;
}) {
  const [hover, setHover] = useState<{ ratio: number; hue: number } | null>(null);

  const markers = paints.map((p) => ({
    id: p.id,
    top: (hexHue(p.hex) / 360) * 100,
    owned: p.owned,
    wishlisted: p.wishlisted,
    label: `${p.name} — ${p.brand}${p.owned ? " · owned" : ""}${p.wishlisted ? " · wishlist" : ""}`,
  }));

  function ratioFromEvent(e: React.MouseEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
  }

  return (
    // min-h-0 lets the spectrum flex-fill the panel; on desktop the whole map
    // fits inside the rail without scrolling (hASzc).
    <Panel
      label="COLOR MAP"
      accent="green"
      cornerTicks
      className="flex min-h-0 w-full shrink-0 flex-col p-3 lg:w-[180px]"
    >
      {/* Legend deliberately broken out of the H2 category (it sits in a narrow
          180px rail): bespoke Flexi at a small fixed size so the lines fit
          without wrapping one-word-per-line. */}
      <div
        className="mb-2 flex flex-col gap-0.5 text-[11px] leading-tight text-fg"
        style={{ fontFamily: '"Flexi IBM VGA True", "IBM Plex Mono", monospace' }}
      >
        <span className="text-fg">1 dot = 1 paint</span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full border border-black bg-yellow" /> Wishlist
          <span className="ml-2 h-2.5 w-2.5 rounded-full border border-black bg-green" /> Owned
        </span>
      </div>
      <button
        type="button"
        aria-label="Hue coverage map — click to jump"
        onClick={(e) => onJumpHue?.(ratioFromEvent(e) * 360)}
        onMouseMove={(e) => {
          const ratio = ratioFromEvent(e);
          setHover({ ratio, hue: ratio * 360 });
        }}
        onMouseLeave={() => setHover(null)}
        // On mobile a fixed height; on desktop flex-fill the remaining panel
        // height so the entire spectrum is visible without scrolling.
        className="relative h-72 w-full min-h-0 flex-1 cursor-pointer border border-fg/20 lg:h-auto"
        style={{
          background:
            "linear-gradient(to bottom, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)",
        }}
      >
        {markers
          // Only owned/wishlisted paints get a marker — no-status cells stay
          // bare so the spectrum reads cleanly behind the coverage dots.
          .filter((m) => m.owned || m.wishlisted)
          // Render owned (green) after wishlist so it sits on top where hues
          // collide — owned coverage is the stronger signal.
          .sort((a, b) => Number(a.owned) - Number(b.owned))
          .map((m) => (
            <span
              key={m.id}
              // DOP-008 — title names the paint so hovering a dot tells you
              // which pot it represents.
              title={m.label}
              // Circle/dot coverage indicators (7RFkgNxn5Cl6): green = owned,
              // yellow = wishlist, each with a 2px black stroke so they read at a
              // glance against the spectrum. Sized a touch larger than the exact
              // paint position for scannability — owned dots sort on top.
              className="absolute left-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-black"
              style={{
                top: `${m.top}%`,
                backgroundColor: m.owned ? "#51fd80" : "#eef996",
              }}
            />
          ))}

        {/* DOP-008 — hover guide: a horizontal tracking line + a live hue
            readout (degrees + band name) so the click target is legible before
            committing. Pointer-events-none so it never eats the click. */}
        {hover && (
          <>
            <span
              aria-hidden
              className="pointer-events-none absolute left-0 right-0 h-px bg-black/70"
              style={{ top: `${hover.ratio * 100}%` }}
            />
            <span
              aria-hidden
              className="pointer-events-none absolute right-1 -translate-y-1/2 whitespace-nowrap border border-black bg-bg/90 px-1 py-0.5 text-[10px] leading-none text-fg"
              style={{ top: `${hover.ratio * 100}%` }}
            >
              {Math.round(hover.hue)}° {hueName(hover.hue)}
            </span>
          </>
        )}
      </button>
    </Panel>
  );
}
