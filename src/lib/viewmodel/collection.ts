import type { WishlistItem, WishlistStatus } from "@/db/schema";
import type { CollectionItem, ProjectStatus } from "@/lib/types";

/** Wishlist-item status vocabulary → contract ProjectStatus. */
const STATUS: Record<WishlistStatus, ProjectStatus> = {
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

const SYMBOL: Record<string, string> = { USD: "$", GBP: "£", EUR: "€" };

function formatPrice(cents: number | null, currency: string | null): string {
  if (cents == null) return "";
  const cur = currency ?? "USD";
  const amount = (cents / 100).toFixed(2);
  const sym = SYMBOL[cur];
  return sym ? `${sym}${amount}` : `${amount} ${cur}`;
}

/** Wishlist item → contract CollectionItem (paint or model, by `kind`). */
export function toCollectionItem(w: WishlistItem): CollectionItem {
  return {
    id: w.id,
    kind: w.kind,
    thumbnail: w.imageUrl ?? "",
    name: w.title,
    company: w.company ?? w.army ?? "",
    vendor: w.vendor ?? "",
    price: formatPrice(w.price, w.currency),
    status: STATUS[w.status],
    sourceUrl: w.sourceUrl ?? "",
    ...(w.projectId ? { projectId: w.projectId } : {}),
  };
}
