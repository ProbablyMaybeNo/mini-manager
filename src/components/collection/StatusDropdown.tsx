"use client";

import { Listbox } from "@/components/kit";
import { STATUS_LABEL, statusAccent } from "@/lib/palette";
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

/** Vibrant status select — border + text tinted by the status accent. */
export function StatusDropdown({
  value,
  onChange,
  ariaLabel,
  kind = "model",
  size = "sm",
}: {
  value: ProjectStatus;
  onChange: (status: ProjectStatus) => void;
  ariaLabel: string;
  kind?: CollectionKind;
  /** "xs" is the phone-table cell: 10px label so NAME · STATUS · COST · actions
   *  all fit one 375px row, while the trigger stays a 44px touch target. */
  size?: "sm" | "md" | "xs";
}) {
  const statuses = kind === "paint" ? PAINT_STATUSES : MODEL_STATUSES;
  const accent = statusAccent[value];
  return (
    <Listbox
      value={value}
      ariaLabel={ariaLabel}
      accent={accent}
      size={size}
      options={statuses.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
      onChange={(s) => onChange(s)}
      triggerClassName="uppercase tracking-[0.06em]"
    />
  );
}
