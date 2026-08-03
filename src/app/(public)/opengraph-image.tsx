import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt =
  "The Mini Mainframe — Plan your projects. Track your paints. Manage your minis.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Brand tokens (mirrors src/app/globals.css). Deterministic build: no remote
// web fonts — we render with a built-in monospace system stack so the OG route
// never reaches out to the network at build time.
const CYAN = "#00d2ff";
const BG = "#06080a";
const FG_DIM = "#b6c6cc";
const MONO_STACK =
  "ui-monospace, 'Cascadia Mono', 'Segoe UI Mono', 'DejaVu Sans Mono', Menlo, Consolas, monospace";

export default function OpengraphImage() {
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
          // CRT-style radial vignette + faint cyan glow from the centre
          backgroundImage:
            "radial-gradient(120% 120% at 50% 38%, rgba(0,210,255,0.16) 0%, rgba(0,210,255,0.04) 32%, rgba(6,8,10,0) 62%)",
          fontFamily: MONO_STACK,
          position: "relative",
        }}
      >
        {/* Top scanline-ish accent rule */}
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
          mini-mainframe.com
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
          THE MINI MAINFRAME
        </div>

        {/* O-4 — the tagline used to be one string that wrapped on its own and
            left "minis." alone on a second line, on the card for every
            homepage link. Broken explicitly instead of retuned: this renders
            through Satori against a SYSTEM font stack, so the glyph metrics
            differ between this machine and the edge runtime that actually
            serves it. Any fix that depends on measuring — a wider container, a
            smaller size — is only correct for the font it was measured
            against, and would re-orphan silently somewhere else. A hard break
            is the same on every box, and reads better anyway: one line per
            pair of promises rather than a ragged 5-word overhang. */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginTop: 38,
            fontSize: 38,
            letterSpacing: 1,
            lineHeight: 1.34,
            color: FG_DIM,
            textAlign: "center",
            padding: "0 80px",
          }}
        >
          <div style={{ display: "flex" }}>Plan your projects. Track your paints.</div>
          <div style={{ display: "flex" }}>Manage your minis.</div>
        </div>

        {/* Bottom accent rule */}
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
