"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import type { Priority, ProjectType } from "@/db/schema";
import { ProgressBar } from "@/components/ProgressBar";
import { StatusPill, type StatusPillKind } from "@/components/ui/StatusPill";
import { Button } from "@/components/ui/Button";
import { updateProjectCount } from "@/lib/actions/projects";
import type { DisplayStatus } from "@/lib/progress";

export interface ProgressRow {
  id: string;
  /** P13.4 — only "project" rows exist now; the prior "named-model"
   *  kind was removed when named models folded into Unit projects.
   *  Kept as a discriminant to make future expansion (e.g. group rows)
   *  cheap and to keep the row VM future-proof. */
  kind: "project";
  name: string;
  /** Project-type label for the row. */
  type: string;
  /** Q2 locked: count = total models for that row. */
  count: number;
  /** Up to 8 hexes of the row's color scheme. */
  paletteHexes: string[];
  status: DisplayStatus;
  percent: number;
  priority: Priority | null;
}

const STATUS_PILL: Record<DisplayStatus, StatusPillKind> = {
  WISHLIST: "wishlist",
  PURCHASED: "neutral",
  BUILDING: "info",
  PRIMING: "info",
  PAINTING: "warning",
  BASING: "warning",
  COMPLETE: "ok",
  SHELVED: "neutral",
};

interface Props {
  /** Parent project type — drives the "+ Add X" CTA labels. */
  parentType: ProjectType;
  parentId: string;
  rows: ReadonlyArray<ProgressRow>;
}

/**
 * P12.10 — Project detail "Progress" table.
 *
 * One row per child (sub-project / named-model). Columns Ross's
 * Q2 locked: Name · Type · Count (± steppers) · Color scheme ·
 * Status bar. ADD CTAs above the table (success-green per the
 * P12.23 button discipline).
 *
 * Inline edits supported in v1:
 *   - Count (± steppers) on sub-project rows (updateProjectCount)
 *
 * Future P12.10 polish (popovers for status / priority / recipe-
 * cell) is intentionally scoped down for the first ship — the
 * pieces it needs (status dropdown + recipe-attach picker) already
 * exist via the existing project workspace + the P12.9 Color
 * Scheme box. Wiring them as inline popovers per cell is a
 * fast-follow.
 */
