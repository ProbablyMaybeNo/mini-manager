"use client";

import { useEffect, useMemo, useState } from "react";
import type { Paint } from "@/lib/paints/types";
import { loadPaints } from "@/lib/paints/loader";
import {
  extractDominantColors,
} from "@/lib/tools/eyedropper/kmeans";
import {
  imageToPixels,
  type SampledImage,
} from "@/lib/tools/eyedropper/sample";
import {
  findClosestPaints,
  type MatchResult,
} from "@/lib/tools/match/find";
import { ToolShell } from "@/components/tools/ToolShell";
import { ToolFooterActions } from "@/components/tools/ToolFooterActions";
import type { ToolPaletteSwatch } from "@/lib/tools/types";
import { DropZone } from "./DropZone";
import { EyedropperPins, type Pin } from "./EyedropperPins";
import { placePins } from "@/lib/tools/eyedropper/pinPlacement";
import {
  CameraSampler,
  isCameraSamplerSupported,
} from "./CameraSampler";
import { Button } from "@/components/ui/Button";

const SWATCH_COUNT = 6;

/**
 * Image-eyedropper tool. The painter drops (or pastes) a reference,
 * k-means extracts six dominant colours, and we surface the three
 * closest paints per swatch. Click a swatch to remove it — the palette
 * is editable.
 */
