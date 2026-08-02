import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";
import path from "node:path";

// E4 / R2-8 — Content-Security-Policy ships REPORT-ONLY, and report-only with
// NOWHERE TO REPORT. Be blunt about what that means, because the previous
// version of this comment read like protection: **this header currently blocks
// nothing and collects nothing.** It is a written-down intention, not a
// control. The enforced protections on this response are X-Frame-Options,
// X-Content-Type-Options, Referrer-Policy, Permissions-Policy and HSTS below.
//
// Report-only was the right first step — the app renders inline styles
// (Tailwind + the styled canvas share cards) and Next's inline bootstrap
// scripts, so enforcing without a soak period would break the render. But the
// exit criterion this comment used to state ("enforce once the violation
// reports are clean") could never be evaluated: the response carries no
// `report-uri`, no `report-to` and no `Reporting-Endpoints`, so no report is
// ever generated and "clean" is unobservable.
//
// The real path, in order, NOT yet taken:
//   1. COLLECT. Sentry ingests CSP reports and its DSN is already in this repo
//      (sentry.*.config.ts), so the endpoint is fully determined — append to
//      the policy below:
//        report-uri https://o4511742045323264.ingest.us.sentry.io/api/4511742054694912/security/?sentry_key=aa39c7f4ae31d79048da7b151eda63a6
//      Deliberately left OFF pending Ross, and not as fence-sitting: Sentry
//      counts CSP reports against the same quota as real errors, and the
//      `tracesSampleRate: 0` in every sentry config exists specifically to
//      preserve that quota for real errors at launch. Pointing an unbounded
//      report firehose at it could blind the error monitoring it shares a
//      budget with. Set a per-key rate limit in the Sentry UI first, then
//      switch this on.
//   2. SOAK, then read what a strict policy would actually have blocked.
//   3. ONLY THEN rename the header key to `Content-Security-Policy`. Flipping
//      it without step 1 is a blind enforcement of an unverified policy against
//      real users' renders — `tests/unit/nextConfigHeaders.test.ts` fails the
//      build if anyone tries.
//
// Honest scale note for whoever picks this up: `script-src` below allows
// 'unsafe-inline' AND 'unsafe-eval', so even fully enforced this policy is
// modest hardening, not XSS protection. Tightening script-src is the step that
// would actually be worth the effort.
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
// guard (report-only CSP frame-ancestors does not block framing, which is
// exactly the sort of thing the R2-8 note above is warning you about); the
// rest are safe to enforce immediately.
const securityHeaders = [
  {
    key: "Content-Security-Policy-Report-Only",
    value: contentSecurityPolicyReportOnly,
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // R2-5 — E4 shipped this as `camera=()`, which is an EMPTY allowlist: the
  // camera is denied to every origin, this site included. That silently made
  // the Eyedropper's live sampler (CameraSampler → getUserMedia) impossible:
  // the button still rendered (getUserMedia exists, so the feature-detect
  // passed) and the policy rejection arrives as NotAllowedError, so the user
  // was told "Camera permission denied" for a permission they never denied.
  // `(self)` grants it to our own origin only; embedded third parties stay
  // denied, which is what the original header was actually reaching for.
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=(), browsing-topics=()",
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

export default withSentryConfig(config, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "beacon-hobbies",

  project: "sentry-mini-mainframe",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // tunnelRoute intentionally omitted: our edge proxy (src/proxy.ts) gates every
  // path not in its matcher allowlist, so a `/monitoring` rewrite would 302 to
  // /sign-in and silently break client error reporting. Sentry posts directly to
  // its ingest host instead (allowed by the CSP `connect-src https:`).

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
