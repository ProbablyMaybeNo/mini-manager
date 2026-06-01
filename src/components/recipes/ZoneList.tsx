"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { clsx } from "clsx";
import {
  addSlotWithPaint,
  deleteZone,
  reorderZones,
} from "@/lib/actions/recipeZones";
import { updateStep } from "@/lib/actions/recipeSteps";
import { Card } from "@/components/ui/Card";
import { LogTag } from "@/components/ui/LogTag";
import { Button } from "@/components/ui/Button";
import { ColorPicker } from "@/components/ui/ColorPicker";
import type { ColorPickerSelection } from "@/lib/colorPicker/types";
import {
  phase12LayerKeys,
  phase12LayerLabel,
  type Phase12LayerKey,
  type TechniqueKey,
} from "@/db/schema";

export interface ZoneListItem {
  id: string;
  name: string;
  silhouetteZoneId: string | null;
  stepCount: number;
  swatchHex: string | null;
  /** First-step id of the slot — used by the picker side panel to
   *  swap the paint on an already-filled slot via updateStep. */
  firstStepId: string | null;
  /** First-step technique (== Phase-12 layer name for new slots). The
   *  slot's swatch overlay chip renders this; the side-panel layer
   *  selector defaults to it. Null when the slot has no step yet. */
  firstStepTechnique: TechniqueKey | null;
}

/** True when `key` is one of Ross's Phase-12 layer names. Legacy
 *  techniques (layer / drybrush / glaze etc.) return false so they
 *  render as a generic chip without misclaiming a Phase-12 slot. */
function isPhase12Layer(key: TechniqueKey | null): key is Phase12LayerKey {
  if (!key) return false;
  return (phase12LayerKeys as readonly string[]).includes(key);
}

interface Props {
  recipeId: string;
  /** Kept on the props for backwards-compat with the page component +
   *  any downstream consumer; the starter-set picker is gone in P12.2,
   *  but bodyType is still useful as a future filter input. */
  bodyType: string;
  zones: ReadonlyArray<ZoneListItem>;
  selectedZoneId: string | null;
  onSelectZone: (zoneId: string) => void;
}

/**
 * Recipe colour-slot grid (P12.2 rebuild).
 *
 * Click an empty `+` slot → opens the ColorPicker side panel. Pick a
 * colour (any of the three sub-panels) → server-action creates the
 * zone + a single basecoat step in one call. The slot fills in.
 *
 * Click a filled slot → opens the side panel pre-seeded with that
 * slot's paint. Picking a different colour swaps the paint via
 * updateStep on the first step. (Layer assignment for additional
 * steps in the same slot lands in P12.3.)
 *
 * The body-part starter dropdown is gone — model-part presets are
 * out of scope per Ross's brief ("Recipes are about COLOR and PAINTS,
 * not parts of a model"). The schema's silhouetteZoneId column stays
 * but the picker UI no longer writes it.
 */
