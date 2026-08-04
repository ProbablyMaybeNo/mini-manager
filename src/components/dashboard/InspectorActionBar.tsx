"use client";

import { Trash2 } from "lucide-react";
import { Button, FocusReticleIcon } from "@/components/kit";
import { cn } from "@/lib/cn";

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
  saveDescription,
  saveDisabled = false,
  disabled = false,
  className,
}: {
  /** Extra classes on the bar's root — the host uses this to push it to the
   *  bottom of the inspector column (`mt-auto`) and to order it on the page. */
  className?: string;
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
  /**
   * What SAVE persists, e.g. "project details" (R4-9). Appended to the visible
   * label to form the accessible name, so a screen-reader user hearing more
   * than one Save on screen can tell them apart. Appended rather than
   * replacing, so the accessible name always contains the visible label
   * whatever `saveLabel` is (WCAG 2.5.3) — including "Create".
   */
  saveDescription?: string;
  /** Disable just SAVE (e.g. create mode with an empty name). */
  saveDisabled?: boolean;
  disabled?: boolean;
}) {
  return (
    // SAVE leads and takes the row's spare width; the destructive Delete goes
    // last, outlined rather than filled. It used to be third — the smallest
    // button in the bar, 8px from a solid-red Delete that was the loudest thing
    // in it (MUX2-007). Five ragged widths are now one grid.
    //
    // ONLY the SAVE row pins on a phone (MUX3-003). The whole bar is 173px —
    // 21% of an 812px viewport — so sticking all of it would cost more than it
    // saves. The secondary verbs sit in flow above it; SAVE, the reason you
    // opened the inspector, is the ~68px that stays reachable.
    <div
      className={cn(
        "sticky bottom-0 z-10 -mx-4 mt-2 grid grid-cols-3 items-center gap-2 border-t border-cyan/40 bg-bg px-4 py-2.5 sm:flex sm:flex-wrap sm:py-3",
        className,
      )}
    >
      {onSave && (
        <Button
          variant="primary"
          size="sm"
          className="col-span-3 min-h-11 sm:flex-1"
          disabled={disabled || saveDisabled}
          aria-label={saveDescription ? `${saveLabel} ${saveDescription}` : undefined}
          onClick={onSave}
        >
          {saveLabel}
        </Button>
      )}

      {/* Secondaries drop to a compact 3-up row of 36px buttons on a phone. The
          bar pins as ONE element — a sticky child needs its own parent to be the
          tall column, and splitting SAVE into a nested wrapper just recreated
          the 173px-parent problem one level down (MUX3-003). At ~100px the whole
          bar is ~12% of the viewport, which is affordable to pin; 173px was not. */}
      {onFocus && (
        <Button
          variant="outlinePurple"
          size="sm"
          className="min-h-9 sm:min-h-11"
          disabled={disabled}
          onClick={onFocus}
        >
          <FocusReticleIcon size={16} />
          Focus
        </Button>
      )}

      {onArchive && (
        <Button
          variant="secondary"
          size="sm"
          className="min-h-9 sm:min-h-11"
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
          className="hidden min-h-9 sm:inline-flex sm:min-h-11"
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
          className="min-h-9 sm:ml-auto sm:min-h-11"
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
