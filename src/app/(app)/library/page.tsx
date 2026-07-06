import { auth } from "@/auth";
import { loadInventoryFlags, loadRecipesByPaintId } from "@/lib/appData";
import { LibraryClient } from "./LibraryClient";

/**
 * Library route — server component. The paint catalog is a large static asset
 * the client loads itself (browser fetch + IndexedDB cache); the server only
 * supplies the signed-in user's owned / wishlisted flags, which the client
 * merges onto the catalog.
 */
export default async function LibraryPage() {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const [flags, recipesByPaint] = await Promise.all([
    loadInventoryFlags(userId),
    loadRecipesByPaintId(userId),
  ]);
  return <LibraryClient flags={flags} recipesByPaint={recipesByPaint} />;
}
