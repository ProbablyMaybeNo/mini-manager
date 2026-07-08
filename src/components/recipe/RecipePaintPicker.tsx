"use client";

import { rankMatchesMulti } from "@/lib/toolMatch";
import type { ColorPickerSelection } from "@/lib/colorPicker/types";
import { PaintPickerPanel } from "@/components/tools/PaintPickerPanel";
import { ColourMatchTool } from "@/components/tools/ColourMatchTool";

/**
 * Full "pick a paint" toolset for a recipe slot (UX-002) — the recipe-flavoured
 * {@link PaintPickerPanel} (the "PAINT PICKER PANEL"). The Figma Recipe.png
 * right-rail puts the whole paint-creator toolset behind a recipe slot, not the
 * reduced wheel-only picker, so this wires the panel's ranked-Match tab (via
 * {@link ColourMatchTool}) and supplies the recipe breadcrumb/copy.
 */
export function RecipePaintPicker({
  open,
  onClose,
  onSelect,
  contextLabel,
  initialHex,
  initialPaintId,
  mode = "add-slot",
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (selection: ColorPickerSelection) => void;
  contextLabel?: string;
  initialHex?: string | null;
  initialPaintId?: string | null;
  mode?: "add-slot" | "edit-slot";
}) {
  return (
    <PaintPickerPanel
      open={open}
      onClose={onClose}
      onSelect={onSelect}
      title="Pick & Paint"
      breadcrumb={contextLabel ? `RECIPE ▸ ${contextLabel.toUpperCase()}` : "RECIPE ▸ PICK & PAINT"}
      contextLabel={contextLabel}
      initialHex={initialHex}
      initialPaintId={initialPaintId}
      mode={mode}
      renderMatchTab={({ paints, brandOptions, assignPaint }) => (
        <ColourMatchTool
          // No typeOptions here — picking a paint for a recipe slot wants
          // every type visible, not the Match tool's incompatible-type
          // default (that default is scoped to the standalone Match page).
          rankMatches={(hex, brands, types, limit) =>
            rankMatchesMulti(hex, paints, brands, limit, { types })
          }
          brandOptions={brandOptions}
          onUse={assignPaint}
          onAssign={assignPaint}
        />
      )}
    />
  );
}
