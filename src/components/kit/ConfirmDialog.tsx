"use client";

import { Button } from "./Button";
import { ModalDialog } from "./ModalDialog";

/**
 * Yes/no confirmation built on {@link ModalDialog} — the non-blocking
 * replacement for `window.confirm` (which freezes the main thread the whole
 * time it's open). The caller owns `open`; `onConfirm` runs the action and
 * `onClose` cancels. `destructive` tints the confirm button red for
 * delete-style actions; `busy` disables the controls while an async action runs.
 */
export function ConfirmDialog({
  open,
  title,
  breadcrumb,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  busy = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  breadcrumb?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      title={title}
      breadcrumb={breadcrumb}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? "danger" : undefined}
            size="sm"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Working…" : confirmLabel}
          </Button>
        </div>
      }
    >
      <p className="font-body text-body text-fg">{message}</p>
    </ModalDialog>
  );
}