export function ZoneList({
  recipeId,
  zones,
  selectedZoneId,
  onSelectZone,
}: Props) {
  const [localZones, setLocalZones] = useState<ReadonlyArray<ZoneListItem>>(
    zones,
  );
  const [reorderError, setReorderError] = useState<string | null>(null);
  const [, startReorderTransition] = useTransition();
  const draggedIdRef = useRef<string | null>(null);
  const [dragTargetId, setDragTargetId] = useState<string | null>(null);

  // Side-panel state — null when closed; otherwise either "new" (an
  // empty + tile was clicked) or the editing slot's id.
  type PickerTarget = { kind: "new" } | { kind: "edit"; zoneId: string };
  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [isSaving, startSaveTransition] = useTransition();

  useEffect(() => {
    setLocalZones(zones);
  }, [zones]);

  const handleDrop = (targetId: string) => {
    const draggedId = draggedIdRef.current;
    draggedIdRef.current = null;
    setDragTargetId(null);
    if (!draggedId || draggedId === targetId) return;
    const fromIdx = localZones.findIndex((z) => z.id === draggedId);
    const toIdx = localZones.findIndex((z) => z.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;

    const next = localZones.slice();
    const [moved] = next.splice(fromIdx, 1);
    if (!moved) return;
    next.splice(toIdx, 0, moved);
    setLocalZones(next);
    const orderedIds = next.map((z) => z.id);
    setReorderError(null);
    startReorderTransition(async () => {
      const result = await reorderZones({ recipeId, orderedIds });
      if (!result.ok) {
        setReorderError(result.error);
        setLocalZones(zones);
      }
    });
  };

  const handlePickerSelect = (selection: ColorPickerSelection) => {
    setPickerError(null);
    startSaveTransition(async () => {
      if (pickerTarget?.kind === "new") {
        const result = await addSlotWithPaint({
          recipeId,
          paintId: selection.paintId ?? null,
          customColorHex: selection.paintId ? null : selection.hex,
        });
        if (!result.ok) {
          setPickerError(result.error);
          return;
        }
        // The page will revalidate + the parent re-renders zones —
        // close the panel + select the new slot.
        setPickerTarget(null);
        onSelectZone(result.data.zoneId);
      } else if (pickerTarget?.kind === "edit") {
        const target = localZones.find((z) => z.id === pickerTarget.zoneId);
        if (!target?.firstStepId) {
          setPickerError(
            "This slot has no step to update. Add a layer first.",
          );
          return;
        }
        const result = await updateStep({
          id: target.firstStepId,
          paintId: selection.paintId ?? null,
          customColorHex: selection.paintId ? null : selection.hex,
        });
        if (!result.ok) {
          setPickerError(result.error);
          return;
        }
        setPickerTarget(null);
      }
    });
  };

  // P12.3 — when the painter picks a layer from the side-panel layer
  // selector, update the first step's technique field. Doesn't close
  // the side panel — layer assignment is a quick edit + the painter
  // might still want to swap the paint after.
  const handleLayerSelect = (layer: Phase12LayerKey) => {
    if (pickerTarget?.kind !== "edit") return;
    const target = localZones.find((z) => z.id === pickerTarget.zoneId);
    if (!target?.firstStepId) {
      setPickerError("This slot has no step to update.");
      return;
    }
    setPickerError(null);
    startSaveTransition(async () => {
      const result = await updateStep({
        id: target.firstStepId!,
        technique: layer,
      });
      if (!result.ok) setPickerError(result.error);
    });
  };

  const editingZone =
    pickerTarget?.kind === "edit"
      ? localZones.find((z) => z.id === pickerTarget.zoneId) ?? null
      : null;

  return (
    <>
      <Card
        title={`Color slots · ${localZones.length}`}
        headerActions={
          localZones.length > 1 ? (
            <span className="text-2xs font-mono text-[var(--color-fg-subtle)] tracking-wider normal-case">
              drag ≡ to reorder
            </span>
          ) : null
        }
      >
        <div className="space-y-2">
          <p className="text-xs font-sans text-[var(--color-fg-subtle)] leading-snug">
            Click any{" "}
            <span className="font-mono uppercase tracking-wider">+</span>{" "}
            slot to pick a paint. Click a filled slot to swap its paint.
          </p>
          <div
            className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(112px,1fr))]"
            role="list"
            aria-label="Color slots"
          >
            {localZones.map((zone) => (
              <ColorSlotCell
                key={zone.id}
                zone={zone}
                selected={selectedZoneId === zone.id}
                onSelect={() => {
                  onSelectZone(zone.id);
                  setPickerTarget({ kind: "edit", zoneId: zone.id });
                }}
                isDragTarget={dragTargetId === zone.id}
                onDragStart={() => {
                  draggedIdRef.current = zone.id;
                }}
                onDragOver={(event) => {
                  if (draggedIdRef.current && draggedIdRef.current !== zone.id) {
                    event.preventDefault();
                    setDragTargetId(zone.id);
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  handleDrop(zone.id);
                }}
                onDragEnd={() => {
                  draggedIdRef.current = null;
                  setDragTargetId(null);
                }}
              />
            ))}
            <AddSlotTile onClick={() => setPickerTarget({ kind: "new" })} />
          </div>

          {localZones.length === 0 ? (
            <p className="text-xs font-sans text-[var(--color-fg-muted)]">
              No colour slots yet. Click the{" "}
              <span className="font-mono uppercase tracking-wider">+</span>{" "}
              tile above to pick your first paint.
            </p>
          ) : null}

          {reorderError ? (
            <p
              role="alert"
              className="flex items-start gap-2 frame px-3 py-1.5 text-2xs font-mono text-[var(--color-red)] bg-[color-mix(in_srgb,var(--color-red)_8%,transparent)]"
            >
              <LogTag variant="err" />
              <span>{reorderError}</span>
            </p>
          ) : null}
        </div>
      </Card>

      {pickerTarget ? (
        <ColorPickerSidePanel
          contextLabel={
            pickerTarget.kind === "new"
              ? "Add a new colour slot"
              : `Edit slot · ${editingZone?.name ?? ""}`
          }
          initial={
            pickerTarget.kind === "edit" && editingZone?.swatchHex
              ? { hex: editingZone.swatchHex }
              : null
          }
          currentLayer={
            pickerTarget.kind === "edit"
              ? editingZone?.firstStepTechnique ?? null
              : null
          }
          showLayerSelector={pickerTarget.kind === "edit"}
          busy={isSaving}
          error={pickerError}
          onClose={() => {
            setPickerTarget(null);
            setPickerError(null);
          }}
          onSelect={handlePickerSelect}
          onLayerSelect={handleLayerSelect}
        />
      ) : null}
    </>
  );
}

