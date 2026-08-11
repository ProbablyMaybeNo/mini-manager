"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Button, MultiSelectDropdown, Swatch } from "@/components/kit";
import { cn } from "@/lib/cn";
import type { Paint } from "@/lib/paints/types";
import { hexToHsl } from "@/lib/tools/wheel/harmonies";
import { extractDominantColors } from "@/lib/tools/eyedropper/kmeans";
import { imageToPixels, validateImageBlob } from "@/lib/tools/eyedropper/sample";
import {
  COLOR_PICKER_HARMONY_LABELS,
  buildPickerHarmony,
  hslToHex,
} from "@/lib/colorPicker/harmonies";
import {
  bandForHex,
  libraryMatches,
  LIBRARY_ROW_CAP,
  MATCH_DEFAULT_DELTAE,
  MATCH_EXPANDED_DELTAE,
  type LibraryRow,
} from "@/lib/colorPicker/matchPaints";
import type {
  ColorPickerHarmony,
  ColorPickerMode,
  ColorPickerSelection,
} from "@/lib/colorPicker/types";
import { PixelWheelRing } from "./PixelWheelRing";

/**
 * ΔE2000 → named match-quality badge (37:5 Pick & Paint library list):
 *   EXACT ≤1 · NEAR ≤2 · CLOSE ≤5 · SIMILAR ≤10 · (beyond) FAR.
 * Returns the badge label + its accent so the row reads the closeness at a
 * glance, with the precise ΔE kept alongside for power users.
 */
function matchQuality(deltaE: number): { label: string; cls: string } {
  if (deltaE <= 1) return { label: "EXACT", cls: "bg-green/15 border-green/25 text-green" };
  if (deltaE <= 2) return { label: "NEAR", cls: "bg-cyan/15 border-cyan/25 text-cyan-lite" };
  if (deltaE <= 5) return { label: "CLOSE", cls: "bg-cyan/10 border-cyan/20 text-cyan/80" };
  if (deltaE <= 10) return { label: "SIMILAR", cls: "bg-yellow/15 border-yellow/25 text-yellow" };
  return { label: "FAR", cls: "bg-fg/5 border-border text-fg-dim" };
}

/**
 * Shared 3-panel ColorPicker (ported from old `components/ui/ColorPicker.tsx`
 * into the terminal-phosphor kit). Stacked sub-panels:
 *   1. Pixel HSL wheel + harmony dropdown + sat/light sliders.
 *   2. Filterable library list (search + ΔE2000 cap + "show more matches").
 *   3. Eyedropper (drop / paste / file → k-means 6 swatches).
 * Emits `{ hex, paintId? }` via `onSelect`. Underpins MM-25 (recipe "Pick a
 * paint" slide-out), MM-51 (recipe-table paint editing), and the tools'
 * "assign paint" flows.
 *
 * The host passes the catalog in so this stays pure past its own image decode.
 */
