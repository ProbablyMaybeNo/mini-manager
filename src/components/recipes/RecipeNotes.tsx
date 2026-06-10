"use client";

import { useEffect, useState, useTransition } from "react";
import { clsx } from "clsx";
import { updateRecipe } from "@/lib/actions/recipes";
import { Card } from "@/components/ui/Card";

interface Props {
  recipeId: string;
  initialNotes: string;
  /** Extra classes for the Card shell — used by the editor right-rail to
   *  let Notes grow (`flex-1`) and fill the empty vertical space (item 2). */
  className?: string;
}

const NOTES_DEBOUNCE_MS = 700;

/**
 * Right-pane notes (markdown source — no preview in v1). The textarea
 * autosaves about 700ms after the last keystroke. We don't show a
 * "Save" button; the only signal is the `saving…` chip in the header.
 */
export function RecipeNotes({ recipeId, initialNotes, className }: Props) {
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
      title="Recipe notes"
      ticks
      techLabel="NOTES"
      className={className}
      bodyClassName="flex flex-col"
      headerActions={
        <span
          className={clsx(
            "text-2xs font-mono normal-case tracking-wider",
            isPending
              ? "text-[var(--color-yellow)]"
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
        placeholder="Take recipe notes — write down techniques, painting guides, paint ratios, brush tips…"
        className={clsx(
          "block w-full px-3 py-2.5 font-mono text-xs",
          "bg-[var(--color-bg)] frame focus:border-[var(--color-cyan)]",
          // Item 2 — grow to fill the right rail so the editor uses the
          // vertical space instead of leaving a dead band beneath Notes.
          "resize-y flex-1 min-h-[280px]",
        )}
      />
    </Card>
  );
}
