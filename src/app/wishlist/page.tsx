import { redirect } from "next/navigation";

/**
 * FIGMA-REBUILD (REBUILD_SPEC §2) — wishlist data merged into the
 * COLLECTION page (STATUS=WISHLIST rows). Permanent redirect so old
 * bookmarks and deep links resolve; query string forwarded.
 */
export default async function WishlistRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") qs.set(key, value);
    else if (Array.isArray(value)) value.forEach((v) => qs.append(key, v));
  }
  redirect(qs.size > 0 ? `/collection?${qs.toString()}` : "/collection");
}
