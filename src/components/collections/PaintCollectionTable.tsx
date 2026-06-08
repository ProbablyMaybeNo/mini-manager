"use client";

import { clsx } from "clsx";
import type { WishlistItem } from "@/db/schema";
import { paintCollectionStatuses } from "@/db/schema";
import { StatusSelect } from "./StatusSelect";
import {
  DeleteButton,
  ItemName,
  SourceLinkCell,
  Thumbnail,
  formatPrice,
} from "./rowParts";

export interface PaintRow {
  item: WishlistItem;
  /** Recipe names this paint is attached to (paint→recipe linkage). */
  recipes: ReadonlyArray<string>;
}

/**
 * PAINT COLLECTION table.
 *
 * Columns (desktop): thumbnail · name · company · vendor · cost · type ·
 * recipe · status · link · delete. Below md it collapses to a stacked
 * card so nothing clips off a phone. The panel is the signature
 * box-in-box terminal frame; rows never scroll horizontally — the grid
 * fits within the panel via minmax(0,…) flexible columns.
 */
export function PaintCollectionTable({ rows }: { rows: ReadonlyArray<PaintRow> }) {
  return (
    <div className="relative panel panel-ticks pt-1">
      <span className="panel-label" aria-hidden>
        PAINTS · QUEUE
      </span>
      <div
        className={clsx(
          "hidden md:grid items-center gap-3 px-3 pr-3 py-1.5",
          "border-b border-[var(--color-border-strong)] section-title m-0 bg-[var(--color-bg-elevated)]",
          GRID_CLASS,
        )}
      >
        <span aria-hidden />
        <span>Name</span>
        <span>Company</span>
        <span>Vendor</span>
        <span className="text-right">Cost</span>
        <span>Type</span>
        <span>Recipe</span>
        <span>Status</span>
        <span className="text-center" title="Source link">
          Link
        </span>
        <span aria-hidden />
      </div>

      {rows.map(({ item, recipes }) => (
        <div
          key={item.id}
          className={clsx(
            "flex flex-col gap-2 md:grid md:items-center md:gap-3 px-3 py-2",
            "border-b border-[var(--color-border)] transition-colors",
            "hover:bg-[color-mix(in_srgb,var(--color-cyan)_8%,transparent)]",
            GRID_CLASS,
          )}
        >
          {/* Mobile: thumb + name on the first line. Desktop: first two cells. */}
          <div className="flex items-center gap-3 min-w-0 md:contents">
            <Thumbnail item={item} />
            <div className="min-w-0 flex-1">
              <ItemName item={item} />
            </div>
          </div>

          <span className="text-xs font-mono text-[var(--color-fg-muted)] truncate">
            <span className="md:hidden text-2xs uppercase tracking-wider text-[var(--color-fg-subtle)] mr-1">
              Co
            </span>
            {item.company ?? "—"}
          </span>
          <span className="text-xs font-mono text-[var(--color-fg-muted)] truncate">
            <span className="md:hidden text-2xs uppercase tracking-wider text-[var(--color-fg-subtle)] mr-1">
              Vendor
            </span>
            {item.vendor ?? "—"}
          </span>

          {/* Cost + type + recipe + status flow on mobile, grid cells on desktop */}
          <div className="flex flex-wrap items-center gap-3 md:contents">
            <span className="text-xs font-mono text-[var(--color-fg)] md:text-right">
              {formatPrice(item.price, item.currency)}
            </span>
            <span className="text-2xs font-mono uppercase tracking-wider text-[var(--color-fg-muted)] truncate">
              {item.paintType ?? "—"}
            </span>
            <span className="text-2xs font-mono text-[var(--color-fg-muted)] truncate" title={recipes.join(", ")}>
              {recipes.length === 0
                ? "—"
                : recipes.length === 1
                  ? recipes[0]
                  : `${recipes[0]} +${recipes.length - 1}`}
            </span>
            <StatusSelect
              itemId={item.id}
              status={item.status}
              options={paintCollectionStatuses}
            />
            <span className="md:text-center">
              <SourceLinkCell url={item.sourceUrl} />
            </span>
            <span className="ml-auto md:ml-0">
              <DeleteButton item={item} />
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * 10-column desktop grid. Flexible (minmax(0,…)) name/company/vendor/recipe
 * columns let the table fit any viewport ≥768px without horizontal scroll;
 * fixed columns for cost / type / status / link / delete keep the controls
 * readable. The brief requires: tables never scroll horizontally.
 */
const GRID_CLASS =
  "md:grid-cols-[40px_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_72px_88px_minmax(0,1fr)_120px_44px_36px]";
