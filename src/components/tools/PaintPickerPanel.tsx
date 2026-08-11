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
import { SubscribeGateDialog } from "@/components/billing/SubscribeGateDialog";
import { useSubscriber } from "@/lib/billing/SubscriberContext";

type Tab = "library" | "match" | "dropper" | "layering";

/** Every TOOL tab is gated — matching, image eyedropper, and glaze-layering
 *  (docs/SUBSCRIPTION_PAYWALL.md, fix 3: "no free AI/tools, no exceptions").
 *  Only "library" (plain catalog search — manually typing a name and clicking
 *  a real paint) is free; it's the base-app "add a paint to a recipe"
 *  capability, not a tool.
 *
 *  The colour wheel is still subscriber-only, but it is no longer a tab to
 *  gate — it renders inside Library for subscribers only. See the Library
 *  branch below. */
const GATED_TABS: ReadonlySet<Tab> = new Set(["match", "dropper", "layering"]);

/** Context handed to a caller-supplied Match tab so this module never has to
 *  import {@link ColourMatchTool} itself — keeping `tools/ ↔ recipe/` acyclic. */
export type PaintPickerMatchContext = {
  paints: Paint[];
  brandOptions: string[];
  assignPaint: (paint: Paint) => void;
  /** The colour the Match tab should rank against when it opens: the slot's
   *  own colour, or whatever the Library wheel has been moved to since. Null
   *  when the panel was opened on an empty slot and the wheel hasn't been
   *  touched — the Match tool keeps its own default then. */
  targetHex: string | null;
};

