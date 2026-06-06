"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { clsx } from "clsx";
import {
  addSlot,
  deleteSlot,
  reorderSlots,
  updateSlot,
} from "@/lib/actions/recipeSlots";
import { Card } from "@/components/ui/Card";
import { LogTag } from "@/components/ui/LogTag";
import { Button } from "@/components/ui/Button";
import { ColorPicker } from "@/components/ui/ColorPicker";
import { RecipeInventoryButtons } from "@/components/recipes/RecipeInventoryButtons";
import type {
  ColorPickerMode,
  ColorPickerSelection,
} from "@/lib/colorPicker/types";
import {
  phase12LayerKeys,
  phase12LayerLabel,
  type Phase12LayerKey,
  type TechniqueKey,
} from "@/db/schema";

export interface SlotListItem {
  id: string;
  /** Resolved swatch hex (paint hex when paintId set, else customColorHex). */
  swatchHex: string | null;
  /** Catalog paint id pinned to this slot, if any. */
  paintId: string | null;
  /** Custom hex (legacy slots only — no new custom-hex slots are addable). */
  customColorHex: string | null;
  /** Resolved paint display name (e.g. "Citadel Macragge Blue"). Null for
   *  custom-hex slots or when the catalog label wasn't resolved. */
  paintLabel: string | null;
  /** The slot's assigned layer. */
  technique: TechniqueKey;
}

/** True for an optimistic, not-yet-persisted slot's temp id (perf-lag
 *  fix). Such cells exist only until the server re-render replaces them
 *  with the real row, so they must never be sent to a slot mutation. */
function isOptimisticId(id: string): boolean {
  return id.startsWith("optimistic-");
}

/** True when `key` is one of the locked Phase-12 layer names. */
function isPhase12Layer(key: TechniqueKey | null): key is Phase12LayerKey {
  if (!key) return false;
  return (phase12LayerKeys as readonly string[]).includes(key);
}

function layerDisplay(key: TechniqueKey | null): string {
  if (isPhase12Layer(key)) return phase12LayerLabel[key];
  if (key) return key.replace(/_/g, " ");
  return "basecoat";
}

interface PaintInventoryState {
  ownedCount: number;
  isWishlisted: boolean;
}

type SlotCoverage = "owned" | "wanted" | "none";

/** Coverage for a slot's paint from the painter's inventory — drives the
 *  green (owned) / yellow (wishlisted) square border. A custom-hex slot
 *  has no catalog paint to own, so it's always "none". */
function coverageForSlot(
  slot: SlotListItem,
  inventoryByPaintId?: ReadonlyMap<string, PaintInventoryState>,
): SlotCoverage {
  if (!slot.paintId) return "none";
  const inv = inventoryByPaintId?.get(slot.paintId);
  if (!inv) return "none";
  if (inv.ownedCount > 0) return "owned";
  if (inv.isWishlisted) return "wanted";
  return "none";
}

/** Owned/wishlist border for a slot square — the same green/yellow
 *  treatment as the library colour-map dots + the /recipes table. */
function coverageBorder(coverage: SlotCoverage): string {
  if (coverage === "owned") return "var(--color-green)";
  if (coverage === "wanted") return "var(--color-yellow)";
  return "var(--color-border-strong)";
}

interface Props {
  recipeId: string;
  slots: ReadonlyArray<SlotListItem>;
  ownedPaintIds?: ReadonlySet<string>;
  /** paintId → inventory state, powering the slot panel's WISHLIST/OWNED. */
  inventoryByPaintId?: ReadonlyMap<string, PaintInventoryState>;
}

/**
 * Flat recipe slot grid (2026-06-04 unify + flatten).
 *
 * A recipe is one ordered list of slots; each slot = ONE paint + its
 * layer (`technique`). There are no zones and no separate Steps box.
 *
 * Click an empty `+` tile → opens the paint picker; picking a paint adds
 * a new basecoat slot. Click a filled slot → opens the editor side panel
 * (swap the paint via the picker, or pick a different layer). Drag a slot
 * to reorder. The × in the corner deletes the slot.
 *
 * Paints-only: new slots must be backed by a catalog paint. Existing
 * custom-hex slots (from older recipes) still render their swatch.
 */
