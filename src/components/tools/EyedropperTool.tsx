"use client";

import { useEffect, useState } from "react";
import { Button, CloseButton, Panel } from "@/components/kit";
import { cn } from "@/lib/cn";
import { extractDominantColors } from "@/lib/tools/eyedropper/kmeans";
import { imageToPixels, validateImageBlob, type SampledImage } from "@/lib/tools/eyedropper/sample";
import { placePins } from "@/lib/tools/eyedropper/pinPlacement";
import type { ToolSwatch } from "@/lib/types";
import { AssignPaintMenu, type AssignedResult } from "@/components/recipe/AssignPaintMenu";
import { EyedropperPins, type Pin } from "./EyedropperPins";
import { CameraSampler, isCameraSamplerSupported } from "./CameraSampler";

// Dropper-slot count is user-controllable via the + / − buttons (wBJeqQHQLK4g):
// start at 3, clamp 1–8. Drives how many dominant colours we extract.
const DEFAULT_DROPPERS = 3;
const MIN_DROPPERS = 1;
const MAX_DROPPERS = 8;

const clampDroppers = (n: number) =>
  Math.max(MIN_DROPPERS, Math.min(MAX_DROPPERS, n));

/**
 * Color Dropper (MM-34 / Wave 2 dOySZp). Drop / paste / capture an image →
 * auto k-means extraction of N dominant colours (N set by the + / − dropper
 * controls, default 3), shown as draggable pins on an image preview that
 * re-sample on drag. Live camera sampler too.
 *
 * Colours-not-paints (dOySZp): this tool finds colours in a reference image.
 * It doesn't pretend to pick a specific paint for you — there's no "closest
 * match" auto-suggestion here anymore. Turning a found colour into a real
 * paint happens in a recipe: "Create Recipe" starts a new one from every
 * swatch, "Assign to Recipe" appends them to an existing one, and each row's
 * own "Assign" sends just that one colour — all via the shared
 * create-or-assign chooser (item 1 / `AssignToRecipeDialog`).
 */
