"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/** Themed route-level error boundary (keeps the terminal aesthetic on a crash).
 *
 *  R2-23 — this capture is not redundant with anything the SDK does. Nothing
 *  auto-reports here: @sentry/nextjs only build-time wraps
 *  page|layout|loading|head|not-found, `captureUnderscoreErrorException` is
 *  Pages Router, and `reactErrorHandler` is opt-in with no root render call to
 *  attach it to in the App Router.
 *
 *  Worse, defining this file SUPPRESSES the one path that did report. Next.js
 *  routes errors hitting its BUILT-IN boundary to `onUncaughtError` ->
 *  `reportError()`, which Sentry's default globalHandlers integration catches.
 *  An explicit boundary like this one takes the `onCaughtError` path instead,
 *  which in production is a bare `console.error` — and captureConsole is not a
 *  default integration. So without the line below, every route-level crash is
 *  silent. */
export default function Error({
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
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="label-osd tracking-[0.18em] text-red-text">FAULT</p>
      <h1 className="font-mono text-[clamp(2rem,8vw,3rem)] font-extrabold uppercase leading-none tracking-tight text-red">
        SOMETHING BROKE
      </h1>
      <span aria-hidden className="block h-1 w-12 rounded-full bg-red" />
      <p className="max-w-sm font-body text-body text-fg-dim">
        An unexpected error interrupted the session. Try again — if it persists,
        reload the page.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-2 inline-flex items-center gap-2 rounded-[6px] border border-cyan bg-cyan px-5 py-2.5 font-display text-button font-bold uppercase tracking-tight text-bg transition-[background-color] duration-150 hover:bg-cyan/85 focus-visible:outline-2 motion-safe:active:scale-[0.98]"
      >
        ▸ Retry
      </button>
    </main>
  );
}
