import { beforeEach, describe, expect, test, vi } from "vitest";

/**
 * R2-23 — every error boundary in the app must report to Sentry.
 *
 * Nothing reports these for us, verified against @sentry/nextjs 10.65.0 rather
 * than assumed:
 *
 *   - The build-time wrapping loader only matches
 *     `page|layout|loading|head|not-found` (config/webpack.js). Neither
 *     `error.tsx` nor `global-error.tsx` is ever auto-wrapped.
 *   - `captureUnderscoreErrorException` is Pages Router only — it lives in
 *     common/pages-router-instrumentation/_error.js and reports the mechanism
 *     `_error.getInitialProps`.
 *   - `reactErrorHandler` is opt-in (reachable only via the `export * from
 *     "@sentry/react"` star re-export) and has no attachment point here: the
 *     App Router owns the `hydrateRoot` call, so there is no `onCaughtError`
 *     to pass it to.
 *
 * Defining `error.tsx` at all makes this capture load-bearing rather than
 * belt-and-braces. Next.js routes errors that reach its BUILT-IN boundary to
 * `onUncaughtError` -> `reportGlobalError` -> `reportError()`, which raises a
 * window error event that Sentry's default globalHandlers integration picks
 * up. An explicit boundary diverts them to `onCaughtError`, which in
 * production is a bare `console.error` — and captureConsole is not one of the
 * browser SDK's default integrations. So a custom `error.tsx` without the
 * capture below is strictly worse for monitoring than having no file at all,
 * which is how 32+ unguarded-await crashes accumulated unseen.
 *
 * These call the boundaries as plain functions with `useEffect` swapped for a
 * synchronous call, so the mount effect runs inline. That proves the capture
 * without a DOM and, deliberately, without emitting a live event — the
 * free-tier error quota that `tracesSampleRate: 0` exists to protect stays
 * unspent.
 */

const captureException = vi.fn();

vi.mock("@sentry/nextjs", () => ({ captureException }));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useEffect: (effect: () => void) => effect() };
});

// Imported AFTER the mocks are registered.
const { default: RouteError } = await import("@/app/error");
const { default: GlobalError } = await import("@/app/global-error");

type Boundary = (props: {
  error: Error & { digest?: string };
  reset: () => void;
}) => unknown;

const BOUNDARIES: ReadonlyArray<readonly [string, Boundary]> = [
  ["src/app/error.tsx (route-level)", RouteError],
  ["src/app/global-error.tsx (root layout)", GlobalError],
];

beforeEach(() => {
  captureException.mockReset();
});

describe("R2-23 error boundaries report to Sentry", () => {
  test.each(BOUNDARIES)("%s captures the error it renders", (_name, Boundary) => {
    const error = Object.assign(new Error("boom"), { digest: "abc123" });

    Boundary({ error, reset: () => {} });

    // The original defect was subtler than "forgot to call captureException":
    // `error.tsx` destructured only `{ reset }`, so the error was never even
    // bound. Asserting on the identity of the argument catches a regression to
    // either shape.
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException.mock.calls[0]?.[0]).toBe(error);
  });
});

/**
 * R3-1 — the same server crash also fires `onRequestError` ->
 * `Sentry.captureRequestError`, so it lands in Sentry twice: a full server
 * event and this client one, which production redacts to a fixed placeholder
 * message. `error.digest` is the only surviving link between them (Next.js
 * stamps it on the error before calling `onRequestError`), so it goes on as a
 * tag — searchable as `digest:<value>` — and into the fingerprint, without
 * which every server crash collapses into ONE client issue, since they all
 * carry the identical redacted message.
 *
 * Tag only. R2-21's `dataCollection` lockdown stays exactly as it is: nothing
 * here enriches the payload, and a digest is a hash of message + stack.
 */
describe("R3-1 boundaries tag the digest so the pair correlates", () => {
  test.each(BOUNDARIES)("%s attaches the digest when present", (_name, Boundary) => {
    const error = Object.assign(new Error("boom"), { digest: "1573929571" });

    Boundary({ error, reset: () => {} });

    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException.mock.calls[0]?.[1]).toEqual({
      tags: { digest: "1573929571" },
      fingerprint: ["{{ default }}", "1573929571"],
    });
  });

  test.each(BOUNDARIES)(
    "%s still reports, and does not throw, without a digest",
    (_name, Boundary) => {
      // A crash originating in a client component never gets a digest. It has
      // no server half to correlate with, so it must keep Sentry's default
      // grouping rather than being fingerprinted on `undefined`.
      const error = new Error("client-side boom");

      expect(() => Boundary({ error, reset: () => {} })).not.toThrow();

      expect(captureException).toHaveBeenCalledTimes(1);
      expect(captureException.mock.calls[0]?.[0]).toBe(error);
      expect(captureException.mock.calls[0]?.[1]).toBeUndefined();
    },
  );
});
