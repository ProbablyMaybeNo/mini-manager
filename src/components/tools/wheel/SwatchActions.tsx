"use client";

import { useEffect, useState } from "react";
import { clsx } from "clsx";
import { Button } from "@/components/ui/Button";
import { ColorPickerDialog } from "@/components/ui/ColorPickerDialog";

/** A paint (or raw hex) assigned to this planned colour slot. */
export interface SwatchAssignment {
  /** Catalog paint id when a real library paint was assigned; null for a
   *  raw hex chosen from the wheel / match / eyedropper sub-panels. */
  paintId: string | null;
  /** The assigned colour's #RRGGBB — the swatch that lands in the recipe. */
  hex: string;
  /** Resolved paint label ("Citadel Macragge Blue") when known. */
  label?: string;
}

interface Props {
  hex: string;
  label: string;
  isPrimary?: boolean;
  isPinned?: boolean;
  /** The paint currently assigned to this planned slot, if any. */
  assignment?: SwatchAssignment | null;
  onPin?: () => void;
  onCopy?: (hex: string) => void;
  /** Fired when the painter assigns a paint (or raw hex) via the shared
   *  recipe ColorPicker side panel. `paintId` is null for a raw hex. */
  onAssign?: (selection: { hex: string; paintId: string | null }) => void;
  /** Clears the assignment back to the planned wheel colour. */
  onClearAssign?: () => void;
}

/**
 * One row in the planned-recipe colour list under the wheel.
 *
 * 2026-06-04 recipe-flow rework — the row used to be a standalone planner
 * affordance ("Find in library" expanded a read-only ΔE lookup). It now
 * authors a recipe colour slot: [ ASSIGN PAINT ] opens the SAME recipe
 * `ColorPicker` side panel the create-recipe editor uses (wheel + harmony,
 * library search, ΔE match, eyedropper), so the painter assigns a real
 * paint to this slot. The assignment flows up to WheelClient and into the
 * "Send to recipe" save with its `sourcePaintId`, exactly like the
 * recipe-editor flat-slot model (paintId | customColorHex).
 */
export function SwatchActions({
  hex,
  label,
  isPrimary,
  isPinned,
  assignment,
  onPin,
  onCopy,
  onAssign,
  onClearAssign,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  const handleCopy = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(hex);
        setCopied(true);
        onCopy?.(hex);
      }
    } catch {
      // Clipboard refused — fall through; user can read the hex inline.
    }
  };

  const assigned = assignment ?? null;
  const assignedLabel =
    assigned?.label ??
    (assigned ? `Custom · ${assigned.hex}` : null);

  return (
    <div
      className={clsx(
        "panel px-2 py-1.5",
        isPrimary && "border-[var(--color-accent)]",
      )}
    >
      <div className="flex items-center gap-2">
        {/* Color-bar swatch — solid fill, black hex text (§7.2). The chip
            both shows the colour and labels it, AA on its own fill. */}
        <span
          className="inline-flex items-center justify-center w-16 shrink-0 px-1 py-1 rounded-sm font-mono text-2xs text-black"
          style={{ background: hex }}
        >
          {hex}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-2xs font-mono text-[var(--color-fg-muted)] uppercase tracking-wider truncate">
            {label}
            {isPrimary ? " · primary" : ""}
            {isPinned ? " · pinned" : ""}
          </div>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="text-2xs font-mono text-[var(--color-fg-muted)] hover:text-[var(--color-amber)] tap-target px-1.5"
          aria-label={`Copy ${hex}`}
        >
          {copied ? "✓" : "⧉"}
        </button>
        {onPin ? (
          <button
            type="button"
            onClick={onPin}
            className={clsx(
              "text-base font-mono tap-target px-1.5",
              isPinned
                ? "text-[var(--color-amber)] glow-amber"
                : "text-[var(--color-fg-muted)] hover:text-[var(--color-amber)]",
            )}
            aria-pressed={isPinned}
            aria-label={isPinned ? "Unpin swatch" : "Pin swatch"}
          >
            {isPinned ? "★" : "☆"}
          </button>
        ) : null}
        <Button
          type="button"
          onClick={() => setPickerOpen(true)}
          variant={assigned ? "secondary" : "success"}
          size="sm"
          aria-haspopup="dialog"
          title="Assign a paint to this colour"
        >
          {assigned ? "Reassign" : "Assign paint"}
        </Button>
      </div>

      {assigned ? (
        <div className="mt-2 border-t border-[var(--color-border)] pt-2 flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block w-4 h-4 rounded-sm shrink-0"
            style={{ background: assigned.hex }}
          />
          <span className="flex-1 min-w-0 text-2xs font-mono truncate text-[var(--color-fg)]">
            {assignedLabel}
          </span>
          {onClearAssign ? (
            <button
              type="button"
              onClick={onClearAssign}
              className="text-2xs font-mono text-[var(--color-fg-muted)] hover:text-[var(--color-red)] tap-target px-1.5"
              aria-label="Clear assigned paint"
            >
              Clear
            </button>
          ) : null}
        </div>
      ) : null}

      <ColorPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        initialHex={assigned?.hex ?? hex}
        contextLabel={`Assign paint · ${label}`}
        onSelect={(pickedHex, paintId) =>
          onAssign?.({ hex: pickedHex, paintId: paintId ?? null })
        }
      />
    </div>
  );
}
