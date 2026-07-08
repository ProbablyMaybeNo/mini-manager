"use client";

import { cn } from "@/lib/cn";
import { Listbox } from "@/components/kit";

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

/**
 * Roster SORT control (dashboard 4:4). Sits between the PROJECTS ROSTER header
 * and the table. Controlled: the host owns the active sort and re-derives the
 * visible rows.
 *
 * The status filter-chip row that used to live here was removed — the derived
 * IN-PROGRESS/NEARLY-DONE/OVERDUE buckets didn't match the projects' real
 * lifecycle status pills (they're a separate computed view), so they read as
 * confusing noise above the table. Sort is the one control that earns its keep.
 */
export function RosterFilterBar({
  sort,
  onSortChange,
  className,
}: {
  sort: RosterSort;
  onSortChange: (sort: RosterSort) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2 py-1.5", className)}>
      <div className="ml-auto flex items-center gap-1 min-[600px]:gap-2">
        <span className="font-mono text-[9px] uppercase tracking-normal text-fg-dim opacity-70 min-[600px]:text-[10px] min-[600px]:tracking-wide min-[600px]:opacity-100">
          Sort
        </span>
        <Listbox<RosterSort>
          value={sort}
          options={ROSTER_SORT_OPTIONS}
          onChange={onSortChange}
          ariaLabel="Sort roster"
          accent="cyan"
          size="xs"
          triggerClassName="min-w-[64px] max-w-[84px] min-[600px]:min-w-[140px] min-[600px]:max-w-none"
        />
      </div>
    </div>
  );
}
