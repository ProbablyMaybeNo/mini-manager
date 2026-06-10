"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { Button } from "@/components/ui/Button";
import { AssignToProjectMenu } from "@/components/recipes/AssignToProjectMenu";
import { NewRecipeButton } from "@/components/recipes/NewRecipeButton";
import type { AssignProjectOption } from "@/components/recipes/RecipeActionsBar";

/** One step-colour chip on a /recipes row — colour, paint name, layer,
 *  ownership coverage (green/yellow ring) and whether it's a colour-only
 *  slot that still needs a paint assigned. */
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
  attachmentKind: "standalone" | "project";
  /** Currently-attached project id so the Assign dropdown can mark it. */
  attachedProjectId: string | null;
  attachmentLabel: string | null;
  paletteHexes: string[];
  /** Per-swatch colour + hover label (paint name, or hex for custom slots). */
  palette: { hex: string; label: string }[];
  /** Step-colour chips (paint name + layer) shown in the RECIPE column. */
  slots: RecipeTableSlotVm[];
  slotCount: number;
  createdAt: number;
  updatedAt: number;
  publicSlug: string | null;
}

type SortKey = "name" | "updatedAt";
type SortDir = "asc" | "desc";

interface Props {
  rows: ReadonlyArray<RecipeRowVm>;
  /** Every non-archived project owned by the user — powers each row's
   *  PROJECT assign dropdown (attach-to-project inline). */
  assignProjects: ReadonlyArray<AssignProjectOption>;
}

/** Chip ring colour for a slot's ownership coverage: green = owned,
 *  yellow = wishlisted, neutral otherwise. */
function coverageBorder(coverage: RecipeTableSlotVm["coverage"]): string {
  if (coverage === "owned") return "var(--color-green)";
  if (coverage === "wanted") return "var(--color-yellow)";
  return "var(--color-border-strong)";
}

/**
 * FIGMA-REBUILD (REBUILD_SPEC §5, `Recipe.png`) — the /recipes table,
 * rebuilt ground-up to the mock:
 *
 *   NAME     mono, cyan link — row click → /recipes/<id> editor
 *   RECIPE   row of small step-colour chips (one per slot)
 *   PROJECT  inline ASSIGN ▾ dropdown (purple accent, per the mock)
 *   SHARE    yellow outline SHARE button (keeps the /r/[slug] flow)
 *
 * A full-width `+ RECIPE` outline row sits under the table inside the
 * same panel (the mock's trailing create row). NAME stays sortable
 * (best-practice win over the static mock); default order is most
 * recently updated first.
 */