/**
 * LayerSelector — the 8-button row Ross's brief locks for slot layer
 * assignment. Shown above the ColorPicker inside the side panel when
 * the painter is editing an existing slot.
 *
 * Each button is a small mono-cap chip; the currently-assigned layer
 * gets a cyan border. Picking a different layer immediately fires
 * onSelect (no commit affordance — Ross's brief explicitly wants
 * "Click any paint to assign it to a layer" speed).
 *
 * Legacy techniques (layer / drybrush / glaze etc.) on already-saved
 * recipes render the currentLayer label as a hint above the buttons
 * but are NOT in the selectable set — the painter clicking any of
 * the 8 locked layers replaces the legacy value.
 */
function LayerSelector({
  currentLayer,
  onSelect,
}: {
  currentLayer: TechniqueKey | null;
  onSelect: (layer: Phase12LayerKey) => void;
}) {
  const isLockedLayer =
    currentLayer && (phase12LayerKeys as readonly string[]).includes(currentLayer);

  return (
    <section
      aria-label="Layer assignment"
      className="space-y-3 p-4"
      style={{ borderBottom: "1px solid var(--color-border)" }}
    >
      <h3 className="section-title">Layer</h3>
      {currentLayer && !isLockedLayer ? (
        <p className="text-2xs font-mono text-[var(--color-fg-subtle)]">
          Currently assigned (legacy):{" "}
          <span className="text-[var(--color-fg-muted)] uppercase tracking-wider">
            {currentLayer.replace(/_/g, " ")}
          </span>
        </p>
      ) : null}
      <div
        className="grid grid-cols-2 sm:grid-cols-4 gap-2"
        role="listbox"
        aria-label="Layers"
      >
        {phase12LayerKeys.map((key) => {
          const selected = currentLayer === key;
          return (
            <button
              key={key}
              type="button"
              role="option"
              aria-selected={selected}
              onClick={() => onSelect(key)}
              className={clsx(
                "px-2 py-1.5 font-mono text-2xs uppercase tracking-wider rounded-sm transition-colors text-center",
                selected
                  ? "text-[var(--color-cyan)]"
                  : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]",
              )}
              style={{
                border: selected
                  ? "2px solid var(--color-cyan)"
                  : "1px solid var(--color-border-strong)",
              }}
            >
              {phase12LayerLabel[key]}
            </button>
          );
        })}
      </div>
    </section>
  );
}

