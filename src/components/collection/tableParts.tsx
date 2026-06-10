"use client";

import { useState, useTransition } from "react";
import { clsx } from "clsx";
import { Button } from "@/components/ui/Button";
import {
  createWishlistItem,
  deleteWishlistItem,
} from "@/lib/actions/wishlist";
import type { WishlistKind } from "@/db/schema";

/** Row-selection state for a COLLECTION table — a toggleable id set
 *  driving the cyan `.dt` selected-row idiom + the REMOVE action. */
export function useRowSelection() {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const clear = () => setSelected(new Set());
  return { selected, toggle, clear };
}

/**
 * COLLECTION table footer (REBUILD_SPEC §8) — `+ PAINT` / `+ MODELS`
 * quick-add on the left, red `REMOVE …` on the right acting on the
 * cyan-selected rows. The quick-add expands into an inline name input
 * that creates a manual row via the existing `createWishlistItem`
 * action (the header URL bar handles scraped adds).
 */
export function TableActions({
  kind,
  addLabel,
  removeLabel,
  selectedIds,
  onRemoved,
}: {
  kind: WishlistKind;
  addLabel: string;
  removeLabel: string;
  selectedIds: ReadonlyArray<string>;
  onRemoved: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [upgradeUrl, setUpgradeUrl] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submitAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setError(null);
    setUpgradeUrl(null);
    startTransition(async () => {
      const result = await createWishlistItem({ title: trimmed, kind });
      if (result.ok === false) {
        setError(result.error);
        setUpgradeUrl(result.upgradeUrl ?? null);
        return;
      }
      setName("");
      setAdding(false);
    });
  }

  function removeSelected() {
    if (selectedIds.length === 0) return;
    setError(null);
    startTransition(async () => {
      for (const id of selectedIds) {
        const result = await deleteWishlistItem({ id });
        if (result.ok === false) {
          setError(result.error);
          return;
        }
      }
      onRemoved();
    });
  }

  return (
    <div className="border-t border-[var(--color-border)] px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {adding ? (
          <form
            onSubmit={submitAdd}
            className="flex min-w-0 flex-1 items-center gap-2"
          >
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={240}
              aria-label={`New ${kind} name`}
              placeholder={`TYPE A ${kind.toUpperCase()} NAME…`}
              className={clsx(
                "frame min-w-0 flex-1 bg-[var(--color-bg-elevated)] px-2 py-1.5 font-mono text-sm text-[var(--color-fg)]",
                "placeholder:text-[var(--color-fg-subtle)]",
                "focus:border-[var(--color-cyan)] focus:outline-none",
              )}
            />
            <Button
              type="submit"
              variant="tertiary"
              size="sm"
              disabled={isPending || name.trim().length === 0}
            >
              {isPending ? "…" : "ADD"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setAdding(false);
                setName("");
                setError(null);
              }}
            >
              CANCEL
            </Button>
          </form>
        ) : (
          <Button
            type="button"
            variant="tertiary"
            size="sm"
            onClick={() => setAdding(true)}
          >
            {addLabel}
          </Button>
        )}
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={isPending || selectedIds.length === 0}
          onClick={removeSelected}
          aria-label={
            selectedIds.length === 0
              ? `${removeLabel} (select rows first)`
              : `${removeLabel} (${selectedIds.length} selected)`
          }
        >
          {removeLabel}
          {selectedIds.length > 0 ? ` [${selectedIds.length}]` : ""}
        </Button>
      </div>
      {error ? (
        <p
          role="alert"
          className="mt-1 flex flex-wrap items-start gap-2 font-mono text-xs text-[var(--color-red)]"
        >
          <span aria-hidden>[ERR]</span>
          <span>{error}</span>
          {upgradeUrl ? (
            <a
              href={upgradeUrl}
              className="whitespace-nowrap font-mono text-2xs uppercase tracking-wider text-[var(--color-green)] underline-offset-2 hover:underline"
            >
              UPGRADE →
            </a>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}

/** Shared interactive-row props — keyboard-toggleable selection on the
 *  `.dt` cyan-row idiom (Space/Enter toggles; aria-selected mirrors). */
export function selectableRowProps(
  selected: boolean,
  toggle: () => void,
): {
  tabIndex: number;
  "aria-selected": boolean;
  onClick: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  className: string;
} {
  return {
    tabIndex: 0,
    "aria-selected": selected,
    onClick: toggle,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        toggle();
      }
    },
    className: clsx(
      "dt-row-link focus:outline-none",
      "focus-visible:[box-shadow:inset_0_0_0_2px_var(--color-cyan)]",
      selected && "dt-row-selected",
    ),
  };
}
