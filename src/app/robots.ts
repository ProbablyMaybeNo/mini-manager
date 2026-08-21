import type { MetadataRoute } from "next";

const BASE = "https://www.mini-mainframe.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      // Public marketing surface is crawlable. `/sign-in` + `/sign-up` are
      // deliberately absent: both carry `robots: { index: false }` and were
      // pulled from the sitemap, so explicitly inviting a crawler to a noindex
      // page contradicts the page's own directive. They are NOT moved to
      // `disallow` either — a disallowed page is never fetched, so the crawler
      // would never read the noindex it is being told to respect.
      allow: ["/", "/pricing", "/privacy", "/terms"],
      // API + the signed-in app shell should never be indexed.
      disallow: [
        "/api/",
        "/dashboard",
        "/library",
        "/collection",
        "/projects",
        "/recipes",
        "/tools",
        "/focus",
        "/user",
        "/dev",
      ],
    },
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
