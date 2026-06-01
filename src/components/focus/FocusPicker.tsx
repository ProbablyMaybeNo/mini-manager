"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { Button } from "@/components/ui/Button";
import { setFocusProject, clearFocusProject } from "@/lib/actions/focus";

export interface FocusPickerOption {
  id: string;
  name: string;
  type: string;
  attachedRecipeName: string;
}

interface Props {
  /** Projects with attached recipes — the only valid focus targets. */
  options: ReadonlyArray<FocusPickerOption>;
  /** Currently-pinned focus project id, or null when no focus is set. */
  currentFocusId: string | null;
}

/**
 * P13.11 — Dashboard FOCUS picker.
 *
 * A narrow native `<select>` of projects that have at least one
 * attached recipe, plus a Clear button when a focus is set. The
 * choices stay deliberately scoped: focusing on a project without a
 * recipe would yield an empty FOCUS panel, so the picker only offers
 * projects you can actually paint from.
 *
 * Picking an option fires `setFocusProject`; revalidatePath in the
 * server action refreshes the page so the FocusPanel below this
 * picker swaps to the new recipe.
 */
export function FocusPicker({ options, currentFocusId }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onChange = (nextId: string) => {
    setError(null);
    if (nextId === "") return;
    startTransition(async () => {
      const result = await setFocusProject({ projectId: nextId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  const onClear = () => {
    setError(null);
    startTransition(async () => {
      const result = await clearFocusProject();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  if (options.length === 0) {
    return (
      <p className="text-xs font-sans text-[var(--color-fg-muted)]">
        No projects with attached recipes yet — attach a recipe from any
        project workspace to make it focusable here.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label
        htmlFor="focus-project-picker"
        className="font-mono text-2xs uppercase tracking-wider text-[var(--color-fg-muted)]"
      >
        Focus:
      </label>
      <select
        id="focus-project-picker"
        value={currentFocusId ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className={clsx(
          "frame px-3 py-1.5 font-mono text-xs",
          "bg-[var(--color-bg-panel)] text-[var(--color-fg)]",
          "border border-[var(--color-border-strong)] rounded-sm",
          "focus:outline-2 focus:outline-[var(--color-cyan)]",
        )}
      >
        <option value="">— Pick a project —</option>
        {options.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.name} · {opt.type} · {opt.attachedRecipeName}
          </option>
        ))}
      </select>

      {currentFocusId ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClear}
        >
          Clear focus
        </Button>
      ) : null}

      {error ? (
        <span
          role="alert"
          className="text-2xs font-mono text-[var(--color-red)]"
        >
          {error}
        </span>
      ) : null}
    </div>
  );
}
