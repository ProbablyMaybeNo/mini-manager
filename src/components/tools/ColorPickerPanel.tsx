"use client";

import { useEffect, useState } from "react";
import { SlideOutPanel } from "@/components/kit";
import { loadPaints } from "@/lib/paints/loader";
import type { Paint } from "@/lib/paints/types";
import type {
  ColorPickerMode,
  ColorPickerSelection,
} from "@/lib/colorPicker/types";
import { ColorPicker } from "./ColorPicker";

/**
 * Slide-out wrapper around the shared {@link ColorPicker}. Loads the paint
 * catalog client-side and stays open after each pick so the painter can add
 * a run of slots (old behaviour, restored for MM-25). The host owns `open`
 * and decides — via `closeOnSelect` — whether a single pick should close it
 * (e.g. editing one recipe-table paint, MM-51).
 */
export function ColorPickerPanel({
  open,
  onClose,
  onSelect,
  title = "Pick a paint",
  breadcrumb = "RECIPE ▸ COLOR PICKER",
  contextLabel,
  initialHex,
  initialPaintId,
  pickerKey,
  mode = "add-slot",
  showLibrary = true,
  showEyedropper = true,
  showWheel = true,
  paintsOnly = false,
  closeOnSelect = false,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (selection: ColorPickerSelection) => void;
  title?: string;
  breadcrumb?: string;
  contextLabel?: string;
  initialHex?: string | null;
  initialPaintId?: string | null;
  /** Render the catalog-match "Library" sub-panel. Off for colours-only
   *  tools (Stacking — lvIX6p). */
  showLibrary?: boolean;
  /** Render the image-eyedropper sub-panel. Off for colours-only tools
   *  (Stacking — lvIX6p), which already are eyedropper-adjacent. */
  showEyedropper?: boolean;
  /** Render the wheel/harmony/sliders sub-panel. Subscription paywall
   *  (fix 3) — the wheel is a subscriber-only tool; a caller editing a
   *  recipe paint as a non-subscriber passes `false` to fall back to a
   *  plain library search. */
  showWheel?: boolean;
  /** Recipe surfaces only — a slot takes a catalog paint, never a bare hex
   *  (UX_FEEDBACK_2026-06-03 B2). See {@link ColorPicker}'s `paintsOnly`. */
  paintsOnly?: boolean;
  /**
   * Stable identity of the target being edited (which lane / layer / slot).
   * The inner {@link ColorPicker} is re-keyed on this so re-opening on a
   * different target resets the wheel — but, crucially, NOT on the live
   * `initialHex`. When the host's `initialHex` IS the value the picker is
   * editing (e.g. the stacking substrate), a pick updates that state, which
   * would otherwise change the key and remount/reset the picker mid-session.
   * Pass a target id here to key on identity instead of value. Falls back to
   * the seed hex/paint id for callers that open one slot at a time.
   */
  pickerKey?: string | number | null;
  mode?: ColorPickerMode;
  /** When true, a pick closes the panel; otherwise it stays open for multi-add. */
  closeOnSelect?: boolean;
}) {
  const [paints, setPaints] = useState<ReadonlyArray<Paint>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    loadPaints()
      .then((rows) => {
        if (alive) setPaints(rows);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <SlideOutPanel
      open={open}
      onClose={onClose}
      title={title}
      breadcrumb={breadcrumb}
    >
      {/* Re-key on a STABLE target identity (which slot is being edited) so
          re-opening on a different slot resets the wheel / sliders / search,
          while a pick that mutates this slot's own colour does NOT remount and
          wipe the open session. Prefer the caller's `pickerKey`; fall back to
          the seed for one-slot-at-a-time callers. */}
      <ColorPicker
        key={pickerKey ?? initialHex ?? initialPaintId ?? "no-initial"}
        paints={paints}
        catalogLoading={loading}
        value={
          initialHex || initialPaintId
            ? { hex: initialHex ?? "#000000", paintId: initialPaintId ?? null }
            : null
        }
        contextLabel={contextLabel}
        mode={mode}
        showLibrary={showLibrary}
        showEyedropper={showEyedropper}
        showWheel={showWheel}
        paintsOnly={paintsOnly}
        onSelect={(sel) => {
          onSelect(sel);
          if (closeOnSelect) onClose();
        }}
      />
    </SlideOutPanel>
  );
}
