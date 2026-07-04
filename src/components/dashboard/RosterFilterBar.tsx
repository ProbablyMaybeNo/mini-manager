"use client";

import { cn } from "@/lib/cn";
import { Listbox } from "@/components/kit";
import { type Accent } from "@/lib/palette";
import { ROSTER_STATUS_ACCENT, type RosterStatus } from "@/lib/rosterStatus";

/** Roster filter value: a roster status, or ALL. */
export type RosterFilter = "ALL" | RosterStatus;

/** Sort options for the roster (SORT dropdown, 4:4). */
export type RosterSort =
  | "completion-desc"
  | "completion-asc"
  | "priority-desc"
  | "title-asc"
  | "time-desc";

export const ROSTER_SORT_OPTIONS: { value: RosterSort; label: string }[] = [
  { value: "completion-desc", label: "Completion ↓" },
  { value: "completion-asc", label: "Completion ↑" },
  { value: "priority-desc", label: "Priority" },
  { value: "title-asc", label: "Title A–Z" },
  { value: "time-desc", label: "Time logged" },
];

/** Chip order matches the Figma 4:4 filter row. */
const FILTERS: RosterFilter[] = [
  "ALL",
  "IN PROGRESS",
  "PLANNED",
  "ON HOLD",
  "DONE",
  "NEARLY DONE",
  "OVERDUE",
];

function accentFor(filter: RosterFilter): Accent {
  return filter === "ALL" ? "cyan" : ROSTER_STATUS_ACCENT[filter];
}

/** Filled-chip classes when a chip is the active filter (colour fill + dark
 *  text), per the 4:4 active-chip treatment (ALL/NEARLY DONE shown filled). */
const activeFill: Record<Accent, string> = {
  cyan: "bg-cyan border-cyan text-white",
  green: "bg-green border-green text-bg",
  yellow: "bg-yellow border-yellow text-bg",
  orange: "bg-orange border-orange text-bg",
  purple: "bg-purple border-purple text-bg",
  red: "bg-red border-red text-bg",
  dim: "bg-fg/20 border-fg/30 text-fg",
  neutral: "bg-fg border-fg text-bg",
  "priority-low": "bg-priority-low border-priority-low text-bg",
  "priority-med": "bg-priority-med border-priority-med text-bg",
  "priority-high": "bg-priority-high border-priority-high text-bg",
};

/** Ghost/outline chip classes when inactive (colour border + colour text). */
const ghost: Record<Accent, string> = {
  cyan: "border-cyan/40 text-cyan-lite hover:bg-cyan/10",
  green: "border-green/40 text-green hover:bg-green/10",
  yellow: "border-yellow/40 text-yellow hover:bg-yellow/10",
  orange: "border-orange/40 text-orange hover:bg-orange/10",
  purple: "border-purple/40 text-purple hover:bg-purple/10",
  red: "border-red/40 text-red hover:bg-red/10",
  dim: "border-border text-fg-dim hover:bg-fg/5",
  neutral: "border-border text-fg hover:bg-fg/5",
  "priority-low": "border-priority-low/40 text-priority-low hover:bg-priority-low/10",
  "priority-med": "border-priority-med/40 text-priority-med hover:bg-priority-med/10",
  "priority-high": "border-priority-high/40 text-priority-high hover:bg-priority-high/10",
};

/**
 * Roster filter-chip row + SORT control (dashboard 4:4). Sits between the
 * PROJECTS ROSTER header and the table. Controlled: the host owns the active
 * filter + sort and re-derives the visible rows.
 */
export function RosterFilterBar({
  filter,
  sort,
  onFilterChange,
  onSortChange,
  className,
}: {
  filter: RosterFilter;
  sort: RosterSort;
  onFilterChange: (filter: RosterFilter) => void;
  onSortChange: (sort: RosterSort) => void;
  className?: string;
}) {
  return (
    <div
      className={cn("flex flex-wrap items-center gap-2 py-1.5", className)}
      role="group"
      aria-label="Filter roster by status"
    >
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => {
          const accent = accentFor(f);
          const active = f === filter;
          return (
            <button
              key={f}
              type="button"
              aria-pressed={active}
              onClick={() => onFilterChange(f)}
              className={cn(
                // 4:4 filter chips are text-only (no leading status dot):
                // active = filled accent, inactive = accent outline.
                // ≥44px tap target on touch widths; compact on desktop (UX-011).
                "inline-flex min-h-[44px] items-center rounded-[6px] border px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-wide transition-colors duration-150 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan motion-safe:active:scale-[0.97] md:min-h-0",
                active ? activeFill[accent] : ghost[accent],
              )}
            >
              {f}
            </button>
          );
        })}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wide text-fg-dim">Sort</span>
        <Listbox<RosterSort>
          value={sort}
          options={ROSTER_SORT_OPTIONS}
          onChange={onSortChange}
          ariaLabel="Sort roster"
          accent="cyan"
          triggerClassName="min-w-[140px]"
        />
      </div>
    </div>
  );
}