export function ProjectProgressTable({
  parentType,
  parentId,
  rows,
}: Props) {
  // P13.4 — Army / Warband / Unit parents host Units only.
  const addLabel = "+ ADD UNIT";
  const showTerrainCta = parentType === "Army" || parentType === "Warband";

  if (rows.length === 0) {
    return (
      <section
        className="frame p-6 text-center space-y-3"
        aria-label="Progress (empty)"
      >
        <p className="text-sm font-sans text-[var(--color-fg-muted)]">
          No children yet. Add a unit, model, or piece of terrain to start
          tracking progress for this {parentType.toLowerCase()}.
        </p>
        <div className="flex justify-center gap-3 flex-wrap">
          <Button
            as="a"
            href={`/projects/new?parent=${parentId}&type=Unit`}
            variant="success"
            size="sm"
          >
            {addLabel}
          </Button>
          {showTerrainCta ? (
            <Button
              as="a"
              href={`/projects/new?parent=${parentId}&type=Terrain Piece`}
              variant="success"
              size="sm"
            >
              + ADD TERRAIN
            </Button>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-3" aria-label="Progress">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="section-title">Progress · {rows.length}</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            as="a"
            href={`/projects/new?parent=${parentId}&type=Unit`}
            variant="success"
            size="sm"
          >
            {addLabel}
          </Button>
          {showTerrainCta ? (
            <Button
              as="a"
              href={`/projects/new?parent=${parentId}&type=Terrain Piece`}
              variant="success"
              size="sm"
            >
              + ADD TERRAIN
            </Button>
          ) : null}
        </div>
      </div>
      <div className="frame overflow-x-auto">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr
              className="text-left text-2xs uppercase tracking-wider text-[var(--color-fg-muted)]"
              style={{ borderBottom: "1px solid var(--color-border-strong)" }}
            >
              <th scope="col" className="px-3 py-2">Name</th>
              <th scope="col" className="px-3 py-2">Type</th>
              <th scope="col" className="px-3 py-2 text-right">Count</th>
              <th scope="col" className="px-3 py-2">Color scheme</th>
              <th scope="col" className="px-3 py-2">Status</th>
              <th scope="col" className="px-3 py-2">Progress</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <ProgressTableRow key={row.id} row={row} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ProgressTableRow({ row }: { row: ProgressRow }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [localCount, setLocalCount] = useState(row.count);
  const [error, setError] = useState<string | null>(null);

  const handleStep = (delta: 1 | -1) => {
    const next = Math.max(0, Math.min(9999, localCount + delta));
    if (next === localCount) return;
    setLocalCount(next);
    setError(null);
    startTransition(async () => {
      const result = await updateProjectCount({ id: row.id, count: next });
      if (!result.ok) {
        setError(result.error);
        setLocalCount(row.count);
      } else {
        router.refresh();
      }
    });
  };

  return (
    <tr
      className="hover:bg-[color-mix(in_srgb,var(--color-cyan)_4%,transparent)] transition-colors"
      style={{ borderBottom: "1px solid var(--color-border)" }}
    >
      <td className="px-3 py-2">
        <Link
          href={`/projects/${row.id}`}
          className="text-[var(--color-cyan)] hover:underline"
        >
          {row.name}
        </Link>
      </td>
      <td className="px-3 py-2 text-[var(--color-fg-muted)]">{row.type}</td>
      <td className="px-3 py-2 text-right tabular-nums">
        <span className="inline-flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleStep(-1)}
            disabled={isPending || localCount === 0}
            aria-label={`Decrement count for ${row.name}`}
            className={clsx(
              "w-5 h-5 inline-flex items-center justify-center rounded-sm text-[var(--color-fg-muted)] hover:text-[var(--color-cyan)] disabled:opacity-40",
            )}
            style={{ border: "1px solid var(--color-border-strong)" }}
          >
            −
          </button>
          <span className="w-6 text-center">{localCount}</span>
          <button
            type="button"
            onClick={() => handleStep(1)}
            disabled={isPending}
            aria-label={`Increment count for ${row.name}`}
            className={clsx(
              "w-5 h-5 inline-flex items-center justify-center rounded-sm text-[var(--color-fg-muted)] hover:text-[var(--color-cyan)] disabled:opacity-40",
            )}
            style={{ border: "1px solid var(--color-border-strong)" }}
          >
            +
          </button>
        </span>
        {error ? (
          <span
            role="alert"
            className="block text-2xs text-[var(--color-red)] mt-1"
          >
            {error}
          </span>
        ) : null}
      </td>
      <td className="px-3 py-2">
        <PaletteStrip hexes={row.paletteHexes} />
      </td>
      <td className="px-3 py-2">
        <StatusPill status={STATUS_PILL[row.status]}>{row.status}</StatusPill>
      </td>
      <td className="px-3 py-2">
        <span className="inline-flex items-center gap-2">
          <ProgressBar percent={row.percent} width={16} />
          <span className="text-2xs text-[var(--color-fg-muted)] tabular-nums">
            {row.percent}%
          </span>
        </span>
      </td>
    </tr>
  );
}

function PaletteStrip({ hexes }: { hexes: ReadonlyArray<string> }) {
  if (hexes.length === 0) {
    return (
      <span className="text-2xs text-[var(--color-fg-muted)] opacity-50">
        —
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1"
      role="list"
      aria-label={`Palette · ${hexes.length} swatch${hexes.length === 1 ? "" : "es"}`}
    >
      {hexes.slice(0, 8).map((hex, i) => (
        <span
          key={`${i}-${hex}`}
          role="listitem"
          aria-label={hex}
          title={hex}
          className="block w-3 h-3 rounded-sm"
          style={{
            background: hex,
            border: "1px solid var(--color-border-strong)",
          }}
        />
      ))}
    </span>
  );
}