export function EyedropperTool({
  onSavePalette,
  onCreateRecipe,
  onAssignRecipe,
  onSwatchAssigned,
}: {
  onSavePalette: (hexes: string[]) => void;
  /** Start a brand-new recipe from every swatch. Omit to hide the button
   *  (the embedded recipe-slot picker doesn't show it — see RecipePaintPicker). */
  onCreateRecipe?: (swatches: ToolSwatch[]) => void;
  /** Append every swatch to an existing recipe. Omit to hide the button. */
  onAssignRecipe?: (swatches: ToolSwatch[]) => void;
  /** Per-row "Assign" — opens the shared {@link AssignPaintMenu} for just
   *  this one colour. Extracted pins never carry a `paintId` (this tool
   *  finds colours, not paints — dOySZp), so the menu always shows the two
   *  recipe options only. Omit to hide the per-row button. */
  onSwatchAssigned?: (result: AssignedResult) => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [sampled, setSampled] = useState<SampledImage | null>(null);
  const [pins, setPins] = useState<ReadonlyArray<Pin>>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [dropperCount, setDropperCount] = useState(DEFAULT_DROPPERS);

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

  // Extract `count` dominant colours from an already-sampled image and place
  // them as pins — shared by the initial drop and the + / − re-extraction so
  // every dropper slot keeps the identical palette-extraction behaviour.
  function extractPins(image: SampledImage, count: number) {
    const extracted = extractDominantColors(image.pixels, image.width, image.height, {
      k: count,
    });
    setPins(placePins(image, extracted));
  }

  // + / − dropper slot controls: clamp 1–8, then re-extract against the current
  // image (if any) so the palette immediately reflects the new slot count.
  function changeDroppers(delta: number) {
    setDropperCount((prev) => {
      const next = clampDroppers(prev + delta);
      if (next !== prev && sampled) extractPins(sampled, next);
      return next;
    });
  }

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
      extractPins(image, dropperCount);
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
      prev.length >= dropperCount ? prev : [...prev, { x: 0, y: 0, hex: hex.toUpperCase() }],
    );
  }

  return (
    // Audit B7 — `/tools/dropper` left 358px (40%) empty below the two panels
    // at 1440×900 because the grid sized to its content inside a full-height
    // shell. `min-h-0 flex-1` lets it claim that space when the shell is a
    // column flex (the tool route); it is inert wherever the picker embeds
    // this tool in a non-flex parent.
    <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-[1fr_1fr]">
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
              <p className="font-body text-body text-fg">
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
                // Grows into whatever height the panel has, with the old 12rem
                // as the floor — a drop target has no reason to be the one
                // fixed-height thing on a page with 358px going spare (B7).
                "flex min-h-48 flex-1 cursor-pointer flex-col items-center justify-center gap-2 border border-dashed border-cyan/50 text-center hover:border-cyan",
                busy && "cursor-progress opacity-60",
              )}
            >
              <span className="label-osd text-cyan-lite">
                ⬚ Drop or capture image
              </span>
              <span className="font-body text-body text-fg">
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
                disabled={busy || pins.length >= dropperCount}
              >
                Use camera
              </Button>
            )}
          </>
        )}
        {error && (
          <p role="alert" className="font-body text-body text-red-text">
            {error}
          </p>
        )}
      </Panel>

      <Panel label="COLOURS FOUND" cornerTicks className="flex flex-col gap-3 p-5">
        {swatches.length === 0 ? (
          <p className="py-8 text-center font-body text-body text-fg">
            Drop an image to auto-extract its colours, then drag the pins to re-sample.
          </p>
        ) : (
          swatches.map((hex, i) => (
            <div key={`${hex}-${i}`} className="flex items-center gap-3 border border-cyan/20 p-2">
              <span className="w-5 font-num2 text-num2 text-fg">{i + 1}</span>
              <span
                aria-hidden
                className="h-8 w-8 shrink-0 border border-fg/20"
                style={{ backgroundColor: hex }}
              />
              <span className="flex-1 font-body text-body text-fg">{hex}</span>
              {onSwatchAssigned && (
                <AssignPaintMenu
                  swatch={{ hex }}
                  onAssigned={onSwatchAssigned}
                  buttonVariant="secondary"
                />
              )}
              <CloseButton
                tone="destructive"
                aria-label={`Remove swatch ${hex}`}
                onClick={() => setPins((prev) => prev.filter((_, k) => k !== i))}
              />
            </div>
          ))
        )}
        {/* + / − dropper controls on the left (where Save/Send used to sit per
            Ross's sketch), the recipe actions pushed to the right (wBJeqQHQLK4g). */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Remove a dropper"
              disabled={dropperCount <= MIN_DROPPERS}
              onClick={() => changeDroppers(-1)}
              className="font-button text-button inline-flex min-h-11 min-w-11 items-center justify-center border border-cyan/40 text-cyan-lite hover:bg-cyan/10 disabled:opacity-30 md:min-h-7 md:min-w-7"
            >
              −
            </button>
            <span className="font-num2 text-num2 min-w-[3.5rem] text-center text-fg tabular-nums">
              {dropperCount} {dropperCount === 1 ? "dropper" : "droppers"}
            </span>
            <button
              type="button"
              aria-label="Add a dropper"
              disabled={dropperCount >= MAX_DROPPERS}
              onClick={() => changeDroppers(1)}
              className="font-button text-button inline-flex min-h-11 min-w-11 items-center justify-center border border-cyan/40 text-cyan-lite hover:bg-cyan/10 disabled:opacity-30 md:min-h-7 md:min-w-7"
            >
              +
            </button>
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button disabled={swatches.length === 0} onClick={() => onSavePalette(swatches)}>
              Save
            </Button>
            {onCreateRecipe && (
              <Button
                variant="secondary"
                disabled={swatches.length === 0}
                onClick={() => onCreateRecipe(swatches.map((hex) => ({ hex })))}
              >
                Create Recipe
              </Button>
            )}
            {onAssignRecipe && (
              <Button
                variant="secondary"
                disabled={swatches.length === 0}
                onClick={() => onAssignRecipe(swatches.map((hex) => ({ hex })))}
              >
                Assign to Recipe
              </Button>
            )}
          </div>
        </div>
      </Panel>

      {cameraOpen && (
        <CameraSampler onSample={handleCameraSample} onClose={() => setCameraOpen(false)} />
      )}
    </div>
  );
}
