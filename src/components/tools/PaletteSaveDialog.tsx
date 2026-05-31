"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

interface Props {
  /** Open / close controlled by the parent. */
  open: boolean;
  /** Pre-fills the name input. */
  defaultName: string;
  /** Called with the trimmed name when the painter confirms. */
  onConfirm: (name: string) => void;
  /** Called when the dialog is dismissed without saving. */
  onCancel: () => void;
}

/**
 * Save palette dialog — replaces the P4 `window.prompt` so painters get
 * a proper terminal-aesthetic prompt instead of the browser's native
 * one. Native <dialog> keeps focus management, ESC-to-close, and the
 * scrim for free.
 */
export function PaletteSaveDialog({
  open,
  defaultName,
  onConfirm,
  onCancel,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(defaultName);

  // Sync the input each time the dialog is reopened.
  useEffect(() => {
    if (open) setName(defaultName);
  }, [open, defaultName]);

  useEffect(() => {
    const node = dialogRef.current;
    if (!node) return;
    if (open && !node.open) {
      node.showModal();
      // Focus + select for fast rename.
      window.setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
    } else if (!open && node.open) {
      node.close();
    }
  }, [open]);

  // ESC + backdrop close → cancel.
  useEffect(() => {
    const node = dialogRef.current;
    if (!node) return;
    const handler = () => onCancel();
    node.addEventListener("close", handler);
    return () => node.removeEventListener("close", handler);
  }, [onCancel]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length === 0) return;
    onConfirm(trimmed);
  };

  return (
    <dialog
      ref={dialogRef}
      className="frame-strong p-0 bg-[var(--color-bg-panel)] text-[var(--color-fg)] backdrop:bg-black/70 max-w-md w-[95vw]"
      aria-label="Save palette"
    >
      <form onSubmit={submit} className="p-5 space-y-4">
        <header>
          <h2 className="text-base font-mono uppercase tracking-wider text-[var(--color-cyan)]">
            Save palette
          </h2>
          <p className="text-2xs font-sans text-[var(--color-fg-muted)] mt-1">
            Name it so you can find it later in Tools → Palettes.
          </p>
        </header>

        <label className="block space-y-1">
          <span className="text-2xs font-mono uppercase tracking-wider text-[var(--color-fg-muted)]">
            Name
          </span>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={120}
            placeholder="e.g. Aetheric blue"
            className="block w-full px-3 py-2 frame bg-[var(--color-bg-elevated)] font-mono text-sm focus:border-[var(--color-accent)]"
            autoComplete="off"
          />
        </label>

        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            onClick={onCancel}
            variant="ghost"
            size="sm"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={name.trim().length === 0}
            variant="primary"
            size="sm"
          >
            Save
          </Button>
        </div>
      </form>
    </dialog>
  );
}
