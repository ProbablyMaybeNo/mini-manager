"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/** Last-resort boundary — replaces the ROOT layout on a render crash, so it
 *  must ship its own <html>/<body>. Inline styles (globals.css isn't applied
 *  here) keep it on-brand: black ground, cyan phosphor. Reports the crash to
 *  Sentry before rendering the fallback. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          background: "#000000",
          color: "#b6c6cc",
          fontFamily: "monospace",
          textAlign: "center",
          padding: "1.5rem",
        }}
      >
        <p style={{ letterSpacing: "0.25em", color: "#ff4242", fontSize: 12 }}>
          SYS ▸ FATAL
        </p>
        <h1 style={{ color: "#00d2ff", fontSize: 22 }}>SYSTEM HALTED</h1>
        <p style={{ maxWidth: 360, fontSize: 14 }}>
          The application failed to start. Reloading usually clears it.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            border: "1px solid #00d2ff",
            background: "rgba(0,210,255,0.15)",
            color: "#00d2ff",
            padding: "0.5rem 1.25rem",
            fontFamily: "monospace",
            textTransform: "uppercase",
            letterSpacing: "0.15em",
            cursor: "pointer",
          }}
        >
          ▸ Reload
        </button>
      </body>
    </html>
  );
}
