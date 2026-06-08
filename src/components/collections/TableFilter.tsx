"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { clsx } from "clsx";
import { SlidersHorizontal } from "lucide-react";

export interface FilterGroup {
  /** URL search-param key this group writes (e.g. "pstatus"). */
  param: string;
  /** Group heading shown above the options. */
  label: string;
  /** Selectable values. The "All" choice clears the param. */
  options: ReadonlyArray<string>;
}

/**
 * Per-table filter button — sits at the far right of a table's header
 * row. Clicking opens a small panel with THAT table's filters. Each
 * group writes a namespaced URL search param so the two tables' filters
 * never collide. Selecting "All" clears the param.
 *
 * Server components re-render off the updated searchParams, so there's
 * no client filtering state to keep in sync — the URL is the source of
 * truth (shareable, back-button-friendly).
 */
export function TableFilter({
  groups,
  label = "Filter",
}: {
  groups: ReadonlyArray<FilterGroup>;
  label?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  const activeCount = groups.filter((g) => sp?.get(g.param)).length;

  const setParam = (param: string, value: string | null) => {
    const params = new URLSearchParams(sp?.toString() ?? "");
    if (value === null) params.delete(param);
    else params.set(param, value);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={clsx(
          "tap-target inline-flex items-center gap-1.5 px-2.5 py-1 frame font-mono text-xs",
          "transition-colors hover:border-[var(--color-cyan)] hover:text-[var(--color-cyan)]",
          "focus:outline-none focus-visible:[box-shadow:0_0_0_2px_var(--color-cyan)]",
          activeCount > 0
            ? "text-[var(--color-cyan)] border-[var(--color-cyan)]"
            : "text-[var(--color-fg-muted)]",
        )}
      >
        <SlidersHorizontal size={13} strokeWidth={1.75} aria-hidden />
        <span className="uppercase tracking-wider">{label}</span>
        {activeCount > 0 ? (
          <span className="ml-0.5 inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full text-2xs bg-[var(--color-cyan)] text-black">
            {activeCount}
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label={`${label} options`}
          className="absolute right-0 top-full mt-1 z-40 w-56 panel bg-[var(--color-bg-panel)] shadow-2xl p-3 space-y-3"
        >
          {groups.map((g) => {
            const current = sp?.get(g.param) ?? null;
            return (
              <div key={g.param} className="space-y-1.5">
                <p className="section-title m-0 text-[var(--color-fg-muted)]">
                  {g.label}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <FilterChip
                    active={current === null}
                    onClick={() => setParam(g.param, null)}
                  >
                    All
                  </FilterChip>
                  {g.options.map((opt) => (
                    <FilterChip
                      key={opt}
                      active={current === opt}
                      onClick={() => setParam(g.param, opt)}
                    >
                      {opt}
                    </FilterChip>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        "px-2 py-1 rounded-sm font-mono text-2xs uppercase tracking-wider transition-colors",
        "border",
        active
          ? "bg-[color-mix(in_srgb,var(--color-cyan)_18%,transparent)] border-[var(--color-cyan)] text-[var(--color-cyan)]"
          : "border-[var(--color-border-strong)] text-[var(--color-fg-muted)] hover:border-[var(--color-cyan)] hover:text-[var(--color-cyan)]",
      )}
    >
      {children}
    </button>
  );
}
