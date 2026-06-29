"use client";

import { useEffect, useMemo, useState } from "react";
import { SlideOutPanel } from "@/components/kit";
import { cn } from "@/lib/cn";
import { loadKitCatalog } from "@/lib/catalogClient";
import { loadPaints } from "@/lib/paints/loader";
import { closestPaint, rankMatchesMulti } from "@/lib/toolMatch";
import type { Paint } from "@/lib/types";
import type { Paint as CatalogPaint } from "@/lib/paints/types";
import type { ColorPickerSelection } from "@/lib/colorPicker/types";
import { ColorPicker } from "@/components/tools/ColorPicker";
import { ColourMatchTool } from "@/components/tools/ColourMatchTool";
import { EyedropperTool } from "@/components/tools/EyedropperTool";
import { LayeringTool } from "@/components/tools/LayeringTool";

type Tab = "picker" | "match" | "dropper" | "layering";

const TABS: ReadonlyArray<{ key: Tab; label: string }> = [
  { key: "picker", label: "Wheel · Library" },
  { key: "match", label: "Match" },
  { key: "dropper", label: "Dropper" },
  { key: "layering", label: "Layering" },
];

/**
 * Full "pick a paint" toolset for a recipe slot (UX-002). The Figma Recipe.png
 * right-rail puts the whole paint-creator toolset behind a recipe slot, not the
 * reduced wheel-only picker. This wraps the existing standalone tools verbatim
 * — the 3-panel {@link ColorPicker} (wheel + filterable library + eyedropper),
 * {@link ColourMatchTool} (brand-filtered ranked matches + harmonies),
 * {@link EyedropperTool} (image → palette), and {@link LayeringTool} (Lab ramp +
 * glaze stacking) — behind a tabbed {@link SlideOutPanel}, funnelling every
 * tool's "use this paint/colour" action through one {@link onSelect} so the
 * chosen paint lands on the slot being edited.
 *
 * The catalog loads client-side via the same {@link loadKitCatalog} the Library
 * and tools use (Dexie-cached); no refetch.
 */
export function RecipePaintPicker({
  open,
  onClose,
  onSelect,
  contextLabel,
  initialHex,
  initialPaintId,
  mode = "add-slot",
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (selection: ColorPickerSelection) => void;
  contextLabel?: string;
  initialHex?: string | null;
  initialPaintId?: string | null;
  mode?: "add-slot" | "edit-slot";
}) {
  // Two views of the same catalog: the kit shape the tools/match expect, and
  // the richer catalog shape the 3-panel ColorPicker library list consumes.
  // Both loaders share loadPaints()'s in-flight cache, so this is one fetch.
  const [paints, setPaints] = useState<Paint[]>([]);
  const [catalogPaints, setCatalogPaints] = useState<ReadonlyArray<CatalogPaint>>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("picker");

  useEffect(() => {
    let alive = true;
    Promise.all([loadKitCatalog(), loadPaints()])
      .then(([kit, catalog]) => {
        if (!alive) return;
        setPaints(kit);
        setCatalogPaints(catalog);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Reset to the primary tab whenever the panel re-opens on a slot, so a slot
  // always starts on the wheel/library view regardless of the prior session.
  useEffect(() => {
    if (open) setTab("picker");
  }, [open, initialHex, initialPaintId]);

  const brandOptions = useMemo(
    () => Array.from(new Set(paints.map((p) => p.brand))).sort(),
    [paints],
  );

  // Every tool funnels its "use this paint" / "use this colour" action here.
  const assignPaint = (paint: Paint) => onSelect({ hex: paint.hex, paintId: paint.id });
  const assignHex = (hex: string) => onSelect({ hex, paintId: null });
  // A layering/dropper "send to recipe" carries N paints; the slot takes the
  // first (the rest would need new slots, which the recipe editor owns).
  const assignFirst = (picks: Paint[]) => {
    if (picks[0]) assignPaint(picks[0]);
  };

  return (
    <SlideOutPanel
      open={open}
      onClose={onClose}
      title="Pick & Paint"
      breadcrumb={contextLabel ? `RECIPE ▸ ${contextLabel.toUpperCase()}` : "RECIPE ▸ PICK & PAINT"}
      width="max-w-2xl"
    >
      <div className="flex flex-col gap-4">
        <p className="font-mono text-body italic text-fg-dim">
          {mode === "edit-slot"
            ? "// choosing a paint replaces this slot"
            : "// choosing a paint fills this slot"}
        </p>

        {/* Underline-active tab bar (Pick & Paint 37:5). */}
        <div role="tablist" aria-label="Paint picker tools" className="flex flex-wrap gap-5 border-b border-border">
          {TABS.map((t) => {
            const active = t.key === tab;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.key)}
                className={cn(
                  "-mb-px border-b-2 pb-2 font-mono text-body font-bold uppercase tracking-wide transition-colors duration-150 focus:outline-none focus-visible:text-cyan",
                  active
                    ? "border-cyan text-cyan"
                    : "border-transparent text-fg-dim hover:border-fg/30 hover:text-fg",
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === "picker" && (
          // Re-key on the seed so re-opening on a different slot resets the
          // wheel / sliders / search instead of bleeding the prior session.
          <ColorPicker
            key={initialHex ?? initialPaintId ?? "no-initial"}
            paints={catalogPaints}
            catalogLoading={loading}
            value={
              initialHex || initialPaintId
                ? { hex: initialHex ?? "#000000", paintId: initialPaintId ?? null }
                : null
            }
            contextLabel={contextLabel}
            mode={mode}
            onSelect={onSelect}
          />
        )}

        {tab === "match" && (
          <ColourMatchTool
            rankMatches={(hex, brands, limit) => rankMatchesMulti(hex, paints, brands, limit)}
            brandOptions={brandOptions}
            onUse={assignPaint}
            onAssign={assignPaint}
          />
        )}

        {tab === "dropper" && (
          <EyedropperTool
            closestPaint={(hex) => closestPaint(hex, paints)}
            onSavePalette={(hexes) => {
              if (hexes[0]) assignHex(hexes[0]);
            }}
            onSendToRecipe={assignFirst}
          />
        )}

        {tab === "layering" && (
          <LayeringTool
            closestPaint={(hex) => closestPaint(hex, paints)}
            onSavePalette={(hexes) => {
              if (hexes[0]) assignHex(hexes[0]);
            }}
            onSendToRecipe={assignFirst}
          />
        )}
      </div>
    </SlideOutPanel>
  );
}
