"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { clsx } from "clsx";
import { StatusPill } from "@/components/ui/StatusPill";
import { setWishlistStatus } from "@/lib/actions/wishlist";
import type { WishlistStatus } from "@/db/schema";
import { collectionStatusKind } from "./statusMeta";

/**
 * COLLECTION row STATUS dropdown (REBUILD_SPEC §8) — the current status
 * as a solid colour-bar (WISHLIST yellow / OWNED green) with a trailing
 * ▾; opens a menu of the per-kind destination statuses and fires the
 * existing `setWishlistStatus` server action.
 */
export function StatusSelect({
  itemId,
  itemTitle,
  status,
  options,
}: {
  itemId: string;
  itemTitle: string;
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
        aria-label={`Change status of ${itemTitle} (currently ${status})`}
        className={clsx(
          "tap-target group inline-flex items-center justify-center",
          "transition-[box-shadow] motion-reduce:transition-none",
          "hover:[box-shadow:0_0_0_1px_var(--color-cyan)]",
          "focus:outline-none focus-visible:[box-shadow:0_0_0_2px_var(--color-cyan)]",
          "disabled:opacity-50",
        )}
      >
        <StatusPill
          status={collectionStatusKind(status)}
          tone="bar"
          className="group-hover:brightness-110"
        >
          {status} ▾
        </StatusPill>
      </button>
      {open ? (
        <div
          role="menu"
          aria-label="Change status"
          className="panel absolute right-0 top-full z-30 mt-1 min-w-[150px] bg-[var(--color-bg-elevated)] py-1 shadow-xl"
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
                "tap-target flex w-full items-center gap-2 px-3 py-1.5 text-left font-mono text-xs uppercase tracking-wider",
                "transition-colors motion-reduce:transition-none",
                "hover:bg-[color-mix(in_srgb,var(--color-cyan)_10%,transparent)]",
                "focus:outline-none focus-visible:[box-shadow:inset_0_0_0_2px_var(--color-cyan)]",
                opt === status
                  ? "text-[var(--color-cyan)]"
                  : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]",
              )}
            >
              <span aria-hidden className="inline-block w-3">
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
