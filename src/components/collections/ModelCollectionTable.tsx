"use client";

import { clsx } from "clsx";
import type { WishlistItem } from "@/db/schema";
import { modelCollectionStatuses } from "@/db/schema";
import { StatusSelect } from "./StatusSelect";
import { ProjectSelect, type ProjectOption } from "./ProjectSelect";
import {
  DeleteButton,
  ItemName,
  SourceLinkCell,
  Thumbnail,
  formatPrice,
} from "./rowParts";

/**
 * MODEL COLLECTION table.
 *
 * Columns (desktop): thumbnail · name · game · army · price · project ·
 * status · link · delete. The project cell is an inline dropdown that
 * assigns the model to an existing project. Status offers the full build
 * lifecycle (WISHLIST → COMPLETE). Mobile collapses to a stacked card.
 */
export function ModelCollectionTable({
  items,
  projects,
}: {
  items: ReadonlyArray<WishlistItem>;
  projects: ReadonlyArray<ProjectOption>;
}) {
  return (
    <div className="relative panel panel-ticks pt-1">
      <span className="panel-label" aria-hidden>
        MODELS · QUEUE
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
        <span>Game</span>
        <span>Army</span>
        <span className="text-right">Price</span>
        <span>Project</span>
        <span>Status</span>
        <span className="text-center" title="Source link">
          Link
        </span>
        <span aria-hidden />
      </div>

      {items.map((item) => (
        <div
          key={item.id}
          className={clsx(
            "flex flex-col gap-2 md:grid md:items-center md:gap-3 px-3 py-2",
            "border-b border-[var(--color-border)] transition-colors",
            "hover:bg-[color-mix(in_srgb,var(--color-cyan)_8%,transparent)]",
            GRID_CLASS,
          )}
        >
          <div className="flex items-center gap-3 min-w-0 md:contents">
            <Thumbnail item={item} />
            <div className="min-w-0 flex-1">
              <ItemName item={item} />
            </div>
          </div>

          <span className="text-xs font-mono text-[var(--color-fg-muted)] truncate">
            <span className="md:hidden text-2xs uppercase tracking-wider text-[var(--color-fg-subtle)] mr-1">
              Game
            </span>
            {item.game ?? "—"}
          </span>
          <span className="text-xs font-mono text-[var(--color-fg-muted)] truncate">
            <span className="md:hidden text-2xs uppercase tracking-wider text-[var(--color-fg-subtle)] mr-1">
              Army
            </span>
            {item.army ?? "—"}
          </span>

          <div className="flex flex-wrap items-center gap-3 md:contents">
            <span className="text-xs font-mono text-[var(--color-fg)] md:text-right">
              {formatPrice(item.price, item.currency)}
            </span>
            <ProjectSelect
              itemId={item.id}
              current={item.projectId}
              projects={projects}
            />
            <StatusSelect
              itemId={item.id}
              status={item.status}
              options={modelCollectionStatuses}
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
 * 9-column desktop grid. minmax(0,…) flexible columns (name/game/army)
 * fit any viewport ≥768px without horizontal scroll; fixed columns for
 * price / project / status / link / delete keep the controls readable.
 */
const GRID_CLASS =
  "md:grid-cols-[40px_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_80px_140px_150px_44px_36px]";
