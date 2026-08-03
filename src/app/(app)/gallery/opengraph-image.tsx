import { ImageResponse } from "next/og";

/**
 * R2-12 — `/gallery` unfurled with NO image at all.
 *
 * The file-based `opengraph-image.tsx` / `twitter-image.tsx` live in the
 * `(public)` route group, but the gallery is `(app)/gallery/page.tsx` and so
 * inherited nothing — while still declaring `twitter:card =
 * summary_large_image`, promising a large image and supplying none, which
 * degrades to a bare or dropped card. Every other public route had one.
 *
 * Its own card rather than a copy of the root one, because this is the link
 * most worth unfurling well: the gallery is the curated shop-window for the
 * recipe moat, and a share of it should say what it is instead of repeating
 * the homepage wordmark. (`/opengraph-image` is not addressable as a plain
 * path either — Next serves only the content-hashed URL — so pointing
 * `openGraph.images` at the root card was never an option.)
 *
 * Deliberately static and edge-rendered: no DB read, no remote fonts, no
 * network. A crawler's unfurl must not depend on a query, and a card built
 * from live recipes would change under the same URL and could time out or
 * come back empty. Mirrors the root card's CRT ground so the two read as one
 * family.
 *
 * `twitter-image.tsx` beside this file is unnecessary — Next merges an
 * `opengraph-image` into `twitter:image` when no twitter-specific image
 * exists, which is exactly what `/r/[slug]` already relies on.
 */
export const runtime = "edge";

export const alt =
  "The Mini Mainframe — Recipe Gallery: paint recipes shared by the community.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const CYAN = "#00d2ff";
const BG = "#06080a";
const FG_DIM = "#b6c6cc";
const MONO_STACK =
  "ui-monospace, 'Cascadia Mono', 'Segoe UI Mono', 'DejaVu Sans Mono', Menlo, Consolas, monospace";

export default function GalleryOpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: BG,
          backgroundImage:
            "radial-gradient(120% 120% at 50% 38%, rgba(0,210,255,0.16) 0%, rgba(0,210,255,0.04) 32%, rgba(6,8,10,0) 62%)",
          fontFamily: MONO_STACK,
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 56,
            left: 80,
            right: 80,
            height: 2,
            backgroundColor: "rgba(0,210,255,0.35)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 44,
            left: 80,
            fontSize: 26,
            letterSpacing: 6,
            color: FG_DIM,
            textTransform: "uppercase",
          }}
        >
          mini-mainframe.com/gallery
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 112,
            fontWeight: 700,
            letterSpacing: 4,
            color: CYAN,
            textAlign: "center",
            lineHeight: 1.04,
            padding: "0 60px",
            textShadow:
              "0 0 18px rgba(0,210,255,0.55), 0 0 42px rgba(0,210,255,0.30)",
          }}
        >
          RECIPE GALLERY
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 38,
            fontSize: 38,
            letterSpacing: 1,
            color: FG_DIM,
            textAlign: "center",
            padding: "0 80px",
          }}
        >
          Paint recipes shared by the community.
        </div>

        <div
          style={{
            position: "absolute",
            bottom: 56,
            left: 80,
            right: 80,
            height: 2,
            backgroundColor: "rgba(0,210,255,0.18)",
          }}
        />
      </div>
    ),
    { ...size },
  );
}
