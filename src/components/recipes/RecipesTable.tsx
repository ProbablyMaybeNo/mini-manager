"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { StatusPill } from "@/components/ui/StatusPill";
import { Button } from "@/components/ui/Button";
import { AssignToProjectMenu } from "@/components/recipes/AssignToProjectMenu";
import type { AssignProjectOption } from "@/components/recipes/RecipeActionsBar";

/** One creator-sized paint square on a /recipes row — colour, paint name,
 *  layer, ownership coverage (green/yellow border), and whether it's a
 *  colour-only slot that still needs a paint assigned. */
export interface RecipeTableSlotVm {
  hex: string;
  paintLabel: string | null;
  layerLabel: string;
  coverage: "owned" | "wanted" | "none";
  needsPaint: boolean;
}

export interface RecipeRowVm {
  id: string;
  name: string;
  bodyType: string;
  attachmentKind: "standalone" | "project";
  /** Currently-attached project id so the Assign dropdown can mark it. */
  attachedProjectId: string | null;
  attachmentLabel: string | null;
  paletteHexes: string[];
  /** Per-swatch colour + hover label (paint name, or hex for custom slots). */
  palette: { hex: string; label: string }[];
  /** Creator-sized paint squares (paint name + layer) shown in the row. */
  slots: RecipeTableSlotVm[];
  slotCount: number;
  createdAt: number;
  updatedAt: number;
  publicSlug: string | null;
}

type SortKey = "name" | "bodyType" | "slotCount" | "createdAt" | "updatedAt";
type SortDir = "asc" | "desc";

/**
 * FOCUS-DASH — one paint square in the dashboard "cards" variant: the
 * colour, the paint name + the layer it sits on, and the painter's
 * ownership coverage (green border = owned, yellow = wishlisted, blank =
 * neither — the same library colour-map dot treatment).
 */
export interface DashboardRecipeSlotVm {
  hex: string;
  paintLabel: string;
  layerLabel: string;
  coverage: "owned" | "wanted" | "none";
}

/** Row shape for the dashboard "cards" variant. */
export interface DashboardRecipeRowVm {
  id: string;
  name: string;
  bodyType: string;
  publicSlug: string | null;
  slots: DashboardRecipeSlotVm[];
  slotCount: number;
  updatedAt: number;
}

interface Props {
  rows: ReadonlyArray<RecipeRowVm>;
  /** Every non-archived project owned by the user — powers each row's
   *  "Assign ▾" project dropdown (attach-to-project inline). */
  assignProjects: ReadonlyArray<AssignProjectOption>;
}

/**
 * P12.5 — Single sortable table replacing the prior two-section
 * card grid (standalone / project-attached). P13.4 collapsed the
 * "named-model-attached" branch when named models folded into Units.
 *
 * Columns:
 *   Name              click → /recipes/<id> editor
 *   Body type         coloured chip
 *   Palette           up to 8 swatches (slot-position order)
 *   Slots             slot count (one paint + layer per slot)
 *   Attached to       chip linking to the project/model (when any)
 *   Updated           short ISO-ish date
 *   Actions           Assign ▾ (cyan/primary) + Share (warning/yellow)
 *
 * Default sort = updatedAt desc; clicking any sortable header toggles
 * asc/desc. The Assign + Share row-actions defer to the existing
 * editor for the heavy lifting — they're shortcuts that navigate.
 */
export function RecipesTable({ rows, assignProjects }: Props) {
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
    <>
      {/* UX-1305 — below md the horizontally-scrolling table hid the
          Assign/Share row actions off-screen. Render a stacked card list
          on mobile and reserve the dense sortable table for md+. */}
      <div className="md:hidden flex flex-col gap-2">
        {sorted.map((row) => (
          <RecipeCardRow
            key={row.id}
            row={row}
            assignProjects={assignProjects}
          />
        ))}
      </div>
      <div className="hidden md:block frame overflow-x-auto">
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
            <RecipeRow
              key={row.id}
              row={row}
              assignProjects={assignProjects}
            />
          ))}
        </tbody>
      </table>
      </div>
    </>
  );
}

/**
 * UX-1305 — mobile card row. Name on its own line, body chip + palette +
 * slot/step counts beneath, and the Assign/Share actions as full-width
 * buttons so they never scroll off the right edge.
 */
