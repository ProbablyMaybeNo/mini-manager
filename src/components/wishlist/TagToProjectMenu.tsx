"use client";

import { useState, useTransition } from "react";
import { clsx } from "clsx";

import { updateWishlistItem } from "@/lib/actions/wishlist";

interface ProjectOption {
  id: string;
  name: string;
}

/**
 * Compact combobox the WishlistTable can pop over the project-tag
 * column. Click → list opens with a search filter; pick a project
 * (or "(none)") and the row is updated via the server action.
 */
export function TagToProjectMenu({
  itemId,
  current,
  projects,
}: {
  itemId: string;
  current: string | null;
  projects: ReadonlyArray<ProjectOption>;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [isPending, startTransition] = useTransition();

  const currentName = current
    ? projects.find((p) => p.id === current)?.name ?? "(unknown)"
    : "(none)";

  const filtered = filter
    ? projects.filter((p) => p.name.toLowerCase().includes(filter.toLowerCase()))
    : projects;

  function pick(projectId: string | null) {
    startTransition(async () => {
      await updateWishlistItem({ id: itemId, projectId });
      setOpen(false);
    });
  }

  return (
    <span className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          "text-xs font-mono px-2 py-0.5 frame hover:bg-[color-mix(in_srgb,var(--color-fg)_6%,transparent)]",
          current ? "text-[var(--color-cyan)]" : "text-[var(--color-fg-muted)]",
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {currentName}
      </button>
      {open ? (
        <div
          className="absolute right-0 z-30 mt-1 w-56 bg-[var(--color-bg-panel)] frame-strong shadow-2xl p-2 space-y-1"
          role="listbox"
        >
          <input
            type="text"
            autoFocus
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search projects…"
            className="w-full px-2 py-1 font-mono text-xs frame bg-[var(--color-bg-elevated)]"
          />
          <button
            type="button"
            onClick={() => pick(null)}
            disabled={isPending}
            className={clsx(
              "w-full text-left text-xs font-mono px-2 py-1 hover:bg-[color-mix(in_srgb,var(--color-fg)_6%,transparent)]",
              current === null && "text-[var(--color-green)]",
            )}
          >
            (none)
          </button>
          <div className="max-h-48 overflow-y-auto">
            {filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => pick(p.id)}
                disabled={isPending}
                className={clsx(
                  "w-full text-left text-xs font-mono px-2 py-1 truncate hover:bg-[color-mix(in_srgb,var(--color-fg)_6%,transparent)]",
                  current === p.id && "text-[var(--color-green)]",
                )}
              >
                {p.name}
              </button>
            ))}
            {filtered.length === 0 ? (
              <p className="px-2 py-1 text-2xs font-mono text-[var(--color-fg-muted)]">
                No matches.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </span>
  );
}