export function ColorPicker({
  paints,
  catalogLoading = false,
  value,
  onSelect,
  onColorChange,
  contextLabel,
  mode = "add-slot",
  showEyedropper = true,
  showLibrary = true,
  showWheel = true,
  paintsOnly = false,
}: {
  paints: ReadonlyArray<Paint>;
  catalogLoading?: boolean;
  value?: ColorPickerSelection | null;
  onSelect: (selection: ColorPickerSelection) => void;
  /** Fires whenever the wheel's live colour moves — WITHOUT committing a pick.
   *  `onSelect` means "the painter chose this"; this means "this is what they
   *  are currently looking at", which is what a sibling surface (the Match
   *  tab's target colour) needs to stay in step with. */
  onColorChange?: (hex: string) => void;
  contextLabel?: string;
  mode?: ColorPickerMode;
  /** Render the image-eyedropper sub-panel. Off in the recipe Pick & Paint
   *  panel, which already exposes the eyedropper as its own top-level tab. */
  showEyedropper?: boolean;
  /** Render the filterable catalog-match "Library" sub-panel. Off for the
   *  Stacking tool (lvIX6p — colours-only, no "closest paint" pretense on a
   *  colour that isn't grounded yet). */
  showLibrary?: boolean;
  /** Render the wheel/harmony/sliders sub-panel. Off for the paywall's
   *  free "plain Library" surface (subscription paywall, fix 3) — the
   *  colour wheel is a subscriber-only tool, manual library search isn't. */
  showWheel?: boolean;
  /**
   * A recipe slot only takes a catalog paint (UX_FEEDBACK_2026-06-03 B2). On
   * a recipe surface this drops every path that would emit a bare hex: the
   * "Use this colour" button goes, and the harmony / extracted swatches AIM
   * the wheel instead of filling the slot — so they still drive the ranked
   * library list below, which is where the painter then picks a real paint.
   *
   * Off for the colour tools (Layering lanes, Stacking, the Match tool's
   * target picker), where a raw colour IS the legitimate output.
   *
   * Only meaningful with `showLibrary` — a paints-only picker with no library
   * has no way to pick anything.
   */
  paintsOnly?: boolean;
}) {
  const seedHsl = useMemo(() => {
    if (value?.hex) {
      const hsl = hexToHsl(value.hex);
      if (hsl) return hsl;
    }
    return { h: 180, s: 60, l: 55 };
  }, [value?.hex]);

  const [hue, setHue] = useState(seedHsl.h);
  const [sat, setSat] = useState(seedHsl.s);
  const [light, setLight] = useState(seedHsl.l);
  const [harmony, setHarmony] = useState<ColorPickerHarmony>("complementary");

  // Turning the hue wheel from an achromatic colour (white / grey / black —
  // e.g. the default "#ffffff" stacking substrate) otherwise does nothing:
  // at saturation 0 every hue is the same grey, so the painter spins the
  // ring and the colour never changes ("the wheel doesn't change the
  // substrate"). When the wheel is turned and the current pick can't express
  // hue, lift saturation to a usable floor and pull lightness off the
  // extremes so the chosen hue becomes visible immediately.
  const handleHueChange = (h: number) => {
    setHue(h);
    if (sat < 5) setSat(60);
    if (light <= 2 || light >= 98) setLight(55);
  };

  const pickedHex = useMemo(() => hslToHex(hue, sat, light), [hue, sat, light]);
  const harmonySwatches = useMemo(
    () => buildPickerHarmony(harmony, hue, sat, light),
    [harmony, hue, sat, light],
  );
  const band = useMemo(() => bandForHex(pickedHex), [pickedHex]);

  // Report the live colour upward. Held in a ref so a caller passing an inline
  // arrow doesn't re-fire this on every render — the effect should depend on
  // the COLOUR changing, not on the parent re-rendering. The ref is synced in
  // its own effect rather than during render, which is not allowed.
  const onColorChangeRef = useRef(onColorChange);
  useEffect(() => {
    onColorChangeRef.current = onColorChange;
  }, [onColorChange]);
  useEffect(() => {
    onColorChangeRef.current?.(pickedHex);
  }, [pickedHex]);

  /* ---------- library sub-panel ---------- */
  const [textQuery, setTextQuery] = useState("");
  const [showFurther, setShowFurther] = useState(false);
  // Company facet (mirrors the Library page's Company filter): a scrollable
  // checkbox list of the distinct brands in the catalog, AND-composed with
  // the search + ΔE cap.
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);

  const brandOptions = useMemo(
    () => Array.from(new Set(paints.map((p) => p.brand))).sort(),
    [paints],
  );
  // MultiSelectDropdown is Set-based; the match predicate takes an array. Keep
  // the array as the source of truth so `libraryMatches`'s memo key is a stable
  // identity that only changes when a company is actually toggled.
  const selectedBrandSet = useMemo(() => new Set(selectedBrands), [selectedBrands]);

  // A typed query searches the WHOLE catalog; the ΔE window only applies when
  // the box is empty (audit B3). See libraryMatches for why.
  const searching = textQuery.trim().length > 0;
  const deltaCap = showFurther ? MATCH_EXPANDED_DELTAE : MATCH_DEFAULT_DELTAE;
  const libraryRows = useMemo<LibraryRow[]>(
    () =>
      libraryMatches(pickedHex, paints, {
        query: textQuery,
        brands: selectedBrands,
        maxDeltaE: deltaCap,
      }),
    [paints, selectedBrands, textQuery, pickedHex, deltaCap],
  );

  /* ---------- eyedropper sub-panel ---------- */
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [eyeSwatches, setEyeSwatches] = useState<ReadonlyArray<string>>([]);
  const [eyeError, setEyeError] = useState<string | null>(null);
  const [eyeBusy, setEyeBusy] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function handleEyeFile(blob: Blob) {
    const validationError = validateImageBlob(blob);
    if (validationError) {
      setEyeError(validationError);
      return;
    }
    setEyeBusy(true);
    setEyeError(null);
    const url = URL.createObjectURL(blob);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(url);
    setEyeSwatches([]);
    try {
      const image = await imageToPixels(blob, { maxEdge: 512 });
      setEyeSwatches(extractDominantColors(image.pixels, image.width, image.height, { k: 6 }));
    } catch (err) {
      setEyeError(err instanceof Error ? err.message : "Could not decode the image.");
    } finally {
      setEyeBusy(false);
    }
  }

  const emitHex = (hex: string) => onSelect({ hex, paintId: null });
  /** Point the wheel at a colour instead of committing it. In paints-only
   *  mode this is what the harmony and extracted swatches do — the colour
   *  becomes the thing the library list ranks against, not the slot's value. */
  const aimWheel = (hex: string) => {
    const hsl = hexToHsl(hex);
    if (!hsl) return;
    setHue(hsl.h);
    setSat(hsl.s);
    setLight(hsl.l);
  };
  const swatchAction = paintsOnly ? aimWheel : emitHex;
  const swatchVerb = paintsOnly ? "Match paints to" : "Use";
  const emitPaint = (hex: string, paintId: string) => onSelect({ hex, paintId });
  // Which library row reads as selected: the seed selection passed by the host.
  const highlightedPaintId = value?.paintId;

  return (
    <div
      className="flex flex-col gap-4"
      role="region"
      aria-label={contextLabel ? `Color picker for ${contextLabel}` : "Color picker"}
    >
      <p className="font-body text-body text-fg">
        {mode === "edit-slot"
          ? "▸ Picking a colour REPLACES this slot's paint."
          : "▸ Picking a colour ADDS a new slot."}
      </p>

      {showWheel && (
      <>
      {/* Sub-panel 1 — wheel + harmony + sliders */}
      <section aria-labelledby="cp-wheel-heading" className="flex flex-col gap-3">
        <h3 id="cp-wheel-heading" className="label-osd text-cyan-lite">
          Wheel
        </h3>
        {/* Ring beside its controls, not stacked above them. Stacked, this
            section ran 468px tall, which pushed the paint list to y=840 in a
            900px viewport — so a painter turning the wheel could not see a
            single matching paint without scrolling, which is the entire point
            of the wheel and library being one panel. Side by side it is ~290px
            and the list clears the fold. Below `sm` there is no width to
            spend, so it stacks as before. */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
          <div className="sm:w-48 sm:shrink-0">
            <PixelWheelRing hue={hue} onChange={handleHueChange} />
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex items-center gap-3">
              <span
                aria-label="Picked colour"
                className="block h-8 w-8 border-2 border-fg/30"
                style={{ background: pickedHex }}
              />
              <span className="font-body text-body text-fg">
                {pickedHex}
                {band ? <span className="text-fg"> · {band}</span> : null}
              </span>
              {/* No "Use this colour" on a recipe surface — a slot holds a
                  paint, never a bare hex (B2). The wheel's job here is to aim
                  the ranked list below it, so the commit action is clicking a
                  paint in that list. */}
              {!paintsOnly && (
                <Button size="sm" onClick={() => emitHex(pickedHex)} className="ml-auto">
                  Use this colour
                </Button>
              )}
            </div>

            <label className="flex items-center gap-2">
              <span className="label-osd text-fg">Harmony</span>
              <select
                value={harmony}
                onChange={(e) => setHarmony(e.target.value as ColorPickerHarmony)}
                className="border border-cyan/50 bg-bg px-2 py-1 font-body text-body text-fg focus:border-cyan focus:outline-none"
              >
                {COLOR_PICKER_HARMONY_LABELS.map((h) => (
                  <option key={h.key} value={h.key}>
                    {h.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex flex-wrap gap-2" role="list" aria-label={`${harmony} harmony swatches`}>
              {harmonySwatches.map((hex, i) => (
                <button
                  key={`${i}-${hex}`}
                  type="button"
                  onClick={() => swatchAction(hex)}
                  aria-label={`${swatchVerb} harmony swatch ${hex}`}
                  className="h-9 w-9 border-2 border-fg/30 transition-transform hover:scale-110"
                  style={{ background: hex }}
                  title={hex}
                />
              ))}
            </div>

            <Slider label="Saturation" value={Math.round(sat)} onChange={setSat} />
            {sat === 0 && (
              <p className="font-body text-body text-fg">
                Greyscale — drag saturation up to pick a colour from the wheel.
              </p>
            )}
            <Slider label="Lightness" value={Math.round(light)} onChange={setLight} />
          </div>
        </div>
      </section>
      </>
      )}

      {showLibrary && (
      <>
      {showWheel && <hr className="border-cyan/20" />}

      {/* Sub-panel 2 — library */}
      <section aria-labelledby="cp-library-heading" className="flex flex-col gap-3">
        <h3 id="cp-library-heading" className="label-osd text-cyan-lite">
          Library
        </h3>

        {/* Search + company filter, as ONE control row at the TOP of the list.
            Both used to sit below it — the search box, then an always-visible
            grid of 39 company checkboxes. That grid was the panel's real
            layout problem: it competed with the results for the panel's height
            (Vercel `YtOKfPcOmKxq`, `_aI8GvJu7Tc0`), so the list got a
            viewport-relative cap and the filter still squashed underneath it.
            A popover takes zero height until asked for, which dissolves the
            fight rather than re-balancing it.

            This reverses the earlier "filters below the list, scan matches
            first" call. Deliberate: that reasoning holds for a filter you must
            look at, and none of it survived 39 companies. */}
        <div className="flex items-center gap-2">
          <input
            type="search"
            value={textQuery}
            onChange={(e) => setTextQuery(e.target.value)}
            placeholder="Search by paint name, brand, or line…"
            aria-label="Filter library paints"
            className="min-w-0 flex-1 border border-cyan/50 bg-bg px-3 py-2 font-body text-body text-fg placeholder:text-fg-muted focus:border-cyan focus:outline-none"
          />
          {brandOptions.length > 0 && (
            <MultiSelectDropdown
              heading="Companies"
              options={brandOptions}
              selected={selectedBrandSet}
              onChange={(next) => setSelectedBrands([...next])}
              ariaLabel="Filter by paint company"
              allLabel="Filter"
              countLabel={(n) => `Filter · ${n}`}
              align="right"
              className="w-36 shrink-0"
            />
          )}
        </div>

        <div className="flex items-center justify-between">
          <span className="font-body text-body text-fg">
            {catalogLoading
              ? "Loading catalog…"
              : searching
                ? `${libraryRows.length}${
                    libraryRows.length === LIBRARY_ROW_CAP ? "+" : ""
                  } result${libraryRows.length === 1 ? "" : "s"} in the library · nearest first`
                : `${libraryRows.length} match${
                    libraryRows.length === 1 ? "" : "es"
                  } · ΔE ≤ ${deltaCap}`}
          </span>
          {/* The ΔE toggle only means something when the window is what's
              driving the list — a search has already left it behind. */}
          {!searching && (
            <Button variant="tertiary" size="sm" onClick={() => setShowFurther((v) => !v)} aria-pressed={showFurther}>
              {showFurther ? "Tight match" : "Show more matches"}
            </Button>
          )}
        </div>
        {/* Audit B6 — this list is the panel's actual content and it had
            max-h-72: 288px, five rows of two hundred, inside an 896px-wide
            slide-out whose remaining ~500px went to the filter controls. Those
            controls are now one row above it.

            The cap depends on whether the wheel is above: with it, the wheel +
            its controls have already spent ~290px of the panel, so a 52vh list
            would run off the bottom and the painter would scroll the PANEL to
            reach matches instead of scrolling the LIST. Both values scroll
            internally; this just decides how much of the panel the list may
            claim. */}
        <ul
          className={cn(
            "flex flex-col gap-1 overflow-y-auto",
            showWheel ? "max-h-[30vh]" : "max-h-[52vh]",
          )}
          aria-label="Matching library paints"
        >
          {libraryRows.map((m) => (
            <li key={m.paint.id}>
              <button
                type="button"
                onClick={() => emitPaint(m.paint.hex, m.paint.id)}
                className={cn(
                  "flex w-full items-center gap-3 border border-cyan/20 px-2 py-1.5 text-left transition-colors hover:border-cyan hover:bg-cyan/5",
                  highlightedPaintId === m.paint.id && "border-cyan bg-cyan/10",
                )}
                aria-current={highlightedPaintId === m.paint.id || undefined}
              >
                <Swatch hex={m.paint.hex} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-body text-body text-fg">{m.paint.name}</span>
                  <span className="truncate font-body text-body text-fg">
                    {m.paint.brand}
                    {m.paint.line ? ` · ${m.paint.line}` : ""}
                  </span>
                </span>
                {/* A row found by name can carry no measurable distance (the
                    paint's own hex is unparseable), so the badges are per-row
                    rather than assumed. */}
                {m.deltaE != null && (
                  <span className="flex shrink-0 items-center gap-2">
                    {(() => {
                      const q = matchQuality(m.deltaE);
                      return (
                        <span
                          className={cn(
                            "rounded-[4px] border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide",
                            q.cls,
                          )}
                        >
                          {q.label}
                        </span>
                      );
                    })()}
                    <span className="font-body text-body tabular-nums text-fg-dim">
                      ΔE {m.deltaE.toFixed(1)}
                    </span>
                  </span>
                )}
              </button>
            </li>
          ))}
          {!catalogLoading && libraryRows.length === 0 && (
            <li className="px-2 py-3 text-center font-body text-body text-fg">
              {searching
                ? `No paint in the library matches “${textQuery.trim()}”.`
                : `No paints within ΔE ${deltaCap}.${
                    !showFurther ? ' Try "Show more matches".' : ""
                  }`}
            </li>
          )}
        </ul>

      </section>
      </>
      )}

      {showEyedropper && (
      <>
      <hr className="border-cyan/20" />

      {/* Sub-panel 3 — eyedropper */}
      <section aria-labelledby="cp-eyedrop-heading" className="flex flex-col gap-3">
        <h3 id="cp-eyedrop-heading" className="label-osd text-cyan-lite">
          Eyedropper
        </h3>
        <PickerDropZone onFile={handleEyeFile} disabled={eyeBusy} />
        {eyeError && (
          <p role="alert" className="font-body text-body text-red-text">
            {eyeError}
          </p>
        )}
        {previewUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="Reference"
            className="mx-auto block max-h-40 w-auto border border-fg/30"
          />
        )}
        {eyeSwatches.length > 0 && (
          <div className="flex flex-wrap gap-2" role="list" aria-label="Extracted swatches">
            {eyeSwatches.map((hex, i) => (
              <button
                key={`${i}-${hex}`}
                type="button"
                onClick={() => swatchAction(hex)}
                aria-label={`${swatchVerb} extracted swatch ${hex}`}
                className="h-9 w-9 border-2 border-fg/30 transition-transform hover:scale-110"
                style={{ background: hex }}
                title={hex}
              />
            ))}
          </div>
        )}
      </section>
      </>
      )}
    </div>
  );
}

function Slider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-center justify-between">
        <span className="label-osd text-fg">{label}</span>
        <span className="font-num2 text-num2 tabular-nums text-fg">{value}</span>
      </span>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="w-full accent-cyan"
      />
    </label>
  );
}

/** Compact drop / paste / file picker for the eyedropper sub-panel. */
function PickerDropZone({
  onFile,
  disabled,
}: {
  onFile: (blob: Blob) => void;
  disabled?: boolean;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [hovering, setHovering] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setHovering(true);
      }}
      onDragLeave={() => setHovering(false)}
      onDrop={(e) => {
        e.preventDefault();
        setHovering(false);
        if (disabled) return;
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      onPaste={(e) => {
        if (disabled) return;
        for (const item of e.clipboardData?.items ?? []) {
          if (item.type.startsWith("image/")) {
            const blob = item.getAsFile();
            if (blob) {
              e.preventDefault();
              onFile(blob);
              return;
            }
          }
        }
      }}
      tabIndex={0}
      role="button"
      aria-label="Drop image here, click to pick a file, or paste from clipboard"
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      className={cn(
        "cursor-pointer border border-dashed p-4 text-center transition-colors",
        hovering ? "border-cyan bg-cyan/5" : "border-cyan/50 hover:border-cyan",
        disabled && "cursor-progress opacity-60",
      )}
    >
      <p className="label-osd text-cyan-lite">⬚ Drop image</p>
      <p className="mt-1 font-body text-body text-fg">
        click to pick · or paste (Ctrl/⌘+V) · JPG/PNG/WebP/GIF
      </p>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
