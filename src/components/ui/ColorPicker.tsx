"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { clsx } from "clsx";
import type { Paint } from "@/lib/paints/types";
import type { MatchResult } from "@/lib/tools/match/find";
import { loadPaints } from "@/lib/paints/loader";
import { hexToHsl } from "@/lib/tools/wheel/harmonies";
import {
  extractDominantColors,
} from "@/lib/tools/eyedropper/kmeans";
import { imageToPixels } from "@/lib/tools/eyedropper/sample";
import {
  COLOR_PICKER_HARMONY_LABELS,
  buildPickerHarmony,
  hslToHex,
} from "@/lib/colorPicker/harmonies";
import {
  bandForHex,
  MATCH_DEFAULT_DELTAE,
  MATCH_EXPANDED_DELTAE,
  matchesWithinDeltaE,
} from "@/lib/colorPicker/matchPaints";
import type {
  ColorPickerHarmony,
  ColorPickerMode,
  ColorPickerSelection,
} from "@/lib/colorPicker/types";
import { DropZone } from "@/components/tools/eyedropper/DropZone";
import { Button } from "./Button";

interface Props {
  /** Currently-selected colour (used to seed the wheel cursor + recall
   *  the active library row on open). Optional. */
  value?: ColorPickerSelection | null;
  /** Fired whenever the user picks a colour from ANY of the three sub-
   *  panels. The consumer decides what to do — close the side panel,
   *  save the slot, etc. */
  onSelect: (selection: ColorPickerSelection) => void;
  /** Allows the host (recipe slot grid, project Color Scheme box, etc.)
   *  to label the picker contextually, e.g. "Slot 1" / "Highlight". */
  contextLabel?: string;
  /** Whether the host is creating a brand-new slot ("add-slot") or
   *  swapping the paint on an existing one ("edit-slot"). Controls the
   *  in-panel microcopy so the painter is never ambiguous about whether
   *  picking a colour creates or replaces. Defaults to "add-slot" for
   *  back-compat with pre-R7 consumers. R7-002. */
  mode?: ColorPickerMode;
}

/**
 * ColorPicker primitive — the keystone of Phase 12 (P12.1).
 *
 * Three stacked sub-panels in one scrollable side panel:
 *
 *   1. Mini wheel (SVG HSL ring + draggable cursor) with a harmony
 *      dropdown — picks generated below the wheel.
 *   2. Filterable library list — search input + brand chips. Hue-band
 *      first pass on the current picked colour; "Show closer matches"
 *      toggle runs ΔE2000 on the full catalog.
 *   3. Eyedropper — drop / paste / file-pick an image, k-means top 6.
 *
 * Output: `{ hex, paintId? }` via `onSelect`. Pure-presentational past
 * the catalog fetch; every state derivation lives in the lib modules
 * so the picker stays drop-in for every Phase-12 consumer.
 *
 * Animations gated on prefers-reduced-motion.
 */
