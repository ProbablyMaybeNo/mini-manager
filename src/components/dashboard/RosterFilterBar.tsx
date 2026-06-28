"use client";

import { cn } from "@/lib/cn";
import { Listbox } from "@/components/kit";
import { accentDot, type Accent } from "@/lib/palette";
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
  cyan: "bg-cyan border-cyan text-bg",
  green: "bg-green border-green text-bg",
  yellow: "bg-yellow border-yellow text-bg",
  orange: "bg-orange border-orange text-bg",
  purple: "bg-purple border-purple text-bg",
  red: "bg-red border-red text-bg",
  dim: "bg-fg/20 border-fg/30 text-fg",
};

/** Ghost/outline chip classes when inactive (colour border + colour text). */
const ghost: Record<Accent, string> = {
  cyan: "border-cyan/40 text-cyan hover:bg-cyan/10",
  green: "border-green/40 text-green hover:bg-green/10",
  yellow: "border-yellow/40 text-yellow hover:bg-yellow/10",
  orange: "border-orange/40 text-orange hover:bg-orange/10",
  purple: "border-purple/40 text-purple hover:bg-purple/10",
  red: "border-red/40 text-red hover:bg-red/10",
  dim: "border-border text-fg-dim hover:bg-fg/5",
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
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-[12px] border border-border bg-surface px-3 py-2.5",
        className,
      )}
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
                "inline-flex items-center gap-1.5 rounded-[6px] border px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wide transition-colors focus:outline-none focus-visible:outline-2 focus-visible:outline-cyan",
                active ? activeFill[accent] : ghost[accent],
              )}
            >
              {f !== "ALL" && (
                <span
                  className={cn(
                    "h-1.5 w-1.5 shrink-0 rounded-full",
                    active ? "bg-bg/70" : accentDot[accent],
                  )}
                  aria-hidden
                />
              )}
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
