"use client";

import { cn } from "@/lib/cn";
import { accentBorder, accentText, statusAccent } from "@/lib/palette";
import type { CollectionKind, ProjectStatus } from "@/lib/types";

/**
 * Per-table status options (5smqx / 2OWF):
 *  - Paints: WISHLIST / OWNED / HOLD (SHELVED is the kit label for HOLD).
 *  - Models: the full build lifecycle.
 * Labels shown to the painter match the spec wording (HOLD, BUILT, …)
 * while the underlying kit value stays a ProjectStatus.
 */
const PAINT_STATUSES: ProjectStatus[] = ["WISHLIST", "OWNED", "SHELVED"];
const MODEL_STATUSES: ProjectStatus[] = [
  "WISHLIST",
  "OWNED",
  "BUILDING",
  "PRIMING",
  "PAINTING",
  "BASING",
  "COMPLETE",
];

/** Spec labels for the lifecycle values (BUILDING→BUILT, etc.). */
const STATUS_LABEL: Record<ProjectStatus, string> = {
  WISHLIST: "WISHLIST",
  OWNED: "OWNED",
  BUILDING: "BUILT",
  PRIMING: "PRIMED",
  PAINTING: "PAINTED",
  BASING: "BASED",
  COMPLETE: "COMPLETE",
  SHELVED: "HOLD",
};

/** Vibrant status select — border + text tinted by the status accent. */
export function StatusDropdown({
  value,
  onChange,
  ariaLabel,
  kind = "model",
}: {
  value: ProjectStatus;
  onChange: (status: ProjectStatus) => void;
  ariaLabel: string;
  kind?: CollectionKind;
}) {
  const options = kind === "paint" ? PAINT_STATUSES : MODEL_STATUSES;
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
      {options.map((s) => (
        <option key={s} value={s} className="bg-bg text-fg">
          {STATUS_LABEL[s]}
        </option>
      ))}
    </select>
  );
}
