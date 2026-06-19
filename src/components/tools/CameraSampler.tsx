"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CloseButton } from "@/components/kit";
import { cn } from "@/lib/cn";

/** Module-level feature-detect so unsupported devices hide the button. */
export const isCameraSamplerSupported: boolean =
  typeof navigator !== "undefined" &&
  typeof navigator.mediaDevices !== "undefined" &&
  typeof navigator.mediaDevices.getUserMedia === "function";

/**
 * Live-camera colour sampler (ported from the old eyedropper). Streams the
 * rear camera into a <video>, overlays a crosshair, and samples a 5×5 patch
 * median under the crosshair on tap. Restyled for the terminal-phosphor UI.
 */
export function CameraSampler({
  onSample,
  onClose,
}: {
  onSample: (hex: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

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
          await video.play().catch(() => {});
          setReady(true);
        }
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error && err.name === "NotAllowedError"
            ? "Camera permission denied. Drop or paste an image instead."
            : "Couldn't start the camera. Drop or paste an image instead.",
        );
      }
    }
    start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  const sample = useCallback(() => {
    const video = videoRef.current;
    if (!video || !ready) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (w === 0 || h === 0) return;
    const canvas = document.createElement("canvas");
    canvas.width = 5;
    canvas.height = 5;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, Math.floor(w / 2) - 2, Math.floor(h / 2) - 2, 5, 5, 0, 0, 5, 5);
    const data = ctx.getImageData(0, 0, 5, 5).data;
    const reds: number[] = [];
    const greens: number[] = [];
    const blues: number[] = [];
    for (let i = 0; i < data.length; i += 4) {
      reds.push(data[i] ?? 0);
      greens.push(data[i + 1] ?? 0);
      blues.push(data[i + 2] ?? 0);
    }
    onSample(`#${toHex(median(reds))}${toHex(median(greens))}${toHex(median(blues))}`);
  }, [onSample, ready]);

  return (
    <div
      role="dialog"
      aria-label="Camera sampler"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
    >
      <div className="w-full max-w-md border border-cyan bg-bg p-3">
        <header className="flex items-center justify-between">
          <h2 className="font-osd text-xs uppercase tracking-[0.18em] text-cyan">Camera sampler</h2>
          <CloseButton
            onClick={onClose}
            aria-label="Close camera sampler"
            className="text-sm"
          />
        </header>
        {error && (
          <p role="alert" className="mt-2 border border-yellow/40 bg-yellow/5 px-3 py-2 font-mono text-xs text-yellow">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={sample}
          disabled={!ready || Boolean(error)}
          aria-label="Sample colour under crosshair"
          className={cn(
            "relative mt-3 block aspect-[4/3] w-full overflow-hidden border border-cyan/40 bg-black",
            ready && !error ? "cursor-crosshair" : "cursor-not-allowed opacity-80",
          )}
        >
          <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full object-cover" />
          <span aria-hidden className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan" />
          <span aria-hidden className="absolute left-1/2 top-1/2 h-12 w-px -translate-x-1/2 -translate-y-1/2 bg-cyan" />
          <span aria-hidden className="absolute left-1/2 top-1/2 h-px w-12 -translate-x-1/2 -translate-y-1/2 bg-cyan" />
        </button>
        <p className="mt-2 font-osd text-[12px] uppercase tracking-[0.18em] text-fg-faint">
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
  if (sorted.length % 2 === 0) return Math.round(((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2);
  return sorted[mid] ?? 0;
}

function toHex(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0").toUpperCase();
}
