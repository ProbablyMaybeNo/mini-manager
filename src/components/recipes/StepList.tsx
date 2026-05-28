"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { clsx } from "clsx";
import type { TechniqueKey } from "@/db/schema";
import { addStep, reorderSteps } from "@/lib/actions/recipeSteps";
import { StepRow, type StepRowData } from "@/components/recipes/StepRow";
import { techniqueLabel } from "@/components/recipes/TechniqueLabel";

interface Props {
  zoneId: string;
  zoneName: string;
  steps: ReadonlyArray<StepRowData>;
  ownedPaintIds?: ReadonlySet<string>;
}

/**
 * Selected zone's step rows + a `[ + Add step ]` button. Drag-and-drop
 * reordering uses the native HTML5 drag API — no third-party library.
 * On drop, we send the new ordered ids to `reorderSteps` and let the
 * server's revalidate refresh the parent. Local state mirrors the
 * pending order so the optimistic UI feels instant.
 */
export function StepList({
  zoneId,
  zoneName,
  steps,
  ownedPaintIds,
}: Props) {
  const [localSteps, setLocalSteps] = useState<ReadonlyArray<StepRowData>>(
    steps,
  );
  const [error, setError] = useState<string | null>(null);
  const [isAddPending, startAddTransition] = useTransition();
  const [, startReorderTransition] = useTransition();
  const draggedIdRef = useRef<string | null>(null);
  const [dragTargetId, setDragTargetId] = useState<string | null>(null);

  // Reset local state whenever the server-provided steps change (after a
  // revalidate the parent passes fresh rows; we replace ours).
  useEffect(() => {
    setLocalSteps(steps);
  }, [steps]);

  const handleAdd = () => {
    setError(null);
    startAddTransition(async () => {
      // Default technique: basecoat for an empty zone, otherwise mirror
      // the last step's technique (the painter usually layers in
      // succession).
      const defaultTechnique: TechniqueKey =
        localSteps[localSteps.length - 1]?.technique ?? "basecoat";
      const result = await addStep({
        zoneId,
        technique: defaultTechnique,
        // Default colour — Macragge Blue is universally legible as
        // "this is a stub". The painter will swap it immediately.
        customColorHex: "#0e4a8a",
      });
      if (!result.ok) setError(result.error);
    });
  };

  const handleDrop = (targetId: string) => {
    const draggedId = draggedIdRef.current;
    draggedIdRef.current = null;
    setDragTargetId(null);
    if (!draggedId || draggedId === targetId) return;
    const fromIdx = localSteps.findIndex((s) => s.id === draggedId);
    const toIdx = localSteps.findIndex((s) => s.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;

    const next = localSteps.slice();
    const [moved] = next.splice(fromIdx, 1);
    if (!moved) return;
    next.splice(toIdx, 0, moved);
    setLocalSteps(next);
    const orderedIds = next.map((s) => s.id);
    startReorderTransition(async () => {
      const result = await reorderSteps({ zoneId, orderedIds });
      if (!result.ok) {
        setError(result.error);
        // Revert local optimism on failure.
        setLocalSteps(steps);
      }
    });
  };

  const patchLocal = (id: string, patch: Partial<StepRowData>) => {
    setLocalSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    );
  };

  const headerLabel = useMemo(
    () => `Steps · ${zoneName} (${localSteps.length})`,
    [zoneName, localSteps.length],
  );

  return (
    <div className="space-y-2">
      <h3 className="section-title flex items-center justify-between mb-0 pb-2">
        <span>{headerLabel}</span>
        <span className="text-2xs font-mono text-[var(--color-fg-subtle)] tracking-wider">
          drag ≡ to reorder
        </span>
      </h3>

      {localSteps.length === 0 ? (
        <p className="text-xs font-sans text-[var(--color-fg-muted)] frame px-3 py-3">
          No steps yet. The first step is usually a{" "}
          <span className="font-mono">{techniqueLabel("basecoat")}</span> —
          click below to add one.
        </p>
      ) : (
        <div className="space-y-1.5" role="list">
          {localSteps.map((step, idx) => (
            <StepRow
              key={step.id}
              step={step}
              position={idx}
              ownedPaintIds={ownedPaintIds}
              isDragTarget={dragTargetId === step.id}
              onDragStart={() => {
                draggedIdRef.current = step.id;
              }}
              onDragOver={(event) => {
                if (draggedIdRef.current && draggedIdRef.current !== step.id) {
                  event.preventDefault();
                  setDragTargetId(step.id);
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                handleDrop(step.id);
              }}
              onDragEnd={() => {
                draggedIdRef.current = null;
                setDragTargetId(null);
              }}
              onLocalPatch={(patch) => patchLocal(step.id, patch)}
            />
          ))}
        </div>
      )}

      {error ? (
        <p
          role="alert"
          className="frame px-3 py-2 text-2xs font-mono text-[var(--color-red)] bg-[color-mix(in_srgb,var(--color-red)_8%,transparent)]"
        >
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={handleAdd}
        disabled={isAddPending}
        className={clsx(
          "inline-flex items-center gap-2 px-3 py-2 frame-strong tap-target text-xs font-mono",
          isAddPending
            ? "opacity-60 cursor-progress"
            : "hover:bg-[color-mix(in_srgb,var(--color-green)_8%,transparent)] hover:text-[var(--color-green)]",
        )}
      >
        {isAddPending ? "[ … ] Adding" : "[ + ] Add step"}
      </button>
    </div>
  );
}
