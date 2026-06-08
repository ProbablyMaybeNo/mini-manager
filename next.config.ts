import type { NextConfig } from "next";
import path from "node:path";

const config: NextConfig = {
  reactStrictMode: true,
  // Pin the Turbopack workspace root to this directory so Next 16
  // doesn't get confused by sibling lockfiles further up the tree
  // (the monorepo root has its own package-lock.json for other apps).
  //
  // `path.resolve()` with no args returns `process.cwd()`, which is
  // always the app/ directory when Next dev/build is invoked here.
  // We deliberately avoid `import.meta.url` — Next 16 compiles this
  // config to CJS and `import.meta` blows up at runtime.
  turbopack: {
    root: path.resolve(),
  },
  // Serve WebP / AVIF where the device supports it. Wishlist + paint
  // detail panels can render reference images supplied by the user;
  // this halves the bytes for those on modern phones.
  images: {
    formats: ["image/avif", "image/webp"],
  },
  // FOCUS-FOLD (2026-06-08) — the standalone /planner (Focus) route was
  // removed and the bench folded into the /projects dashboard. Permanently
  // redirect any inbound /planner link (bookmarks, the old PWA shortcut,
  // shared URLs) to the dashboard so they land on the relocated FOCUS
  // section instead of a 404.
  async redirects() {
    return [
      {
        source: "/planner",
        destination: "/projects",
        permanent: true,
      },
    ];
  },
  // Long-cache /data/paints.json — it's a 2-3 MB static catalog that
  // changes only on a scrape rebuild. Next's static-asset cache only
  // covers /_next/* by default; the public folder gets a more
  // conservative cache. We override per the P6.7 perf pass.
  async headers() {
    return [
      {
        source: "/data/paints.json",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=300, s-maxage=3600",
          },
        ],
      },
    ];
  },
};

export default config;
