"use client";

import "./globals.css";

/**
 * UX-001 — themed global error boundary.
 *
 * `global-error.tsx` catches errors thrown in the root layout itself and
 * REPLACES the entire document (it must render its own <html>/<body> —
 * the root layout is gone at this point). Next's default fallback paints a
 * bare white page, which is the same #FFFFFF flash inside a pure-black
 * terminal app that UX-001 kills on the 404 path.
 *
 * We render the terminal shell ourselves: an inline #0A0A0A ground +
 * phosphor text set on the <body> guarantees there is NO white flash even
 * in the worst case where the stylesheet hasn't applied yet (this boundary
 * runs when the app is already broken). globals.css is imported too so the
 * `.btn` / token classes resolve when available.
 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0A0A0A",
          color: "#f5f5f5",
          fontFamily:
            '"IBM Plex Mono", ui-monospace, SFMono-Regular, Consolas, monospace',
          padding: "24px",
        }}
      >
        <div style={{ width: "100%", maxWidth: "28rem", textAlign: "center" }}>
          <p
            style={{
              fontSize: "0.6875rem",
              textTransform: "uppercase",
              letterSpacing: "0.25em",
              color: "#FF4244",
              margin: "0 0 1rem",
            }}
          >
            SYS ▸ FATAL / 500
          </p>
          <p
            aria-hidden
            style={{
              fontSize: "2.75rem",
              color: "#00D2FF",
              textShadow: "0 0 8px rgba(0,210,255,0.55)",
              margin: "0 0 1rem",
            }}
          >
            500
          </p>
          <h1 style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
            Something went wrong
          </h1>
          <p
            style={{
              fontSize: "0.875rem",
              color: "#cfcfcf",
              lineHeight: 1.6,
              margin: "0 0 1.5rem",
            }}
          >
            The terminal hit an unrecoverable error. Reload to reconnect, or
            return to the dashboard.
          </p>
          <div
            style={{
              display: "flex",
              gap: "0.5rem",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={() => reset()}
              style={{
                fontFamily: "inherit",
                fontSize: "0.875rem",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                color: "#0A0A0A",
                background: "#00D2FF",
                border: "1px solid #00D2FF",
                borderRadius: 2,
                padding: "8px 16px",
                minHeight: 36,
                cursor: "pointer",
              }}
            >
              RELOAD
            </button>
            <a
              href="/projects"
              style={{
                fontFamily: "inherit",
                fontSize: "0.875rem",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                color: "#00D2FF",
                background: "transparent",
                border: "1px solid #00D2FF",
                borderRadius: 2,
                padding: "8px 16px",
                minHeight: 36,
                display: "inline-flex",
                alignItems: "center",
                textDecoration: "none",
              }}
            >
              RETURN TO DASHBOARD
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
