"use client";

import { useEffect, useRef } from "react";
import { ColorPicker } from "./ColorPicker";
import type { ColorPickerSelection } from "@/lib/colorPicker/types";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Pre-fills the wheel + active library row. Optional. */
  initialHex?: string | null;
  /** Fired when the painter picks any of the three sub-panels. The
   *  dialog auto-closes after emit. */
  onSelect: (hex: string, paintId?: string) => void;
  /** Optional label shown at the top of the dialog (e.g. "Match
   *  target", "Shadow", "Highlight"). */
  contextLabel?: string;
}

/**
 * R7-4 — modal wrapper around the ColorPicker primitive.
 *
 * Lets tools (Match + Layering) hand the painter the full three-panel
 * picker — wheel + harmony, library list, eyedropper — to choose a
 * starting hex. Uses a native <dialog> so the modal layer plays nice
 * with existing AttachRecipeModal / SendToRecipeModal patterns.
 */
export function ColorPickerDialog({
  open,
  onClose,
  initialHex,
  onSelect,
  contextLabel,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const handleSelect = (sel: ColorPickerSelection) => {
    onSelect(sel.hex, sel.paintId);
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-label={contextLabel ?? "Pick a colour"}
      className="frame-strong p-0 bg-[var(--color-bg-panel)] text-[var(--color-fg)] backdrop:bg-black/70 m-auto inset-0 w-[440px] max-w-[92vw] max-h-[90vh]"
    >
      <div className="border-b border-[var(--color-border)] px-4 py-3 flex items-center justify-between">
        <p className="text-sm font-mono uppercase tracking-wider text-[var(--color-cyan)]">
          {contextLabel ?? "Pick a colour"}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-mono text-[var(--color-fg-muted)] hover:text-[var(--color-cyan)] tap-target px-2"
          aria-label="Close"
        >
          ×
        </button>
      </div>
      <ColorPicker
        value={initialHex ? { hex: initialHex } : null}
        onSelect={handleSelect}
        contextLabel={contextLabel}
      />
    </dialog>
  );
}
