import type { WishlistItem } from "@/db/schema";
import type { CollectionItem, ProjectStatus } from "@/lib/types";

/**
 * DB wishlist status -> kit ProjectStatus (mirrors appData's server-side
 * map so optimistically-added rows render identically to a full reload).
 * Shared by every Collection-page mutation that needs to drop a freshly
 * persisted row straight into local state without a round-trip.
 */
export const FROM_DB_STATUS: Record<string, ProjectStatus> = {
  WISHLIST: "WISHLIST",
  OWNED: "OWNED",
  HOLD: "SHELVED",
  BUILT: "BUILDING",
  PRIMED: "PRIMING",
  PAINTED: "PAINTING",
  BASED: "BASING",
  COMPLETE: "COMPLETE",
  PURCHASED: "OWNED",
};

/** Map a persisted wishlist row to the kit's CollectionItem. */
export function toCollectionItem(i: WishlistItem): CollectionItem {
  return {
    id: i.id,
    kind: i.kind,
    thumbnail: i.imageUrl ?? "",
    name: i.title,
    company: i.company ?? "",
    vendor: i.vendor ?? "",
    game: i.game ?? undefined,
    army: i.army ?? undefined,
    price: i.price != null ? `$${(i.price / 100).toFixed(2)}` : "",
    status: FROM_DB_STATUS[i.status ?? "WISHLIST"] ?? "WISHLIST",
    sourceUrl: i.sourceUrl ?? "",
    projectId: i.projectId ?? undefined,
    recipeId: i.recipeId ?? undefined,
    paintType: i.paintType ?? undefined,
    paintId: i.paintId ?? undefined,
  };
}
