"use client";

import { useEffect, useState } from "react";
import { Button, Panel, Swatch } from "@/components/kit";
import { cn } from "@/lib/cn";
import { extractDominantColors } from "@/lib/tools/eyedropper/kmeans";
import { imageToPixels, validateImageBlob, type SampledImage } from "@/lib/tools/eyedropper/sample";
import { placePins } from "@/lib/tools/eyedropper/pinPlacement";
import type { Paint } from "@/lib/types";
import { EyedropperPins, type Pin } from "./EyedropperPins";
import { CameraSampler, isCameraSamplerSupported } from "./CameraSampler";

const SWATCH_COUNT = 6;

/**
 * Color Dropper (MM-34). Drop / paste / capture an image → auto k-means
 * extraction of 6 dominant colours, shown as draggable pins on an image
 * preview that re-sample on drag. Live camera sampler too. Each swatch
 * resolves its closest library paint. Ported from old
 * `components/tools/eyedropper/*` into the terminal UI.
 */
export function EyedropperTool({
  closestPaint,
  onSavePalette,
  onSendToRecipe,
}: {
  closestPaint: (hex: string) => Paint | null;
  onSavePalette: (hexes: string[]) => void;
  onSendToRecipe: (paints: Paint[]) => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [sampled, setSampled] = useState<SampledImage | null>(null);
  const [pins, setPins] = useState<ReadonlyArray<Pin>>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);

  // Feature-detect after mount to avoid an SSR hydration mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const cameraAvailable = mounted && isCameraSamplerSupported;

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const swatches = pins.map((p) => p.hex);

  async function handleFile(file?: File | null) {
    if (!file) return;
    const validationError = validateImageBlob(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setBusy(true);
    setError(null);
    const url = URL.createObjectURL(file);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(url);
    setSampled(null);
    setPins([]);
    try {
      const image = await imageToPixels(file, { maxEdge: 512 });
      setSampled(image);
      const extracted = extractDominantColors(image.pixels, image.width, image.height, {
        k: SWATCH_COUNT,
      });
      setPins(placePins(image, extracted));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not decode the image.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setSampled(null);
    setPins([]);
    setError(null);
  }

  function handleCameraSample(hex: string) {
    setError(null);
    setPins((prev) =>
      prev.length >= SWATCH_COUNT ? prev : [...prev, { x: 0, y: 0, hex: hex.toUpperCase() }],
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <Panel label="IMAGE" className="flex flex-col gap-4 p-5">
        {previewUrl && sampled ? (
          <>
            <div className="border border-cyan/30">
              <EyedropperPins
                imageUrl={previewUrl}
                sampled={sampled}
                pins={pins}
                onPinChange={(idx, next) =>
                  setPins((prev) => prev.map((p, i) => (i === idx ? next : p)))
                }
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <p className="font-mono text-[12px] text-fg-faint">
                {sampled.width} × {sampled.height} px · {pins.length} pins · drag to re-sample
              </p>
              <Button variant="danger" size="sm" onClick={reset}>
                Clear
              </Button>
            </div>
          </>
        ) : (
          <>
            <label
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void handleFile(e.dataTransfer.files?.[0]);
              }}
              onPaste={(e) => {
                for (const item of e.clipboardData?.items ?? []) {
                  if (item.type.startsWith("image/")) {
                    const blob = item.getAsFile();
                    if (blob) {
                      e.preventDefault();
                      void handleFile(blob);
                      return;
                    }
                  }
                }
              }}
              className={cn(
                "flex h-48 cursor-pointer flex-col items-center justify-center gap-2 border border-dashed border-cyan/50 text-center hover:border-cyan",
                busy && "cursor-progress opacity-60",
              )}
            >
              <span className="font-osd text-sm uppercase tracking-[0.18em] text-cyan">
                ⬚ Drop or capture image
              </span>
              <span className="font-mono text-[12px] text-fg-faint">
                {busy ? "Extracting dominant colours…" : "PNG / JPG / WebP · click, drag, or paste"}
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(e) => void handleFile(e.target.files?.[0])}
              />
            </label>
            {cameraAvailable && (
              <Button
                variant="secondary"
                onClick={() => setCameraOpen(true)}
                disabled={busy || pins.length >= SWATCH_COUNT}
              >
                Use camera
              </Button>
            )}
          </>
        )}
        {error && (
          <p role="alert" className="font-mono text-[12px] text-red">
            {error}
          </p>
        )}
      </Panel>

      <Panel label="PALETTE" cornerTicks className="flex flex-col gap-3 p-5">
        {swatches.length === 0 ? (
          <p className="py-8 text-center font-mono text-xs text-fg-faint">
            Drop an image to auto-extract a palette, then drag the pins to re-sample.
          </p>
        ) : (
          swatches.map((hex, i) => {
            const paint = closestPaint(hex);
            return (
              <div key={`${hex}-${i}`} className="flex items-center gap-3 border border-cyan/20 p-2">
                <span className="w-5 font-osd text-[12px] text-fg-faint">{i + 1}</span>
                <Swatch hex={hex} size="lg" />
                <span aria-hidden className="font-osd text-fg-faint">→</span>
                {paint ? (
                  <>
                    <Swatch hex={paint.hex} size="lg" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-mono text-sm text-fg">{paint.name}</div>
                      <div className="font-osd text-[12px] uppercase tracking-[0.15em] text-fg-faint">
                        {paint.brand}
                      </div>
                    </div>
                  </>
                ) : (
                  <span className="flex-1 font-mono text-xs text-fg-faint">No match</span>
                )}
                <button
                  type="button"
                  aria-label={`Remove swatch ${hex}`}
                  onClick={() => setPins((prev) => prev.filter((_, k) => k !== i))}
                  className="font-osd text-fg-faint hover:text-red"
                >
                  ✕
                </button>
              </div>
            );
          })
        )}
        <div className="flex flex-wrap gap-2">
          <Button disabled={swatches.length === 0} onClick={() => onSavePalette(swatches)}>
            Save
          </Button>
          <Button
            variant="secondary"
            disabled={swatches.length === 0}
            onClick={() => onSendToRecipe(swatches.map(closestPaint).filter((p): p is Paint => p != null))}
          >
            Send to Recipe
          </Button>
        </div>
      </Panel>

      {cameraOpen && (
        <CameraSampler onSample={handleCameraSample} onClose={() => setCameraOpen(false)} />
      )}
    </div>
  );
}