export function SlotList({ recipeId, slots, inventoryByPaintId }: Props) {
  const [localSlots, setLocalSlots] =
    useState<ReadonlyArray<SlotListItem>>(slots);
  const [reorderError, setReorderError] = useState<string | null>(null);
  const [, startReorderTransition] = useTransition();
  const draggedIdRef = useRef<string | null>(null);
  const [dragTargetId, setDragTargetId] = useState<string | null>(null);

  // Side-panel state — null when closed, otherwise the editing slot's id.
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  // Whether the add-paint picker tile is open.
  const [addOpen, setAddOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSaving, startSaveTransition] = useTransition();
  // Monotonic counter for optimistic-slot temp ids (perf-lag fix).
  const optimisticSeq = useRef(0);

  useEffect(() => {
    setLocalSlots(slots);
  }, [slots]);

  const handleDrop = (targetId: string) => {
    const draggedId = draggedIdRef.current;
    draggedIdRef.current = null;
    setDragTargetId(null);
    if (!draggedId || draggedId === targetId) return;
    // Don't reorder while an optimistic (not-yet-persisted) cell is in the
    // grid — its temp id isn't a real slot the server can order.
    if (isOptimisticId(draggedId) || isOptimisticId(targetId)) return;
    const fromIdx = localSlots.findIndex((s) => s.id === draggedId);
    const toIdx = localSlots.findIndex((s) => s.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;

    const next = localSlots.slice();
    const [moved] = next.splice(fromIdx, 1);
    if (!moved) return;
    next.splice(toIdx, 0, moved);
    setLocalSlots(next);
    const orderedIds = next.map((s) => s.id);
    setReorderError(null);
    startReorderTransition(async () => {
      const result = await reorderSlots({ recipeId, orderedIds });
      if (!result.ok) {
        setReorderError(result.error);
        setLocalSlots(slots);
      }
    });
  };

  // A selection from the full ColorPicker is EITHER a library paint
  // (paintId set) OR a raw hex from the wheel / harmony / eyedropper
  // (paintId null). The flat-slot model + recipeSlots actions accept
  // exactly one of paintId | customColorHex, so both paths persist.
  const selectionPatch = (
    selection: ColorPickerSelection,
  ): { paintId: string } | { customColorHex: string } =>
    selection.paintId
      ? { paintId: selection.paintId }
      : { customColorHex: selection.hex };

  const handleAddPaint = (selection: ColorPickerSelection) => {
    setActionError(null);
    // Perf (perf-lag fix): append an optimistic slot cell immediately so
    // the swatch shows the instant the painter picks — no waiting on the
    // server write + revalidate round-trip. The server re-render replaces
    // localSlots (via the `slots` prop sync) with the real row, which
    // carries the resolved paint label; we roll the optimistic cell back
    // only if the write fails.
    const patch = selectionPatch(selection);
    optimisticSeq.current += 1;
    const tempId = `optimistic-${optimisticSeq.current}`;
    const isPaint = "paintId" in patch;
    const optimisticSlot: SlotListItem = {
      id: tempId,
      swatchHex: selection.hex,
      paintId: isPaint ? patch.paintId : null,
      customColorHex: isPaint ? null : patch.customColorHex,
      // The picked paint's catalog label isn't on the wire; show the hex
      // for the sub-second window until the server render fills the name.
      paintLabel: isPaint ? selection.hex : null,
      technique: "basecoat",
    };
    setLocalSlots((prev) => [...prev, optimisticSlot]);
    // Item 3 — keep the slide-out OPEN after a pick so the painter can
    // add several paints in a row (or keep adjusting). The panel closes
    // only via its explicit Close control / Esc, never on a paint click.
    startSaveTransition(async () => {
      const result = await addSlot({ recipeId, ...patch });
      if (!result.ok) {
        setActionError(result.error);
        // Roll back the optimistic cell; the server state is the source
        // of truth and the write didn't land.
        setLocalSlots((prev) => prev.filter((s) => s.id !== tempId));
      }
    });
  };

  const handleSwapPaint = (
    slotId: string,
    selection: ColorPickerSelection,
  ) => {
    setActionError(null);
    startSaveTransition(async () => {
      const result = await updateSlot({
        id: slotId,
        ...selectionPatch(selection),
      });
      if (!result.ok) {
        setActionError(result.error);
      }
      // Item 3 — do NOT close the panel on a successful pick. The painter
      // keeps the slide-out open to keep adjusting / pick again; it closes
      // only via the explicit Close control / Esc.
    });
  };

  const handleLayerSelect = (slotId: string, layer: Phase12LayerKey) => {
    setActionError(null);
    startSaveTransition(async () => {
      const result = await updateSlot({ id: slotId, technique: layer });
      if (!result.ok) setActionError(result.error);
    });
  };

  const handleDelete = (slotId: string) => {
    setActionError(null);
    // An optimistic cell has no server row yet — just drop it locally.
    if (isOptimisticId(slotId)) {
      setLocalSlots((prev) => prev.filter((s) => s.id !== slotId));
      if (editingSlotId === slotId) setEditingSlotId(null);
      return;
    }
    startSaveTransition(async () => {
      const result = await deleteSlot({ id: slotId });
      if (!result.ok) setActionError(result.error);
      else if (editingSlotId === slotId) setEditingSlotId(null);
    });
  };

  const editingSlot = editingSlotId
    ? localSlots.find((s) => s.id === editingSlotId) ?? null
    : null;

  return (
    <>
      <Card
        title={`Recipe slots · ${localSlots.length}`}
        nested
        ticks
        techLabel="SLOTS"
        headerActions={
          localSlots.length > 1 ? (
            <span className="text-2xs font-mono text-[var(--color-fg-subtle)] tracking-wider normal-case">
              drag ≡ to reorder
            </span>
          ) : null
        }
      >
        <div className="space-y-2">
          <p className="text-xs font-sans text-[var(--color-fg-subtle)] leading-snug">
            Each slot is one paint and the layer you use it on. Click{" "}
            <span className="font-mono uppercase tracking-wider">+ Add paint</span>{" "}
            to append a slot; click a slot to swap its paint or change the
            layer.
          </p>
          <div
            className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(112px,1fr))]"
            role="list"
            aria-label="Recipe slots"
          >
            {localSlots.map((slot) => (
              <SlotCell
                key={slot.id}
                slot={slot}
                coverage={coverageForSlot(slot, inventoryByPaintId)}
                selected={editingSlotId === slot.id}
                onSelect={() => {
                  // An optimistic cell has no editable server row yet.
                  if (isOptimisticId(slot.id)) return;
                  setActionError(null);
                  setEditingSlotId(slot.id);
                }}
                onDelete={() => handleDelete(slot.id)}
                isDragTarget={dragTargetId === slot.id}
                onDragStart={() => {
                  draggedIdRef.current = slot.id;
                }}
                onDragOver={(event) => {
                  if (draggedIdRef.current && draggedIdRef.current !== slot.id) {
                    event.preventDefault();
                    setDragTargetId(slot.id);
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  handleDrop(slot.id);
                }}
                onDragEnd={() => {
                  draggedIdRef.current = null;
                  setDragTargetId(null);
                }}
              />
            ))}
            <AddSlotTile
              onClick={() => {
                setActionError(null);
                setAddOpen(true);
              }}
            />
          </div>

          {localSlots.length === 0 ? (
            <p className="text-xs font-sans text-[var(--color-fg-muted)]">
              No slots yet. Click the{" "}
              <span className="font-mono uppercase tracking-wider">
                + Add paint
              </span>{" "}
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
          {actionError ? (
            <p
              role="alert"
              className="text-2xs font-mono text-[var(--color-red)]"
            >
              {actionError}
            </p>
          ) : null}
        </div>
      </Card>

      {addOpen ? (
        <SlotEditorPanel
          contextLabel="Add a paint"
          mode="add-slot"
          initialHex={null}
          currentLayer={null}
          busy={isSaving}
          showLayerSelector={false}
          selectedPaintId={null}
          selectedPaintInventory={null}
          onPickColor={handleAddPaint}
          onLayerSelect={() => {}}
          onClose={() => setAddOpen(false)}
        />
      ) : null}

      {editingSlot ? (
        <SlotEditorPanel
          contextLabel={`Edit slot · ${editingSlot.paintLabel ?? layerDisplay(editingSlot.technique)}`}
          mode="edit-slot"
          initialHex={editingSlot.swatchHex}
          currentLayer={editingSlot.technique}
          busy={isSaving}
          showLayerSelector
          selectedPaintId={editingSlot.paintId}
          selectedPaintInventory={
            editingSlot.paintId
              ? inventoryByPaintId?.get(editingSlot.paintId) ?? {
                  ownedCount: 0,
                  isWishlisted: false,
                }
              : null
          }
          onPickColor={(selection) => handleSwapPaint(editingSlot.id, selection)}
          onLayerSelect={(layer) => handleLayerSelect(editingSlot.id, layer)}
          onClose={() => setEditingSlotId(null)}
        />
      ) : null}
    </>
  );
}

/**
 * LayerSelector — the 8-button row Ross's brief locks for a slot's layer.
 * Picking a layer fires onSelect immediately (no commit affordance).
 * Legacy techniques render a hint above the buttons but aren't selectable.
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
                  ? "text-[var(--color-accent)]"
                  : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]",
              )}
              style={{
                border: selected
                  ? "2px solid var(--color-accent)"
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
 * Slide-out side panel hosting the FULL colour-picker tool set + an
 * optional layer selector. Right-side drawer on desktop, bottom sheet on
 * mobile. Backdrop click / Esc closes.
 *
 * v6-4 bug fix — the panel previously hosted the bare paints-only flat
 * list picker, so the painter's brief-mandated tools —
 * the colour wheel + harmony, "pick from library", ΔE match, and the
 * eyedropper / colour-drop — were entirely missing from the recipe slot
 * side panel. Swapping in the shared ColorPicker primitive (the same one
 * the project ColorSchemeBox uses) renders all four, and because they
 * live in one always-mounted scrollable panel they PERSIST while adding
 * or swapping a paint instead of vanishing once the panel opens. A
 * library row emits a `paintId`; the wheel / harmony / eyedropper emit a
 * raw hex — both persist via the recipeSlots actions' paint|hex slot
 * invariant.
 */
function SlotEditorPanel({
  contextLabel,
  mode,
  initialHex,
  currentLayer,
  busy,
  showLayerSelector,
  selectedPaintId,
  selectedPaintInventory,
  onPickColor,
  onLayerSelect,
  onClose,
}: {
  contextLabel: string;
  mode: ColorPickerMode;
  initialHex: string | null;
  currentLayer: TechniqueKey | null;
  busy: boolean;
  showLayerSelector: boolean;
  /** The catalog paint this slot currently holds (null for add / custom-hex). */
  selectedPaintId: string | null;
  /** That paint's inventory state — null when there's no catalog paint. */
  selectedPaintInventory: PaintInventoryState | null;
  onPickColor: (selection: ColorPickerSelection) => void;
  onLayerSelect: (layer: Phase12LayerKey) => void;
  onClose: () => void;
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
      className="fixed inset-0 z-50 flex flex-col md:flex-row"
      role="dialog"
      aria-modal="true"
      aria-label={contextLabel}
    >
      <div
        aria-hidden
        onClick={onClose}
        className="flex-1 bg-[color-mix(in_srgb,var(--color-bg)_70%,transparent)]"
      />
      {/* Item 2 — terminal drawer: near-black fill with a 1px phosphor
          (cyan-dim) edge so the slide-out reads as a CRT side-panel, not a
          grey sheet. Top edge on mobile, left edge on desktop. */}
      <aside
        className="w-full max-h-[88vh] md:max-h-none md:w-[480px] md:h-full bg-[var(--color-bg-elevated)] flex flex-col border-t md:border-t-0 md:border-l"
        style={{
          paddingBottom: "env(safe-area-inset-bottom, 0)",
          borderColor: "var(--color-cyan-dim)",
        }}
      >
        <header
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: "1px solid var(--color-cyan-dim)" }}
        >
          <h2 className="font-mono text-xs uppercase tracking-wider text-[var(--color-cyan)] glow-text-strong">
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
          {/* Item 2 — WISHLIST + OWNED for the slot's selected catalog paint.
              Only a catalog-paint slot has an inventory row to toggle; the
              add path + custom-hex slots have no clear selected paint. */}
          {selectedPaintId && selectedPaintInventory ? (
            <div
              className="px-4 py-3"
              style={{ borderBottom: "1px solid var(--color-border)" }}
            >
              <RecipeInventoryButtons
                paintId={selectedPaintId}
                initial={selectedPaintInventory}
              />
            </div>
          ) : null}
          {showLayerSelector ? (
            <LayerSelector currentLayer={currentLayer} onSelect={onLayerSelect} />
          ) : null}
          {/* Full tool set: wheel + harmony, library, ΔE match, eyedropper. */}
          <ColorPicker
            value={initialHex ? { hex: initialHex } : null}
            onSelect={onPickColor}
            mode={mode}
          />
        </div>
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
 * One flat slot cell — swatch fills the box, the pinned paint's NAME is
 * the main label, and the layer renders at the bottom. Click to edit; ×
 * in the corner deletes.
 */
function SlotCell({
  slot,
  coverage,
  selected,
  onSelect,
  onDelete,
  isDragTarget,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  slot: SlotListItem;
  coverage: SlotCoverage;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  isDragTarget?: boolean;
  onDragStart?: () => void;
  onDragOver?: (event: React.DragEvent<HTMLDivElement>) => void;
  onDrop?: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd?: () => void;
}) {
  const filled = slot.swatchHex !== null;
  const textColor = filled ? readableTextOn(slot.swatchHex!) : "var(--color-fg)";

  const slotLabel =
    slot.paintLabel ??
    (slot.customColorHex ? `Custom · ${slot.customColorHex}` : "No paint");

  const handleDelete = (event: React.MouseEvent | React.KeyboardEvent) => {
    event.stopPropagation();
    if (
      typeof window !== "undefined" &&
      !window.confirm(`Delete this slot (${slotLabel})?`)
    ) {
      return;
    }
    onDelete();
  };

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
        isDragTarget && "outline outline-2 outline-[var(--color-accent)]",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={`Edit slot ${slotLabel}`}
        title={`${slotLabel} · ${layerDisplay(slot.technique)}`}
        className={clsx(
          "w-full aspect-square flex flex-col items-stretch justify-between rounded-sm transition-all cursor-pointer p-2",
          selected && "shadow-[0_0_0_2px_var(--color-accent)]",
        )}
        style={{
          background: filled ? slot.swatchHex! : "transparent",
          // Item 2 — owned (green) / wishlisted (yellow) border on the
          // filled square, matching the library dots + the /recipes table.
          // Selection still wins (accent); empty slots stay dashed.
          border: selected
            ? "2px solid var(--color-accent)"
            : filled
              ? `2px solid ${coverageBorder(coverage)}`
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
          {slotLabel}
        </span>
        <span
          className="block text-2xs font-mono uppercase tracking-wider text-center opacity-80"
          style={filled ? { color: textColor } : { color: "var(--color-fg-muted)" }}
        >
          {layerDisplay(slot.technique)}
        </span>
      </button>
      <span
        role="button"
        tabIndex={0}
        aria-label={`Delete slot ${slotLabel}`}
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
 * Trailing "+ Add paint" tile. Opens the paints-only picker so the
 * painter goes from empty grid to first paint in two clicks.
 */
function AddSlotTile({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Add a paint"
      className="aspect-square flex flex-col items-center justify-center gap-1.5 rounded-sm hover:bg-[color-mix(in_srgb,var(--color-accent)_4%,transparent)] transition-all cursor-pointer text-[var(--color-fg-muted)] hover:text-[var(--color-accent)] hover:[border-color:var(--color-accent)]"
      style={{ border: "2px dashed var(--color-border-strong)" }}
    >
      <span aria-hidden className="font-mono text-2xl leading-none">
        +
      </span>
      <span className="font-mono text-2xs uppercase tracking-wider">
        Add paint
      </span>
    </button>
  );
}

/**
 * Pick black or white for text rendered on a coloured background.
 * sRGB perceived-luminance threshold (~0.55).
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
