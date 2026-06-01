"use client";

import { useState } from "react";
import type { ToolId, ToolPaletteSwatch } from "@/lib/tools/types";
import { SendToRecipeModal } from "./SendToRecipeModal";
import { Button } from "@/components/ui/Button";

interface Props {
  /** The single swatch to assign. Always one entry passed to the
   *  underlying SendToRecipeModal so a recipe picks up just this
   *  colour. */
  swatch: ToolPaletteSwatch;
  /** The tool the swatch came from. Drives the default zone name in
   *  the modal ("Wheel" / "Match" / "Layering" / "Eyedropper"). */
  toolId: ToolId;
  /** Optional override for the button label. Defaults to "Assign ▾". */
  label?: string;
  /** Optional button size. Defaults to "sm" — assign sits next to a
   *  swatch and shouldn't crowd it. */
  size?: "sm" | "md";
}

/**
 * P12.16 — Universal "Assign ▾" affordance Ross's brief lands on
 * every paint surface in /tools/*. Renders a single button that
 * opens the existing SendToRecipeModal pre-loaded with just THIS
 * swatch — the painter can then pick an existing recipe + zone, or
 * spin up a new recipe with this colour as its first slot.
 *
 * The component is intentionally a thin wrapper around the existing
 * SendToRecipeModal infrastructure. Per-swatch assign reuses the
 * same code path the whole-palette "Send to recipe" footer uses —
 * we just pass an array of length 1.
 *
 * Drop this into any tool surface (Wheel harmony swatches, Match
 * result rows, Layering ramp steps, Eyedropper pin rows) by handing
 * it the swatch's hex + optional paint id.
 */
export function SwatchAssignButton({
  swatch,
  toolId,
  label = "Assign ▾",
  size = "sm",
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="success"
        size={size}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        title="Assign this swatch to a recipe"
      >
        {label}
      </Button>
      <SendToRecipeModal
        open={open}
        onClose={() => setOpen(false)}
        swatches={[swatch]}
        toolId={toolId}
      />
    </>
  );
}
