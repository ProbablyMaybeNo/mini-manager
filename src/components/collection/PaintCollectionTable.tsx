"use client";

import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import type { WishlistItem } from "@/db/schema";
import { paintCollectionStatuses } from "@/db/schema";
import { StatusSelect } from "@/components/collection/StatusSelect";
import {
  ItemImage,
  ItemName,
  RecipeChips,
  SourceLink,
  formatPrice,
} from "@/components/collection/rowParts";
import {
  TableActions,
  selectableRowProps,
  useRowSelection,
} from "@/components/collection/tableParts";

export interface PaintRow {
  item: WishlistItem;
  recipes: ReadonlyArray<string>;
}

/**
 * MY PAINT COLLECTION table (REBUILD_SPEC §8) — `.dt` idiom with cyan
 * selected rows, checkbox column, and the `+PAINT` / `REMOVE PAINT`
 * footer actions.
 */
export function PaintCollectionTable({ rows }: { rows: ReadonlyArray<PaintRow> }) {
  const router = useRouter();
  const { selected, toggle, clear } = useRowSelection();

  return (
    <div className="panel panel-ticks relative">
      <span className="panel-label" aria-hidden>
        PAINTS · {rows.length}
      </span>
      {/* Scroll on an inner wrapper so the panel stays non-clipping and
          the on-border label isn't cut off by overflow. */}
      <div className="overflow-x-auto">
      <table className="dt">
        <thead>
          <tr>
            <th scope="col" className="w-8" aria-label="Select" />
            <th scope="col">Image</th>
            <th scope="col">Name</th>
            <th scope="col">Company</th>
            <th scope="col">Vendor</th>
            <th scope="col" className="dt-num">
              Price
            </th>
            <th scope="col">Recipe</th>
            <th scope="col">Status</th>
            <th scope="col" className="text-center">
              Link
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ item, recipes }) => {
            const isSelected = selected.has(item.id);
            const rowProps = selectableRowProps(isSelected, () => toggle(item.id));
            return (
              <tr key={item.id} {...rowProps}>
                <td onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggle(item.id)}
                    aria-label={`Select ${item.title}`}
                    className="tap-target accent-[var(--color-cyan)]"
                  />
                </td>
                <td>
                  <ItemImage item={item} />
                </td>
                <td>
                  <ItemName item={item} />
                </td>
                <td className="truncate">{item.company ?? "—"}</td>
                <td className="truncate">{item.vendor ?? "—"}</td>
                <td className="dt-num">{formatPrice(item.price, item.currency)}</td>
                <td>
                  <RecipeChips recipes={recipes} />
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  <StatusSelect
                    itemId={item.id}
                    itemTitle={item.title}
                    status={item.status}
                    options={paintCollectionStatuses}
                  />
                </td>
                <td className="text-center" onClick={(e) => e.stopPropagation()}>
                  <SourceLink item={item} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <TableActions
        kind="paint"
        addLabel="+ PAINT"
        removeLabel="REMOVE PAINT"
        selectedIds={Array.from(selected)}
        onRemoved={() => {
          clear();
          router.refresh();
        }}
      />
      </div>
    </div>
  );
}
