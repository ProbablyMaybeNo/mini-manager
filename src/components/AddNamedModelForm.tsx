"use client";

import { useId, useRef, useState, useTransition } from "react";
import { clsx } from "clsx";
import { createNamedModel } from "@/lib/actions/namedModels";

/**
 * Inline form for appending a named model to a project. Two visual
 * modes:
 *
 * - `compact`: a single `[ + Add named model ]` button. When clicked
 *    it expands into the input. Used when `namedModels.length === 0`
 *    so the workspace stays uncluttered until the painter actually
 *    has an exception model to track.
 * - `inline`: full input + submit, always visible. Used inside the
 *    panel once at least one named model exists.
 */
export function AddNamedModelForm({
  projectId,
  mode,
}: {
  projectId: string;
  mode: "compact" | "inline";
}) {
  const formId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [expanded, setExpanded] = useState<boolean>(mode === "inline");
  const [name, setName] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const expand = () => {
    setExpanded(true);
    // Focus after the input mounts.
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const collapse = () => {
    if (mode === "compact") {
      setExpanded(false);
      setName("");
      setError(null);
    }
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setError("Name is required");
      return;
    }

    startTransition(async () => {
      const result = await createNamedModel({ projectId, name: trimmed });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Success: clear the field. If the panel was in compact mode
      // it will re-render in inline mode after revalidatePath, so
      // we don't need to collapse here.
      setName("");
    });
  };

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={expand}
        className={clsx(
          "tap-target inline-flex items-center gap-2 px-3 py-2 frame font-mono text-xs",
          "text-[var(--color-fg-muted)] uppercase tracking-wider",
          "hover:bg-[color-mix(in_srgb,var(--color-accent)_8%,transparent)] hover:text-[var(--color-accent)] hover:border-[var(--color-accent)]",
        )}
      >
        [ + ] Add named model
      </button>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      aria-describedby={`${formId}-err`}
      className="space-y-2"
    >
      <div className="flex flex-wrap items-stretch gap-2">
        <label htmlFor={`${formId}-name`} className="sr-only">
          Named model name
        </label>
        <input
          id={`${formId}-name`}
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder='e.g. "Sergeant Vraks"'
          maxLength={120}
          required
          className={clsx(
            "min-w-0 flex-1 px-3 py-2.5 font-mono text-sm",
            "bg-[var(--color-bg-elevated)] frame focus:border-[var(--color-accent)]",
          )}
        />
        <button
          type="submit"
          disabled={isPending}
          className={clsx(
            "tap-target inline-flex items-center gap-2 px-4 py-2 frame-strong font-mono text-sm",
            isPending
              ? "opacity-60 cursor-progress"
              : "hover:bg-[color-mix(in_srgb,var(--color-accent)_8%,transparent)] hover:text-[var(--color-accent)]",
          )}
        >
          {isPending ? "[ … ]" : "[ + ] Add"}
        </button>
        {mode === "compact" ? (
          <button
            type="button"
            onClick={collapse}
            disabled={isPending}
            className={clsx(
              "tap-target inline-flex items-center px-3 py-2 font-mono text-xs",
              "text-[var(--color-fg-muted)] hover:text-[var(--color-cyan)]",
            )}
          >
            Cancel
          </button>
        ) : null}
      </div>

      {error ? (
        <p
          id={`${formId}-err`}
          role="alert"
          className="frame px-3 py-2 text-xs font-mono text-[var(--color-red)] bg-[color-mix(in_srgb,var(--color-red)_8%,transparent)]"
        >
          {error}
        </p>
      ) : null}
    </form>
  );
}
