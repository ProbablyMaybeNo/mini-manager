import type { NextConfig } from "next";
import path from "node:path";

// E4 — Content-Security-Policy shipped REPORT-ONLY first. The app renders
// inline styles (Tailwind + styled canvas share cards) and Next's inline
// bootstrap scripts, so enforcing a strict policy now would break the render.
// Report-only lets the browser log what a strict policy WOULD block (console /
// any future report endpoint) without affecting users — flip the header key to
// `Content-Security-Policy` to enforce once the violation reports are clean.
//   img-src allows https:/data:/blob: because painters paste reference-image
//   URLs from arbitrary hosts and canvas exports are data:/blob: URIs.
//   connect-src https: covers the Vercel Analytics beacon + blob uploads.
const contentSecurityPolicyReportOnly = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https:",
  "frame-src 'self'",
]
  .join("; ");

// Applied to every response. X-Frame-Options is the ENFORCED clickjacking
// guard (report-only CSP frame-ancestors does not block framing); the rest are
// safe to enforce immediately.
const securityHeaders = [
  {
    key: "Content-Security-Policy-Report-Only",
    value: contentSecurityPolicyReportOnly,
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
];

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
    // E5 — remotePatterns is intentionally NARROW: only Vercel Blob, where our
    // own uploaded images live. The previous `hostname:'**'` wildcard turned
    // /_next/image into an open image proxy/optimizer for any host on the
    // internet (SSRF + bandwidth-abuse surface). Painter-pasted reference URLs
    // (inspiration tiles, model photos) are NOT rendered through next/image —
    // they use plain <img> (see InspoBoard.tsx / ProjectImagePanel.tsx), which
    // is not subject to remotePatterns — so tightening this does not break the
    // pasted-reference feature. next/image is used only for local /brand and
    // /tools static assets, which need no remote allowance at all.
    remotePatterns: [
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
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
        // Security headers on every response (E4).
        source: "/:path*",
        headers: securityHeaders,
      },
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
