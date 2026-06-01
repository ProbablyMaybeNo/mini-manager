"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  buildHarmony,
  getHarmonyMeta,
  hexToHsl,
  type HarmonyKey,
} from "@/lib/tools/wheel/harmonies";
import type { Paint } from "@/lib/paints/types";
import { loadPaints } from "@/lib/paints/loader";
import { resolvePaintByName } from "@/lib/tools/wheel/resolvePaint";
import { ToolShell } from "@/components/tools/ToolShell";
import { ToolFooterActions } from "@/components/tools/ToolFooterActions";
import type { ToolPaletteSwatch } from "@/lib/tools/types";
import { WheelCanvas, type WheelStop } from "./WheelCanvas";
import { HarmonyPicker } from "./HarmonyPicker";
import { SwatchActions } from "./SwatchActions";

interface PrimaryHs {
  hue: number;
  saturation: number;
}

const DEFAULT_PRIMARY: PrimaryHs = { hue: 0, saturation: 90 };
const DEFAULT_LIGHTNESS = 50;
const DEFAULT_HARMONY: HarmonyKey = "complementary";

/**
 * Owns the wheel's interactive state — the primary HSL pick, the active
 * harmony mode, the lightness slider, and the pinned-swatch set. Renders
 * the WheelCanvas on the input pane and the swatch list (with closest-
 * paint subrows) on the output pane.
 *
 * The "[ Send to recipe ]" / "[ Save palette ]" footer actions are wired
 * placeholders for P4.7 — they expose the current palette via the future
 * SendToRecipeModal.
 */
