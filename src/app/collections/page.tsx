import { redirect } from "next/navigation";

/**
 * FIGMA-REBUILD (REBUILD_SPEC §2) — the COLLECTIONS surface moved to
 * /collection (singular). This route is kept as a redirect so old
 * bookmarks and internal links keep resolving; the query string
 * (table filters) is forwarded.
 */
export default async function CollectionsRedirect({
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
