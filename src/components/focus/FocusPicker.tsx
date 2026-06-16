"use client";

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
    <div className={cn("flex items-center gap-2", className)}>
      <label className="flex items-center gap-2">
        <span className="font-osd text-[11px] uppercase tracking-[0.18em] text-cyan">
          + Focus
        </span>
        <select
          aria-label="Focus on project"
          value={currentId ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            if (v) onSelect(v);
          }}
          className="max-w-[220px] border border-cyan/50 bg-bg px-2 py-1 font-mono text-xs text-fg focus:border-cyan focus:outline-none"
        >
          <option value="" disabled>
            {options.length ? "Pick a project…" : "No projects yet"}
          </option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      {currentId && (
        <button
          type="button"
          onClick={onClear}
          className="border border-red/50 px-2 py-1 font-osd text-[10px] uppercase tracking-[0.15em] text-red hover:bg-red/10 focus:outline-none focus-visible:bg-red/10"
        >
          Remove Focus
        </button>
      )}
    </div>
  );
}
