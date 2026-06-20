"use client";

import { Panel } from "@/components/kit";
import { hexHue } from "@/lib/palette";
import type { Paint } from "@/lib/types";

/**
 * Hue coverage map: a vertical spectrum with owned/wishlisted paints overlaid by hue.
 * Clicking a region emits the hue so the host/grid can jump to it.
 */
export function ColorMapRail({
  paints,
  onJumpHue,
}: {
  paints: Paint[];
  onJumpHue?: (hue: number) => void;
}) {
  const markers = paints.map((p) => ({
    id: p.id,
    top: (hexHue(p.hex) / 360) * 100,
    owned: p.owned,
    wishlisted: p.wishlisted,
  }));

  return (
    // min-h-0 lets the spectrum flex-fill the panel; on desktop the whole map
    // fits inside the rail without scrolling (hASzc).
    <Panel
      label="COLOR MAP"
      accent="green"
      cornerTicks
      className="flex min-h-0 w-full shrink-0 flex-col p-3 lg:w-[180px]"
    >
      <div className="mb-2 flex flex-col gap-1 label-osd text-fg">
        <span className="text-fg">1 dot = 1 paint</span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full border border-black bg-yellow" /> Wishlist
          <span className="ml-2 h-2.5 w-2.5 rounded-full border border-black bg-green" /> Owned
        </span>
      </div>
      <button
        type="button"
        aria-label="Hue coverage map — click to jump"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const ratio = (e.clientY - rect.top) / rect.height;
          onJumpHue?.(Math.max(0, Math.min(1, ratio)) * 360);
        }}
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
      </button>
    </Panel>
  );
}
