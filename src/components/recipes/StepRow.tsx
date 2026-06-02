"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { clsx } from "clsx";
import { techniqueKeys, type TechniqueKey } from "@/db/schema";
import { deleteStep, updateStep } from "@/lib/actions/recipeSteps";
import { techniqueLabel } from "@/components/recipes/TechniqueLabel";
import { PaintSlotPicker } from "@/components/recipes/PaintSlotPicker";

const NOTES_DEBOUNCE_MS = 500;

export interface StepRowData {
  id: string;
  technique: TechniqueKey;
  paintId: string | null;
  customColorHex: string | null;
  /** Resolved swatch hex (paintHex if paintId is set; customColorHex
   *  otherwise; null if no colour resolved yet). */
  swatchHex: string | null;
  /** Display label for the picked paint (e.g. "Citadel Macragge Blue"). */
  paintLabel: string | null;
  notesMd: string | null;
}

interface Props {
  step: StepRowData;
  position: number;
  /** Optional owned-paint set used by the slot picker. */
  ownedPaintIds?: ReadonlySet<string>;
  /** Drag handlers — the parent owns the drag/drop bookkeeping. */
  onDragStart?: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragOver?: (event: React.DragEvent<HTMLDivElement>) => void;
  onDrop?: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd?: (event: React.DragEvent<HTMLDivElement>) => void;
  isDragTarget?: boolean;
  /** Optimistic patch fired before the server confirms. */
  onLocalPatch?: (patch: Partial<StepRowData>) => void;
}

