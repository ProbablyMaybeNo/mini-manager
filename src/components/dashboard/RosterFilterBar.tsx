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
    // Inline in the ROSTER header row (MUX-015). It used to own a full 44px
    // row that was 64% empty, with the control squeezed to max-w-[84px] so
    // "Completion ↓" clipped to "Comple…". Here it sizes to its content and the
    // row disappears. The "Sort" caption is desktop-only — next to a value that
    // reads "Completion ↓" it was labelling the obvious.
    <div className={cn("flex min-w-0 items-center gap-1 min-[600px]:gap-2", className)}>
      <span className="hidden font-mono text-[10px] uppercase tracking-wide text-fg-dim min-[600px]:inline">
        Sort
      </span>
      <Listbox<RosterSort>
        value={sort}
        options={ROSTER_SORT_OPTIONS}
        onChange={onSortChange}
        ariaLabel="Sort roster"
        accent="cyan"
        size="xs"
        className="min-w-0"
      />
    </div>
  );
}
