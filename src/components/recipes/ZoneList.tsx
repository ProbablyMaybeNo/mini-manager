"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { clsx } from "clsx";
import {
  ZONE_PRESET_KEYS,
  ZONE_PRESET_LABEL,
  getZonePreset,
  type ZonePresetKey,
} from "@/lib/silhouettes/presets";
import {
  addZone,
  addZonesBulk,
  deleteZone,
  reorderZones,
} from "@/lib/actions/recipeZones";
import { Card } from "@/components/ui/Card";
import { LogTag } from "@/components/ui/LogTag";
import { Button } from "@/components/ui/Button";

export interface ZoneListItem {
  id: string;
  name: string;
  silhouetteZoneId: string | null;
  stepCount: number;
  swatchHex: string | null;
}

interface Props {
  recipeId: string;
  bodyType: string;
  zones: ReadonlyArray<ZoneListItem>;
  selectedZoneId: string | null;
  onSelectZone: (zoneId: string) => void;
}

/**
 * The colour-slot CRUD pane. Two ways in:
 *   - `+ Add color` — text input, painter types whatever
 *     ("Carapace", "Shoulder badge", "Pauldron trim", etc.)
 *   - `Use a starter set ▾` — one-shot populate from a preset
 *     pack (Infantry / Vehicle / Monster / Terrain). Defaults to
 *     the recipe's bodyType; painter can pick any pack.
 *
 * Reorder uses HTML5 drag-and-drop (same idiom as StepList).
 *
 * UI strings flipped from "Zone" → "Color slot" in P11.3 — schema
 * columns (`recipe_zone`, `silhouetteZoneId`) + server actions
 * (`addZone`, `reorderZones`) intentionally stay named as-is.
 */
