"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Input } from "@/components/kit";
import type { InspoRef } from "@/lib/types";

/**
 * INSPIRATION board (ZsWm). Reference URLs render as image thumbnails in a
 * grid; double-clicking a thumb opens a full-size popup overlay, which closes
 * on outside-click (or Escape). Empty cells show a "+" placeholder so the grid
 * always reads as a board.
 */
export function InspoBoard({
  inspo,
  onAddInspo,
  onRemoveInspo,
}: {
  inspo: InspoRef[];
  onAddInspo?: (url: string) => void;
  onRemoveInspo?: (id: string) => void;
}) {
  const [url, setUrl] = useState("");
  const [zoomed, setZoomed] = useState<InspoRef | null>(null);

  function add() {
    const v = url.trim();
    if (!v) return;
    onAddInspo?.(v);
    setUrl("");
  }

  const cells = Math.max(7, inspo.length);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Input
          name="focus-inspo"
          placeholder="Paste URL to add inspo"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          containerClassName="flex-1"
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <Button variant="secondary" onClick={add}>
          Add
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-7">
        {Array.from({ length: cells }).map((_, i) => {
          const ref = inspo[i];
          return (
            <div
              key={ref?.id || i}
              className="group relative aspect-square overflow-hidden border border-cyan/40 bg-bg-raised/30"
            >
              {ref ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={ref.url}
                    alt="Inspiration reference"
                    onDoubleClick={() => setZoomed(ref)}
                    title="Double-click to enlarge"
                    className="h-full w-full cursor-zoom-in object-cover"
                    // If the URL isn't a direct image, fall back to showing the
                    // raw link text rather than a broken-image glyph.
                    onError={(e) => {
                      const el = e.currentTarget;
                      el.style.display = "none";
                      const sib = el.nextElementSibling as HTMLElement | null;
                      if (sib) sib.style.display = "flex";
                    }}
                  />
                  <span
                    style={{ display: "none" }}
                    onDoubleClick={() => setZoomed(ref)}
                    className="absolute inset-0 cursor-zoom-in items-center justify-center p-1 text-center"
                  >
                    <span className="truncate font-mono text-[12px] text-fg-dim">{ref.url}</span>
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove reference ${i + 1}`}
                    onClick={() => onRemoveInspo?.(ref.id)}
                    className="absolute right-0.5 top-0.5 bg-bg/70 px-1 font-osd text-[12px] text-fg-faint opacity-0 transition-opacity hover:text-red group-hover:opacity-100"
                  >
                    ✕
                  </button>
                </>
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <span aria-hidden className="font-osd text-fg-faint/30">
                    +
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {zoomed && <InspoZoom ref_={zoomed} onClose={() => setZoomed(null)} />}
    </div>
  );
}

/** Full-size popup overlay; closes on outside-click or Escape. */
function InspoZoom({ ref_, onClose }: { ref_: InspoRef; onClose: () => void }) {
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Inspiration preview"
      // Outside-click: the backdrop's onClick fires only when the click lands
      // on the backdrop itself, not inside the framed image.
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-bg/80 p-6 backdrop-blur-sm motion-safe:animate-[content-in_180ms_ease-out]"
    >
      <div
        ref={frameRef}
        className="relative max-h-[90vh] max-w-[90vw] border border-cyan/60 bg-bg p-2 shadow-[0_0_40px_rgba(0,210,255,0.25)]"
      >
        <button
          type="button"
          aria-label="Close preview"
          onClick={onClose}
          className="absolute right-1 top-1 z-10 bg-bg/70 px-2 py-0.5 font-osd text-xs text-cyan hover:text-red"
        >
          ✕
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={ref_.url}
          alt="Inspiration reference (enlarged)"
          className="max-h-[85vh] max-w-[85vw] object-contain"
        />
        <p className="mt-1 truncate font-mono text-[12px] text-fg-dim">{ref_.url}</p>
      </div>
    </div>
  );
}
