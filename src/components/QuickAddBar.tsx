"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { clsx } from "clsx";
import { parseQuickAdd } from "@/lib/quickAdd";
import { createProject } from "@/lib/actions/projects";
import { Button } from "@/components/ui/Button";

/**
 * Single-line quick-add bar. Parses the input via parseQuickAdd
 * (so "Necron Warriors x20" → Unit, count 20, name "Necron Warriors")
 * then calls the createProject server action.
 *
 * Press `/` anywhere on the page to focus the input — unless an input,
 * textarea, or contenteditable already has focus.
 */
export function QuickAddBar() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "/") return;
      const active = document.activeElement;
      if (
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLSelectElement ||
        (active instanceof HTMLElement && active.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      inputRef.current?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const parsed = parseQuickAdd(value);
    if (parsed.name.length === 0) {
      setError("Type something — e.g. 'Necron Warriors x20'");
      return;
    }
    startTransition(async () => {
      const result = await createProject({
        name: parsed.name,
        type: parsed.type,
        count: parsed.count,
        parentId: null,
      });
      // Success redirects (throws); only failure paths surface here.
      if (result && result.ok === false) {
        setError(result.error);
        return;
      }
      setValue("");
    });
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-1 w-full md:w-[420px]">
      <div className="flex items-center gap-2">
        {/* P13.10 — keyboard hint as <kbd>, not bracket-text. The `/`
            shortcut focuses this input from anywhere on the page. */}
        <kbd
          aria-hidden
          className="font-mono text-xs text-[var(--color-fg-muted)] select-none px-1 py-0.5 frame"
        >
          /
        </kbd>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={140}
          aria-label="Quick add project"
          placeholder="e.g. Necron Warriors x20"
          className={clsx(
            "flex-1 min-w-0 px-3 py-2 font-mono text-sm bg-[var(--color-bg-elevated)] frame",
            "focus:border-[var(--color-accent)]",
          )}
        />
        <Button
          type="submit"
          disabled={isPending || value.trim().length === 0}
          aria-label="Add project"
          variant="success"
          size="sm"
        >
          {isPending ? "…" : "Add"}
        </Button>
      </div>
      {error ? (
        <p
          role="alert"
          className="text-xs font-mono text-[var(--color-red)] pl-7"
        >
          {error}
        </p>
      ) : null}
    </form>
  );
}
