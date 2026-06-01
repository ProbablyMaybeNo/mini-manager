"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  samplePixelHex,
  type SampledImage,
} from "@/lib/tools/eyedropper/sample";

export interface Pin {
  /** Image-space x (px). */
  x: number;
  /** Image-space y (px). */
  y: number;
  hex: string;
}

interface Props {
  /** Preview URL of the uploaded image. The component renders the
   *  <img> itself so it can overlay SVG pins in the same coordinate
   *  space. */
  imageUrl: string;
  /** Decoded image — used to sample the pixel under each pin on
   *  drag. */
  sampled: SampledImage;
  /** Pins in current order. Component is controlled — the parent owns
   *  the pin array. */
  pins: ReadonlyArray<Pin>;
  /** Fired on drag-end with the new pin position + freshly-sampled
   *  hex. The parent updates state. */
  onPinChange: (idx: number, next: Pin) => void;
  /** Optional onRemove for the per-pin × affordance. */
  onPinRemove?: (idx: number) => void;
}

/**
 * P12.15 — Movable pin overlay on the eyedropper's uploaded image.
 *
 * Each pin renders as an SVG circle absolutely-positioned over the
 * image. Dragging a pin re-samples the pixel under it via the
 * existing samplePixelHex helper; the parent state updates and the
 * extracted palette re-renders downstream.
 *
 * Rendering details:
 *   - The component owns the <img> so the SVG overlay can share its
 *     bounding box.
 *   - Image scales with its container; pin coordinates are stored
 *     in image-space (px) and projected to display-space via a
 *     useEffect that watches the rendered <img>'s clientWidth /
 *     clientHeight.
 *   - Drag uses pointer events so it works on touch + mouse. We use
 *     setPointerCapture so the pointer doesn't lose tracking when
 *     it moves off the SVG.
 */
export function EyedropperPins({
  imageUrl,
  sampled,
  pins,
  onPinChange,
  onPinRemove,
}: Props) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [displaySize, setDisplaySize] = useState<{ w: number; h: number }>({
    w: 0,
    h: 0,
  });
  const [dragging, setDragging] = useState<number | null>(null);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    const update = () => {
      setDisplaySize({ w: img.clientWidth, h: img.clientHeight });
    };
    // Initial measure once the image is laid out.
    update();
    const ro =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    if (ro) ro.observe(img);
    return () => {
      if (ro) ro.disconnect();
    };
  }, [imageUrl]);

  const scale = useMemo(() => {
    if (!displaySize.w || !sampled.width) return 1;
    return displaySize.w / sampled.width;
  }, [displaySize.w, sampled.width]);

  const handlePointerDown = (
    e: React.PointerEvent<SVGCircleElement>,
    idx: number,
  ) => {
    setDragging(idx);
    (e.target as Element).setPointerCapture?.(e.pointerId);
    e.stopPropagation();
  };

  const handlePointerMove = (
    e: React.PointerEvent<SVGSVGElement>,
  ) => {
    if (dragging === null) return;
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const px = (e.clientX - rect.left) / scale;
    const py = (e.clientY - rect.top) / scale;
    const clampedX = Math.max(0, Math.min(sampled.width - 1, px));
    const clampedY = Math.max(0, Math.min(sampled.height - 1, py));
    const hex = samplePixelHex(sampled, clampedX, clampedY);
    onPinChange(dragging, { x: clampedX, y: clampedY, hex });
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (dragging === null) return;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    setDragging(null);
  };

  return (
    <div className="relative inline-block w-full">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={imageUrl}
        alt="Eyedropper reference"
        className="block w-full h-auto select-none"
        draggable={false}
      />
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox={`0 0 ${sampled.width} ${sampled.height}`}
        preserveAspectRatio="none"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ touchAction: "none" }}
      >
        {pins.map((pin, idx) => (
          <g key={idx} role="listitem" aria-label={`Pin ${idx + 1} · ${pin.hex}`}>
            <circle
              cx={pin.x}
              cy={pin.y}
              r={Math.max(6, sampled.width * 0.02)}
              fill={pin.hex}
              stroke="white"
              strokeWidth={Math.max(1.5, sampled.width * 0.004)}
              onPointerDown={(e) => handlePointerDown(e, idx)}
              style={{ cursor: dragging === idx ? "grabbing" : "grab" }}
            />
            <text
              x={pin.x}
              y={pin.y - Math.max(8, sampled.width * 0.025)}
              fill="white"
              stroke="black"
              strokeWidth={0.5}
              fontSize={Math.max(8, sampled.width * 0.018)}
              textAnchor="middle"
              style={{ pointerEvents: "none", userSelect: "none" }}
            >
              {idx + 1}
            </text>
          </g>
        ))}
      </svg>
      {onPinRemove && pins.length > 0 ? (
        <ul
          className="mt-2 flex flex-wrap gap-2"
          aria-label="Pin list"
        >
          {pins.map((pin, idx) => (
            <li key={`row-${idx}`}>
              <button
                type="button"
                onClick={() => onPinRemove(idx)}
                aria-label={`Remove pin ${idx + 1}`}
                className="inline-flex items-center gap-1.5 px-2 py-1 frame text-2xs font-mono hover:text-[var(--color-red)]"
                title={pin.hex}
              >
                <span
                  aria-hidden
                  className="block w-3 h-3 rounded-sm"
                  style={{
                    background: pin.hex,
                    border: "1px solid var(--color-border-strong)",
                  }}
                />
                <span>{idx + 1}</span>
                <span className="opacity-50">·</span>
                <span className="opacity-80">{pin.hex}</span>
                <span className="opacity-50 ml-1">×</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
