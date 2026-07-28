"use client";

import { Trash2 } from "lucide-react";
import { Button, FocusReticleIcon } from "@/components/kit";

/**
 * The inspector's sticky action bar (RF-1).
 *
 * The old `⋯` overflow menu is retired: every lifecycle verb is now a visible,
 * labelled button across the bottom of the panel —
 *   FOCUS · DELETE · SAVE · Archive · Duplicate
 * Focus carries the shared purple reticle (RF-2). Delete stays confirm-guarded
 * (the caller's `onDelete` opens the ConfirmDialog — this bar never deletes
 * directly). SAVE persists the DETAILS edits, and in RF-8's new-project mode it
 * is the create action (caller passes `saveLabel="Create"`).
 *
 * Rendered `sticky bottom-0` inside the scrollable inspector body so it pins to
 * the bottom on long projects — shared by the desktop pane and the mobile
 * full-screen view (RF-10).
 */
export function InspectorActionBar({
  onFocus,
  onDelete,
  onSave,
  onArchive,
  onDuplicate,
  archived = false,
  saveLabel = "Save",
  saveDisabled = false,
  disabled = false,
}: {
  /** Opens the focus bench for this project (hidden in create mode). */
  onFocus?: () => void;
  /** Opens the caller's delete ConfirmDialog (hidden in create mode). */
  onDelete?: () => void;
  /** Persists the DETAILS edits — or creates the project in RF-8 create mode. */
  onSave?: () => void;
  /** Toggles archived (hidden in create mode). */
  onArchive?: () => void;
  /** Duplicates the project (hidden in create mode). */
  onDuplicate?: () => void;
  archived?: boolean;
  /** SAVE button label — "Save" normally, "Create" in RF-8 create mode. */
  saveLabel?: string;
  /** Disable just SAVE (e.g. create mode with an empty name). */
  saveDisabled?: boolean;
  disabled?: boolean;
}) {
  return (
    // SAVE leads and takes the row's spare width; the destructive Delete goes
    // last, outlined rather than filled. It used to be third — the smallest
    // button in the bar, 8px from a solid-red Delete that was the loudest thing
    // in it (MUX2-007). Five ragged widths are now one grid.
    <div className="sticky bottom-0 z-10 -mx-4 mt-2 grid grid-cols-2 items-center gap-2 border-t border-cyan/40 bg-bg px-4 py-3 sm:flex sm:flex-wrap">
      {onSave && (
        <Button
          variant="primary"
          size="sm"
          className="col-span-2 min-h-11 sm:flex-1"
          disabled={disabled || saveDisabled}
          onClick={onSave}
        >
          {saveLabel}
        </Button>
      )}

      {onFocus && (
        <Button
          variant="outlinePurple"
          size="sm"
          className="min-h-11"
          disabled={disabled}
          onClick={onFocus}
        >
          <FocusReticleIcon size={18} />
          Focus
        </Button>
      )}

      {onArchive && (
        <Button
          variant="secondary"
          size="sm"
          className="min-h-11"
          disabled={disabled}
          onClick={onArchive}
        >
          {archived ? "⊞ Unarchive" : "⊟ Archive"}
        </Button>
      )}
      {onDuplicate && (
        <Button
          variant="secondary"
          size="sm"
          className="min-h-11"
          disabled={disabled}
          onClick={onDuplicate}
        >
          ⧉ Duplicate
        </Button>
      )}

      {onDelete && (
        <Button
          variant="outlineRed"
          size="sm"
          className="min-h-11 sm:ml-auto"
          disabled={disabled}
          onClick={onDelete}
        >
          <Trash2 size={16} aria-hidden />
          Delete
        </Button>
      )}
    </div>
  );
}