export function ColorPicker({
  value,
  onSelect,
  contextLabel,
  mode = "add-slot",
}: Props) {
  /* ---------- catalog + currently picked colour ---------- */
  const [paints, setPaints] = useState<ReadonlyArray<Paint>>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);

  // Initial wheel state: seed from value if present, else a neutral cyan.
  const seedHsl = useMemo(() => {
    if (value?.hex) {
      const hsl = hexToHsl(value.hex);
      if (hsl) return hsl;
    }
    return { h: 180, s: 60, l: 55 };
  }, [value?.hex]);

  const [hue, setHue] = useState<number>(seedHsl.h);
  // BUG fix (item 3) — saturation was seeded from the slot colour but had
  // NO setter, so a greyscale seed (s = 0) latched the wheel into greyscale
  // forever: every hslToHex(hue, 0, light) renders grey regardless of hue,
  // with no control to climb back out. It now has a slider (mirrors the
  // lightness one) so a greyscale slot can be lifted back into full colour.
  const [sat, setSat] = useState<number>(seedHsl.s);
  const [light, setLight] = useState<number>(seedHsl.l);
  const [harmony, setHarmony] = useState<ColorPickerHarmony>("complementary");

  const pickedHex = useMemo(() => hslToHex(hue, sat, light), [hue, sat, light]);
  const harmonySwatches = useMemo(
    () => buildPickerHarmony(harmony, hue, sat, light),
    [harmony, hue, sat, light],
  );
  const band = useMemo(() => bandForHex(pickedHex), [pickedHex]);

  /* ---------- catalog load ---------- */
  useEffect(() => {
    let mounted = true;
    loadPaints()
      .then((rows) => {
        if (mounted) setPaints(rows);
      })
      .catch(() => {
        /* swallow — empty list renders gracefully */
      })
      .finally(() => {
        if (mounted) setCatalogLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  /* ---------- library sub-panel state ----------
     UX-908 — Library list is now always ΔE2000-sorted and capped by
     perceptual distance, not row count. Default ΔE ≤ 10 ("useful
     family"); "Show more matches" loosens to ≤ 30 ("cross-band
     approximations"). Replaces the old hue-band default that
     surfaced "Rubber Black" for a magenta pick simply because they
     share the red-purple band. */
  const [textQuery, setTextQuery] = useState("");
  const [showFurther, setShowFurther] = useState(false);

  const libraryRows = useMemo<MatchResult[]>(() => {
    let pool: ReadonlyArray<Paint> = paints;
    if (textQuery.trim()) {
      const q = textQuery.trim().toLowerCase();
      pool = pool.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          (p.line ?? "").toLowerCase().includes(q),
      );
    }
    const cap = showFurther ? MATCH_EXPANDED_DELTAE : MATCH_DEFAULT_DELTAE;
    return matchesWithinDeltaE(pickedHex, pool, cap);
  }, [paints, textQuery, pickedHex, showFurther]);

  /* ---------- eyedropper sub-panel state ---------- */
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [eyeSwatches, setEyeSwatches] = useState<ReadonlyArray<string>>([]);
  const [eyeError, setEyeError] = useState<string | null>(null);
  const [eyeBusy, setEyeBusy] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleEyeFile = async (blob: Blob, url: string) => {
    setEyeBusy(true);
    setEyeError(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(url);
    setEyeSwatches([]);
    try {
      const image = await imageToPixels(blob, { maxEdge: 512 });
      const extracted = extractDominantColors(
        image.pixels,
        image.width,
        image.height,
        { k: 6 },
      );
      setEyeSwatches(extracted);
    } catch (err) {
      setEyeError(
        err instanceof Error ? err.message : "Could not decode the image.",
      );
    } finally {
      setEyeBusy(false);
    }
  };

  /* ---------- selection emit ----------
     R7-001 — wheel, harmony swatches, and eyedropper swatches all emit
     via these two helpers. `emitHex` pins `paintId: null` explicitly
     (vs. leaving the field undefined) so the consumer's downstream
     branching never conflates "raw hex picked" with "use existing
     paintId". The library-row path keeps the paintId set. */
  const emitHex = (hex: string) => {
    onSelect({ hex, paintId: null });
  };
  const emitPaint = (hex: string, paintId: string) => {
    onSelect({ hex, paintId });
  };

  return (
    <div
      className="flex flex-col gap-4 p-4 overflow-y-auto"
      role="region"
      aria-label={
        contextLabel ? `Color picker for ${contextLabel}` : "Color picker"
      }
    >
      {contextLabel ? (
        <p className="section-title">{contextLabel}</p>
      ) : null}

      {/* R7-002 — mode-disambiguating hint. The painter is never
          ambiguous about whether picking a colour creates a new slot or
          replaces the paint on the existing one. Lives at the top of
          the picker so it's visible regardless of which sub-panel they
          interact with. */}
      <p
        className="text-2xs font-mono text-[var(--color-fg-subtle)] leading-snug"
        data-testid="picker-mode-hint"
      >
        {mode === "edit-slot"
          ? "Picking a colour REPLACES this slot's paint."
          : "Picking a colour ADDS a new slot."}
      </p>

      {/* -------- Sub-panel 1: mini wheel + harmony -------- */}
      <section aria-labelledby="cp-wheel-heading" className="space-y-3">
        <h3 id="cp-wheel-heading" className="section-title">
          Wheel
        </h3>
        <WheelRing hue={hue} onChange={setHue} />
        <div className="flex items-center gap-3">
          <span
            aria-label="Picked colour swatch"
            className="block w-8 h-8 rounded-sm"
            style={{
              background: pickedHex,
              border: "2px solid var(--color-border-strong)",
            }}
          />
          <span className="font-mono text-xs text-[var(--color-fg-muted)]">
            {pickedHex}
            {band ? <span className="opacity-60"> · {band}</span> : null}
          </span>
          <Button
            type="button"
            variant="success"
            size="sm"
            onClick={() => emitHex(pickedHex)}
            className="ml-auto"
          >
            Use this colour
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <label
            htmlFor="cp-harmony"
            className="font-mono text-2xs uppercase tracking-wider text-[var(--color-fg-muted)]"
          >
            Harmony
          </label>
          <select
            id="cp-harmony"
            value={harmony}
            onChange={(e) =>
              setHarmony(e.target.value as ColorPickerHarmony)
            }
            className="font-mono text-xs bg-[var(--color-bg)] px-2 py-1 frame"
          >
            {COLOR_PICKER_HARMONY_LABELS.map((h) => (
              <option key={h.key} value={h.key}>
                {h.label}
              </option>
            ))}
          </select>
        </div>

        <div
          className="flex flex-wrap gap-2"
          role="list"
          aria-label={`${harmony} harmony swatches`}
        >
          {harmonySwatches.map((hex, idx) => (
            <button
              key={`${idx}-${hex}`}
              type="button"
              role="listitem"
              onClick={() => emitHex(hex)}
              aria-label={`Use harmony swatch ${hex}`}
              className="block w-9 h-9 rounded-sm cursor-pointer hover:scale-110 transition-transform"
              style={{
                background: hex,
                border: "2px solid var(--color-border-strong)",
              }}
              title={hex}
            />
          ))}
        </div>

        {/* Item 3 — horizontal saturation slider. The companion to the
            lightness slider below. Critically, it's the way OUT of a
            greyscale slot: a slot seeded at saturation 0 used to be
            permanently grey because nothing could raise saturation. Drag
            this up and the wheel hue + harmonies + matches re-render in
            full colour again. */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label
              htmlFor="cp-saturation"
              className="font-mono text-2xs uppercase tracking-wider text-[var(--color-fg-muted)]"
            >
              Saturation
            </label>
            <span className="font-mono text-2xs tabular-nums text-[var(--color-fg-subtle)]">
              {Math.round(sat)}
            </span>
          </div>
          <input
            id="cp-saturation"
            type="range"
            min={0}
            max={100}
            value={Math.round(sat)}
            onChange={(e) => setSat(Number(e.target.value))}
            className="w-full"
            aria-label="Saturation"
          />
          {sat === 0 ? (
            <p className="text-2xs font-sans text-[var(--color-fg-subtle)] leading-snug">
              Greyscale — drag saturation up to pick a colour from the wheel.
            </p>
          ) : null}
        </div>

        {/* R7-3 — horizontal lightness slider. Lives below the wheel +
            harmony dropdown so the painter can reach darker / lighter
            variants without dragging the wheel cursor closer to the
            origin. The picked-hex swatch, the matches list below, AND
            the harmony swatches all re-render at the new lightness. */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label
              htmlFor="cp-lightness"
              className="font-mono text-2xs uppercase tracking-wider text-[var(--color-fg-muted)]"
            >
              Lightness
            </label>
            <span className="font-mono text-2xs tabular-nums text-[var(--color-fg-subtle)]">
              {Math.round(light)}
            </span>
          </div>
          <input
            id="cp-lightness"
            type="range"
            min={0}
            max={100}
            value={Math.round(light)}
            onChange={(e) => setLight(Number(e.target.value))}
            className="w-full"
            aria-label="Lightness"
          />
        </div>
      </section>

      <hr />

      {/* -------- Sub-panel 2: library list -------- */}
      <section aria-labelledby="cp-library-heading" className="space-y-3">
        <h3 id="cp-library-heading" className="section-title">
          Library
        </h3>
        <input
          type="search"
          value={textQuery}
          onChange={(e) => setTextQuery(e.target.value)}
          placeholder="Search by paint name, brand, or line…"
          aria-label="Filter library paints"
          className="block w-full px-3 py-2 font-mono text-xs bg-[var(--color-bg)] frame"
        />
        <div className="flex items-center justify-between">
          <span className="text-2xs font-mono text-[var(--color-fg-subtle)]">
            {catalogLoading
              ? "Loading catalog…"
              : `${libraryRows.length} match${libraryRows.length === 1 ? "" : "es"} · ΔE ≤ ${showFurther ? MATCH_EXPANDED_DELTAE : MATCH_DEFAULT_DELTAE}`}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowFurther((v) => !v)}
            aria-pressed={showFurther}
          >
            {showFurther ? "Tight match" : "Show more matches"}
          </Button>
        </div>
        <ul
          className="max-h-72 overflow-y-auto space-y-1"
          aria-label="Matching library paints"
        >
          {libraryRows.map((m) => (
            <li key={m.paint.id}>
              <button
                type="button"
                onClick={() => emitPaint(m.paint.hex, m.paint.id)}
                className={clsx(
                  "w-full flex items-center gap-3 px-2 py-1.5 frame text-left hover:border-[var(--color-cyan)] transition-colors",
                  value?.paintId === m.paint.id &&
                    "border-[var(--color-cyan)]",
                )}
                aria-current={value?.paintId === m.paint.id || undefined}
              >
                <span
                  aria-hidden
                  className="block w-6 h-6 rounded-sm flex-shrink-0"
                  style={{
                    background: m.paint.hex,
                    border: "1px solid var(--color-border-strong)",
                  }}
                />
                <span className="flex flex-col min-w-0 flex-1">
                  <span className="font-mono text-xs truncate text-[var(--color-fg)]">
                    {m.paint.name}
                  </span>
                  <span className="font-mono text-2xs text-[var(--color-fg-muted)] truncate">
                    {m.paint.brand}
                    {m.paint.line ? ` · ${m.paint.line}` : ""}
                  </span>
                </span>
                {/* UX-908 — Surface the ΔE per row so the painter can
                    eyeball how close each candidate really is. <2 is
                    high-confidence, <5 medium. Lower = closer. */}
                <span
                  aria-label={`Delta E ${m.deltaE.toFixed(1)}`}
                  className="font-mono text-2xs tabular-nums text-[var(--color-fg-subtle)] flex-shrink-0"
                >
                  ΔE {m.deltaE.toFixed(1)}
                </span>
              </button>
            </li>
          ))}
          {!catalogLoading && libraryRows.length === 0 ? (
            <li className="px-2 py-3 text-2xs font-sans text-[var(--color-fg-muted)] text-center">
              No paints within ΔE {showFurther ? MATCH_EXPANDED_DELTAE : MATCH_DEFAULT_DELTAE}.
              {!showFurther ? ' Try "Show more matches".' : ""}
            </li>
          ) : null}
        </ul>
      </section>

      <hr />

      {/* -------- Sub-panel 3: eyedropper -------- */}
      <section aria-labelledby="cp-eyedrop-heading" className="space-y-3">
        <h3 id="cp-eyedrop-heading" className="section-title">
          Eyedropper
        </h3>
        <DropZone
          onFile={handleEyeFile}
          onError={(msg) => setEyeError(msg)}
          disabled={eyeBusy}
        />
        {eyeError ? (
          <p
            role="alert"
            className="text-2xs font-mono text-[var(--color-red)]"
          >
            {eyeError}
          </p>
        ) : null}
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="Reference"
            className="block max-h-40 w-auto mx-auto rounded-sm"
            style={{ border: "1px solid var(--color-border-strong)" }}
          />
        ) : null}
        {eyeSwatches.length > 0 ? (
          <div
            className="flex flex-wrap gap-2"
            role="list"
            aria-label="Extracted swatches"
          >
            {eyeSwatches.map((hex, idx) => (
              <button
                key={`${idx}-${hex}`}
                type="button"
                role="listitem"
                onClick={() => emitHex(hex)}
                aria-label={`Use extracted swatch ${hex}`}
                className="block w-9 h-9 rounded-sm cursor-pointer hover:scale-110 transition-transform"
                style={{
                  background: hex,
                  border: "2px solid var(--color-border-strong)",
                }}
                title={hex}
              />
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}

/* ============================================================
   <WheelRing>
   PIXEL / retro rainbow hue wheel (batch/redesign-recipes,
   DESIGN_LANGUAGE §7.3 "pixel color-wheel upgrade").

   Behaviour is UNCHANGED from the prior smooth-wedge ring — the
   pointer / keyboard handlers, the aria-slider contract, and the
   cursor all compute purely from the angle about the centre, so
   they're independent of how the ring is painted. The VISUAL is
   restyled toward the moodboard's pixelated retro colour wheel:
   the ring is rasterised into a grid of discrete square "pixels",
   each filled by the hue at its angle (quantised into stepped
   bands) and slightly stepped in saturation across two radial
   rings, with a chunky pixel cursor block instead of a smooth dot.

   Saturation + lightness for the WHEEL FILL are held constant for
   the fast-pick UX (Ross's brief stresses speed); the picked
   colour's real S/L still come from the sliders below the wheel.
   ============================================================ */

/** Pixel grid resolution + ring geometry for the retro wheel. A fixed
 *  cell size keeps every "pixel" a crisp square regardless of the SVG
 *  scale; the ring band is ~5 cells thick so the blocks read as a chunky
 *  rainbow donut rather than a thin line. */
const WHEEL_SIZE = 160;
const WHEEL_PX = 10; // edge of one square pixel cell (retro chunk size)
const WHEEL_HUE_STEPS = 24; // quantised hue bands (retro colour banding)

function WheelRing({
  hue,
  onChange,
}: {
  hue: number;
  onChange: (h: number) => void;
}) {
  const ref = useRef<SVGSVGElement | null>(null);
  const [dragging, setDragging] = useState(false);

  const size = WHEEL_SIZE;
  const radius = size / 2 - 8;
  const cx = size / 2;
  const cy = size / 2;

  const computeHue = (clientX: number, clientY: number): number | null => {
    const svg = ref.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    // Map client px → SVG user units so the angle is correct even when the
    // wheel is CSS-scaled (the grid is in user units, not screen px).
    const sx = rect.width ? size / rect.width : 1;
    const sy = rect.height ? size / rect.height : 1;
    const x = (clientX - rect.left) * sx - cx;
    const y = (clientY - rect.top) * sy - cy;
    let deg = (Math.atan2(y, x) * 180) / Math.PI;
    if (deg < 0) deg += 360;
    return deg;
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const next = computeHue(e.clientX, e.clientY);
    if (next == null) return;
    setDragging(true);
    onChange(next);
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragging) return;
    const next = computeHue(e.clientX, e.clientY);
    if (next == null) return;
    onChange(next);
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    setDragging(false);
    (e.target as Element).releasePointerCapture?.(e.pointerId);
  };

  // Rasterise the ring into a grid of square pixel cells. Each cell whose
  // centre lands inside the ring band gets a colour from the hue at its
  // angle — quantised into WHEEL_HUE_STEPS bands for the stepped retro
  // rainbow, and stepped in saturation across the inner/outer half of the
  // band so the donut has a touch of pixel-art depth.
  const pixels = useMemo(() => {
    const innerR = radius - WHEEL_PX * 5;
    const outerR = radius;
    const cells: { x: number; y: number; fill: string }[] = [];
    for (let gy = 0; gy < size; gy += WHEEL_PX) {
      for (let gx = 0; gx < size; gx += WHEEL_PX) {
        const ccx = gx + WHEEL_PX / 2;
        const ccy = gy + WHEEL_PX / 2;
        const dx = ccx - cx;
        const dy = ccy - cy;
        const dist = Math.hypot(dx, dy);
        if (dist < innerR || dist > outerR) continue;
        let deg = (Math.atan2(dy, dx) * 180) / Math.PI;
        if (deg < 0) deg += 360;
        // Quantise hue into discrete retro bands.
        const band = Math.round(deg / (360 / WHEEL_HUE_STEPS));
        const qHue = (band * (360 / WHEEL_HUE_STEPS)) % 360;
        // Step saturation by radial position (outer = punchier).
        const sat = dist > (innerR + outerR) / 2 ? 90 : 65;
        cells.push({ x: gx, y: gy, fill: hslToHex(qHue, sat, 55) });
      }
    }
    return cells;
  }, [cx, cy, radius, size]);

  // Pixel cursor — a chunky square block snapped to the grid, sitting on
  // the ring at the current hue (replaces the smooth dot for the retro
  // look). White block + black outline so it reads on any hue.
  const hueRad = (hue * Math.PI) / 180;
  const midR = radius - WHEEL_PX * 2.5;
  const rawCurX = cx + Math.cos(hueRad) * midR;
  const rawCurY = cy + Math.sin(hueRad) * midR;
  const curX = Math.floor(rawCurX / WHEEL_PX) * WHEEL_PX;
  const curY = Math.floor(rawCurY / WHEEL_PX) * WHEEL_PX;

  return (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="slider"
      aria-label="Hue"
      aria-valuemin={0}
      aria-valuemax={360}
      aria-valuenow={Math.round(hue)}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") onChange((hue - 5 + 360) % 360);
        if (e.key === "ArrowRight") onChange((hue + 5) % 360);
      }}
      // crispEdges keeps the square pixels hard-edged (no AA blur) for the
      // retro raster look.
      shapeRendering="crispEdges"
      className="block mx-auto cursor-crosshair"
    >
      {pixels.map((p, i) => (
        <rect
          key={i}
          x={p.x}
          y={p.y}
          width={WHEEL_PX}
          height={WHEEL_PX}
          fill={p.fill}
          stroke="#000000"
          strokeWidth={0.5}
        />
      ))}
      {/* Chunky pixel cursor block. */}
      <rect
        x={curX}
        y={curY}
        width={WHEEL_PX}
        height={WHEEL_PX}
        fill="#ffffff"
        stroke="#000000"
        strokeWidth={2}
      />
    </svg>
  );
}
