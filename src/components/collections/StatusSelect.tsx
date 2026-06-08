"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { clsx } from "clsx";
import { StatusPill } from "@/components/ui/StatusPill";
import { statusPillKind } from "./statusMeta";
import { setWishlistStatus } from "@/lib/actions/wishlist";
import type { WishlistStatus } from "@/db/schema";

/**
 * Vibrant inline status control for a COLLECTIONS row. Renders the
 * current status as a solid phosphor colour-bar (DESIGN_LANGUAGE §7.2,
 * "gold-standard select" idiom) carrying a trailing ▾; clicking opens a
 * small menu of the valid destination statuses for that table. Selecting
 * one fires the `setWishlistStatus` server action.
 *
 * The `options` prop is the per-kind status set (paint vs model), so the
 * paint table offers WISHLIST/OWNED/HOLD and the model table offers the
 * full build lifecycle.
 */
export function StatusSelect({
  itemId,
  status,
  options,
}: {
  itemId: string;
  status: string;
  options: ReadonlyArray<string>;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (next: string) => {
    setOpen(false);
    if (next === status) return;
    startTransition(async () => {
      await setWishlistStatus({ id: itemId, status: next as WishlistStatus });
    });
  };

  return (
    <span
      ref={ref}
      className="relative inline-block"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={isPending}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Change status"
        className={clsx(
          "tap-target inline-flex items-center justify-center group rounded-sm",
          "transition-[box-shadow,transform] motion-reduce:transition-none",
          "hover:[box-shadow:0_0_0_1px_var(--color-cyan)]",
          "focus-visible:[box-shadow:0_0_0_2px_var(--color-cyan)] focus:outline-none",
          "active:translate-y-px",
        )}
      >
        <StatusPill
          status={statusPillKind(status)}
          tone="bar"
          className={clsx(
            "group-hover:brightness-110",
            status === "HOLD" && "line-through",
          )}
        >
          {status} ▾
        </StatusPill>
      </button>
      {open ? (
        <div
          role="menu"
          aria-label="Change status"
          className="absolute right-0 top-full mt-1 z-30 min-w-[150px] panel bg-[var(--color-bg-panel)] shadow-xl py-1"
        >
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              role="menuitemradio"
              aria-checked={opt === status}
              onClick={() => pick(opt)}
              disabled={isPending}
              className={clsx(
                "tap-target w-full text-left px-3 py-1.5 text-xs font-mono uppercase tracking-wider",
                "flex items-center gap-2 transition-colors",
                "hover:bg-[color-mix(in_srgb,var(--color-cyan)_10%,transparent)]",
                opt === status
                  ? "text-[var(--color-cyan)]"
                  : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]",
              )}
            >
              <span aria-hidden className="w-3 inline-block">
                {opt === status ? "▸" : ""}
              </span>
              {opt}
            </button>
          ))}
        </div>
      ) : null}
    </span>
  );
}
