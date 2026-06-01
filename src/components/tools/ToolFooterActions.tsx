"use client";

import { useState, useTransition } from "react";
import { createPalette } from "@/lib/actions/palettes";
import type { ToolPaletteSwatch, ToolId } from "@/lib/tools/types";
import { SendToRecipeModal } from "./SendToRecipeModal";
import { PaletteSaveDialog } from "./PaletteSaveDialog";
import { Button } from "@/components/ui/Button";

interface Props {
  toolId: ToolId;
  swatches: ReadonlyArray<ToolPaletteSwatch>;
  /** Default name shown in the Save palette prompt. */
  defaultPaletteName?: string;
}

const TOOL_SOURCE: Record<ToolId, "wheel" | "match" | "eyedropper" | "gradient"> = {
  wheel: "wheel",
  match: "match",
  eyedropper: "eyedropper",
  gradient: "gradient",
};

/**
 * The two ToolShell footer actions — Save palette + Send to recipe —
 * extracted into a single component so all four tools share the wiring
 * (P4.7 ship criterion: every tool can hand its output to a recipe in
 * one click).
 *
 * Disabled when the swatch list is empty.
 */
export function ToolFooterActions({
  toolId,
  swatches,
  defaultPaletteName,
}: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [savePending, startSave] = useTransition();
  const [saveFlash, setSaveFlash] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const empty = swatches.length === 0;
  const fallbackName = defaultPaletteName ?? `${toolLabel(toolId)} palette`;

  const openSave = () => {
    if (empty || savePending) return;
    setSaveError(null);
    setSaveFlash(null);
    setSaveDialogOpen(true);
  };

  const confirmSave = (name: string) => {
    setSaveDialogOpen(false);
    startSave(async () => {
      const res = await createPalette({
        name,
        source: TOOL_SOURCE[toolId],
        colorHexes: swatches.map((s) => s.hex),
        paintIds: swatches.map((s) => s.sourcePaintId ?? null),
      });
      if (res.ok) {
        setSaveFlash(`Saved "${name}"`);
      } else {
        setSaveError(res.error);
      }
    });
  };

  return (
    <>
      {saveError ? (
        <span
          role="alert"
          className="text-2xs font-mono text-[var(--color-red)] mr-auto"
        >
          {saveError}
        </span>
      ) : saveFlash ? (
        <span
          role="status"
          className="text-2xs font-mono text-[var(--color-green)] mr-auto"
        >
          ✓ {saveFlash}
        </span>
      ) : null}
      <Button
        type="button"
        onClick={openSave}
        disabled={empty || savePending}
        title={empty ? "No swatches to save yet" : "Save palette to your library"}
        variant="secondary"
        size="sm"
      >
        {savePending ? "Saving…" : "Save palette"}
      </Button>
      <PaletteSaveDialog
        open={saveDialogOpen}
        defaultName={fallbackName}
        onConfirm={confirmSave}
        onCancel={() => setSaveDialogOpen(false)}
      />
      <Button
        type="button"
        onClick={() => setModalOpen(true)}
        disabled={empty}
        title={empty ? "No swatches to send yet" : "Send palette to a recipe"}
        variant="primary"
        size="sm"
      >
        Send to recipe
      </Button>
      <SendToRecipeModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        swatches={swatches}
        toolId={toolId}
      />
    </>
  );
}

function toolLabel(id: ToolId): string {
  switch (id) {
    case "wheel":
      return "Wheel";
    case "match":
      return "Match";
    case "eyedropper":
      return "Eyedropper";
    case "gradient":
      // P12.14 — UI string flip; toolId stays 'gradient' for back-compat.
      return "Layering";
  }
}
