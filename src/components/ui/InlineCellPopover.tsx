"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { clsx } from "clsx";

interface InlineCellPopoverProps {
  /** Rendered as the click target. Should look like a button — the
   *  popover itself wraps it in a `<button>` so the host doesn't need
   *  to. */
  trigger: ReactNode;
  /** ARIA label for the trigger button. */
  triggerLabel: string;
  /** Optional className applied to the trigger button so callers can
   *  pass `text-left w-full` etc. */
  triggerClassName?: string;
  /** Popover body — rendered when open. */
  children: ReactNode;
  /** Optional handler to fire when popover closes (after option pick
   *  or click-outside). */
  onClose?: () => void;
}

/**
 * R7-1 — InlineCellPopover.
 *
 * A small click-to-toggle popover used by the projects dashboard table
 * for inline cell editing (status / type / priority). Closes on
 * click-outside, Escape, or when the body emits a click on any
 * `data-cell-popover-close` element.
 *
 * Visual style: tightly-cropped frame matching the existing dropdown
 * pattern used in QuickAddBar + WishlistFilters — bordered, padded,
 * mono caps inside. Animation gated on prefers-reduced-motion.
 */
export function InlineCellPopover({
  trigger,
  triggerLabel,
  triggerClassName,
  children,
  onClose,
}: InlineCellPopoverProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const close = () => {
    setOpen(false);
    onClose?.();
  };

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        aria-label={triggerLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          "cursor-pointer hover:opacity-90 transition-opacity",
          triggerClassName,
        )}
      >
        {trigger}
      </button>
      {open ? (
        <div
          role="menu"
          aria-label={triggerLabel}
          onClick={(e) => {
            const target = e.target as HTMLElement;
            if (target.closest("[data-cell-popover-close]")) {
              close();
            }
          }}
          className="absolute z-50 left-0 top-full mt-1 min-w-[10rem] frame bg-[var(--color-bg-panel)] shadow-xl p-1 space-y-0.5"
          style={{ border: "1px solid var(--color-border-strong)" }}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Helper menu item — used inside <InlineCellPopover> bodies for a
 * consistent typography + active-row hover state. Pass `active` to
 * mark the currently-set value with a cyan tick.
 */
export function InlineCellPopoverItem({
  active,
  children,
  onClick,
  destructive,
}: {
  active?: boolean;
  children: ReactNode;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      data-cell-popover-close
      onClick={onClick}
      className={clsx(
        "w-full text-left px-2 py-1 font-mono text-2xs uppercase tracking-wider transition-colors",
        destructive
          ? "text-[var(--color-red)] hover:bg-[color-mix(in_srgb,var(--color-red)_12%,transparent)]"
          : "text-[var(--color-fg)] hover:bg-[color-mix(in_srgb,var(--color-cyan)_10%,transparent)]",
        active && !destructive && "text-[var(--color-cyan)]",
      )}
      aria-current={active || undefined}
    >
      {active ? <span aria-hidden>▸ </span> : <span aria-hidden>  </span>}
      {children}
    </button>
  );
}
