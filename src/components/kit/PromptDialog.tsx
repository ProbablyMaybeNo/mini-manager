"use client";

import { useEffect, useState } from "react";
import { Button } from "./Button";
import { Input } from "./Input";
import { ModalDialog } from "./ModalDialog";

/**
 * One-field naming/entry dialog built on {@link ModalDialog}. The caller
 * controls `open`; `onSubmit` receives the trimmed value (the dialog
 * never submits blank). `busy` disables the controls while an async save
 * runs; `error` surfaces a server failure under the field.
 */
export function PromptDialog({
  open,
  title,
  breadcrumb,
  label,
  placeholder,
  defaultValue = "",
  submitLabel = "Save",
  busy = false,
  error,
  onSubmit,
  onClose,
}: {
  open: boolean;
  title: string;
  breadcrumb?: string;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  submitLabel?: string;
  busy?: boolean;
  error?: string | null;
  onSubmit: (value: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(defaultValue);

  // Re-seed the field each time the dialog opens.
  useEffect(() => {
    if (open) setValue(defaultValue);
  }, [open, defaultValue]);

  function submit() {
    const v = value.trim();
    if (!v || busy) return;
    onSubmit(v);
  }

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      title={title}
      breadcrumb={breadcrumb}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button size="sm" onClick={submit} disabled={busy || !value.trim()}>
            {busy ? "Saving…" : submitLabel}
          </Button>
        </div>
      }
    >
      {label && (
        <label className="mb-2 block font-osd text-[10px] uppercase tracking-[0.18em] text-fg-dim">
          {label}
        </label>
      )}
      <Input
        name="prompt-value"
        autoFocus
        placeholder={placeholder}
        value={value}
        disabled={busy}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
      />
      {error && (
        <p className="mt-2 font-mono text-xs text-red" role="alert">
          ▸ {error}
        </p>
      )}
    </ModalDialog>
  );
}
