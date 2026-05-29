"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { clsx } from "clsx";
import {
  INFANTRY_ZONES,
  type InfantryZoneId,
} from "@/lib/silhouettes/infantry";
import type { RecipeZoneWithSteps } from "@/lib/recipes/types";
import { addZone, deleteZone, reorderZones } from "@/lib/actions/recipeZones";

export interface ZoneListItem {
  id: string;
  name: string;
  silhouetteZoneId: string | null;
  stepCount: number;
  swatchHex: string | null;
}

interface Props {
  recipeId: string;
  zones: ReadonlyArray<ZoneListItem>;
  selectedZoneId: string | null;
  onSelectZone: (zoneId: string) => void;
}

/**
 * Middle pane — the painter's zone list. Click selects (which mirrors
 * the silhouette pane's selection); the `[ + ] Add zone` popover offers
 * either a preset silhouette zone (filtered to ones not already used)
 * OR a custom free-text name.
 *
 * Reorder uses the native HTML5 drag-and-drop API, same idiom as
 * StepList (P3.5). Drop fires `reorderZones`; local state mirrors the
 * pending order so the optimistic UI feels instant.
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

  // Reset local order whenever the server-provided zones change
  // (parent re-renders after revalidate).
  useEffect(() => {
    setLocalZones(zones);
  }, [zones]);

  const usedSilhouetteIds = useMemo(() => {
    const set = new Set<string>();
    for (const z of localZones) {
      if (z.silhouetteZoneId) set.add(z.silhouetteZoneId);
    }
    return set;
  }, [localZones]);

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
    <div className="space-y-2">
      <h3 className="section-title flex items-center justify-between mb-0 pb-2">
        <span>Zones · {localZones.length}</span>
        {localZones.length > 1 ? (
          <span className="text-2xs font-mono text-[var(--color-fg-subtle)] tracking-wider">
            drag ≡ to reorder
          </span>
        ) : null}
      </h3>

      {localZones.length === 0 ? (
        <p className="text-xs font-sans text-[var(--color-fg-muted)] frame px-3 py-3">
          No zones yet. Click a region on the silhouette or use the
          <span className="font-mono"> [ + ] Add zone </span>
          button below to start.
        </p>
      ) : (
        <ul className="space-y-1" role="list">
          {localZones.map((zone) => (
            <ZoneRow
              key={zone.id}
              zone={zone}
              selected={selectedZoneId === zone.id}
              onSelect={() => onSelectZone(zone.id)}
              recipeId={recipeId}
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

      <AddZoneControl recipeId={recipeId} usedSilhouetteIds={usedSilhouetteIds} />
    </div>
  );
}

function ZoneRow({
  zone,
  selected,
  onSelect,
  recipeId,
  isDragTarget,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  zone: ZoneListItem;
  selected: boolean;
  onSelect: () => void;
  recipeId: string;
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
    void recipeId;
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

function AddZoneControl({
  recipeId,
  usedSilhouetteIds,
}: {
  recipeId: string;
  usedSilhouetteIds: ReadonlySet<string>;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"silhouette" | "custom">("silhouette");
  const [customName, setCustomName] = useState("");
  const [silhouettePick, setSilhouettePick] = useState<InfantryZoneId | "">("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const availableSilhouetteZones = useMemo(
    () => INFANTRY_ZONES.filter((z) => !usedSilhouetteIds.has(z.id)),
    [usedSilhouetteIds],
  );

  const reset = () => {
    setOpen(false);
    setCustomName("");
    setSilhouettePick("");
    setError(null);
    setMode("silhouette");
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (mode === "silhouette") {
      if (!silhouettePick) {
        setError("Pick a zone");
        return;
      }
      const meta = INFANTRY_ZONES.find((z) => z.id === silhouettePick);
      if (!meta) {
        setError("Unknown zone");
        return;
      }
      startTransition(async () => {
        const result = await addZone({
          recipeId,
          name: meta.name,
          silhouetteZoneId: meta.id,
        });
        if (result.ok) reset();
        else setError(result.error);
      });
    } else {
      const trimmed = customName.trim();
      if (trimmed.length === 0) {
        setError("Zone name is required");
        return;
      }
      startTransition(async () => {
        const result = await addZone({ recipeId, name: trimmed });
        if (result.ok) reset();
        else setError(result.error);
      });
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-3 py-2 frame-strong tap-target text-xs font-mono hover:bg-[color-mix(in_srgb,var(--color-green)_8%,transparent)] hover:text-[var(--color-green)]"
      >
        [ + ] Add zone
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="frame p-3 space-y-3 bg-[var(--color-bg-elevated)]"
    >
      <div className="flex items-center gap-2 text-2xs font-mono uppercase tracking-wider">
        <button
          type="button"
          onClick={() => setMode("silhouette")}
          className={clsx(
            "px-2 py-1 frame tap-target",
            mode === "silhouette"
              ? "border-[var(--color-green)] text-[var(--color-green)]"
              : "text-[var(--color-fg-muted)]",
          )}
        >
          Preset
        </button>
        <button
          type="button"
          onClick={() => setMode("custom")}
          className={clsx(
            "px-2 py-1 frame tap-target",
            mode === "custom"
              ? "border-[var(--color-green)] text-[var(--color-green)]"
              : "text-[var(--color-fg-muted)]",
          )}
        >
          Custom
        </button>
      </div>

      {mode === "silhouette" ? (
        <div>
          <select
            value={silhouettePick}
            onChange={(event) =>
              setSilhouettePick(event.target.value as InfantryZoneId | "")
            }
            className="block w-full px-3 py-2 font-mono text-xs bg-[var(--color-bg)] frame focus:border-[var(--color-green)]"
          >
            <option value="">— Pick a body zone —</option>
            {availableSilhouetteZones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </select>
          {availableSilhouetteZones.length === 0 ? (
            <p className="text-2xs font-sans text-[var(--color-fg-muted)] mt-2">
              All 12 preset zones are already in this recipe. Use Custom for
              extras.
            </p>
          ) : null}
        </div>
      ) : (
        <input
          type="text"
          value={customName}
          onChange={(event) => setCustomName(event.target.value)}
          placeholder="e.g. Shoulder badge"
          maxLength={80}
          autoFocus
          className="block w-full px-3 py-2 font-mono text-xs bg-[var(--color-bg)] frame focus:border-[var(--color-green)]"
        />
      )}

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
              : "hover:bg-[color-mix(in_srgb,var(--color-green)_8%,transparent)] hover:text-[var(--color-green)]",
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