export function ZoneList({
  recipeId,
  bodyType,
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

  return (
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
        Each colour slot is one part of the model — carapace, pauldron,
        eye lens. Add a slot, then pick a paint and a technique for it.
      </p>
      {/* P11.3 deep redesign: horizontal strip of clickable colour
          squares. Empty slots render with a dim border + slot name;
          filled slots show the actual paint swatch. Click → selects
          the slot and surfaces the technique editor below. */}
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
            onSelect={() => onSelectZone(zone.id)}
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
        {/* The trailing "+ Add color" tile lives inside the same grid
            so a partially-full row stays balanced visually. Clicking
            it scrolls to + focuses the existing add-control below. */}
        <AddSlotTile />
      </div>
      {localZones.length === 0 ? (
        <p className="text-xs font-sans text-[var(--color-fg-muted)]">
          No colour slots yet. Use{" "}
          <span className="font-mono uppercase tracking-wider">+ Add color</span>{" "}
          above, or load a starter set below.
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

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <AddZoneControl recipeId={recipeId} />
        <StarterZonesControl recipeId={recipeId} defaultBodyType={bodyType} />
      </div>
      </div>
    </Card>
  );
}

/**
 * Horizontal-strip cell rendering for one colour slot. Replaces the
 * old vertical `<ZoneRow>` (kept below as a back-compat alias if any
 * external consumer ever exists, but ZoneList itself uses these now).
 * P11.3 deep redesign — Ross's "empty colored squares" ask.
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

  const handleDelete = (event: React.MouseEvent) => {
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

  // Use a dark-text-on-swatch contrast pick so the name renders on
  // any colour. Computed once per render from the hex.
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
          "w-full aspect-square flex flex-col items-stretch justify-between rounded-sm border-2 transition-all cursor-pointer p-2",
          selected
            ? "border-[var(--color-cyan)] shadow-[0_0_0_2px_var(--color-cyan)]"
            : filled
              ? "border-[var(--color-border-strong)] hover:border-[var(--color-cyan)]"
              : "border-dashed border-[var(--color-border-strong)] hover:border-[var(--color-cyan)] hover:bg-[color-mix(in_srgb,var(--color-cyan)_4%,transparent)]",
          isPending && "opacity-50 cursor-progress",
        )}
        style={{ background: filled ? zone.swatchHex! : "transparent" }}
      >
        <span
          aria-hidden
          className="self-start cursor-grab text-2xs font-mono leading-none px-1 py-0.5 rounded-sm opacity-60 group-hover:opacity-100"
          style={{ color: textColor, background: filled ? "rgba(0,0,0,0.2)" : "transparent" }}
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
        <span
          className="block text-2xs font-mono uppercase tracking-wider text-center opacity-70"
          style={filled ? { color: textColor } : { color: "var(--color-fg-muted)" }}
        >
          {filled ? `${zone.stepCount} step${zone.stepCount === 1 ? "" : "s"}` : "no paint"}
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
            handleDelete(event as unknown as React.MouseEvent);
          }
        }}
        className="absolute top-1 right-1 text-2xs font-mono leading-none px-1 py-0.5 rounded-sm opacity-0 group-hover:opacity-100 hover:text-[var(--color-red)] cursor-pointer"
        style={{ color: textColor, background: filled ? "rgba(0,0,0,0.2)" : "color-mix(in srgb, var(--color-bg) 70%, transparent)" }}
      >
        ×
      </span>
    </div>
  );
}

/**
 * Trailing tile in the slot grid that scrolls + focuses the AddZoneControl
 * input below. Lets the user add a new slot from the strip itself instead
 * of hunting for the form. Visually balances rows that don't fill exactly.
 */
function AddSlotTile() {
  return (
    <button
      type="button"
      onClick={() => {
        // Find the "+ Add color" trigger Button below and click it.
        // AddZoneControl's input has autoFocus, so the form opens +
        // focuses in one user-perceived step.
        const trigger = document.querySelector<HTMLButtonElement>(
          'button[data-add-zone-trigger]',
        );
        if (trigger) {
          trigger.scrollIntoView({ behavior: "smooth", block: "nearest" });
          trigger.click();
        }
      }}
      aria-label="Add a colour slot"
      className="aspect-square flex flex-col items-center justify-center gap-1.5 rounded-sm border-2 border-dashed border-[var(--color-border-strong)] hover:border-[var(--color-cyan)] hover:bg-[color-mix(in_srgb,var(--color-cyan)_4%,transparent)] transition-all cursor-pointer text-[var(--color-fg-muted)] hover:text-[var(--color-cyan)]"
    >
      <span aria-hidden className="font-mono text-2xl leading-none">+</span>
      <span className="font-mono text-2xs uppercase tracking-wider">
        Add color
      </span>
    </button>
  );
}

/**
 * Pick black or white for text rendered on a coloured background.
 * Uses the standard sRGB perceived-luminance threshold (~0.55) — light
 * swatches get dark text, dark swatches get light text. Falls back to
 * the fg token if the hex is malformed.
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

/**
 * @deprecated kept for tests; ZoneList itself now renders ColorSlotCell.
 */
function AddZoneControl({ recipeId }: { recipeId: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const reset = () => {
    setOpen(false);
    setName("");
    setError(null);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setError("Slot name is required");
      return;
    }
    startTransition(async () => {
      const result = await addZone({ recipeId, name: trimmed });
      if (result.ok) reset();
      else setError(result.error);
    });
  };

  if (!open) {
    return (
      <Button
        type="button"
        onClick={() => setOpen(true)}
        variant="primary"
        size="sm"
        // Targeted by the AddSlotTile in the slot grid so clicking
        // the trailing "+ Add color" tile opens this control.
        data-add-zone-trigger
      >
        + Add color
      </Button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="frame p-3 space-y-3 bg-[var(--color-bg-elevated)] w-full"
    >
      <input
        type="text"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="e.g. Carapace, Pauldron trim, Tongues…"
        maxLength={80}
        autoFocus
        className="block w-full px-3 py-2 font-mono text-xs bg-[var(--color-bg)] frame focus:border-[var(--color-accent)]"
      />

      {error ? (
        <p
          role="alert"
          className="flex items-start gap-2 text-2xs font-mono text-[var(--color-red)]"
        >
          <LogTag variant="err" />
          <span>{error}</span>
        </p>
      ) : null}

      <div className="flex items-center gap-2">
        <Button
          type="submit"
          disabled={isPending}
          variant="primary"
          size="sm"
        >
          {isPending ? "Adding…" : "Add"}
        </Button>
        <Button
          type="button"
          onClick={reset}
          variant="ghost"
          size="sm"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

function StarterZonesControl({
  recipeId,
  defaultBodyType,
}: {
  recipeId: string;
  defaultBodyType: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isPresetKey = (k: string): k is ZonePresetKey =>
    (ZONE_PRESET_KEYS as ReadonlyArray<string>).includes(k);
  const initialKey: ZonePresetKey = isPresetKey(defaultBodyType)
    ? defaultBodyType
    : "infantry";
  const [picked, setPicked] = useState<ZonePresetKey>(initialKey);

  const applyPreset = () => {
    const preset = getZonePreset(picked);
    if (!preset || preset.length === 0) {
      setError("Empty preset");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await addZonesBulk({
        recipeId,
        zones: preset.map((z) => ({ id: z.id, name: z.name })),
      });
      if (result.ok) setOpen(false);
      else setError(result.error);
    });
  };

  if (!open) {
    return (
      <Button
        type="button"
        onClick={() => setOpen(true)}
        variant="ghost"
        size="sm"
      >
        Use a starter set ▾
      </Button>
    );
  }

  return (
    <div className="frame p-3 space-y-3 bg-[var(--color-bg-elevated)] w-full">
      <div className="flex flex-wrap items-center gap-2">
        {ZONE_PRESET_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setPicked(key)}
            className={clsx(
              "px-2 py-1 frame tap-target text-2xs font-mono uppercase tracking-wider",
              picked === key
                ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                : "text-[var(--color-fg-muted)]",
            )}
          >
            {ZONE_PRESET_LABEL[key]}
          </button>
        ))}
      </div>

      <p className="text-2xs font-sans text-[var(--color-fg-muted)]">
        Adds <strong>{getZonePreset(picked)?.length ?? 0}</strong> colour
        slots to the recipe. Edit or delete any row after.
      </p>

      {error ? (
        <p
          role="alert"
          className="flex items-start gap-2 text-2xs font-mono text-[var(--color-red)]"
        >
          <LogTag variant="err" />
          <span>{error}</span>
        </p>
      ) : null}

      <div className="flex items-center gap-2">
        <Button
          type="button"
          onClick={applyPreset}
          disabled={isPending}
          variant="primary"
          size="sm"
        >
          {isPending ? "Adding…" : "Add all"}
        </Button>
        <Button
          type="button"
          onClick={() => setOpen(false)}
          variant="ghost"
          size="sm"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
