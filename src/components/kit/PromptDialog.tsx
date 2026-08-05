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
      <Input
        name="prompt-value"
        // R4-1: the label is the kit's, wired to the input with `htmlFor`. The
        // dialog used to hand-roll a bare <label> next to the field, so the
        // input had no accessible name at all — `input.labels` empty, no
        // aria-label, no aria-labelledby — and a screen reader announced an
        // unnamed edit box under a decorative "Paint name".
        // `gap-2` reproduces the 8px the old `mb-2` gave it so nothing moves;
        // the bespoke `tracking-[0.18em]` goes, since that is the app's
        // section/meta label treatment and every other FIELD label in the kit
        // (Name, Username, Recipe name, Event…) is plain `label-osd`.
        label={label}
        containerClassName="gap-2"
        // Not React's `autoFocus` — see useFocusTrap (R4-2/R4-3). React applies
        // that during commit, so the trap captured this input as the element to
        // restore to and then took the focus off it anyway.
        data-autofocus
        placeholder={placeholder}
        value={value}
        disabled={busy}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
      />
      {error && (
        <p className="mt-2 font-body text-body text-red-text" role="alert">
          ▸ {error}
        </p>
      )}
    </ModalDialog>
  );
}
