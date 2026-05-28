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
import { DropZone } from "./DropZone";

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
  const [swatches, setSwatches] = useState<ReadonlyArray<string>>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
      setSwatches(extracted);
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

  const reset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setSampled(null);
    setSwatches([]);
    setError(null);
  };

  const matchesPerSwatch = useMemo(() => {
    if (catalogLoading || paints.length === 0) return [];
    return swatches.map((hex) =>
      findClosestPaints(hex, paints, { limit: 3 }),
    );
  }, [swatches, paints, catalogLoading]);

  return (
    <ToolShell
      input={
        <div className="space-y-4">
          <header className="space-y-1">
            <h1 className="text-xl glow-green">┌─ EYEDROPPER ─</h1>
            <p className="text-2xs font-sans text-[var(--color-fg-muted)]">
              Drop a reference. K-means extracts six dominant colours —
              click any swatch to drop it from the palette.
            </p>
          </header>

          {previewUrl ? (
            <div className="space-y-2">
              <div className="frame overflow-hidden">
                <img
                  src={previewUrl}
                  alt="Reference"
                  className="block w-full h-auto"
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-2xs font-mono text-[var(--color-fg-muted)]">
                  {sampled
                    ? `${sampled.width} × ${sampled.height} px sampled`
                    : "Decoding…"}
                </p>
                <button
                  type="button"
                  onClick={reset}
                  className="text-2xs font-mono text-[var(--color-red)] hover:glow-amber tap-target px-2 frame"
                >
                  [ × Clear ]
                </button>
              </div>
            </div>
          ) : (
            <DropZone
              onFile={handleFile}
              onError={handleError}
              disabled={busy}
            />
          )}

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
                            >
                              ΔE {r.deltaE.toFixed(1)}
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
        <>
          <button
            type="button"
            disabled
            title="Save palette ships in P4.4 wiring"
            className="px-3 py-1.5 frame-strong text-xs font-mono uppercase tracking-wider text-[var(--color-fg-muted)] opacity-60"
          >
            [ Save palette ]
          </button>
          <button
            type="button"
            disabled
            title="Send to recipe ships in P4.7"
            className="px-3 py-1.5 frame-strong text-xs font-mono uppercase tracking-wider text-[var(--color-fg-muted)] opacity-60"
          >
            [ Send to recipe ]
          </button>
        </>
      }
    />
  );
}
