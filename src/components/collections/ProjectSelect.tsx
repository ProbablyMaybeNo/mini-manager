"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { clsx } from "clsx";
import { ChevronDown } from "lucide-react";
import { updateWishlistItem } from "@/lib/actions/wishlist";

export interface ProjectOption {
  id: string;
  name: string;
}

/**
 * MODEL COLLECTION project assignment dropdown. Assigns the model row to
 * an existing project via `updateWishlistItem`. Mirrors the old
 * TagToProjectMenu but scoped to the collections surface and slightly
 * tightened for the model table cell.
 */
export function ProjectSelect({
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
    : "Assign…";

  const filtered = filter
    ? projects.filter((p) => p.name.toLowerCase().includes(filter.toLowerCase()))
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
        className={clsx(
          "tap-target inline-flex items-center gap-1.5 text-xs font-mono px-2 py-1 frame",
          "hover:border-[var(--color-cyan)] transition-colors",
          "focus:outline-none focus-visible:[box-shadow:0_0_0_2px_var(--color-cyan)]",
          current ? "text-[var(--color-cyan)]" : "text-[var(--color-fg-muted)]",
        )}
      >
        <span className="truncate max-w-[110px]">{currentName}</span>
        <ChevronDown
          size={12}
          strokeWidth={1.75}
          aria-hidden
          className={clsx("transition-transform shrink-0", open && "rotate-180")}
        />
      </button>
      {open ? (
        <div
          role="listbox"
          className="absolute right-0 z-[60] mt-1 w-60 panel bg-[var(--color-bg-panel)] shadow-2xl p-2 space-y-1"
        >
          <input
            type="text"
            autoFocus
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search projects…"
            className="w-full px-2 py-1.5 font-mono text-xs frame bg-[var(--color-bg-elevated)]"
          />
          <button
            type="button"
            onClick={() => pick(null)}
            disabled={isPending}
            className={clsx(
              "w-full text-left text-xs font-mono px-2 py-1.5 rounded-sm hover:bg-[color-mix(in_srgb,var(--color-fg)_6%,transparent)]",
              current === null && "text-[var(--color-cyan)]",
            )}
          >
            (none)
          </button>
          <div className="max-h-48 overflow-y-auto">
            {projects.length === 0 ? (
              <p className="px-2 py-2 text-2xs font-mono text-[var(--color-fg-muted)] leading-relaxed">
                No projects yet. Create one on the{" "}
                <a
                  href="/projects/new"
                  className="text-[var(--color-cyan)] underline-offset-2 hover:underline"
                >
                  Dashboard
                </a>{" "}
                first.
              </p>
            ) : filtered.length === 0 ? (
              <p className="px-2 py-1 text-2xs font-mono text-[var(--color-fg-muted)]">
                No matches.
              </p>
            ) : (
              filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => pick(p.id)}
                  disabled={isPending}
                  className={clsx(
                    "w-full text-left text-xs font-mono px-2 py-1.5 rounded-sm truncate hover:bg-[color-mix(in_srgb,var(--color-fg)_6%,transparent)]",
                    current === p.id && "text-[var(--color-cyan)]",
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
