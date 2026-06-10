"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { clsx } from "clsx";
import { updateWishlistItem } from "@/lib/actions/wishlist";

export interface ProjectOption {
  id: string;
  name: string;
}

/**
 * MODEL table PROJECT cell (REBUILD_SPEC §8) — the mock's `ASSIGN ▾`
 * dropdown. Assigns the model row to an existing project via the
 * existing `updateWishlistItem` server action; shows the assigned
 * project name once set.
 */
export function ProjectAssign({
  itemId,
  itemTitle,
  current,
  projects,
}: {
  itemId: string;
  itemTitle: string;
  current: string | null;
  projects: ReadonlyArray<ProjectOption>;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
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

  const currentName = current
    ? projects.find((p) => p.id === current)?.name ?? "(unknown)"
    : null;

  const filtered = filter
    ? projects.filter((p) =>
        p.name.toLowerCase().includes(filter.toLowerCase()),
      )
    : projects;

  const pick = (projectId: string | null) => {
    startTransition(async () => {
      await updateWishlistItem({ id: itemId, projectId });
      setOpen(false);
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
        onClick={() => setOpen((o) => !o)}
        disabled={isPending}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Assign ${itemTitle} to a project${currentName ? ` (currently ${currentName})` : ""}`}
        className={clsx(
          "tap-target inline-flex items-center gap-1.5 border border-current px-2 py-1 font-mono text-2xs uppercase tracking-wider",
          "transition-[box-shadow] motion-reduce:transition-none",
          "hover:[box-shadow:0_0_0_1px_currentColor]",
          "focus:outline-none focus-visible:[box-shadow:0_0_0_2px_var(--color-cyan)]",
          "disabled:opacity-50",
          "text-[var(--color-cyan)]",
        )}
      >
        <span className="max-w-[110px] truncate">
          {currentName ?? "ASSIGN"}
        </span>
        <span aria-hidden className={clsx(open && "rotate-180")}>
          ▾
        </span>
      </button>
      {open ? (
        <div
          role="listbox"
          aria-label="Assign to project"
          className="panel absolute right-0 z-30 mt-1 w-60 space-y-1 bg-[var(--color-bg-elevated)] p-2 shadow-2xl"
        >
          <input
            type="text"
            autoFocus
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Search projects"
            placeholder="SEARCH PROJECTS…"
            className="frame w-full bg-transparent px-2 py-1.5 font-mono text-xs text-[var(--color-fg)] placeholder:text-[var(--color-fg-subtle)] focus:border-[var(--color-cyan)] focus:outline-none"
          />
          <button
            type="button"
            onClick={() => pick(null)}
            disabled={isPending}
            className={clsx(
              "w-full px-2 py-1.5 text-left font-mono text-xs",
              "hover:bg-[color-mix(in_srgb,var(--color-cyan)_10%,transparent)]",
              "focus:outline-none focus-visible:[box-shadow:inset_0_0_0_2px_var(--color-cyan)]",
              current === null
                ? "text-[var(--color-cyan)]"
                : "text-[var(--color-fg-muted)]",
            )}
          >
            (NONE)
          </button>
          <div className="max-h-48 overflow-y-auto">
            {projects.length === 0 ? (
              <p className="px-2 py-2 font-mono text-2xs leading-relaxed text-[var(--color-fg-muted)]">
                NO PROJECTS YET — create one from the{" "}
                <a
                  href="/projects"
                  className="text-[var(--color-cyan)] underline-offset-2 hover:underline"
                >
                  DASHBOARD
                </a>{" "}
                first.
              </p>
            ) : filtered.length === 0 ? (
              <p className="px-2 py-1 font-mono text-2xs text-[var(--color-fg-muted)]">
                NO MATCHES.
              </p>
            ) : (
              filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => pick(p.id)}
                  disabled={isPending}
                  className={clsx(
                    "w-full truncate px-2 py-1.5 text-left font-mono text-xs",
                    "hover:bg-[color-mix(in_srgb,var(--color-cyan)_10%,transparent)]",
                    "focus:outline-none focus-visible:[box-shadow:inset_0_0_0_2px_var(--color-cyan)]",
                    current === p.id
                      ? "text-[var(--color-cyan)]"
                      : "text-[var(--color-fg)]",
                  )}
                >
                  {p.name}
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </span>
  );
}