export function StepRow({
  step,
  position,
  ownedPaintIds,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isDragTarget,
  onLocalPatch,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [notes, setNotes] = useState(step.notesMd ?? "");
  const [savedNotes, setSavedNotes] = useState(step.notesMd ?? "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Mobile-only: expand-on-tap reveal for the step-notes input. The
  // input is always visible on lg+ so this only matters below lg.
  // Default-open when the step already has notes so the painter can
  // see them at a glance on small screens.
  const [notesExpanded, setNotesExpanded] = useState(
    (step.notesMd ?? "").length > 0,
  );
  const slotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setNotes(step.notesMd ?? "");
    setSavedNotes(step.notesMd ?? "");
  }, [step.id, step.notesMd]);

  // Debounced notes save.
  useEffect(() => {
    if (notes === savedNotes) return;
    const handle = setTimeout(() => {
      const next = notes;
      startTransition(async () => {
        const result = await updateStep({
          id: step.id,
          notesMd: next.length === 0 ? null : next,
        });
        if (result.ok) {
          setSavedNotes(result.data.notesMd ?? "");
        }
      });
    }, NOTES_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [notes, savedNotes, step.id]);

  const handleTechniqueChange = (next: TechniqueKey) => {
    onLocalPatch?.({ technique: next });
    startTransition(async () => {
      const result = await updateStep({ id: step.id, technique: next });
      if (!result.ok) setError(result.error);
    });
  };

  const handleDelete = () => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(`Delete this ${techniqueLabel(step.technique)} step?`)
    ) {
      return;
    }
    startTransition(async () => {
      const result = await deleteStep({ id: step.id });
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <div
      className={clsx(
        "frame px-2 py-2 flex flex-col gap-2 bg-[var(--color-bg-elevated)]",
        isDragTarget && "border-[var(--color-cyan)]",
        isPending && "opacity-70",
      )}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      role="listitem"
      aria-label={`Step ${position + 1}`}
    >
      <div className="flex items-center gap-2">
      <span
        aria-hidden
        className="font-mono text-xs text-[var(--color-fg-subtle)] cursor-grab select-none px-1"
        title="Drag to reorder"
      >
        ≡
      </span>

      <select
        value={step.technique}
        onChange={(event) =>
          handleTechniqueChange(event.target.value as TechniqueKey)
        }
        className="px-2 py-1 font-mono text-2xs uppercase tracking-wider bg-[var(--color-bg)] frame focus:border-[var(--color-accent)] min-w-[130px]"
      >
        {techniqueKeys.map((key) => (
          <option key={key} value={key}>
            {techniqueLabel(key)}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={() => setNotesExpanded((prev) => !prev)}
        aria-label={notesExpanded ? "Collapse notes" : "Expand notes"}
        aria-expanded={notesExpanded}
        title={notes.length > 0 ? "Has notes" : "Add notes"}
        className={clsx(
          "lg:hidden shrink-0 inline-flex items-center justify-center tap-target px-2 font-mono text-xs",
          notes.length > 0
            ? "text-[var(--color-cyan)]"
            : "text-[var(--color-fg-subtle)] hover:text-[var(--color-fg-muted)]",
        )}
      >
        {notesExpanded ? "▾" : "▸"}
      </button>

      <div ref={slotRef} className="relative min-w-0 flex-1">
        <button
          type="button"
          onClick={() => setPickerOpen((prev) => !prev)}
          className={clsx(
            // P15.2 — paint-slot trigger was py-1 (~28px). tap-target floors
            // the height to 44px (mobile) / 32px (desktop); already full-width.
            "tap-target w-full flex items-center gap-2 px-2 py-1 frame text-left",
            pickerOpen && "border-[var(--color-cyan)]",
            "hover:bg-[color-mix(in_srgb,var(--color-fg)_3%,transparent)]",
          )}
          aria-haspopup="dialog"
          aria-expanded={pickerOpen}
          aria-label="Change paint for step"
        >
          <span
            aria-hidden
            className="inline-block w-4 h-4 rounded-sm border shrink-0"
            style={{
              background: step.swatchHex ?? "transparent",
              borderColor: "var(--color-border-strong)",
            }}
          />
          <span className="flex-1 min-w-0 font-mono text-xs truncate">
            {step.paintId
              ? step.paintLabel ?? step.paintId
              : step.customColorHex
                ? `Custom · ${step.customColorHex}`
                : "Pick paint…"}
          </span>
          <span
            aria-hidden
            className="text-2xs font-mono text-[var(--color-fg-muted)]"
          >
            ▾
          </span>
        </button>
        {pickerOpen ? (
          <PaintSlotPicker
            stepId={step.id}
            currentPaintId={step.paintId}
            currentHex={step.customColorHex}
            inventory={ownedPaintIds ? { ownedIds: ownedPaintIds } : undefined}
            onClose={() => setPickerOpen(false)}
            onPatchPreview={(patch) =>
              onLocalPatch?.({
                paintId: patch.paintId,
                customColorHex: patch.customColorHex,
                swatchHex: patch.swatchHex,
              })
            }
          />
        ) : null}
      </div>

      <input
        type="text"
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        placeholder="note…"
        maxLength={200}
        className="hidden lg:block w-[120px] px-2 py-1 font-mono text-2xs bg-[var(--color-bg)] frame focus:border-[var(--color-cyan)]"
      />

      <button
        type="button"
        onClick={handleDelete}
        disabled={isPending}
        // UX-1311 — the × delete previously had no shrink-0, so under tight
        // mobile widths it could be pushed to overlap the paint-swatch
        // trigger's 44px tap box (measured 25px collision). shrink-0 +
        // justify-center give it its own non-overlapping 44px box; the
        // parent gap-2 keeps a clear gutter between the two hit areas.
        className="shrink-0 inline-flex items-center justify-center text-xs font-mono text-[var(--color-fg-subtle)] hover:text-[var(--color-red)] tap-target px-2"
        aria-label="Delete step"
      >
        ×
      </button>

      {error ? (
        <span className="sr-only" role="alert">
          {error}
        </span>
      ) : null}
      </div>

      {notesExpanded ? (
        <input
          type="text"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="note…"
          maxLength={200}
          aria-label="Step notes"
          className="lg:hidden w-full px-2 py-1.5 font-mono text-2xs bg-[var(--color-bg)] frame focus:border-[var(--color-cyan)]"
        />
      ) : null}
    </div>
  );
}
