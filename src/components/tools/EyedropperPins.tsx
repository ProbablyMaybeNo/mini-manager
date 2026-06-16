"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { samplePixelHex, type SampledImage } from "@/lib/tools/eyedropper/sample";

export interface Pin {
  /** Image-space x (px). */
  x: number;
  /** Image-space y (px). */
  y: number;
  hex: string;
}

/**
 * Draggable pin overlay on the eyedropper's uploaded image (ported from the
 * old `EyedropperPins`). Each pin is an SVG circle over the image; dragging it
 * re-samples the pixel underneath via `samplePixelHex`, and the parent's
 * extracted palette updates. Controlled — the parent owns the pin array.
 */
export function EyedropperPins({
  imageUrl,
  sampled,
  pins,
  onPinChange,
}: {
  imageUrl: string;
  sampled: SampledImage;
  pins: ReadonlyArray<Pin>;
  onPinChange: (idx: number, next: Pin) => void;
}) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [displaySize, setDisplaySize] = useState({ w: 0, h: 0 });
  const [dragging, setDragging] = useState<number | null>(null);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    const update = () => setDisplaySize({ w: img.clientWidth, h: img.clientHeight });
    update();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    if (ro) ro.observe(img);
    return () => {
      if (ro) ro.disconnect();
    };
  }, [imageUrl]);

  const scale = useMemo(() => {
    if (!displaySize.w || !sampled.width) return 1;
    return displaySize.w / sampled.width;
  }, [displaySize.w, sampled.width]);

  const handlePointerDown = (e: React.PointerEvent<SVGCircleElement>, idx: number) => {
    setDragging(idx);
    (e.target as Element).setPointerCapture?.(e.pointerId);
    e.stopPropagation();
  };
  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (dragging === null) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / scale;
    const py = (e.clientY - rect.top) / scale;
    const cx = Math.max(0, Math.min(sampled.width - 1, px));
    const cy = Math.max(0, Math.min(sampled.height - 1, py));
    onPinChange(dragging, { x: cx, y: cy, hex: samplePixelHex(sampled, cx, cy) });
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
        className="block h-auto w-full select-none"
        draggable={false}
      />
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox={`0 0 ${sampled.width} ${sampled.height}`}
        preserveAspectRatio="none"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ touchAction: "none" }}
      >
        {pins.map((pin, idx) => (
          <g key={idx} aria-label={`Pin ${idx + 1} · ${pin.hex}`}>
            <circle
              cx={pin.x}
              cy={pin.y}
              r={Math.max(6, sampled.width * 0.02)}
              fill={pin.hex}
              stroke="#00d2ff"
              strokeWidth={Math.max(1.5, sampled.width * 0.005)}
              onPointerDown={(e) => handlePointerDown(e, idx)}
              style={{ cursor: dragging === idx ? "grabbing" : "grab" }}
            />
            <text
              x={pin.x}
              y={pin.y - Math.max(8, sampled.width * 0.025)}
              fill="#ffffff"
              stroke="#000000"
              strokeWidth={0.5}
              fontSize={Math.max(8, sampled.width * 0.02)}
              textAnchor="middle"
              style={{ pointerEvents: "none", userSelect: "none" }}
            >
              {idx + 1}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
