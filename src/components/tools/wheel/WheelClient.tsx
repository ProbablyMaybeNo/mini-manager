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
import { SwatchActions, type SwatchAssignment } from "./SwatchActions";

interface PrimaryHs {
  hue: number;
  saturation: number;
}

const DEFAULT_PRIMARY: PrimaryHs = { hue: 0, saturation: 90 };
const DEFAULT_LIGHTNESS = 50;
const DEFAULT_HARMONY: HarmonyKey = "complementary";

/**
 * Owns the wheel's interactive state — the primary HSL pick, the active
 * harmony mode, the lightness slider, the pinned-swatch set, and the
 * per-colour paint assignments. Renders the WheelCanvas on the input pane
 * and the planned-recipe colour list on the output pane.
 *
 * 2026-06-04 recipe-flow rework — the page no longer plans a standalone
 * palette. It authors a RECIPE: each wheel colour is a planned recipe
 * slot, "[ Assign paint ]" opens the SAME recipe `ColorPicker` side panel
 * the create-recipe editor uses (wheel + harmony, library, ΔE match,
 * eyedropper), and "[ Send to recipe ]" saves it as a real recipe (raw-hex
 * slots allowed) or attaches it to a project — the saved row lands on
 * /recipes alongside hand-authored recipes. Assignments are keyed by the
 * planned colour's hex so they survive harmony/lightness tweaks that keep
 * the same swatch, and they ride into the save as `sourcePaintId` so the
 * recipe pins the real catalog paint instead of a custom hex.
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
  // Per-colour paint assignments, keyed by the planned colour's hex so a
  // harmony/lightness tweak that lands on the same swatch keeps its paint.
  const [assignments, setAssignments] = useState<
    ReadonlyMap<string, SwatchAssignment>
  >(new Map());

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
        // assigned-paint label resolution; the picker side panel loads its
        // own catalog independently.
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

  // Index the catalog by id so an assigned paintId resolves to a display
  // label ("Citadel Macragge Blue") without a second catalog fetch.
  const paintsById = useMemo(() => {
    const map = new Map<string, Paint>();
    paints.forEach((p) => map.set(p.id, p));
    return map;
  }, [paints]);

  const assignPaint = useCallback(
    (
      planHex: string,
      selection: { hex: string; paintId: string | null },
    ) => {
      const paint = selection.paintId
        ? paintsById.get(selection.paintId)
        : undefined;
      const label = paint ? `${paint.brand} ${paint.name}` : undefined;
      setAssignments((prev) => {
        const next = new Map(prev);
        next.set(planHex, {
          paintId: selection.paintId,
          hex: selection.hex,
          label,
        });
        return next;
      });
    },
    [paintsById],
  );

  const clearAssign = useCallback((planHex: string) => {
    setAssignments((prev) => {
      if (!prev.has(planHex)) return prev;
      const next = new Map(prev);
      next.delete(planHex);
      return next;
    });
  }, []);

  const swatchLabel = (i: number) =>
    i === 0 ? "Primary" : `Swatch ${i + 1}`;

  const harmonyMeta = getHarmonyMeta(harmony);
  const activeHex = harmonyHexes[indexForStopId(activeStopId)] ?? harmonyHexes[0];

  // The footer ships the planned recipe as the palette. A colour that has
  // a paint assigned contributes the assigned paint's hex + `sourcePaintId`
  // (so `sendPaletteToRecipe` pins the real catalog paint instead of a raw
  // custom-hex slot); an un-assigned colour rides as its planned hex —
  // raw-hex slots are allowed, exactly like the create-recipe flow. Pinned
  // swatches sort to the front so the painter's curated picks lead.
  const footerSwatches: ReadonlyArray<ToolPaletteSwatch> = useMemo(() => {
    const entries = harmonyHexes.map((planHex, i) => {
      const assigned = assignments.get(planHex);
      const planName = i === 0 ? "Primary" : `Swatch ${i + 1}`;
      const swatch: ToolPaletteSwatch = assigned
        ? {
            hex: assigned.hex,
            name: assigned.label ?? planName,
            ...(assigned.paintId ? { sourcePaintId: assigned.paintId } : {}),
          }
        : { hex: planHex, name: planName };
      return { planHex, swatch };
    });
    const ordered =
      pinnedHexes.size === 0
        ? entries
        : [...entries].sort((a, b) => {
            const aP = pinnedHexes.has(a.planHex) ? 0 : 1;
            const bP = pinnedHexes.has(b.planHex) ? 0 : 1;
            return aP - bP;
          });
    return ordered.map((e) => e.swatch);
  }, [harmonyHexes, pinnedHexes, assignments]);

  return (
    <ToolShell
      input={
        <div className="space-y-4">
          <header className="space-y-2">
            <p className="font-mono text-2xs uppercase tracking-[0.2em] text-[var(--color-cyan)]">
              SYS ▸ WHEEL / 01
            </p>
            <h1 className="title-display text-base md:text-lg">COLOUR WHEEL</h1>
            <p className="panel px-3 py-2 text-2xs font-sans leading-snug text-[var(--color-fg-muted)]">
              Use the colour wheel to plan a recipe — assign a paint to each
              colour, then attach it to a project or save it for later.
            </p>
            <p className="text-2xs font-sans text-[var(--color-fg-subtle)]">
              Drag the primary pick. Switch harmony with the bar below.
            </p>
          </header>

          {/* The pixel wheel framed in terminal chrome — a nested-border
              panel with corner ticks + an INPUT ▸ HUE port tag. */}
          <div className="relative panel panel-ticks p-4 flex items-center justify-center">
            <span className="panel-label" aria-hidden>
              INPUT ▸ HUE
            </span>
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
          <header className="space-y-2">
            <h2 className="section-title">
              Recipe colours · {harmonyHexes.length}
            </h2>
            {/* Active pick rendered as a color-bar chip — solid fill, black
                text shows the hex (§7.2 signature, AA on the fill). */}
            <p className="flex items-center gap-2 text-2xs font-sans text-[var(--color-fg-muted)]">
              <span className="font-mono uppercase tracking-wider">Active</span>
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-sm font-mono text-2xs text-black"
                style={{ background: activeHex }}
              >
                {activeHex}
              </span>
            </p>
          </header>

          <p className="text-2xs font-sans text-[var(--color-fg-subtle)] leading-snug">
            Each colour is a recipe slot. Click{" "}
            <span className="font-mono uppercase tracking-wider">
              Assign paint
            </span>{" "}
            to pick a real paint from the library (or the wheel, match, or
            eyedropper), then{" "}
            <span className="font-mono uppercase tracking-wider">
              Send to recipe
            </span>{" "}
            to save it or attach it to a project.
          </p>
          <div className="space-y-2">
            {harmonyHexes.map((hex, i) => (
              <SwatchActions
                key={`${hex}-${i}`}
                hex={hex}
                label={swatchLabel(i)}
                isPrimary={i === 0}
                isPinned={pinnedHexes.has(hex)}
                assignment={assignments.get(hex) ?? null}
                onPin={() => togglePin(hex)}
                onAssign={(selection) => assignPaint(hex, selection)}
                onClearAssign={() => clearAssign(hex)}
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