/**
 * Slide-out side panel that hosts the ColorPicker primitive. Renders
 * as a fixed-right drawer on desktop (480px wide), full-width on
 * mobile. Backdrop click closes; the user can also Esc out.
 *
 * Pure-presentational — animation handled via CSS transitions gated
 * on prefers-reduced-motion.
 */
function ColorPickerSidePanel({
  contextLabel,
  initial,
  currentLayer,
  showLayerSelector,
  busy,
  error,
  onClose,
  onSelect,
  onLayerSelect,
}: {
  contextLabel: string;
  initial: { hex: string } | null;
  currentLayer: TechniqueKey | null;
  showLayerSelector: boolean;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSelect: (selection: ColorPickerSelection) => void;
  onLayerSelect: (layer: Phase12LayerKey) => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex"
      role="dialog"
      aria-modal="true"
      aria-label={contextLabel}
    >
      <div
        aria-hidden
        onClick={onClose}
        className="flex-1 bg-[color-mix(in_srgb,var(--color-bg)_70%,transparent)]"
      />
      <aside
        className="w-full md:w-[480px] h-full bg-[var(--color-bg-elevated)] flex flex-col"
        style={{ borderLeft: "1px solid var(--color-border-strong)" }}
      >
        <header
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: "1px solid var(--color-border)" }}
        >
          <h2 className="font-mono text-xs uppercase tracking-wider text-[var(--color-fg)]">
            {contextLabel}
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="Close picker"
          >
            Close
          </Button>
        </header>
        <div className="flex-1 overflow-y-auto">
          {showLayerSelector ? (
            <LayerSelector
              currentLayer={currentLayer}
              onSelect={onLayerSelect}
            />
          ) : null}
          <ColorPicker
            value={initial ? { hex: initial.hex } : null}
            onSelect={onSelect}
            contextLabel={undefined}
          />
        </div>
        {error ? (
          <p
            role="alert"
            className="m-3 frame px-3 py-2 text-2xs font-mono text-[var(--color-red)] bg-[color-mix(in_srgb,var(--color-red)_8%,transparent)]"
          >
            {error}
          </p>
        ) : null}
        {busy ? (
          <p className="m-3 text-2xs font-mono text-[var(--color-fg-muted)] text-center">
            Saving…
          </p>
        ) : null}
      </aside>
    </div>
  );
}

/**
 * Horizontal-strip cell rendering for one colour slot. Click → opens
 * the picker side panel pre-seeded with this slot's paint. The delete
 * affordance lives in the corner (hover-revealed) so accidental swaps
 * never wipe the slot.
 */