export function WheelClient() {
  const searchParams = useSearchParams();
  // R7-004 — `?hex=` and `?name=` deep-link params seed the primary
  // pick on mount. `?hex=` is the canonical param (Wheel needs a hex
  // anyway); `?name=` survives as a soft fallback so the Wishlist
  // "Tools ▾ → Wheel" menu (which only knows the paint title) still
  // pre-seeds via catalog resolution. Both are read once at mount —
  // mid-session URL edits don't re-seed.
  const initialHex = searchParams?.get("hex") ?? null;
  const initialName = searchParams?.get("name") ?? null;
  const seededFromName = useRef(false);

  const initialPrimary = useMemo<PrimaryHs>(() => {
    if (initialHex) {
      const hsl = hexToHsl(initialHex);
      if (hsl) return { hue: hsl.h, saturation: hsl.s };
    }
    return DEFAULT_PRIMARY;
  }, [initialHex]);
  const initialLightness = useMemo<number>(() => {
    if (initialHex) {
      const hsl = hexToHsl(initialHex);
      if (hsl) return Math.round(hsl.l);
    }
    return DEFAULT_LIGHTNESS;
  }, [initialHex]);

  const [primary, setPrimary] = useState<PrimaryHs>(initialPrimary);
  const [lightness, setLightness] = useState<number>(initialLightness);
  const [harmony, setHarmony] = useState<HarmonyKey>(DEFAULT_HARMONY);
  const [pinnedHexes, setPinnedHexes] = useState<ReadonlySet<string>>(new Set());
  const [activeStopId, setActiveStopId] = useState<string>("p");
  const [paints, setPaints] = useState<ReadonlyArray<Paint>>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);

  // Load the paint catalog once.
  useEffect(() => {
    let mounted = true;
    loadPaints()
      .then((rows) => {
        if (mounted) {
          setPaints(rows);
          // R7-004 — if `?hex=` wasn't supplied but `?name=` was, look
          // the title up in the catalog now (case-insensitive substring
          // match against name / brand / line, prefer exact-name) and
          // seed the wheel from the matched paint's hex.
          if (!initialHex && initialName && !seededFromName.current) {
            const matched = resolvePaintByName(rows, initialName);
            if (matched) {
              const hsl = hexToHsl(matched.hex);
              if (hsl) {
                setPrimary({ hue: hsl.h, saturation: hsl.s });
                setLightness(Math.round(hsl.l));
                seededFromName.current = true;
              }
            }
          }
        }
      })
      .catch(() => {
        // Catalog failure is non-fatal — the wheel still works without
        // closest-paint matches.
      })
      .finally(() => {
        if (mounted) setCatalogLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [initialHex, initialName]);

  // Derive the ordered list of hex strings from the harmony.
  const harmonyHexes = useMemo(
    () => buildHarmony(harmony, primary.hue, primary.saturation, lightness),
    [harmony, primary.hue, primary.saturation, lightness],
  );

  // Canvas stops: convert each hex back into draggable wheel coords.
  // For monochromatic, only the primary holds the painter-controlled HSL;
  // derived stops sit at varied lightness so they share the same hue+sat.
  const canvasStops: ReadonlyArray<WheelStop> = useMemo(() => {
    return harmonyHexes.map((_, i) => {
      const stop: WheelStop = {
        id: i === 0 ? "p" : `d-${i}`,
        hue: primary.hue + offsetForIndex(harmony, i),
        saturation: primary.saturation,
        isPrimary: i === 0,
      };
      return stop;
    });
  }, [harmonyHexes, harmony, primary.hue, primary.saturation]);

  const handlePrimaryChange = useCallback((next: PrimaryHs) => {
    setPrimary(next);
  }, []);

  const togglePin = useCallback((hex: string) => {
    setPinnedHexes((prev) => {
      const next = new Set(prev);
      if (next.has(hex)) next.delete(hex);
      else next.add(hex);
      return next;
    });
  }, []);

  const swatchLabel = (i: number) =>
    i === 0 ? "Primary" : `Swatch ${i + 1}`;

  const harmonyMeta = getHarmonyMeta(harmony);
  const activeHex = harmonyHexes[indexForStopId(activeStopId)] ?? harmonyHexes[0];

  // The footer ships the full harmony as the palette. Pinned swatches
  // sort to the front so the painter's curated picks lead.
  const footerSwatches: ReadonlyArray<ToolPaletteSwatch> = useMemo(() => {
    const swatches = harmonyHexes.map((hex, i) => ({
      hex,
      name: i === 0 ? "Primary" : `Swatch ${i + 1}`,
    }));
    if (pinnedHexes.size === 0) return swatches;
    return [...swatches].sort((a, b) => {
      const aP = pinnedHexes.has(a.hex) ? 0 : 1;
      const bP = pinnedHexes.has(b.hex) ? 0 : 1;
      return aP - bP;
    });
  }, [harmonyHexes, pinnedHexes]);

  return (
    <ToolShell
      input={
        <div className="space-y-4">
          <header className="space-y-1">
            <h1 className="text-3xl tracking-wide">COLOUR WHEEL</h1>
            <p className="text-2xs font-sans text-[var(--color-fg-muted)]">
              Drag the primary pick. Switch harmony with the bar below.
              Click <span className="font-mono uppercase tracking-wider">Find in library</span>{" "}
              on any swatch to pull the closest paints across every brand.
            </p>
          </header>

          <div className="flex items-center justify-center">
            <WheelCanvas
              size={360}
              lightness={lightness}
              stops={canvasStops}
              activeId={activeStopId}
              onPrimaryChange={handlePrimaryChange}
              onActiveChange={setActiveStopId}
            />
          </div>

          <div className="flex items-center gap-3">
            <label
              htmlFor="wheel-lightness"
              className="text-2xs font-mono uppercase tracking-wider text-[var(--color-fg-muted)] w-12"
            >
              L*
            </label>
            <input
              id="wheel-lightness"
              type="range"
              min={10}
              max={90}
              value={lightness}
              onChange={(e) => setLightness(Number(e.target.value))}
              className="flex-1"
            />
            <span className="text-2xs font-mono text-[var(--color-fg)] w-10 text-right">
              {lightness}%
            </span>
          </div>

          <div>
            <p className="section-title">Harmony</p>
            <HarmonyPicker
              active={harmony}
              onChange={setHarmony}
              primary={{
                hue: primary.hue,
                saturation: primary.saturation,
                lightness,
              }}
            />
          </div>
        </div>
      }
      output={
        <div className="space-y-4">
          <header className="space-y-1">
            <h2 className="section-title">Swatches · {harmonyHexes.length}</h2>
            <p className="text-2xs font-sans text-[var(--color-fg-muted)]">
              Active:{" "}
              <span
                aria-hidden
                className="inline-block align-middle w-3 h-3 rounded-sm border mx-1"
                style={{
                  background: activeHex,
                  borderColor: "var(--color-border-strong)",
                }}
              />
              <span className="font-mono">{activeHex}</span>
            </p>
          </header>

          <div className="space-y-2">
            {harmonyHexes.map((hex, i) => (
              <SwatchActions
                key={`${hex}-${i}`}
                hex={hex}
                label={swatchLabel(i)}
                isPrimary={i === 0}
                isPinned={pinnedHexes.has(hex)}
                paints={paints}
                catalogLoading={catalogLoading}
                onPin={() => togglePin(hex)}
              />
            ))}
          </div>
        </div>
      }
      footer={
        <ToolFooterActions
          toolId="wheel"
          swatches={footerSwatches}
          defaultPaletteName={`${harmonyMeta.label} palette`}
        />
      }
    />
  );
}

/* ============================================================
   Helpers — keep the harmony→stop offsets aligned with the
   pure-function math in lib/tools/wheel/harmonies.ts.
   ============================================================ */

function indexForStopId(stopId: string): number {
  if (stopId === "p") return 0;
  const m = /^d-(\d+)$/.exec(stopId);
  if (!m) return 0;
  return Number(m[1]);
}

function offsetForIndex(harmony: HarmonyKey, i: number): number {
  if (i === 0) return 0;
  switch (harmony) {
    case "complementary":
      return [0, 180][i] ?? 0;
    case "analogous":
      return [0, -30, 30][i] ?? 0;
    case "triadic":
      return [0, 120, 240][i] ?? 0;
    case "tetradic":
      return [0, 60, 180, 240][i] ?? 0;
    case "splitComplementary":
      return [0, 150, 210][i] ?? 0;
    case "square":
      return [0, 90, 180, 270][i] ?? 0;
    case "monochromatic":
      // Same hue across all five swatches.
      return 0;
    case "accentedAnalogous":
      return [0, -30, 30, 180][i] ?? 0;
  }
}

