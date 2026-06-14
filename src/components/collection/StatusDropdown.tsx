"use client";

import { cn } from "@/lib/cn";
import { accentBorder, accentText, statusAccent } from "@/lib/palette";
import type { ProjectStatus } from "@/lib/types";

const STATUSES: ProjectStatus[] = [
  "WISHLIST", "OWNED", "BUILDING", "PRIMING", "PAINTING", "BASING", "COMPLETE", "SHELVED",
];

/** Vibrant status select — border + text tinted by the status accent. */
export function StatusDropdown({
  value,
  onChange,
  ariaLabel,
}: {
  value: ProjectStatus;
  onChange: (status: ProjectStatus) => void;
  ariaLabel: string;
}) {
  const accent = statusAccent[value];
  return (
    <select
      value={value}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value as ProjectStatus)}
      className={cn(
        "border bg-bg px-2 py-1 font-osd text-[10px] uppercase tracking-[0.12em] focus:outline-none",
        accentBorder[accent],
        accentText[accent],
      )}
    >
      {STATUSES.map((s) => (
        <option key={s} value={s} className="bg-bg text-fg">
          {s}
        </option>
      ))}
    </select>
  );
}
