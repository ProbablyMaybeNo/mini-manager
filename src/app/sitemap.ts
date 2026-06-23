import type { MetadataRoute } from "next";

const BASE = "https://mini-mainframe.com";

/** Public, indexable routes. Authed app routes live under /(app) and are
 *  excluded here + disallowed in robots.ts. */
const PUBLIC_ROUTES = [
  "/",
  "/pricing",
  "/sign-in",
  "/sign-up",
  "/privacy",
  "/terms",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return PUBLIC_ROUTES.map((route) => ({
    url: `${BASE}${route}`,
    lastModified,
    changeFrequency: route === "/" ? "weekly" : "monthly",
    priority: route === "/" ? 1 : 0.7,
  }));
}
