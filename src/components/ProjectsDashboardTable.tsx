"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import type { Priority, ProjectType } from "@/db/schema";
import { ProgressBar } from "@/components/ProgressBar";
import { StatusPill, type StatusPillKind } from "@/components/ui/StatusPill";
import type { DisplayStatus } from "@/lib/progress";

/** Per-row VM. Page builds these server-side from listTopLevelProjects
 *  + getProjectPalettesMap + countNamedModelsByProject + the existing
 *  displayStatus / progressPercent helpers. */
export interface ProjectDashboardRow {
  id: string;
  name: string;
  type: ProjectType;
  faction: string | null;
  priority: Priority | null;
  status: DisplayStatus;
  paletteHexes: string[];
  progressPercent: number;
  totalModels: number;
  updatedAt: number;
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

/** Stages flow WISHLIST -> PURCHASED -> BUILDING -> PRIMING -> PAINTING
 *  -> BASING -> COMPLETE. SHELVED sorts last (hibernating). Used for
 *  status-column sort order. */
const STATUS_RANK: Record<DisplayStatus, number> = {
  WISHLIST: 0,
  PURCHASED: 1,
  BUILDING: 2,
  PRIMING: 3,
  PAINTING: 4,
  BASING: 5,
  COMPLETE: 6,
  SHELVED: 7,
};

/** Locked priority order — Urgent first, Low last. */
const PRIORITY_RANK: Record<NonNullable<Priority>, number> = {
  Urgent: 0,
  High: 1,
  Medium: 2,
  Low: 3,
};

const TYPE_CHIP: Readonly<Record<ProjectType, string>> = {
  Army: "type-chip-cyan",
  Warband: "type-chip-cyan",
  Unit: "type-chip-amber",
  "Single Model": "type-chip-purple",
  "Terrain Piece": "type-chip-green",
  Diorama: "type-chip-purple",
};

type SortKey =
  | "name"
  | "type"
  | "status"
  | "priority"
  | "progressPercent"
  | "updatedAt";
type SortDir = "asc" | "desc";

interface Props {
  rows: ReadonlyArray<ProjectDashboardRow>;
}

/**
 * P12.6 — Single sortable dashboard table. Replaces the prior three-
 * card layout (Backlog / Active / All projects) with one dense
 * surface Ross's brief locks: Name / Type / Recipes / Status /
 * Priority / Completion (bar).
 *
 * Default sort = updatedAt DESC. Click any header to toggle asc/desc.
 * Completion bar tone Ross locked: red < 25%, pastel-yellow 25-75%,
 * neon-green >= 75%. The ProgressBar primitive's tone="auto" mode now
 * implements this threshold set (P12.6 update).
 *
 * Expandable hierarchy rows (Army > Units > Models) land in P12.7.
 */
export function ProjectsDashboardTable({ rows }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("updatedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sorted = useMemo(() => {
    const arr = rows.slice();
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "type":
          cmp = a.type.localeCompare(b.type);
          break;
        case "status":
          cmp = STATUS_RANK[a.status] - STATUS_RANK[b.status];
          break;
        case "priority":
          cmp =
            (a.priority ? PRIORITY_RANK[a.priority] : 99) -
            (b.priority ? PRIORITY_RANK[b.priority] : 99);
          break;
        case "progressPercent":
          cmp = a.progressPercent - b.progressPercent;
          break;
        case "updatedAt":
          cmp = a.updatedAt - b.updatedAt;
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [rows, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      // Name + type default to asc; numeric/status/priority/updatedAt to desc.
      setSortDir(key === "name" || key === "type" ? "asc" : "desc");
    }
  };

  return (
    <div className="frame overflow-x-auto">
      <table className="w-full text-xs font-mono">
        <thead>
          <tr
            className="text-left text-2xs uppercase tracking-wider text-[var(--color-fg-muted)]"
            style={{ borderBottom: "1px solid var(--color-border-strong)" }}
          >
            <Th
              label="Name"
              active={sortKey === "name"}
              dir={sortDir}
              onClick={() => handleSort("name")}
            />
            <Th
              label="Type"
              active={sortKey === "type"}
              dir={sortDir}
              onClick={() => handleSort("type")}
            />
            <th scope="col" className="px-3 py-2">
              Recipes
            </th>
            <Th
              label="Status"
              active={sortKey === "status"}
              dir={sortDir}
              onClick={() => handleSort("status")}
            />
            <Th
              label="Priority"
              active={sortKey === "priority"}
              dir={sortDir}
              onClick={() => handleSort("priority")}
            />
            <Th
              label="Completion"
              active={sortKey === "progressPercent"}
              dir={sortDir}
              onClick={() => handleSort("progressPercent")}
            />
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <DashboardRow key={row.id} row={row} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}) {
  return (
    <th scope="col" className="px-3 py-2 text-left">
      <button
        type="button"
        onClick={onClick}
        className={clsx(
          "uppercase tracking-wider transition-colors",
          active
            ? "text-[var(--color-cyan)]"
            : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]",
        )}
        aria-sort={
          active ? (dir === "asc" ? "ascending" : "descending") : "none"
        }
      >
        {label}
        {active ? (
          <span aria-hidden className="ml-1">
            {dir === "asc" ? "▲" : "▼"}
          </span>
        ) : null}
      </button>
    </th>
  );
}

function DashboardRow({ row }: { row: ProjectDashboardRow }) {
  const typeChipClass = TYPE_CHIP[row.type];
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
        {row.faction ? (
          <span className="ml-2 text-2xs text-[var(--color-fg-muted)]">
            {row.faction}
          </span>
        ) : null}
      </td>
      <td className="px-3 py-2">
        <span className={clsx("type-chip", typeChipClass)}>{row.type}</span>
      </td>
      <td className="px-3 py-2">
        <PaletteStrip hexes={row.paletteHexes} />
      </td>
      <td className="px-3 py-2">
        <StatusPill status={STATUS_PILL[row.status]}>{row.status}</StatusPill>
      </td>
      <td className="px-3 py-2 text-[var(--color-fg-muted)]">
        {row.priority ?? "—"}
      </td>
      <td className="px-3 py-2">
        <span className="inline-flex items-center gap-2">
          <ProgressBar percent={row.progressPercent} width={22} />
          <span className="text-2xs font-mono text-[var(--color-fg-muted)] tabular-nums">
            {row.progressPercent}%
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
        no recipes
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
