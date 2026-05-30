"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { clsx } from "clsx";

interface Props {
  /** Called with a #RRGGBB hex string after a successful tap. */
  onSample: (hex: string) => void;
  /** Closes the sampler. */
  onClose: () => void;
}

/**
 * Feature-detected at module level so unsupported devices can hide the
 * button entirely instead of mounting then failing.
 */
export const isCameraSamplerSupported: boolean =
  typeof navigator !== "undefined" &&
  typeof navigator.mediaDevices !== "undefined" &&
  typeof navigator.mediaDevices.getUserMedia === "function";

/**
 * Live-camera colour sampler. Renders the rear-camera stream in a
 * <video>, overlays a fixed crosshair, and samples a 5x5 pixel patch
 * under the crosshair on tap. Returns the per-channel median (not
 * mean) so a single outlier pixel at the crosshair edge can't drag
 * the result.
 *
 * Permission denial surfaces a friendly inline message; the painter
 * can still close and use drop / paste image.
 */
export function CameraSampler({ onSample, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Start the camera on mount. Stop the stream on unmount.
  useEffect(() => {
    let cancelled = false;
    async function start() {
      if (!isCameraSamplerSupported) {
        setError("Camera access isn't available on this device.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => {
            /* play() may reject in test environments */
          });
          setReady(true);
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof Error && err.name === "NotAllowedError") {
          setError("Camera permission denied. Drop or paste an image instead.");
        } else {
          setError("Couldn't start the camera. Drop or paste an image instead.");
        }
      }
    }
    start();
    return () => {
      cancelled = true;
      const s = streamRef.current;
      if (s) {
        s.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const sample = useCallback(() => {
    const video = videoRef.current;
    if (!video || !ready) return;

    // The video's intrinsic dimensions, not its rendered size, are
    // what we sample from. The crosshair is centered, so the sample
    // center is (videoWidth/2, videoHeight/2) in source pixels.
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (w === 0 || h === 0) return;

    const canvas = document.createElement("canvas");
    canvas.width = 5;
    canvas.height = 5;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const sx = Math.floor(w / 2) - 2;
    const sy = Math.floor(h / 2) - 2;
    ctx.drawImage(video, sx, sy, 5, 5, 0, 0, 5, 5);
    const data = ctx.getImageData(0, 0, 5, 5).data;

    const reds: number[] = [];
    const greens: number[] = [];
    const blues: number[] = [];
    for (let i = 0; i < data.length; i += 4) {
      reds.push(data[i] ?? 0);
      greens.push(data[i + 1] ?? 0);
      blues.push(data[i + 2] ?? 0);
    }
    const hex = `#${toHex(median(reds))}${toHex(median(greens))}${toHex(median(blues))}`;
    onSample(hex);
  }, [onSample, ready]);

  return (
    <div
      role="dialog"
      aria-label="Camera sampler"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[color-mix(in_srgb,var(--color-bg)_90%,transparent)] p-4"
    >
      <div className="w-full max-w-md frame-strong bg-[var(--color-bg-panel)] p-3 space-y-3">
        <header className="flex items-center justify-between">
          <h2 className="text-xs font-mono uppercase tracking-wider text-[var(--color-green)]">
            Camera sampler
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close camera sampler"
            className="tap-target px-2 text-sm font-mono text-[var(--color-fg-muted)] hover:text-[var(--color-cyan)]"
          >
            ×
          </button>
        </header>

        {error ? (
          <p
            role="alert"
            className="frame px-3 py-2 text-xs font-mono text-[var(--color-amber)] bg-[color-mix(in_srgb,var(--color-amber)_8%,transparent)]"
          >
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={sample}
          disabled={!ready || Boolean(error)}
          aria-label="Sample colour under crosshair"
          className={clsx(
            "relative block w-full overflow-hidden frame bg-black",
            "aspect-[4/3]",
            ready && !error ? "cursor-crosshair" : "cursor-not-allowed opacity-80",
          )}
        >
          <video
            ref={videoRef}
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Crosshair overlay */}
          <span
            aria-hidden
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 border border-[var(--color-cyan)] rounded-full"
          />
          <span
            aria-hidden
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-px h-12 bg-[var(--color-cyan)]"
          />
          <span
            aria-hidden
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-px w-12 bg-[var(--color-cyan)]"
          />
        </button>

        <p className="text-2xs font-mono text-[var(--color-fg-muted)] uppercase tracking-wider">
          Tap the viewfinder to sample under the crosshair
        </p>
      </div>
    </div>
  );
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    const a = sorted[mid - 1] ?? 0;
    const b = sorted[mid] ?? 0;
    return Math.round((a + b) / 2);
  }
  return sorted[mid] ?? 0;
}

function toHex(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n)))
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();
}
