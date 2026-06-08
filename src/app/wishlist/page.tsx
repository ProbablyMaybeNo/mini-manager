import { redirect } from "next/navigation";

/**
 * The WISHLIST surface was rebuilt and renamed to COLLECTIONS
 * (batch/collections-rebuild). This route is kept as a permanent
 * redirect so old bookmarks, the dashboard's "top wishes" deep links,
 * and any external links continue to resolve.
 */
export default function WishlistRedirect() {
  redirect("/collections");
}
