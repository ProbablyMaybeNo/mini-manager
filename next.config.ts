import type { NextConfig } from "next";
import path from "node:path";

const config: NextConfig = {
  reactStrictMode: true,
  // Keep visited routes in the client Router Cache briefly so re-navigating to
  // a page you just saw is instant (served from cache, no server round-trip).
  // Dynamic routes default to 0s in Next 15+, which is why every revisit
  // re-hit the server and felt laggy.
  experimental: {
    staleTimes: { dynamic: 30, static: 300 },
  },
  // DOP-016 / MUX-013 — the circular "N" mark the UX audits saw overlapping
  // the bottom-left "REPORT AN ISSUE" sidebar text is the Next.js dev/preview
  // indicator (it does NOT ship to a production build, so real users never see
  // it). Moving it to bottom-right (the prior fix here) stopped it compositing
  // over the desktop sidebar footer, but on phone-width viewports that same
  // bottom-right corner is exactly where the persistent bottom-nav "More" tab
  // sits (MUX-001) — the badge physically blocks taps on it in dev, which is
  // how the E2E mobile suite (qa_mobile_flows M6.1) caught it. There's no
  // corner that's safe on both breakpoints, so disable the indicator outright;
  // it's dev-only chrome, never shipped to production.
  devIndicators: false,
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
    // MM-26 — inspiration tiles render painter-pasted reference image URLs
    // from arbitrary hosts. next/image blocks unknown remote hosts by
    // default, so a pasted URL silently failed to render. Allow any
    // remote image (these are user-supplied references shown small) via
    // the documented remotePatterns wildcard.
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
  // Legacy-route redirects. Each of these paths existed in an earlier
  // information architecture; permanently redirect inbound links
  // (bookmarks, the old PWA shortcut, shared URLs) to their current home
  // so they land on a live page instead of a 404.
  //   /planner     — the standalone Focus route, now served at /focus.
  //   /projects    — the old dashboard path, now /dashboard.
  //   /collections — plural alias of the COLLECTION route.
  //   /wishlist    — the wishlist was folded into COLLECTION.
  async redirects() {
    return [
      { source: "/planner", destination: "/focus", permanent: true },
      { source: "/projects", destination: "/dashboard", permanent: true },
      { source: "/collections", destination: "/collection", permanent: true },
      { source: "/wishlist", destination: "/collection", permanent: true },
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
