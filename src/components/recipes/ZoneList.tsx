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
 * The zone CRUD pane. Two ways in:
 *   - `[ + Add zone ]` — text input, painter types whatever
 *     ("Carapace", "Shoulder badge", "Pauldron trim", etc.)
 *   - `[ Use starter zones ▾ ]` — one-shot populate from a preset
 *     pack (Infantry / Vehicle / Monster / Terrain). Defaults to
 *     the recipe's bodyType; painter can pick any pack.
 *
 * Reorder uses HTML5 drag-and-drop (same idiom as StepList).
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
      title={`Zones · ${localZones.length}`}
      headerActions={
        localZones.length > 1 ? (
          <span className="text-2xs font-mono text-[var(--color-fg-subtle)] tracking-wider normal-case">
            drag ≡ to reorder
          </span>
        ) : null
      }
    >
      <div className="space-y-2">
      {localZones.length === 0 ? (
        <p className="text-xs font-sans text-[var(--color-fg-muted)] frame px-3 py-3">
          No zones yet. Type your own with{" "}
          <span className="font-mono">[ + ] Add zone</span> or one-click
          populate a starter pack below.
        </p>
      ) : (
        <ul className="space-y-1" role="list">
          {localZones.map((zone) => (
            <ZoneRow
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
        </ul>
      )}

      {reorderError ? (
        <p
          role="alert"
          className="frame px-3 py-1.5 text-2xs font-mono text-[var(--color-red)] bg-[color-mix(in_srgb,var(--color-red)_8%,transparent)]"
        >
          {reorderError}
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

function ZoneRow({
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
  onDragOver?: (event: React.DragEvent<HTMLLIElement>) => void;
  onDrop?: (event: React.DragEvent<HTMLLIElement>) => void;
  onDragEnd?: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  const handleDelete = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (
      typeof window !== "undefined" &&
      !window.confirm(`Delete zone "${zone.name}"? Its steps will be removed too.`)
    ) {
      return;
    }
    startTransition(async () => {
      await deleteZone({ id: zone.id });
    });
  };

  return (
    <li
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={clsx(
        "flex items-stretch gap-1",
        isDragTarget && "outline outline-1 outline-[var(--color-cyan)]",
      )}
    >
      <span
        aria-hidden
        className="font-mono text-xs text-[var(--color-fg-subtle)] cursor-grab select-none px-1 flex items-center"
        title="Drag to reorder"
      >
        ≡
      </span>
      <button
        type="button"
        onClick={onSelect}
        className={clsx(
          "flex-1 min-w-0 flex items-center gap-3 px-2.5 py-2 frame text-left tap-target",
          "transition-colors",
          selected
            ? "border-[var(--color-cyan)] bg-[color-mix(in_srgb,var(--color-cyan)_8%,transparent)]"
            : "hover:bg-[color-mix(in_srgb,var(--color-fg)_3%,transparent)]",
          isPending && "opacity-50 cursor-progress",
        )}
        aria-pressed={selected}
      >
        <span
          aria-hidden
          className="inline-block w-4 h-4 rounded-sm border"
          style={{
            background: zone.swatchHex ?? "transparent",
            borderColor: "var(--color-border-strong)",
          }}
        />
        <span className="flex-1 min-w-0">
          <span
            className={clsx(
              "block font-mono text-sm truncate",
              selected ? "text-[var(--color-cyan)]" : "text-[var(--color-fg)]",
            )}
          >
            {zone.name}
          </span>
          <span className="block text-2xs font-mono text-[var(--color-fg-muted)] uppercase tracking-wider">
            {zone.silhouetteZoneId ?? "custom"} · {zone.stepCount} step
            {zone.stepCount === 1 ? "" : "s"}
          </span>
        </span>
        <span
          role="button"
          tabIndex={0}
          aria-label={`Delete zone ${zone.name}`}
          onClick={handleDelete}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              handleDelete(event as unknown as React.MouseEvent);
            }
          }}
          className="text-2xs font-mono text-[var(--color-fg-subtle)] hover:text-[var(--color-red)] px-2"
        >
          ×
        </span>
      </button>
    </li>
  );
}

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
      setError("Zone name is required");
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
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-3 py-2 frame-strong tap-target text-xs font-mono hover:bg-[color-mix(in_srgb,var(--color-accent)_8%,transparent)] hover:text-[var(--color-accent)]"
      >
        [ + ] Add zone
      </button>
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
          className="text-2xs font-mono text-[var(--color-red)]"
        >
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={isPending}
          className={clsx(
            "inline-flex items-center gap-2 px-3 py-1.5 frame-strong tap-target text-xs font-mono",
            isPending
              ? "opacity-60 cursor-progress"
              : "hover:bg-[color-mix(in_srgb,var(--color-accent)_8%,transparent)] hover:text-[var(--color-accent)]",
          )}
        >
          {isPending ? "[ … ] Adding" : "[ + ] Add"}
        </button>
        <button
          type="button"
          onClick={reset}
          className="text-2xs font-mono text-[var(--color-fg-muted)] hover:text-[var(--color-cyan)] tap-target px-3"
        >
          Cancel
        </button>
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
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-3 py-2 frame tap-target text-xs font-mono text-[var(--color-fg-muted)] hover:text-[var(--color-cyan)] hover:border-[var(--color-cyan)]"
      >
        [ ▾ ] Use starter zones
      </button>
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
        Adds <strong>{getZonePreset(picked)?.length ?? 0}</strong> zones to the
        recipe. Edit or delete any row after.
      </p>

      {error ? (
        <p
          role="alert"
          className="text-2xs font-mono text-[var(--color-red)]"
        >
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={applyPreset}
          disabled={isPending}
          className={clsx(
            "inline-flex items-center gap-2 px-3 py-1.5 frame-strong tap-target text-xs font-mono",
            isPending
              ? "opacity-60 cursor-progress"
              : "hover:bg-[color-mix(in_srgb,var(--color-accent)_8%,transparent)] hover:text-[var(--color-accent)]",
          )}
        >
          {isPending ? "[ … ] Adding" : "[ + ] Add all"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-2xs font-mono text-[var(--color-fg-muted)] hover:text-[var(--color-cyan)] tap-target px-3"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