export function RecipesTable({ rows, assignProjects }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("updatedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sorted = useMemo(() => {
    const arr = rows.slice();
    arr.sort((a, b) => {
      const cmp =
        sortKey === "updatedAt"
          ? a.updatedAt - b.updatedAt
          : a.name.localeCompare(b.name);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [rows, sortKey, sortDir]);

  const handleNameSort = () => {
    if (sortKey === "name") {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey("name");
      setSortDir("asc");
    }
  };

  return (
    <>
      {/* UX-1305 — below md the table reflows to stacked cards so the
          Assign/Share row actions never scroll off-screen. */}
      <div className="md:hidden flex flex-col gap-2">
        {sorted.map((row) => (
          <RecipeCardRow
            key={row.id}
            row={row}
            assignProjects={assignProjects}
          />
        ))}
        <NewRecipeButton trigger="row" />
      </div>

      {/* Desktop — one terminal panel: cyan border, corner ticks, tech
          label; table + the trailing + RECIPE row share the frame. */}
      <div className="hidden md:block panel panel-info panel-ticks relative">
        <span className="panel-label" aria-hidden>
          RECIPES · {sorted.length}
        </span>
        {/* Scroll lives on an inner wrapper so the panel itself stays
            non-clipping — otherwise overflow clips the on-border label. */}
        <div className="overflow-x-auto">
        <table className="w-full font-mono text-sm">
          <thead>
            <tr
              className="text-left text-xs uppercase tracking-[0.14em] text-[var(--color-green)]"
              style={{ borderBottom: "1px solid var(--color-cyan-dim)" }}
            >
              <th scope="col" className="px-4 py-2.5">
                <button
                  type="button"
                  onClick={handleNameSort}
                  className="tap-target inline-flex items-center uppercase tracking-[0.14em] text-[var(--color-green)] transition-colors hover:text-[var(--color-fg)] motion-reduce:transition-none"
                  aria-sort={
                    sortKey === "name"
                      ? sortDir === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  Name
                  {sortKey === "name" ? (
                    <span aria-hidden className="ml-1">
                      {sortDir === "asc" ? "▲" : "▼"}
                    </span>
                  ) : null}
                </button>
              </th>
              <th scope="col" className="px-4 py-2.5 text-center">
                Recipe
              </th>
              <th scope="col" className="px-4 py-2.5 text-center">
                Project
              </th>
              <th scope="col" className="px-4 py-2.5 text-right">
                Share
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
        <NewRecipeButton trigger="row" />
        </div>
      </div>
    </>
  );
}

/** Desktop row — the whole row is a click surface into the editor (the
 *  NAME link is the accessible path); the PROJECT + SHARE cells stop
 *  propagation so their own controls keep working. */
function RecipeRow({
  row,
  assignProjects,
}: {
  row: RecipeRowVm;
  assignProjects: ReadonlyArray<AssignProjectOption>;
}) {
  const router = useRouter();
  return (
    <tr
      onClick={() => router.push(`/recipes/${row.id}`)}
      className="caret-row cursor-pointer align-middle transition-colors hover:bg-[color-mix(in_srgb,var(--color-cyan)_12%,transparent)] hover:[box-shadow:inset_2px_0_0_0_var(--color-cyan)] motion-reduce:transition-none"
      style={{ borderBottom: "1px solid var(--color-border)" }}
    >
      <td className="px-4 py-3">
        <Link
          href={`/recipes/${row.id}`}
          onClick={(e) => e.stopPropagation()}
          className="text-[var(--color-fg)] hover:text-[var(--color-cyan)] hover:underline"
        >
          {row.name}
        </Link>
      </td>
      <td className="px-4 py-3">
        <div className="flex justify-center">
          <RecipeStepChips slots={row.slots} />
        </div>
      </td>
      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
        <AssignToProjectMenu
          recipeId={row.id}
          projects={assignProjects}
          currentlyAttachedProjectId={row.attachedProjectId}
          attachedLabel={row.attachmentLabel}
        />
      </td>
      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
        <Button
          as="a"
          href={row.publicSlug ? `/r/${row.publicSlug}` : `/recipes/${row.id}`}
          variant="warning"
          size="sm"
          title={row.publicSlug ? "Open shared link" : "Open editor to share"}
        >
          Share
        </Button>
      </td>
    </tr>
  );
}

/**
 * UX-1305 — mobile card row. Name on its own line, step chips beneath,
 * and the Assign/Share actions as full-width buttons so they never
 * scroll off the right edge.
 */
function RecipeCardRow({
  row,
  assignProjects,
}: {
  row: RecipeRowVm;
  assignProjects: ReadonlyArray<AssignProjectOption>;
}) {
  return (
    <div className="panel px-3 py-3 flex flex-col gap-2 active:[box-shadow:inset_2px_0_0_0_var(--color-cyan)] transition-shadow motion-reduce:transition-none">
      <Link
        href={`/recipes/${row.id}`}
        className="font-mono text-sm text-[var(--color-cyan)] hover:underline min-w-0 truncate"
      >
        {row.name}
      </Link>
      <RecipeStepChips slots={row.slots} />
      <div className="flex items-center gap-3 text-2xs font-mono text-[var(--color-fg-muted)] tabular-nums">
        <span>
          {row.slotCount} step{row.slotCount === 1 ? "" : "s"}
        </span>
        <span aria-hidden>·</span>
        <span className="truncate">{row.attachmentLabel ?? "standalone"}</span>
      </div>
      <div className="flex items-center gap-2">
        <AssignToProjectMenu
          recipeId={row.id}
          projects={assignProjects}
          currentlyAttachedProjectId={row.attachedProjectId}
          attachedLabel={row.attachmentLabel}
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

/**
 * RECIPE column — small step-colour chips, one per slot, in recipe
 * order (the mock's row of colour squares). Decorative-but-labelled:
 * each chip carries a tooltip + screen-reader text; the ROW handles
 * navigation, so the chips don't need their own 44px targets. The
 * green/yellow coverage ring (owned / wishlisted) is kept from the
 * previous build; a colour-only slot renders a dashed ring.
 */
function RecipeStepChips({
  slots,
}: {
  slots: ReadonlyArray<RecipeTableSlotVm>;
}) {
  if (slots.length === 0) {
    return (
      <span className="text-2xs font-mono text-[var(--color-fg-subtle)]">
        no palette yet
      </span>
    );
  }
  return (
    <ul
      className="flex flex-wrap items-center gap-1.5"
      aria-label={`Recipe steps · ${slots.length}`}
    >
      {slots.map((slot, i) => {
        const label = slot.needsPaint
          ? `Step ${i + 1} · assign a paint · ${slot.hex} · ${slot.layerLabel}`
          : `Step ${i + 1} · ${slot.paintLabel} · ${slot.layerLabel}`;
        return (
          <li
            key={`${i}-${slot.hex}`}
            title={label}
            className={clsx("h-6 w-6 shrink-0")}
            style={{
              background: slot.hex,
              border: slot.needsPaint
                ? "1px dashed var(--color-fg-muted)"
                : `1px solid ${coverageBorder(slot.coverage)}`,
            }}
          >
            <span className="sr-only">{label}</span>
          </li>
        );
      })}
    </ul>
  );
}
