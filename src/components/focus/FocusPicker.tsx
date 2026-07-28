"use client";

import { Listbox } from "@/components/kit";
import type { Project } from "@/lib/types";
import { cn } from "@/lib/cn";
import { flattenFocusOptions } from "@/lib/focus/focusOptions";

export { flattenFocusOptions } from "@/lib/focus/focusOptions";
export type { FocusOption } from "@/lib/focus/focusOptions";

/**
 * "+ Focus" picker (MM-23). A dropdown of every project / sub-project to pin
 * to the bench, plus a Remove Focus control when a project is already pinned.
 * Pure presentational — the host owns selection + persistence.
 */
export function FocusPicker({
  projects,
  currentId,
  onSelect,
  onClear,
  className,
}: {
  projects: Project[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onClear: () => void;
  className?: string;
}) {
  const options = flattenFocusOptions(projects);

  return (
    // The "+ Focus" caption is desktop-only (Ross, 2026-07-27): on a phone the
    // label plus a full "Remove Focus" button pushed the dropdown itself off
    // the right edge. The dropdown is self-evident — it's the only control up
    // there — and clearing focus collapses to a ✕ that still announces itself.
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      <label className="flex min-w-0 flex-1 items-center gap-2 md:flex-none">
        <span className="label-osd hidden shrink-0 text-cyan-lite md:inline">+ Focus</span>
        <Listbox
          ariaLabel="Focus on project"
          value={currentId ?? ""}
          options={options.map((o) => ({ value: o.id, label: o.label }))}
          onChange={(v) => onSelect(v)}
          placeholder={options.length ? "Pick a project…" : "No projects yet"}
          disabled={options.length === 0}
          className="min-w-0 flex-1 md:flex-none"
          triggerClassName="md:max-w-[220px]"
        />
      </label>
      {currentId && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Remove focus"
          title="Remove focus"
          className="inline-flex h-8 shrink-0 items-center justify-center border border-red/50 px-2 font-button text-button uppercase tracking-[0.12em] text-red hover:bg-red/10 focus:outline-none focus-visible:bg-red/10"
        >
          <span aria-hidden className="md:hidden">✕</span>
          <span aria-hidden className="hidden md:inline">Remove Focus</span>
        </button>
      )}
    </div>
  );
}
