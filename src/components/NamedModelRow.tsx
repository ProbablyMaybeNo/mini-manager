"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { clsx } from "clsx";
import { deleteNamedModel, toggleNamedModelStage } from "@/lib/actions/namedModels";
import {
  applyToggle,
  namedModelStages,
  type NamedModelStage,
} from "@/lib/namedModels/cascade";

/**
 * Slim, serialisable snapshot — server pages pass this in. Avoids
 * shipping Date instances or fields the row never reads.
 */
export type NamedModelRowSnapshot = {
  id: string;
  name: string;
  isBuilt: boolean;
  isPrimed: boolean;
  isPainted: boolean;
  isBased: boolean;
  isComplete: boolean;
};

const STAGE_LABEL: Readonly<Record<NamedModelStage, string>> = {
  isBuilt: "BUILD",
  isPrimed: "PRIME",
  isPainted: "PAINT",
  isBased: "BASE",
  isComplete: "DONE",
};

const STAGE_INITIAL: Readonly<Record<NamedModelStage, string>> = {
  isBuilt: "B",
  isPrimed: "P",
  isPainted: "A",
  isBased: "S",
  isComplete: "C",
};

export function NamedModelRow({
  snapshot,
  recipeSlot,
}: {
  snapshot: NamedModelRowSnapshot;
  recipeSlot?: ReactNode;
}) {
  const [snap, setSnap] = useState<NamedModelRowSnapshot>(snapshot);
  const [error, setError] = useState<string | null>(null);
  const [recipeOpen, setRecipeOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Re-sync on parent re-render (after a revalidatePath round-trip).
  useEffect(() => {
    setSnap(snapshot);
  }, [snapshot]);

  const onToggle = (stage: NamedModelStage) => {
    const nextValue = !snap[stage];

    const result = applyToggle(
      {
        isBuilt: snap.isBuilt,
        isPrimed: snap.isPrimed,
        isPainted: snap.isPainted,
        isBased: snap.isBased,
        isComplete: snap.isComplete,
      },
      stage,
      nextValue,
    );
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);

    // Optimistic update — the server action will revalidate the page
    // on success. If it fails we restore the previous snapshot.
    const prev = snap;
    setSnap({ ...prev, ...result.patch });

    startTransition(async () => {
      const response = await toggleNamedModelStage({
        id: snap.id,
        stage,
        nextValue,
      });
      if (!response.ok) {
        setSnap(prev);
        setError(response.error);
      }
    });
  };

  const onDelete = () => {
    setError(null);
    const prev = snap;
    startTransition(async () => {
      const response = await deleteNamedModel({ id: prev.id });
      if (!response.ok) {
        setError(response.error);
      }
      // On success the parent re-renders without this row via
      // revalidatePath, so no local state mutation needed.
    });
  };

  return (
    <li className="space-y-2">
      <div
        className={clsx(
          "frame px-3 py-2 grid items-center gap-x-3 gap-y-2",
          "grid-cols-[1fr_auto] sm:grid-cols-[1fr_auto_auto]",
        )}
      >
        <span className="flex items-center gap-2 min-w-0">
          {recipeSlot ? (
            <button
              type="button"
              onClick={() => setRecipeOpen((prev) => !prev)}
              aria-expanded={recipeOpen}
              aria-label={
                recipeOpen ? "Hide recipe override" : "Show recipe override"
              }
              className="text-2xs font-mono text-[var(--color-fg-subtle)] hover:text-[var(--color-cyan)] tap-target px-1"
            >
              {recipeOpen ? "▾" : "▸"}
            </button>
          ) : null}
          <span
            className={clsx(
              "font-mono text-sm truncate",
              snap.isComplete
                ? "text-[var(--color-green)]"
                : "text-[var(--color-fg)]",
            )}
          >
            {snap.name}
          </span>
        </span>

        <span
          className={clsx(
            "col-span-2 sm:col-span-1 flex flex-wrap items-center justify-start sm:justify-end gap-1.5",
          )}
        >
          {namedModelStages.map((stage) => (
            <StageCheckbox
              key={stage}
              modelName={snap.name}
              stage={stage}
              checked={snap[stage]}
              disabled={isPending}
              onToggle={() => onToggle(stage)}
            />
          ))}
        </span>

        <span className="col-span-2 sm:col-span-1 flex items-center justify-end">
          <button
            type="button"
            onClick={onDelete}
            disabled={isPending}
            aria-label={`Delete ${snap.name}`}
            className={clsx(
              "tap-target inline-flex items-center justify-center px-3 py-1.5",
              "frame-strong font-mono text-sm leading-none select-none",
              isPending
                ? "opacity-40 cursor-not-allowed"
                : "hover:bg-[color-mix(in_srgb,var(--color-red)_10%,transparent)] hover:text-[var(--color-red)] active:bg-[color-mix(in_srgb,var(--color-red)_16%,transparent)]",
            )}
          >
            ×
          </button>
        </span>
      </div>

      {recipeSlot && recipeOpen ? (
        <div className="frame px-3 py-2 ml-6">{recipeSlot}</div>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="frame px-3 py-2 text-xs font-mono text-[var(--color-red)] bg-[color-mix(in_srgb,var(--color-red)_8%,transparent)]"
        >
          {error}
        </p>
      ) : null}
    </li>
  );
}

function StageCheckbox({
  modelName,
  stage,
  checked,
  disabled,
  onToggle,
}: {
  modelName: string;
  stage: NamedModelStage;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={`${STAGE_LABEL[stage]} — ${modelName}`}
      disabled={disabled}
      onClick={onToggle}
      title={STAGE_LABEL[stage]}
      className={clsx(
        "tap-target inline-flex flex-col items-center justify-center gap-0.5 px-2 py-1",
        "frame font-mono text-xs leading-none select-none",
        checked
          ? "text-[var(--color-green)] border-[var(--color-accent)] bg-[color-mix(in_srgb,var(--color-accent)_8%,transparent)]"
          : "text-[var(--color-fg-muted)]",
        disabled
          ? "opacity-50 cursor-not-allowed"
          : !checked &&
              "hover:bg-[color-mix(in_srgb,var(--color-accent)_4%,transparent)] hover:text-[var(--color-fg)]",
      )}
    >
      <span aria-hidden>{checked ? "[x]" : "[ ]"}</span>
      <span
        aria-hidden
        className="text-2xs uppercase tracking-wider text-[var(--color-fg-subtle)]"
      >
        {STAGE_INITIAL[stage]}
      </span>
    </button>
  );
}
