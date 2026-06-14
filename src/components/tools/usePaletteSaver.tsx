"use client";

import { useState, useTransition, type ReactNode } from "react";
import { PromptDialog } from "@/components/kit";
import { createPalette } from "@/lib/actions/palettes";
import type { PaletteSource } from "@/db/schema";

/**
 * Wires a tool's `onSavePalette(hexes)` to the real `createPalette`
 * action. `save(hexes)` opens a naming dialog; on submit it persists the
 * palette under the tool's `source` and closes. Returns the `dialog`
 * element the page renders once.
 */
export function usePaletteSaver(source: PaletteSource): {
  save: (hexes: string[]) => void;
  dialog: ReactNode;
} {
  const [hexes, setHexes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function close() {
    setHexes(null);
    setError(null);
  }

  function submit(name: string) {
    const colorHexes = hexes;
    if (!colorHexes || colorHexes.length === 0) return;
    setError(null);
    startTransition(async () => {
      const res = await createPalette({ name, source, colorHexes });
      if (res.ok) close();
      else setError(res.error);
    });
  }

  return {
    save: (next) => {
      if (next.length === 0) return;
      setHexes(next);
    },
    dialog: (
      <PromptDialog
        open={hexes !== null}
        title="Save palette"
        breadcrumb="TOOLS"
        label="Palette name"
        placeholder="e.g. Ultramarine highlights"
        submitLabel="Save palette"
        busy={pending}
        error={error}
        onSubmit={submit}
        onClose={close}
      />
    ),
  };
}
