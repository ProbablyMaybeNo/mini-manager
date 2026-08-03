# Audit batch — round 2g, 2026-08-02

One item, and it is the reason the rest of this round existed.

Evidence: `ux-audit/round2-2026-08-02/REPORT.md`.

**Rules for this batch**
- You are on branch `fix/audit-batch-r2-2026-08-02`, which already holds
  twenty-two round-2 fixes. Stay on it. **Never push or merge to `main`.**
- Before the commit: `npm run typecheck` (0 errors), `npm run lint` (0 errors;
  51 pre-existing warnings are fine), `npm run test:unit`,
  `npm run test:integration`. Baselines: **843 unit**, **533 integration + 1
  skipped**.
- Do NOT touch `public/data/paints.json` or `public/brand/`.
- No new dependencies.

---

- [x] **R2-23 · P2 · Route-level crashes are never reported to Sentry**
  `Sentry.captureException` appears in **exactly one place** in `src/`:
  `src/app/global-error.tsx:18`. There is no `reactErrorHandler`, no
  `onCaughtError`, and **no capture in `src/app/error.tsx`** — which does not
  even bind `error`, destructuring only `{ reset }`.

  `global-error.tsx` fires only when the **root layout** crashes: rare and
  catastrophic. Every *route-level* error is caught by `src/app/error.tsx`,
  renders "SOMETHING BROKE", and **emits no Sentry event**.

  Verified against the installed SDK, not assumed: App Router `error.tsx`
  boundaries do **not** auto-report. `captureUnderscoreErrorException` is for
  the Pages Router's `_error`; `reactErrorHandler` is an **opt-in** helper for
  React 19's `onCaughtError`. Neither is wired in this app.

  **Why this matters more than its severity suggests.** R2-2, R2-9, R2-10 and
  R2-14 were all one class — 32+ `await`ed server actions inside transitions
  whose **rejections** escape into `src/app/error.tsx`. Every one of those
  crashes replaced the app with the fault screen for a real user **and produced
  zero monitoring signal.** That is why they accumulated to 32 unnoticed. This
  is the blind spot that hid the rest of the round's findings.

  **Fix:** bind `error` and capture it, mirroring what `global-error.tsx`
  already does:
  ```tsx
  useEffect(() => { Sentry.captureException(error); }, [error]);
  ```
  Consider also wiring `Sentry.reactErrorHandler` into the client root for
  component errors React hands to boundaries — your call, and say which way you
  went.

  **Respect R2-21's work.** `dataCollection` was just locked down in all three
  runtimes (`httpBodies: []`, `userInfo: false`, `genAI.inputs: false`). Do not
  loosen any of it to make error capture richer, and do not add a `beforeSend`
  that re-introduces request bodies.

  **Verify:** a route-level throw produces a Sentry event. If exercising that
  live would spend the free-tier quota `tracesSampleRate: 0` exists to protect,
  a unit test asserting `error.tsx` calls `captureException` — mirroring the
  existing `global-error` coverage — is an acceptable substitute. Say which you
  did.

  **Shipped** — `c26fbcc`. Claim confirmed against the installed 10.65.0 on
  four independent points (wrapping-loader regex excludes `error`;
  `captureUnderscoreErrorException` is Pages Router; `reactErrorHandler` is
  absent from the SDK's own source and reachable only via the `@sentry/react`
  star re-export; the SDK's build warns when `global-error` is missing, i.e.
  it expects a hand-written capture).

  **Two corrections to this entry.**

  1. *The file was suppressing the report, not merely omitting it.* In Next.js
     16.2.10 an error reaching the BUILT-IN boundary goes `onUncaughtError` ->
     `reportGlobalError` -> `reportError()`, raising a window error event that
     Sentry's default `globalHandlersIntegration` does capture. An explicit
     `error.tsx` diverts it to `onCaughtError`, whose production branch is a
     bare `console.error` — and captureConsole is not a default integration.
     So this file was strictly worse for monitoring than not existing. The
     entry reads as a gap; it was an active regression.
  2. *There is no "existing `global-error` coverage" to mirror.* No test
     referenced that file. Its capture was equally unguarded, so the new test
     covers both boundaries.

  **`reactErrorHandler` not wired**, deliberately: it is passed to
  `hydrateRoot`'s `onCaughtError`, and the App Router owns that call — there is
  no `hydrateRoot`/`createRoot` in `src/` to attach it to. Wiring it would mean
  a fake root or a double-report of what the boundary now captures.

  **Verified by unit test, not a live throw** (quota). Both boundaries are
  called as plain functions with `useEffect` swapped for a synchronous call;
  the effect runs inline, no DOM, no event emitted. The test was confirmed
  able to fail by reverting the capture to `void error`.

  R2-21 untouched: no `beforeSend`, no `dataCollection` edit, no
  `sendDefaultPii`.

---

## Out of scope — needs Ross, do NOT action

- **R2-17 · MOP-004 inspector history.** Three options are laid out in the
  report (fix properly via the router / remove the integration / leave it).
  A UX ruling, not a bug fix.
- **R2-8 Sentry CSP reporting** — a spend decision; the report now describes the
  actual shape of the risk (near-zero app violations; browser-extension noise is
  the real volume, cappable with a per-key rate limit).
- **R2-4 retailer list** — the report now carries live reachability data for all
  8 advertised stores. Games Workshop returns **403**. Narrowing the advertised
  list is still a product call.
- **`public/brand/logo.png`** and **`mini-mainframe-logo-poster.jpg`**, both
  unreferenced by `src/`.
- **`useInstallPrompt.promptInstall`** — a stuck-flag-shaped await around a
  browser API; fixing it means deciding what a failed install prompt shows.
- **R2-5** real-device camera, and **accessibility of the signed-in app** —
  both need hardware/credentials the audit does not have.
