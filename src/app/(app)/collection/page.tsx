import { currentUserId } from "@/lib/auth-stub";
import { loadCollectionData } from "@/lib/appData";
import { CollectionClient } from "./CollectionClient";

export const dynamic = "force-dynamic";

/**
 * Server shell for the COLLECTION route. Exists so the paint/model lists are
 * loaded HERE rather than in `loadAppData` — the signed-in layout calls that on
 * every route, so a real collection was being serialized into the RSC payload
 * of every page (and of every server action's re-render) to be used by exactly
 * one screen.
 */
export default async function CollectionPage() {
  const userId = await currentUserId();
  const { collectionPaints, collectionModels } = await loadCollectionData(userId);
  return (
    <CollectionClient
      collectionPaints={collectionPaints}
      collectionModels={collectionModels}
    />
  );
}
