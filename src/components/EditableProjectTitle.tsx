"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { clsx } from "clsx";
import { updateProjectName } from "@/lib/actions/projects";

interface Props {
  projectId: string;
  /** The server-provided current name. Drives the optimistic state on
   *  mount + on prop-change (e.g. after a server revalidate). */
  name: string;
}

const NAME_DEBOUNCE_MS = 600;

/**
 * R7-008 — replicates the recipe-header `contentEditable` h1 pattern
 * on the project detail page so painters can rename a project in
 * place. Debounced save (600ms) matches the recipe header so a brisk
 * typist doesn't trigger a round-trip per keystroke. Blank value on
 * blur reverts to the last saved name — no orphan-name rows.
 */
export function EditableProjectTitle({ projectId, name }: Props) {
  const ref = useRef<HTMLHeadingElement>(null);
  const [draftName, setDraftName] = useState(name);
  const [savedName, setSavedName] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Reset state when the parent re-renders with a new server-side name
  // (e.g. after revalidatePath fires from another mutation).
  useEffect(() => {
    setDraftName(name);
    setSavedName(name);
  }, [projectId, name]);

  // Debounced save.
  useEffect(() => {
    if (draftName === savedName) return;
    const trimmed = draftName.trim();
    if (trimmed.length === 0) return;
    const handle = setTimeout(() => {
      startTransition(async () => {
        const result = await updateProjectName({ id: projectId, name: trimmed });
        if (result.ok) {
          setSavedName(result.data.name);
          setError(null);
        } else {
          setError(result.error);
        }
      });
    }, NAME_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [draftName, savedName, projectId]);

  return (
    <>
      <h1
        ref={ref}
        role="textbox"
        aria-label="Project name"
        contentEditable
        suppressContentEditableWarning
        spellCheck
        onInput={(event) =>
          setDraftName(event.currentTarget.textContent ?? "")
        }
        onBlur={(event) => {
          const trimmed = event.currentTarget.textContent?.trim() ?? "";
          if (trimmed.length === 0) {
            event.currentTarget.textContent = savedName;
            setDraftName(savedName);
          }
        }}
        className={clsx(
          "text-3xl tracking-wide font-mono outline-none min-w-0",
          "text-[var(--color-cyan)]",
          "focus:bg-[color-mix(in_srgb,var(--color-cyan)_8%,transparent)]",
          "px-2 -mx-2 rounded-sm",
        )}
        style={{
          textShadow:
            "0 0 12px color-mix(in srgb, var(--color-cyan) 22%, transparent)",
        }}
      >
        {name}
      </h1>
      {isPending ? (
        <span
          role="status"
          aria-live="polite"
          className="text-2xs font-mono uppercase tracking-wider text-[var(--color-fg-muted)]"
        >
          saving…
        </span>
      ) : null}
      {error ? (
        <span
          role="alert"
          className="text-2xs font-mono text-[var(--color-red)]"
        >
          {error}
        </span>
      ) : null}
    </>
  );
}
