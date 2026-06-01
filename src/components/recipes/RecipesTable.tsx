"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import { StatusPill } from "@/components/ui/StatusPill";
import { Button } from "@/components/ui/Button";

export interface RecipeRowVm {
  id: string;
  name: string;
  bodyType: string;
  attachmentKind: "standalone" | "project";
  attachmentLabel: string | null;
  paletteHexes: string[];
  stepCount: number;
  slotCount: number;
  createdAt: number;
  updatedAt: number;
  publicSlug: string | null;
}

type SortKey = "name" | "bodyType" | "slotCount" | "stepCount" | "createdAt" | "updatedAt";
type SortDir = "asc" | "desc";

interface Props {
  rows: ReadonlyArray<RecipeRowVm>;
}

/**
 * P12.5 — Single sortable table replacing the prior two-section
 * card grid (standalone / project-attached). P13.4 collapsed the
 * "named-model-attached" branch when named models folded into Units.
 *
 * Columns:
 *   Name              click → /recipes/<id> editor
 *   Body type         coloured chip
 *   Palette           up to 8 swatches (zone-position order)
 *   Slots / Steps     compact count summary
 *   Attached to       chip linking to the project/model (when any)
 *   Updated           short ISO-ish date
 *   Actions           Assign ▾ (cyan/primary) + Share (warning/yellow)
 *
 * Default sort = updatedAt desc; clicking any sortable header toggles
 * asc/desc. The Assign + Share row-actions defer to the existing
 * editor for the heavy lifting — they're shortcuts that navigate.
 */
export function RecipesTable({ rows }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("updatedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sorted = useMemo(() => {
    const arr = rows.slice();
    arr.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      let cmp = 0;
      if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
      else cmp = String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [rows, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" || key === "bodyType" ? "asc" : "desc");
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
              label="Body"
              active={sortKey === "bodyType"}
              dir={sortDir}
              onClick={() => handleSort("bodyType")}
            />
            <th scope="col" className="px-3 py-2">
              Palette
            </th>
            <Th
              label="Slots"
              align="right"
              active={sortKey === "slotCount"}
              dir={sortDir}
              onClick={() => handleSort("slotCount")}
            />
            <Th
              label="Steps"
              align="right"
              active={sortKey === "stepCount"}
              dir={sortDir}
              onClick={() => handleSort("stepCount")}
            />
            <th scope="col" className="px-3 py-2">
              Attached to
            </th>
            <Th
              label="Updated"
              active={sortKey === "updatedAt"}
              dir={sortDir}
              onClick={() => handleSort("updatedAt")}
            />
            <th scope="col" className="px-3 py-2 text-right">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <RecipeRow key={row.id} row={row} />
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
  align = "left",
  onClick,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  align?: "left" | "right";
  onClick: () => void;
}) {
  return (
    <th
      scope="col"
      className={clsx("px-3 py-2", align === "right" ? "text-right" : "text-left")}
    >
      <button
        type="button"
        onClick={onClick}
        className={clsx(
          "uppercase tracking-wider transition-colors",
          active ? "text-[var(--color-cyan)]" : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]",
        )}
        aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
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

function RecipeRow({ row }: { row: RecipeRowVm }) {
  return (
    <tr
      className="hover:bg-[color-mix(in_srgb,var(--color-cyan)_4%,transparent)] transition-colors"
      style={{ borderBottom: "1px solid var(--color-border)" }}
    >
      <td className="px-3 py-2">
        <Link
          href={`/recipes/${row.id}`}
          className="text-[var(--color-cyan)] hover:underline"
        >
          {row.name}
        </Link>
      </td>
      <td className="px-3 py-2">
        <StatusPill status="neutral">{row.bodyType}</StatusPill>
      </td>
      <td className="px-3 py-2">
        <PaletteStrip hexes={row.paletteHexes} />
      </td>
      <td className="px-3 py-2 text-right tabular-nums">{row.slotCount}</td>
      <td className="px-3 py-2 text-right tabular-nums">{row.stepCount}</td>
      <td className="px-3 py-2 text-[var(--color-fg-muted)]">
        {row.attachmentLabel ?? (
          <span className="opacity-50">standalone</span>
        )}
      </td>
      <td className="px-3 py-2 text-[var(--color-fg-muted)] whitespace-nowrap">
        {formatDate(row.updatedAt)}
      </td>
      <td className="px-3 py-2 text-right">
        <div className="inline-flex items-center gap-2">
          <Button
            as="a"
            href={`/recipes/${row.id}`}
            variant="success"
            size="sm"
            title="Open editor + assign to a project"
          >
            Assign ▾
          </Button>
          <Button
            as="a"
            href={
              row.publicSlug ? `/r/${row.publicSlug}` : `/recipes/${row.id}`
            }
            variant="warning"
            size="sm"
            title={
              row.publicSlug
                ? "Open shared link"
                : "Open editor to share"
            }
          >
            Share
          </Button>
        </div>
      </td>
    </tr>
  );
}

function PaletteStrip({ hexes }: { hexes: ReadonlyArray<string> }) {
  if (hexes.length === 0) {
    return (
      <span className="text-2xs text-[var(--color-fg-muted)] opacity-50">
        no palette yet
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
          className="block w-4 h-4 rounded-sm"
          style={{
            background: hex,
            border: "1px solid var(--color-border-strong)",
          }}
        />
      ))}
    </span>
  );
}

function formatDate(ms: number): string {
  const d = new Date(ms);
  // ISO-ish: YYYY-MM-DD — short, mono-friendly, sortable.
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
