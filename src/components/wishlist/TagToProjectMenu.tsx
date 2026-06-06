"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { clsx } from "clsx";
import { ChevronDown } from "lucide-react";

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
  const rootRef = useRef<HTMLSpanElement | null>(null);

  // Outside-click to close. Mounted only while the menu is open.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

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
    <span
      ref={rootRef}
      className="relative inline-block"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          // UX-1504 — the project-tag trigger was a 29px px-2 py-1 pill,
          // under the 44px touch floor. tap-target floors it to 44px
          // (mobile) / 32px (desktop); padding/visuals otherwise unchanged.
          "tap-target inline-flex items-center gap-1.5 text-xs font-mono px-2 py-1 frame hover:bg-[color-mix(in_srgb,var(--color-fg)_8%,transparent)] hover:border-[var(--color-accent)] transition-colors",
          current ? "text-[var(--color-cyan)]" : "text-[var(--color-fg-muted)]",
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate max-w-[120px]">{currentName}</span>
        <ChevronDown
          size={12}
          strokeWidth={1.75}
          aria-hidden
          className={clsx("transition-transform", open && "rotate-180")}
        />
      </button>
      {open ? (
        <div
          className="absolute right-0 z-[60] mt-1 w-64 panel bg-[var(--color-bg-panel)] shadow-2xl p-2 space-y-1"
          role="listbox"
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
              current === null && "text-[var(--color-accent)]",
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
                  Projects page
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
                    current === p.id && "text-[var(--color-accent)]",
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
