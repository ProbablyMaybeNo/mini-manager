import { auth } from "@/auth";
import { loadInventoryFlags } from "@/lib/appData";
import { LibraryClient } from "./LibraryClient";

/**
 * Library route — server component. The paint catalog is a large static asset
 * the client loads itself (browser fetch + IndexedDB cache); the server only
 * supplies the signed-in user's owned / wishlisted flags, which the client
 * merges onto the catalog.
 */
export default async function LibraryPage() {
  const session = await auth();
  const flags = await loadInventoryFlags(session?.user?.id ?? null);
  return <LibraryClient flags={flags} />;
}
