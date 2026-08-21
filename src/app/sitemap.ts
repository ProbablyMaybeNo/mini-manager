import type { MetadataRoute } from "next";
import { listPublishedRecipes } from "@/db/queries/recipes";

const BASE = "https://www.mini-mainframe.com";

/**
 * Static public, indexable routes. `/sign-in` + `/sign-up` are deliberately
 * absent — they carry `robots: { index: false }` (see their layouts) and have
 * no organic value. Authed app routes live under /(app) and are disallowed in
 * robots.ts.
 */
const STATIC_ROUTES = [
  "/",
  "/pricing",
  "/gallery",
  "/miniature-wargame-project-tracker",
  "/paint-collection-manager",
  "/paint-recipes",
  "/privacy",
  "/terms",
] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: `${BASE}${route}`,
    lastModified,
    changeFrequency: route === "/" ? "weekly" : "monthly",
    priority: route === "/" ? 1 : 0.7,
  }));

  // Every published recipe card is a keyword-rich, ever-growing UGC surface —
  // the gallery's whole SEO value. Wrapped so a DB hiccup serves the static
  // routes rather than 500-ing the sitemap.
  let recipeEntries: MetadataRoute.Sitemap = [];
  try {
    const published = await listPublishedRecipes(5000);
    recipeEntries = published.map((r) => ({
      url: `${BASE}/r/${r.slug}`,
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));
  } catch {
    // Serve the static routes only.
  }

  return [...staticEntries, ...recipeEntries];
}
