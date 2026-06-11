"use client";

import { useState } from "react";
import { Button, Panel, Swatch } from "@/components/kit";
import { cn } from "@/lib/cn";
import type { Paint } from "@/lib/types";

/**
 * Drop/capture an image → host extracts dominant colours → click a swatch to add it to the
 * palette. Extraction is host-provided (extractedColors); the UI only sends the file out.
 */
export function EyedropperTool({
  extractedColors,
  closestPaint,
  onImageDropped,
  onSavePalette,
  onSendToRecipe,
}: {
  extractedColors: string[];
  closestPaint: (hex: string) => Paint | null;
  onImageDropped: (file: File) => void;
  onSavePalette: (hexes: string[]) => void;
  onSendToRecipe: (paints: Paint[]) => void;
}) {
  const [hasImage, setHasImage] = useState(false);
  const [palette, setPalette] = useState<string[]>([]);

  function handleFile(file?: File | null) {
    if (!file) return;
    onImageDropped(file);
    setHasImage(true);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <Panel label="IMAGE" className="flex flex-col gap-4 p-5">
        <label
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFile(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            "flex h-48 cursor-pointer flex-col items-center justify-center gap-2 border border-dashed border-cyan/50 text-center hover:border-cyan",
          )}
        >
          <span className="font-osd text-sm uppercase tracking-[0.18em] text-cyan">
            ⬚ Drop or capture image
          </span>
          <span className="font-mono text-[11px] text-fg-faint">
            {hasImage ? "Image loaded — dominant colours extracted →" : "PNG / JPG · click or drag"}
          </span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </label>

        <div>
          <span className="font-osd text-[10px] uppercase tracking-[0.18em] text-fg-dim">
            Extracted dominant colours
          </span>
          <div className="mt-2 flex flex-wrap gap-1">
            {extractedColors.length === 0 ? (
              <span className="font-mono text-[11px] text-fg-faint">
                Drop an image to extract a palette.
              </span>
            ) : (
              extractedColors.map((hex, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Add ${hex} to palette`}
                  onClick={() => setPalette((p) => (p.includes(hex) ? p : [...p, hex]))}
                >
                  <Swatch hex={hex} size="lg" />
                </button>
              ))
            )}
          </div>
        </div>
      </Panel>

      <Panel label="PALETTE" cornerTicks className="flex flex-col gap-3 p-5">
        {palette.length === 0 ? (
          <p className="py-8 text-center font-mono text-xs text-fg-faint">
            Click extracted colours to drop them into your palette.
          </p>
        ) : (
          palette.map((hex, i) => {
            const paint = closestPaint(hex);
            return (
              <div key={i} className="flex items-center gap-3 border border-cyan/20 p-2">
                <Swatch hex={hex} size="lg" />
                <span aria-hidden className="font-osd text-fg-faint">→</span>
                {paint ? (
                  <>
                    <Swatch hex={paint.hex} size="lg" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-mono text-sm text-fg">{paint.name}</div>
                      <div className="font-osd text-[10px] uppercase tracking-[0.15em] text-fg-faint">
                        {paint.brand}
                      </div>
                    </div>
                  </>
                ) : (
                  <span className="flex-1 font-mono text-xs text-fg-faint">No match</span>
                )}
                <button
                  type="button"
                  aria-label={`Remove ${hex}`}
                  onClick={() => setPalette((p) => p.filter((_, k) => k !== i))}
                  className="font-osd text-fg-faint hover:text-red"
                >
                  ✕
                </button>
              </div>
            );
          })
        )}
        <div className="flex flex-wrap gap-2">
          <Button disabled={palette.length === 0} onClick={() => onSavePalette(palette)}>
            Save
          </Button>
          <Button
            variant="secondary"
            disabled={palette.length === 0}
            onClick={() =>
              onSendToRecipe(palette.map(closestPaint).filter((p): p is Paint => p != null))
            }
          >
            Send to Recipe
          </Button>
        </div>
      </Panel>
    </div>
  );
}
