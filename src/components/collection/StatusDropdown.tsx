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
}: {
  value: ProjectStatus;
  onChange: (status: ProjectStatus) => void;
  ariaLabel: string;
  kind?: CollectionKind;
}) {
  const statuses = kind === "paint" ? PAINT_STATUSES : MODEL_STATUSES;
  const accent = statusAccent[value];
  return (
    <Listbox
      value={value}
      ariaLabel={ariaLabel}
      accent={accent}
      options={statuses.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
      onChange={(s) => onChange(s)}
      triggerClassName="uppercase tracking-[0.12em]"
    />
  );
}