/**
 * The **PAINT PICKER PANEL** — the tabbed "pick a paint" side panel, as opposed
 * to the {@link ColorPickerPanel} (the "COLOR PICKER PANEL"). It wraps
 * {@link ColorPicker} once (wheel above library, the component's own stacked
 * layout), {@link EyedropperTool} (image → palette), and {@link LayeringTool}
 * (Lab ramp + glaze stacking) — behind a tabbed {@link SlideOutPanel},
 * funnelling every tool's "use this paint/colour" action through one
 * {@link onSelect}.
 *
 * Subscription paywall (docs/SUBSCRIPTION_PAYWALL.md) — "Library" is the only
 * free tab (manually search + click a real paint); every tool tab (Match,
 * Dropper, Layering) is subscriber-gated per `GATED_TABS` below, and the wheel
 * is gated inside the Library tab on the same rule.
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
  paintsOnly = false,
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
  /**
   * Recipe surfaces only: a slot takes a catalog paint, never a bare hex
   * (UX_FEEDBACK_2026-06-03 B2). Drops the wheel's "Use this colour", turns
   * the harmony/extracted swatches into wheel targets, and re-points the
   * Dropper and Layering tabs at the wheel instead of the slot — so every
   * one of them ends at "now pick a paint from the ranked list".
   *
   * Off for the Match tool's embedded target picker, where the whole job is
   * to hand a raw colour back.
   */
  paintsOnly?: boolean;
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
  const [tab, setTab] = useState<Tab>("library");
  const isSubscriber = useSubscriber();
  const [gateOpen, setGateOpen] = useState(false);
  // The colour the whole panel is working on. Seeded from the slot and then
  // driven by the Library tab's wheel, so switching to Match ranks against the
  // colour the painter was just looking at instead of a hardcoded blue.
  const [targetHex, setTargetHex] = useState<string | null>(initialHex ?? null);
  /**
   * A colour pushed IN by a tool tab (Dropper / Layering), as opposed to
   * `targetHex` which the wheel pushes OUT. Kept separate on purpose: this one
   * is part of the ColorPicker's `key`, so a tool push remounts the picker
   * seeded to that colour and the wheel actually lands on it. `targetHex`
   * must never be in the key — it changes on every slider drag, which would
   * remount the picker mid-session and wipe the search.
   *
   * `n` makes repeat pushes of the SAME colour still take effect.
   */
  const [toolSeed, setToolSeed] = useState<{ hex: string; n: number } | null>(null);

  /** Route every tab click through the subscriber check — Match / Dropper /
   *  Layering are the recipe creator's power features (docs/
   *  SUBSCRIPTION_PAYWALL.md); a non-subscriber gets the gate dialog
   *  instead of the tab switching. */
  function selectTab(key: Tab) {
    if (GATED_TABS.has(key) && !isSubscriber) {
      setGateOpen(true);
      return;
    }
    setTab(key);
  }

  const tabs = useMemo<ReadonlyArray<{ key: Tab; label: string }>>(
    () => [
      { key: "library", label: "Library" },
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
  // the free library view regardless of the prior session. The target colour
  // re-seeds with it — a panel re-opened on a different slot must not carry the
  // previous slot's colour into Match.
  useEffect(() => {
    if (open) {
      setTab("library");
      setTargetHex(initialHex ?? null);
      setToolSeed(null);
    }
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

  /**
   * What a tool tab's colour does. On a recipe surface it CANNOT fill the slot
   * — it seeds the wheel and hands the painter back to Library, where the
   * ranked list is already showing the paints closest to it. Everywhere else
   * the colour is the answer, so it fills the slot as before.
   */
  const applyToolColour = (hex: string) => {
    if (!paintsOnly) {
      assignHex(hex);
      return;
    }
    setToolSeed((prev) => ({ hex, n: (prev?.n ?? 0) + 1 }));
    setTargetHex(hex);
    setTab("library");
  };

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
            const locked = GATED_TABS.has(t.key) && !isSubscriber;
            return (
              // A locked tab used to signal its state ONLY with an aria-hidden
              // 🔒, so a screen reader announced a plain "Wheel, tab, 2 of 5"
              // and the user got a paywall instead of a tool (paywall audit
              // MUX-P12). The Tools hub already does this properly one component
              // away. min-h-11 also lifts these off the 30px they measured.
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active}
                aria-label={locked ? `${t.label} — sponsor access only` : undefined}
                className={cn(
                  "-mb-px inline-flex min-h-11 items-center border-b-2 pb-2 font-mono text-body font-bold uppercase tracking-wide transition-colors duration-150 focus:outline-none focus-visible:text-cyan-lite",
                  active
                    ? "border-cyan text-cyan-lite"
                    : "border-transparent text-fg-dim hover:border-fg/30 hover:text-fg",
                )}
                onClick={() => selectTab(t.key)}
              >
                {t.label}
                {locked && <span aria-hidden> 🔒</span>}
              </button>
            );
          })}
        </div>

        {tab === "library" && (
          // ONE picker, wheel above library — not two tabs showing half of it
          // each. The split was arbitrary: the library list is already ranked
          // by ΔE2000 against the wheel's current colour, so separating them
          // meant the Wheel tab spun a colour with no way to see which paints
          // matched it (Vercel `C3QMQBdYltw7`) while the Library tab ranked
          // against a colour the painter could not see or turn.
          //
          // Re-key on the seed so re-opening on a different slot resets the
          // session instead of bleeding the prior one.
          //
          // The wheel stays subscriber-only — it is gated here rather than by
          // GATED_TABS, so a non-subscriber gets exactly today's free surface
          // (library search, no wheel) and a subscriber gets both stacked.
          <ColorPicker
            key={toolSeed ? `tool:${toolSeed.n}` : initialHex ?? initialPaintId ?? "no-initial"}
            paints={catalogPaints}
            catalogLoading={loading}
            value={
              toolSeed
                ? { hex: toolSeed.hex, paintId: null }
                : initialHex || initialPaintId
                  ? { hex: initialHex ?? "#000000", paintId: initialPaintId ?? null }
                  : null
            }
            contextLabel={contextLabel}
            mode={mode}
            showWheel={isSubscriber}
            showEyedropper={false}
            paintsOnly={paintsOnly}
            onSelect={handleSelect}
            onColorChange={setTargetHex}
          />
        )}

        {tab === "match" &&
          isSubscriber &&
          renderMatchTab?.({ paints, brandOptions, assignPaint, targetHex })}

        {tab === "dropper" && isSubscriber && (
          <EyedropperTool
            onSavePalette={(hexes) => {
              if (hexes[0]) applyToolColour(hexes[0]);
            }}
          />
        )}

        {tab === "layering" && isSubscriber && (
          <LayeringTool
            onSavePalette={(hexes) => {
              if (hexes[0]) applyToolColour(hexes[0]);
            }}
          />
        )}
      </div>
      <SubscribeGateDialog open={gateOpen} onClose={() => setGateOpen(false)} />
    </SlideOutPanel>
  );
}
