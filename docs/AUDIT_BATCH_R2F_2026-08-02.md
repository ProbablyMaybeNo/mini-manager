# Audit batch — round 2f, 2026-08-02

One item: error reporting is configured to collect more than it needs, on an app
that POSTs plaintext credentials.

Evidence: `ux-audit/round2-2026-08-02/REPORT.md`.

**Rules for this batch**
- You are on branch `fix/audit-batch-r2-2026-08-02`, which already holds
  twenty-one round-2 fixes. Stay on it. **Never push or merge to `main`.**
- Before the commit: `npm run typecheck` (0 errors), `npm run lint` (0 errors;
  51 pre-existing warnings are fine), `npm run test:unit`,
  `npm run test:integration`. Baselines: **829 unit**, **533 integration + 1
  skipped**.
- Do NOT touch `public/data/paints.json` or `public/brand/`.
- No new dependencies.

---

- [x] **R2-21 · P2 · Sentry collects HTTP request bodies by default — including the sign-in POST**
  `sentry.server.config.ts` and `sentry.edge.config.ts` both leave the scaffold's
  `dataCollection` block entirely commented out:

  ```js
  dataCollection: {
    // userInfo: false,
    // httpBodies: [],
  },
  ```

  Defaults read from the **installed SDK's own type definitions**
  (`@sentry/nextjs` 10.65.0 → `@sentry/core/build/types/types/datacollection.d.ts`),
  not inferred:

  | option | default | assessment |
  |---|---|---|
  | `userInfo` | `false` | already fine |
  | `cookies` | `true`, but *"sensitive values like keys and tokens are **always** filtered out"* | **session token safe** |
  | `httpHeaders` | `{request: true, response: true}` | same filtering |
  | `queryParams` | `true` | same filtering |
  | **`httpBodies`** | **all four targets** | **the gap** |
  | `genAI` | `{inputs: true, outputs: true}` | records user recipe prompts |
  | local variables in stack frames | `true` | a `password` local in a throwing frame |

  **The scope, precisely.** The always-filtered guarantee attaches to
  `CollectBehavior` — the key-value surfaces. It is **not** stated for bodies.
  This app POSTs plaintext credentials to sign-in and sign-up, and errors on that
  path are realistic: R2-14 fixed unguarded awaits on `signInAction` /
  `signUpAction` that threw on any network blip.

  **Fix:** uncomment what the scaffold already provides — `httpBodies: []` at
  minimum, in **both** config files. Strongly consider `genAI: { inputs: false }`
  too: recipe prompts are user content going to a third party for no diagnostic
  benefit. If the SDK supports disabling local-variable capture, weigh it —
  it is genuinely useful for debugging, so this one is a judgement call, not an
  obvious win. Say which way you went and why.

  **Do NOT** rely on Sentry's server-side scrubbers as the fix. They likely do
  strip `password`-like fields today, but that is a dashboard setting outside
  this repo — scrubbing at the source does not depend on it staying right.

  **Verify:** a deliberate throw inside a route that received a POST body
  produces a Sentry event with **no** request body attached. If that cannot be
  exercised without spending quota, a unit/config assertion that both files set
  `httpBodies: []` is an acceptable substitute — say which you did.

  **Shipped** — commit `dccddb9`. Three corrections to the above, each of which
  changes what the next sweep should look for:

  1. **The empty block was the opt-in, not a neutral no-op.** `@sentry/core`
     branches on whether the `dataCollection` KEY is present, not on what it
     contains: `options.dataCollection != null ? DEFAULTS : defaultPiiTo
     CollectionOptions(options.sendDefaultPii)`. Since `{} != null`, the
     scaffold's commented-out block was strictly *worse* than no block at all.
     Resolved empirically against the installed 10.65.0 — `dataCollection`
     absent gives `httpBodies: []`, `genAI` both off, `userInfo: false`;
     `dataCollection: {}` gives all four body targets, `genAI` both on,
     `userInfo: true`. So "uncomment `httpBodies: []`" alone would have left
     userInfo/cookies/queryParams resolving *more* permissively than deleting
     the block. All fields are now explicit.
  2. **The `userInfo` row is wrong.** `false` is what the SDK's JSDoc says and
     it holds only on the no-block branch; on the branch this repo took it
     resolved `true`, so `user.*` auto-population was on. Not "already fine".
  3. **Three files, not two.** Correct that no `sentry.client.config.ts`
     exists — the browser init is `src/instrumentation-client.ts`, and it had
     the identical gap. Arguably the load-bearing one, since the sign-in POST
     originates in the browser. All three blocks are now byte-identical and a
     test asserts that so they cannot drift.

  Judgement calls: `genAI: { inputs: false }` taken (recipe commands,
  paint-scan photos, moderation payloads — user content, no diagnostic value)
  with `outputs` left ON, because malformed model JSON is a real failure mode
  here. `stackFrameVariables` deliberately **not** set, against the lean above:
  the password-local concern is real and confirmed in `signInAction` /
  `signUpAction`, but in 10.65.0 nothing reads the resolved value — capture is
  gated on the separate `includeLocalVariables` option, which is unset, so
  capture is already off and setting it would be a placebo. A test guards
  `includeLocalVariables` instead.

  Not done: `cookies` / `httpHeaders` / `queryParams` left at the SDK's
  filtered defaults rather than hand-copying its internal PII denylist into
  three files (drift risk, no credential benefit). No live event fired —
  verified by config assertion that survives comment-stripping, plus a replay
  of the three shipped blocks through the SDK's own resolver.

---

## Out of scope — needs Ross, do NOT action

- **R2-17 · MOP-004 inspector history** — `window.history.pushState` fighting
  Next's patched version; yanks the user back to `/dashboard` and leaves a stale
  entry per inspector open. Real, but fixing it changes shipped behaviour on a
  deliberate UX decision.
- **`public/brand/logo.png`** and **`mini-mainframe-logo-poster.jpg`**, both now
  unreferenced by `src/`.
- **R2-8 Sentry CSP reporting** — a spend decision.
- **`useInstallPrompt.promptInstall`** — a stuck-flag-shaped await around a
  browser API; fixing it means deciding what a failed install prompt should show.
- **R2-3** army-list nesting, **R2-4** retailer list, **R2-5** real-device
  camera, the failed-CI catalog commits on `main`.
- **Accessibility of the signed-in app** — public pages verified clean in a real
  browser; the interior needs credentials and its own scoped run.
