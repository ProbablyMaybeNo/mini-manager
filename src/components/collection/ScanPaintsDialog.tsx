"use client";

import { useEffect, useState } from "react";
import { Button, Listbox, ModalDialog, SegmentedToggle, Swatch, type ListboxOption } from "@/components/kit";
import type { BulkOwnershipStatus } from "@/lib/paints/ownership";
import type { PaintScanMatch } from "@/lib/paints/matchScan";
import type { Paint } from "@/lib/paints/types";

/** Sentinel option value meaning "don't add this one" — a real choice in
 *  the dropdown (not an unset/placeholder state) so reject reads as
 *  deliberate, matching the spec's accept/swap/reject three-way. */
const SKIP = "__skip__";

interface RowState {
  key: string;
  /** What the vision scan actually read off the label, for display. */
  readLabel: string;
  options: ListboxOption<string>[];
  paintsById: Map<string, Paint>;
  selected: string;
  status: BulkOwnershipStatus;
}

function buildRow(m: PaintScanMatch, index: number): RowState {
  const candidates = m.match
    ? [m.match, ...m.alternates.filter((a) => a.id !== m.match!.id)]
    : m.alternates;
  const paintsById = new Map(candidates.map((p) => [p.id, p]));
  const options: ListboxOption<string>[] = [
    ...candidates.map((p) => ({ value: p.id, label: `${p.brand} — ${p.name}` })),
    { value: SKIP, label: "Skip — no match" },
  ];
  return {
    key: `${index}-${m.extracted.brand}-${m.extracted.name}`,
    readLabel: `${m.extracted.brand} ${m.extracted.name}`.trim(),
    options,
    paintsById,
    selected: m.match ? m.match.id : SKIP,
    status: "OWNED",
  };
}

/**
 * Confirm-before-add dialog for a completed photo scan — never auto-adds
 * (vision can misread). Each extracted label gets its best catalog match
 * pre-selected; the painter can swap to an alternate, skip it, or leave it
 * as-is, plus an Owned/Wishlist choice per row. "Add N paints" hands the
 * confirmed `{paintId, status}` pairs up to the caller, which persists them
 * via the existing `bulkAddPaintsToCollection` action.
 */
export function ScanPaintsDialog({
  open,
  items,
  busy = false,
  error,
  onConfirm,
  onClose,
}: {
  open: boolean;
  items: PaintScanMatch[];
  busy?: boolean;
  error?: string | null;
  onConfirm: (confirmed: { paintId: string; status: BulkOwnershipStatus }[]) => void;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<RowState[]>([]);

  // Re-seed rows every time a fresh scan result opens the dialog.
  useEffect(() => {
    if (open) setRows(items.map(buildRow));
  }, [open, items]);

  function patchRow(key: string, patch: Partial<RowState>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  const confirmedCount = rows.filter((r) => r.selected !== SKIP).length;

  function submit() {
    const confirmed = rows
      .filter((r) => r.selected !== SKIP)
      .map((r) => ({ paintId: r.selected, status: r.status }));
    if (confirmed.length === 0) return;
    onConfirm(confirmed);
  }

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      title="Confirm scanned paints"
      breadcrumb="COLLECTION"
      width="max-w-lg"
      footer={
        <div className="flex items-center justify-between gap-2">
          <span className="font-body text-body text-fg-dim">
            {confirmedCount} of {rows.length} selected
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button size="sm" onClick={submit} disabled={busy || confirmedCount === 0}>
              {busy ? "Adding…" : `Add ${confirmedCount} paint${confirmedCount === 1 ? "" : "s"}`}
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex max-h-[55vh] flex-col gap-3 overflow-y-auto">
        {rows.length === 0 ? (
          <p className="font-body text-body text-fg-dim">▸ No paints to confirm.</p>
        ) : (
          rows.map((row) => {
            const selectedPaint = row.selected !== SKIP ? row.paintsById.get(row.selected) : null;
            return (
              <div
                key={row.key}
                className="flex flex-col gap-2 border-b border-border pb-3 last:border-0"
              >
                <p className="font-body text-body text-fg-dim">
                  Read: <span className="text-fg">{row.readLabel || "(unlabeled)"}</span>
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {selectedPaint ? (
                    <Swatch hex={selectedPaint.hex} size="sm" />
                  ) : (
                    <span
                      className="inline-block h-4 w-4 border border-dashed border-fg/30"
                      aria-hidden
                    />
                  )}
                  <Listbox
                    value={row.selected}
                    options={row.options}
                    onChange={(v) => patchRow(row.key, { selected: v })}
                    ariaLabel={`Catalog match for ${row.readLabel}`}
                    disabled={busy}
                    className="min-w-[220px] flex-1"
                    size="sm"
                  />
                  <SegmentedToggle
                    options={[
                      { value: "OWNED", label: "Owned" },
                      { value: "WISHLIST", label: "Wishlist" },
                    ]}
                    value={row.status}
                    onChange={(v) => patchRow(row.key, { status: v })}
                    disabled={busy || row.selected === SKIP}
                    aria-label={`Owned or wishlist for ${row.readLabel}`}
                  />
                </div>
              </div>
            );
          })
        )}
        {error && (
          <p className="font-body text-body text-red-text" role="alert">
            ▸ {error}
          </p>
        )}
      </div>
    </ModalDialog>
  );
}