export function EyedropperClient() {
  const [paints, setPaints] = useState<ReadonlyArray<Paint>>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [sampled, setSampled] = useState<SampledImage | null>(null);
  /** P12.15 — pins is now the source of truth. Each pin's hex becomes
   *  one extracted swatch. Drag-end re-samples the pixel under the
   *  pin, which updates pin.hex, which ripples through to swatches. */
  const [pins, setPins] = useState<ReadonlyArray<Pin>>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);

  // The legacy swatches[] surface is derived from pins so the rest of
  // the page (palette display, match resolution, footer) keeps reading
  // the same shape it always has.
  const swatches: ReadonlyArray<string> = pins.map((p) => p.hex);
  const setSwatches = (
    next:
      | ReadonlyArray<string>
      | ((prev: ReadonlyArray<string>) => ReadonlyArray<string>),
  ): void => {
    setPins((prev) => {
      const nextArr =
        typeof next === "function"
          ? next(prev.map((p) => p.hex))
          : next;
      // Preserve pin coordinates when possible (same index → same x/y).
      return nextArr.map((hex, i) => {
        const existing = prev[i];
        return existing
          ? { ...existing, hex: hex.toUpperCase() }
          : { x: 0, y: 0, hex: hex.toUpperCase() };
      });
    });
  };

  // Load the paint catalog once.
  useEffect(() => {
    let mounted = true;
    loadPaints()
      .then((rows) => {
        if (mounted) setPaints(rows);
      })
      .catch(() => {
        /* no-op — catalog failure shows empty matches */
      })
      .finally(() => {
        if (mounted) setCatalogLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Release any object URLs we created.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFile = async (blob: Blob, url: string) => {
    setBusy(true);
    setError(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(url);
    setSampled(null);
    setSwatches([]);
    try {
      const image = await imageToPixels(blob, { maxEdge: 512 });
      setSampled(image);
      const extracted = extractDominantColors(
        image.pixels,
        image.width,
        image.height,
        { k: SWATCH_COUNT },
      );
      // P12.15 — place a pin per cluster centroid by walking the image
      // once + grabbing the pixel closest to each extracted hex.
      const placements = placePins(image, extracted);
      setPins(placements);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not decode the image.",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleError = (message: string) => {
    setError(message);
  };

  const removeSwatch = (idx: number) => {
    setSwatches((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleCameraSample = (hex: string) => {
    setError(null);
    setSwatches((prev) => {
      if (prev.length >= SWATCH_COUNT) return prev;
      return [...prev, hex.toUpperCase()];
    });
  };

  const reset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setSampled(null);
    setPins([]);
    setError(null);
  };

  const matchesPerSwatch = useMemo(() => {
    if (catalogLoading || paints.length === 0) return [];
    return swatches.map((hex) =>
      findClosestPaints(hex, paints, { limit: 3 }),
    );
  }, [swatches, paints, catalogLoading]);

  // Build the footer palette. When a swatch has a sub-2 ΔE match we pin
  // the paint id so the send-to-recipe flow can attach it directly
  // instead of writing a custom-hex step.
  const footerSwatches: ReadonlyArray<ToolPaletteSwatch> = useMemo(() => {
    return swatches.map((hex, i) => {
      const best = matchesPerSwatch[i]?.[0];
      return {
        hex,
        sourcePaintId:
          best && best.confidence === "high" ? best.paint.id : undefined,
        name: best?.paint.name,
      };
    });
  }, [swatches, matchesPerSwatch]);

  return (
    <ToolShell
      input={
        <div className="space-y-4">
          <header className="space-y-1">
            <h1 className="text-3xl tracking-wide">EYEDROPPER</h1>
            <p className="text-2xs font-sans text-[var(--color-fg-muted)] leading-snug">
              Drop a reference image. It extracts six dominant colours —
              click any swatch to drop it from the palette.
            </p>
          </header>

          {previewUrl ? (
            <div className="space-y-2">
              <div className="frame overflow-hidden">
                {sampled ? (
                  <EyedropperPins
                    imageUrl={previewUrl}
                    sampled={sampled}
                    pins={pins}
                    onPinChange={(idx, next) =>
                      setPins((prev) =>
                        prev.map((p, i) => (i === idx ? next : p)),
                      )
                    }
                    onPinRemove={(idx) =>
                      setPins((prev) => prev.filter((_, i) => i !== idx))
                    }
                  />
                ) : (
                  <img
                    src={previewUrl}
                    alt="Reference"
                    className="block w-full h-auto"
                  />
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-2xs font-mono text-[var(--color-fg-muted)]">
                  {sampled
                    ? `${sampled.width} × ${sampled.height} px · ${pins.length}/8 pin${pins.length === 1 ? "" : "s"} · drag to re-sample`
                    : "Decoding…"}
                </p>
                <Button
                  type="button"
                  onClick={reset}
                  variant="danger"
                  size="sm"
                >
                  Clear
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <DropZone
                onFile={handleFile}
                onError={handleError}
                disabled={busy}
              />
              {isCameraSamplerSupported ? (
                <Button
                  type="button"
                  onClick={() => setCameraOpen(true)}
                  disabled={busy || swatches.length >= SWATCH_COUNT}
                  variant="success"
                  size="sm"
                  className="w-full"
                  aria-label="Open camera sampler"
                >
                  {swatches.length >= SWATCH_COUNT
                    ? "Use camera — palette full"
                    : "Use camera"}
                </Button>
              ) : null}
            </div>
          )}

          {cameraOpen ? (
            <CameraSampler
              onSample={handleCameraSample}
              onClose={() => setCameraOpen(false)}
            />
          ) : null}

          {error ? (
            <p
              role="alert"
              className="text-2xs font-mono text-[var(--color-red)]"
            >
              {error}
            </p>
          ) : null}
        </div>
      }
      output={
        <div className="space-y-4">
          <header className="flex items-baseline justify-between">
            <h2 className="section-title mb-0 pb-0 border-0">
              Palette · {swatches.length}
            </h2>
            <p className="text-2xs font-mono text-[var(--color-fg-muted)]">
              {busy
                ? "Extracting…"
                : swatches.length === 0
                  ? "Awaiting image"
                  : "Click a swatch to remove"}
            </p>
          </header>

          {swatches.length === 0 ? (
            <p className="text-xs font-sans text-[var(--color-fg-muted)] frame px-3 py-6 text-center">
              No image yet. Drop one on the left.
            </p>
          ) : (
            <div className="space-y-3">
              {swatches.map((hex, i) => {
                const matches: ReadonlyArray<MatchResult> =
                  matchesPerSwatch[i] ?? [];
                return (
                  <div key={`${hex}-${i}`} className="frame">
                    <div className="flex items-center gap-3 px-3 py-2 border-b border-[var(--color-border)]">
                      <button
                        type="button"
                        onClick={() => removeSwatch(i)}
                        aria-label={`Remove swatch ${hex}`}
                        className="inline-block w-10 h-10 rounded-sm border tap-target"
                        style={{
                          background: hex,
                          borderColor: "var(--color-border-strong)",
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-xs text-[var(--color-fg)]">
                          {hex}
                        </div>
                        <div className="text-2xs font-mono text-[var(--color-fg-muted)] uppercase tracking-wider">
                          Swatch {i + 1}
                        </div>
                      </div>
                    </div>
                    <div className="px-3 py-2 space-y-1">
                      {catalogLoading ? (
                        <p className="text-2xs font-mono text-[var(--color-fg-muted)]">
                          Loading catalog…
                        </p>
                      ) : matches.length === 0 ? (
                        <p className="text-2xs font-mono text-[var(--color-fg-muted)]">
                          No catalog matches.
                        </p>
                      ) : (
                        matches.map((r) => (
                          <div
                            key={r.paint.id}
                            className="flex items-center gap-2"
                          >
                            <span
                              aria-hidden
                              className="inline-block w-4 h-4 rounded-sm border shrink-0"
                              style={{
                                background: r.paint.hex,
                                borderColor: "var(--color-border-strong)",
                              }}
                            />
                            <span className="flex-1 min-w-0 text-2xs font-mono truncate text-[var(--color-fg)]">
                              {r.paint.brand} {r.paint.name}
                            </span>
                            <span
                              className={
                                r.confidence === "high"
                                  ? "text-2xs font-mono text-[var(--color-green)]"
                                  : r.confidence === "medium"
                                    ? "text-2xs font-mono text-[var(--color-amber)]"
                                    : "text-2xs font-mono text-[var(--color-fg-muted)]"
                              }
                              title="Match closeness — 0 = exact, ≤2 = imperceptible, >5 = noticeably different. Industry standard (CIE ΔE 2000)."
                            >
                              {r.deltaE.toFixed(1)}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      }
      footer={
        <ToolFooterActions
          toolId="eyedropper"
          swatches={footerSwatches}
          defaultPaletteName="Eyedropper palette"
        />
      }
    />
  );
}
