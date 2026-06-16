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
  mode = "add-slot",
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
      width="max-w-md"
    >
      {/* Re-key on the seed so re-opening on a different slot resets the
          wheel / sliders / search instead of bleeding the prior session. */}
      <ColorPicker
        key={initialHex ?? initialPaintId ?? "no-initial"}
        paints={paints}
        catalogLoading={loading}
        value={
          initialHex || initialPaintId
            ? { hex: initialHex ?? "#000000", paintId: initialPaintId ?? null }
            : null
        }
        contextLabel={contextLabel}
        mode={mode}
        onSelect={(sel) => {
          onSelect(sel);
          if (closeOnSelect) onClose();
        }}
      />
    </SlideOutPanel>
  );
}