function ColorSlotCell({
  zone,
  selected,
  onSelect,
  isDragTarget,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  zone: ZoneListItem;
  selected: boolean;
  onSelect: () => void;
  isDragTarget?: boolean;
  onDragStart?: () => void;
  onDragOver?: (event: React.DragEvent<HTMLDivElement>) => void;
  onDrop?: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd?: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const filled = zone.swatchHex !== null;

  const handleDelete = (event: React.MouseEvent | React.KeyboardEvent) => {
    event.stopPropagation();
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `Delete colour slot "${zone.name}"? Its steps will be removed too.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      await deleteZone({ id: zone.id });
    });
  };

  // Pick dark or light text against the swatch for max readability.
  const textColor = filled ? readableTextOn(zone.swatchHex!) : "var(--color-fg)";

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      role="listitem"
      className={clsx(
        "relative group rounded-sm transition-all",
        isDragTarget && "outline outline-2 outline-[var(--color-cyan)]",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={`${filled ? "Edit" : "Configure"} colour slot ${zone.name}`}
        title={`${zone.name} · ${zone.stepCount} step${zone.stepCount === 1 ? "" : "s"}`}
        className={clsx(
          "w-full aspect-square flex flex-col items-stretch justify-between rounded-sm transition-all cursor-pointer p-2",
          selected && "shadow-[0_0_0_2px_var(--color-cyan)]",
          isPending && "opacity-50 cursor-progress",
        )}
        style={{
          background: filled ? zone.swatchHex! : "transparent",
          border: selected
            ? "2px solid var(--color-cyan)"
            : filled
              ? "2px solid var(--color-border-strong)"
              : "2px dashed var(--color-border-strong)",
        }}
      >
        <span
          aria-hidden
          className="self-start cursor-grab text-2xs font-mono leading-none px-1 py-0.5 rounded-sm opacity-60 group-hover:opacity-100"
          style={{
            color: textColor,
            background: filled ? "rgba(0,0,0,0.2)" : "transparent",
          }}
          title="Drag to reorder"
        >
          ≡
        </span>
        <span
          className={clsx(
            "block font-mono text-xs leading-tight truncate font-semibold text-center",
            !filled && "text-[var(--color-fg)]",
          )}
          style={filled ? { color: textColor } : undefined}
        >
          {zone.name}
        </span>
        {/* P12.3 — layer chip overlaid in the bottom band of the slot.
            Renders the assigned Phase-12 layer name in tiny caps when
            one is set (basecoat / midcoat / highlight / etc.). Legacy
            techniques render their underscored name as-is. Empty slots
            show the existing "no paint" hint. */}
        <span
          className="block text-2xs font-mono uppercase tracking-wider text-center opacity-80"
          style={filled ? { color: textColor } : { color: "var(--color-fg-muted)" }}
        >
          {filled
            ? isPhase12Layer(zone.firstStepTechnique)
              ? phase12LayerLabel[zone.firstStepTechnique]
              : zone.firstStepTechnique
                ? zone.firstStepTechnique.replace(/_/g, " ")
                : `${zone.stepCount} step${zone.stepCount === 1 ? "" : "s"}`
            : "no paint"}
        </span>
      </button>
      <span
        role="button"
        tabIndex={0}
        aria-label={`Delete colour slot ${zone.name}`}
        onClick={handleDelete}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleDelete(event);
          }
        }}
        className="absolute top-1 right-1 text-2xs font-mono leading-none px-1 py-0.5 rounded-sm opacity-0 group-hover:opacity-100 hover:text-[var(--color-red)] cursor-pointer"
        style={{
          color: textColor,
          background: filled
            ? "rgba(0,0,0,0.2)"
            : "color-mix(in srgb, var(--color-bg) 70%, transparent)",
        }}
      >
        ×
      </span>
    </div>
  );
}

/**
 * Trailing "+" tile in the slot grid. Opens the ColorPicker side
 * panel in "new" mode so the painter goes from empty grid to first
 * paint in two clicks.
 */
function AddSlotTile({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Add a colour slot"
      className="aspect-square flex flex-col items-center justify-center gap-1.5 rounded-sm hover:bg-[color-mix(in_srgb,var(--color-cyan)_4%,transparent)] transition-all cursor-pointer text-[var(--color-fg-muted)] hover:text-[var(--color-cyan)] hover:[border-color:var(--color-cyan)]"
      style={{ border: "2px dashed var(--color-border-strong)" }}
    >
      <span aria-hidden className="font-mono text-2xl leading-none">
        +
      </span>
      <span className="font-mono text-2xs uppercase tracking-wider">
        Add color
      </span>
    </button>
  );
}

/**
 * Pick black or white for text rendered on a coloured background.
 * sRGB perceived-luminance threshold (~0.55). Falls back to the fg
 * token if the hex is malformed.
 */
function readableTextOn(hex: string): string {
  const clean = hex.startsWith("#") ? hex.slice(1) : hex;
  if (clean.length !== 6) return "var(--color-fg)";
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return "var(--color-fg)";
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.55 ? "#0a0a0a" : "#f5f5f5";
}
