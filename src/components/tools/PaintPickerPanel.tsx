"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { SlideOutPanel } from "@/components/kit";
import { cn } from "@/lib/cn";
import { loadKitCatalog } from "@/lib/catalogClient";
import { loadPaints } from "@/lib/paints/loader";
import type { Paint } from "@/lib/types";
import type { Paint as CatalogPaint } from "@/lib/paints/types";
import type { ColorPickerSelection } from "@/lib/colorPicker/types";
import { ColorPicker } from "@/components/tools/ColorPicker";
import { EyedropperTool } from "@/components/tools/EyedropperTool";
import { LayeringTool } from "@/components/tools/LayeringTool";

type Tab = "picker" | "match" | "dropper" | "layering";

/** Context handed to a caller-supplied Match tab so this module never has to
 *  import {@link ColourMatchTool} itself — keeping `tools/ ↔ recipe/` acyclic. */
export type PaintPickerMatchContext = {
  paints: Paint[];
  brandOptions: string[];
  assignPaint: (paint: Paint) => void;
};

/**
 * The **PAINT PICKER PANEL** — the tabbed "pick a paint" side panel, as opposed
 * to the wheel-only {@link ColorPickerPanel} (the "COLOR PICKER PANEL"). It wraps
 * the standalone paint-creator tools — the 3-panel {@link ColorPicker} (wheel +
 * filterable library), {@link EyedropperTool} (image → palette), and
 * {@link LayeringTool} (Lab ramp + glaze stacking) — behind a tabbed
 * {@link SlideOutPanel}, funnelling every tool's "use this paint/colour" action
 * through one {@link onSelect}.
 *
 * The optional ranked-Match tab is injected by the caller via {@link renderMatchTab}
 * (recipes wire {@link ColourMatchTool} there); callers that don't need it — e.g.
 * the standalone Color Match page, which IS a match tool — simply omit it.
 *
 * The catalog loads client-side via the same {@link loadKitCatalog}/{@link loadPaints}
 * the Library and tools use (Dexie-cached); no refetch.
 */
export function PaintPickerPanel({
  open,
  onClose,
  onSelect,
  title = "Pick & Paint",
  breadcrumb,
  contextLabel,
  initialHex,
  initialPaintId,
  mode = "add-slot",
  note,
  closeOnSelect = false,
  renderMatchTab,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (selection: ColorPickerSelection) => void;
  title?: string;
  breadcrumb?: string;
  contextLabel?: string;
  initialHex?: string | null;
  initialPaintId?: string | null;
  mode?: "add-slot" | "edit-slot";
  /** Italic helper line under the tab bar. Defaults to the slot-fill copy. */
  note?: string;
  /** When true, a pick closes the panel; otherwise it stays open for multi-add. */
  closeOnSelect?: boolean;
  /** Optional Match tab. When provided, a "Match" tab appears and is rendered
   *  with the panel's loaded catalog. */
  renderMatchTab?: (ctx: PaintPickerMatchContext) => ReactNode;
}) {
  // Two views of the same catalog: the kit shape the tools/match expect, and
  // the richer catalog shape the 3-panel ColorPicker library list consumes.
  // Both loaders share loadPaints()'s in-flight cache, so this is one fetch.
  const [paints, setPaints] = useState<Paint[]>([]);
  const [catalogPaints, setCatalogPaints] = useState<ReadonlyArray<CatalogPaint>>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("picker");

  const tabs = useMemo<ReadonlyArray<{ key: Tab; label: string }>>(
    () => [
      { key: "picker", label: "Wheel · Library" },
      ...(renderMatchTab ? [{ key: "match" as const, label: "Match" }] : []),
      { key: "dropper", label: "Dropper" },
      { key: "layering", label: "Layering" },
    ],
    [renderMatchTab],
  );

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

  // Reset to the primary tab whenever the panel re-opens, so it always starts on
  // the wheel/library view regardless of the prior session.
  useEffect(() => {
    if (open) setTab("picker");
  }, [open, initialHex, initialPaintId]);

  const brandOptions = useMemo(
    () => Array.from(new Set(paints.map((p) => p.brand))).sort(),
    [paints],
  );

  // A pick may close the panel (edit-one flows) or keep it open (multi-add).
  const handleSelect = (selection: ColorPickerSelection) => {
    onSelect(selection);
    if (closeOnSelect) onClose();
  };
  const assignPaint = (paint: Paint) => handleSelect({ hex: paint.hex, paintId: paint.id });
  const assignHex = (hex: string) => handleSelect({ hex, paintId: null });

  return (
    <SlideOutPanel
      open={open}
      onClose={onClose}
      title={title}
      breadcrumb={breadcrumb ?? (contextLabel ? `PICK ▸ ${contextLabel.toUpperCase()}` : "PICK & PAINT")}
    >
      <div className="flex flex-col gap-4">
        <p className="font-mono text-body italic text-fg-dim">
          {note ??
            (mode === "edit-slot"
              ? "// choosing a paint replaces this slot"
              : "// choosing a paint fills this slot")}
        </p>

        {/* Underline-active tab bar (Pick & Paint 37:5). */}
        <div role="tablist" aria-label="Paint picker tools" className="flex flex-wrap gap-5 border-b border-border">
          {tabs.map((t) => {
            const active = t.key === tab;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.key)}
                className={cn(
                  "-mb-px border-b-2 pb-2 font-mono text-body font-bold uppercase tracking-wide transition-colors duration-150 focus:outline-none focus-visible:text-cyan-lite",
                  active
                    ? "border-cyan text-cyan-lite"
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
            // The eyedropper is its own tab here, so drop the duplicate sub-panel;
            // a click on a library paint selects it immediately.
            showEyedropper={false}
            onSelect={handleSelect}
          />
        )}

        {tab === "match" && renderMatchTab?.({ paints, brandOptions, assignPaint })}

        {tab === "dropper" && (
          <EyedropperTool
            onSavePalette={(hexes) => {
              if (hexes[0]) assignHex(hexes[0]);
            }}
          />
        )}

        {tab === "layering" && (
          <LayeringTool
            onSavePalette={(hexes) => {
              if (hexes[0]) assignHex(hexes[0]);
            }}
          />
        )}
      </div>
    </SlideOutPanel>
  );
}