function RecipeCardRow({
  row,
  assignProjects,
}: {
  row: RecipeRowVm;
  assignProjects: ReadonlyArray<AssignProjectOption>;
}) {
  return (
    <div className="frame px-3 py-3 flex flex-col gap-2 bg-[var(--color-bg-elevated)]">
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/recipes/${row.id}`}
          className="font-mono text-sm text-[var(--color-cyan)] hover:underline min-w-0 truncate"
        >
          {row.name}
        </Link>
        <StatusPill status="neutral">{row.bodyType}</StatusPill>
      </div>
      <RecipeSlotSquares recipeId={row.id} slots={row.slots} />
      <div className="flex items-center gap-3 text-2xs font-mono text-[var(--color-fg-muted)] tabular-nums">
        <span>
          {row.slotCount} slot{row.slotCount === 1 ? "" : "s"}
        </span>
        <span aria-hidden className="text-[var(--color-fg-muted)]">·</span>
        <span className="truncate">{row.attachmentLabel ?? "standalone"}</span>
      </div>
      <div className="flex items-center gap-2">
        <AssignToProjectMenu
          recipeId={row.id}
          projects={assignProjects}
          currentlyAttachedProjectId={row.attachedProjectId}
          block
        />
        <Button
          as="a"
          href={row.publicSlug ? `/r/${row.publicSlug}` : `/recipes/${row.id}`}
          variant="warning"
          size="sm"
          className="flex-1"
          title={row.publicSlug ? "Open shared link" : "Open editor to share"}
        >
          Share
        </Button>
      </div>
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
          // P15.2 — bare text sort triggers only had the text line-height
          // as their hit-box. tap-target + inline-flex floors the button at
          // 44px (mobile) / 32px (desktop) inside the header cell.
          "tap-target inline-flex items-center uppercase tracking-wider transition-colors",
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

function RecipeRow({
  row,
  assignProjects,
}: {
  row: RecipeRowVm;
  assignProjects: ReadonlyArray<AssignProjectOption>;
}) {
  return (
    <tr
      className="hover:bg-[color-mix(in_srgb,var(--color-cyan)_4%,transparent)] transition-colors align-top"
      style={{ borderBottom: "1px solid var(--color-border)" }}
    >
      <td className="px-3 py-3">
        <Link
          href={`/recipes/${row.id}`}
          className="text-[var(--color-cyan)] hover:underline"
        >
          {row.name}
        </Link>
      </td>
      <td className="px-3 py-3">
        <StatusPill status="neutral">{row.bodyType}</StatusPill>
      </td>
      <td className="px-3 py-3">
        <RecipeSlotSquares recipeId={row.id} slots={row.slots} />
      </td>
      <td className="px-3 py-3 text-right tabular-nums">{row.slotCount}</td>
      <td className="px-3 py-3 text-[var(--color-fg-muted)]">
        {row.attachmentLabel ?? (
          <span className="opacity-50">standalone</span>
        )}
      </td>
      <td className="px-3 py-3 text-[var(--color-fg-muted)] whitespace-nowrap">
        {formatDate(row.updatedAt)}
      </td>
      <td className="px-3 py-3 text-right">
        <div className="inline-flex items-center gap-2">
          <AssignToProjectMenu
            recipeId={row.id}
            projects={assignProjects}
            currentlyAttachedProjectId={row.attachedProjectId}
          />
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

/**
 * Item 1 — the row's paint squares, rendered at the SAME size the recipe
 * creator uses (w-12 h-12) with the paint name + layer beneath, so
 * /recipes reads as a full recipe at a glance. Clicking a square opens
 * the creator (to assign / edit paints). A colour-only slot with no paint
 * assigned shows a "+ Assign Paint" affordance — black or white text per
 * the swatch's contrast — instead of a name.
 */
function RecipeSlotSquares({
  recipeId,
  slots,
}: {
  recipeId: string;
  slots: ReadonlyArray<RecipeTableSlotVm>;
}) {
  const router = useRouter();
  if (slots.length === 0) {
    return (
      <span className="text-2xs text-[var(--color-fg-muted)] opacity-50">
        no palette yet
      </span>
    );
  }
  return (
    <ul
      className="flex flex-wrap items-start gap-2"
      role="list"
      aria-label={`Palette · ${slots.length} paint${slots.length === 1 ? "" : "s"}`}
    >
      {slots.map((slot, i) => {
        const fg = readableTextOn(slot.hex);
        const hover = slot.needsPaint
          ? `Assign a paint · ${slot.hex} · ${slot.layerLabel}`
          : `${slot.paintLabel} · ${slot.layerLabel}`;
        return (
          <li
            key={`${i}-${slot.hex}`}
            role="listitem"
            className="flex flex-col items-center gap-1 w-[4.5rem]"
          >
            <button
              type="button"
              onClick={() => router.push(`/recipes/${recipeId}`)}
              title={hover}
              aria-label={hover}
              className="block w-12 h-12 rounded-sm transition-transform hover:scale-[1.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
              style={{
                background: slot.hex,
                border: `2px solid ${coverageBorder(slot.coverage)}`,
              }}
            >
              {slot.needsPaint ? (
                <span
                  aria-hidden
                  className="font-mono text-2xs leading-none"
                  style={{ color: fg }}
                >
                  + Assign
                  <br />
                  Paint
                </span>
              ) : null}
            </button>
            <span className="font-mono text-2xs text-[var(--color-fg)] text-center leading-tight line-clamp-2 break-words">
              {slot.paintLabel ?? (
                <span className="text-[var(--color-fg-muted)]">no paint</span>
              )}
            </span>
            <span className="font-mono text-2xs uppercase tracking-wider text-[var(--color-fg-muted)] text-center leading-tight">
              {slot.layerLabel}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Pick black or white text for a coloured swatch background. sRGB
 * perceived-luminance threshold (~0.55) — the same trick the creator's
 * SlotCell uses for its on-swatch labels.
 */
function readableTextOn(hex: string): string {
  const clean = hex.startsWith("#") ? hex.slice(1) : hex;
  if (clean.length !== 6) return "#0a0a0a";
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return "#0a0a0a";
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.55 ? "#0a0a0a" : "#f5f5f5";
}

function formatDate(ms: number): string {
  const d = new Date(ms);
  // ISO-ish: YYYY-MM-DD — short, mono-friendly, sortable.
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* ============================================================
   FOCUS-DASH — dashboard "cards" variant
   ============================================================ */

/** Owned/wishlist border for a dashboard paint square — the same
 *  treatment as the library colour-map dots (green = owned, yellow =
 *  wishlisted, neutral border = neither). */
function coverageBorder(coverage: DashboardRecipeSlotVm["coverage"]): string {
  if (coverage === "owned") return "var(--color-green)";
  if (coverage === "wanted") return "var(--color-yellow)";
  return "var(--color-border-strong)";
}

/**
 * FOCUS-DASH — the DASHBOARD recipes table (Ross's spec). Rows of BIGGER
 * paint/colour squares with the paint name + layer visible, the recipe
 * title, and an "Assign Recipe" button. Squares carry the owned/wishlist
 * border. Lives on the dashboard alongside the project table; the dense
 * sortable `RecipesTable` above stays the /recipes view — same data, two
 * presentations.
 */
export function DashboardRecipesTable({
  rows,
}: {
  rows: ReadonlyArray<DashboardRecipeRowVm>;
}) {
  if (rows.length === 0) {
    return (
      <p className="frame px-3 py-4 text-xs font-sans text-[var(--color-fg-muted)]">
        No recipes yet. Build a scheme from the wheel, library, or
        eyedropper, then assign it to a project.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-2" role="list">
      {rows.map((row) => (
        <DashboardRecipeRowCard key={row.id} row={row} />
      ))}
    </ul>
  );
}

function DashboardRecipeRowCard({ row }: { row: DashboardRecipeRowVm }) {
  return (
    <li className="frame px-3 py-3 flex flex-col gap-3 bg-[var(--color-bg-elevated)]">
      <div className="flex items-start justify-between gap-3">
        <Link
          href={`/recipes/${row.id}`}
          className="font-mono text-sm text-[var(--color-cyan)] hover:underline min-w-0 truncate"
        >
          {row.name}
        </Link>
        <Button
          as="a"
          href={`/recipes/${row.id}`}
          variant="success"
          size="sm"
          className="shrink-0"
          title="Open editor + assign to a project"
        >
          Assign Recipe
        </Button>
      </div>
      {row.slots.length === 0 ? (
        <span className="text-2xs font-mono text-[var(--color-fg-muted)] opacity-60">
          no paints yet
        </span>
      ) : (
        <ul
          className="flex flex-wrap items-start gap-2"
          role="list"
          aria-label={`${row.name} paints`}
        >
          {row.slots.map((slot, i) => (
            <li
              key={`${i}-${slot.hex}`}
              role="listitem"
              className="flex flex-col items-center gap-1 w-[4.5rem]"
            >
              <span
                aria-hidden
                title={`${slot.paintLabel} · ${slot.layerLabel}`}
                className="block w-12 h-12 rounded-sm"
                style={{
                  background: slot.hex,
                  border: `2px solid ${coverageBorder(slot.coverage)}`,
                }}
              />
              <span className="font-mono text-2xs text-[var(--color-fg)] text-center leading-tight line-clamp-2 break-words">
                {slot.paintLabel}
              </span>
              <span className="font-mono text-2xs uppercase tracking-wider text-[var(--color-fg-muted)] text-center leading-tight">
                {slot.layerLabel}
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
