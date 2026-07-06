/**
 * The tri-state Library ↔ Collection ownership status. A paint is either
 * untracked (NONE), on the shopping list (WISHLIST), or in-hand (OWNED).
 *
 * This is intentionally NOT a DB column enum — it's the shared vocabulary
 * `reconcilePaintOwnership` (src/lib/paints/reconcileOwnership.ts) uses to
 * drive BOTH `inventory_entry` (ownedCount/isWishlisted booleans) and the
 * linked `wishlist_item` row's `status` (WISHLIST/OWNED) in lockstep. Kept
 * in its own plain module (no `server-only` import) so client components
 * — the Library STATUS control, the bulk-select action bar — can import
 * the type without pulling in DB code.
 */
export const ownershipStatuses = ["NONE", "WISHLIST", "OWNED"] as const;
export type OwnershipStatus = (typeof ownershipStatuses)[number];

/** The subset the "Add to Collection" bulk action offers — NONE only makes
 *  sense as a per-paint "clear" action, not a bulk one. */
export const bulkOwnershipStatuses = ["OWNED", "WISHLIST"] as const;
export type BulkOwnershipStatus = (typeof bulkOwnershipStatuses)[number];
