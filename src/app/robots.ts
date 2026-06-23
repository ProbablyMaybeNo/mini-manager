import type { MetadataRoute } from "next";

const BASE = "https://mini-mainframe.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      // Public marketing + auth surface is crawlable.
      allow: ["/", "/pricing", "/sign-in", "/sign-up", "/privacy", "/terms"],
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
