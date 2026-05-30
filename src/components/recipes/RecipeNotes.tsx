"use client";

import { useEffect, useState, useTransition } from "react";
import { clsx } from "clsx";
import { updateRecipe } from "@/lib/actions/recipes";
import { Card } from "@/components/ui/Card";

interface Props {
  recipeId: string;
  initialNotes: string;
}

const NOTES_DEBOUNCE_MS = 700;

/**
 * Right-pane notes (markdown source — no preview in v1). The textarea
 * autosaves about 700ms after the last keystroke. We don't show a
 * "Save" button; the only signal is the `saving…` chip in the header.
 */
export function RecipeNotes({ recipeId, initialNotes }: Props) {
  const [value, setValue] = useState(initialNotes);
  const [saved, setSaved] = useState(initialNotes);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setValue(initialNotes);
    setSaved(initialNotes);
  }, [recipeId, initialNotes]);

  useEffect(() => {
    if (value === saved) return;
    const handle = setTimeout(() => {
      const next = value;
      startTransition(async () => {
        const result = await updateRecipe({
          id: recipeId,
          notesMd: next.length === 0 ? null : next,
        });
        if (result.ok) {
          setSaved(result.data.notesMd ?? "");
        }
      });
    }, NOTES_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [value, saved, recipeId]);

  const dirty = value !== saved;

  return (
    <Card
      title="Notes"
      headerActions={
        <span
          className={clsx(
            "text-2xs font-mono normal-case tracking-wider",
            isPending
              ? "text-[var(--color-amber)]"
              : dirty
                ? "text-[var(--color-fg-muted)]"
                : "text-[var(--color-fg-subtle)]",
          )}
          aria-live="polite"
        >
          {isPending ? "saving…" : dirty ? "unsaved" : "saved"}
        </span>
      }
    >
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        rows={14}
        spellCheck
        placeholder="Markdown notes — paint ratios, mix recipes, brush tips…"
        className={clsx(
          "block w-full px-3 py-2.5 font-mono text-xs",
          "bg-[var(--color-bg)] frame focus:border-[var(--color-cyan)]",
          "resize-y min-h-[200px]",
        )}
      />
    </Card>
  );
}
