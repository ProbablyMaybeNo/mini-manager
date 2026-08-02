# Audit batch — round 2, 2026-08-02

Findings from the second full-app audit, run against the code deployed in
`84663fd`. Evidence, measurements and screenshots:
`ux-audit/round2-2026-08-02/REPORT.md`.

**Rules for this batch**
- Work on branch `fix/audit-batch-r2-2026-08-02`. **Never push or merge to
  `main`.** Ross reviews before anything deploys.
- Commit per item, referencing its id (R2-1 … R2-5).
- Before EVERY commit: `npm run typecheck` (0 errors), `npm run lint`
  (0 errors; ~51 pre-existing warnings are fine), `npm run test:unit`,
  `npm run test:integration`. Baselines: **777 unit**, **510 integration + 1
  skipped**. Fix causes, never delete or skip a test to go green.
- Do NOT touch `public/data/paints.json`.
- No new dependencies. Match neighbouring file conventions.
- If an item needs a product decision you can't make from this file: skip it,
  leave the box unchecked, and say why. Do not guess.

---

- [x] **R2-6 · P1 · The public share page overflows horizontally on a phone**
  `/r/<slug>` at 375px forces `window.innerWidth` and `document.scrollWidth` to
  **487** — the layout viewport is dragged 30% wider than the device, so the
  browser zooms out and the page scrolls sideways. Uncontained offenders:
  `div.flex w=471 right=487` and `button.shrink-0 w=88 right=474` — the
  ShareLinkBar's URL text plus its COPY button.
  This is the surface a stranger lands on from a shared recipe link, and page-level
  horizontal scroll is against this project's own rule.
  **Fix:** let the URL truncate (it already has `min-w-0`; it needs the flex row
  to actually constrain) or wrap the copy button below it under `sm`. Verify with
  `document.body.scrollWidth === 375` at a 375×812 viewport.

- [x] **R2-5 · P1 · The live camera sampler cannot work — our own header blocks it**
  Every response sends `Permissions-Policy: camera=(), microphone=(),
  geolocation=(), browsing-topics=()` (verified on production). `camera=()` is an
  **empty allowlist — the camera is denied to every origin including this site**.
  `src/components/tools/CameraSampler.tsx` calls
  `navigator.mediaDevices.getUserMedia({ video: … })` for the Eyedropper's live
  sampling, so it can never succeed. Two aggravating factors:
  - The feature-detect only checks that `getUserMedia` *exists* (it does), so the
    **USE CAMERA button is shown** as if available.
  - The rejection is a `NotAllowedError`, so the user is told *"Camera permission
    denied"* and will hunt through browser settings for a permission they never
    denied.
  **Fix:** `camera=(self)` in `next.config.ts` (keep third parties denied). If
  live camera sampling is not wanted, delete the button and the component rather
  than shipping a control that cannot work. Verify by loading `/tools/dropper`
  and confirming the camera stream starts.

- [x] **R2-4 · P1 · Auto-populate fails silently on every retailer it advertises**
  The scraper itself works: pasting `https://example.com/` creates a row with
  `title="Example Domain"`, `vendor="example.com"`. But every advertised
  retailer produces **no row and no message**, after 5–9 seconds of waiting:

  | pasted URL | row created | user told anything |
  |---|---|---|
  | `example.com` | yes | — |
  | Games Workshop | **no** | **no** |
  | Element Games | **no** | **no** |
  | Amazon | **no** | **no** |

  The panel promises *"Auto-fills from: Games Workshop, Element Games, … Amazon,
  eBay"* and separately *"Other links still add a row"* — the second promise is
  also broken for these hosts (they get nothing at all, while example.com got a
  row). Most likely those sites block server-side fetches; that is an external
  constraint, but the silent failure is ours.
  **Fix:** surface the failure ("couldn't read that page — add the details
  yourself"), keep the pasted URL on the created row so the work is not lost, and
  make the fallback dialog match the paste-bar mode (a model URL currently opens
  ADD **PAINT**). Consider narrowing the advertised retailer list to hosts that
  actually work.

- [x] **R2-2 · P1 · A failed save destroys the whole app and the user's edit**
  Renaming a project while offline replaces the **entire application** with the
  global fault screen ("SOMETHING BROKE"), not an inline message. The typed value
  is lost — after reconnecting and reloading, the rename had not persisted.
  Reproduce: open a project inspector → go offline → edit NAME → blur.
  This is a *transient* failure (a phone losing signal for two seconds) and this
  app is used on mobile at a painting desk.
  **Fix:** a failed mutation should show an inline, retryable error that keeps
  the typed value and leaves the rest of the app usable. Reserve the whole-app
  error boundary for unrecoverable render faults, not failed fetches.

- [x] **R2-1 · P2 · Clipboard writes are fire-and-forget: false "copied" toasts**
  Five sites call `void navigator.clipboard?.writeText(...)`. `void` discards the
  promise, so a rejection is never handled — observed live as an uncaught
  `NotAllowedError`, and reproduced independently by the click crawl on both
  `/recipes` SHARE LINK and `/tools/match` USE.

  | site | on failure |
  |---|---|
  | `src/app/(app)/tools/match/page.tsx:38` | toasts **"Copied {name} · {hex}"** — hex is nowhere else on screen. **Worst: claims success, user loses the value** |
  | `src/app/(app)/library/LibraryClient.tsx:207` | silent, no feedback either way |
  | `src/components/recipe/RecipeWorkbench.tsx:169` | toasts "copied" but also reveals the URL — mitigated |
  | `src/app/(app)/recipes/[id]/RecipeEditorClient.tsx:185` | same — mitigated |

  `src/components/public/ShareLinkBar.tsx:21` is already correct (`await` in
  `try/catch`, value visible regardless) — **use it as the template**.
  **Fix:** `.catch()` every clipboard write; only toast success on resolve; on
  failure surface the value so it can be copied by hand.

---

## Status — all five shipped on `fix/audit-batch-r2-2026-08-02`, 2026-08-02

One commit per item, each measured before/after against a running build.
Branch is NOT merged: Ross reviews first.

**Left for Ross — deliberately not decided here:**

- **R2-4, narrowing the advertised retailer list.** A product call about what
  the panel promises. The error surfacing shipped; the copy did not.
- **R2-5, whether a real camera works.** `camera=(self)` is proven to let
  `getUserMedia` resolve (Chromium fake device, video track acquired) and the
  `Permissions policy violation` is gone. A genuine phone camera still needs
  30 seconds of Ross's thumb.

**Two audit readings corrected by measurement, both under R2-4:** the failure
was already reported (a ~2.4s toast, easy to miss — now also stated
persistently in the dialog), and the fallback dialog already matched the
paste-bar mode (Paint→"Add paint", Model→"Add model"). The confirmed loss was
the pasted URL, which is what got fixed.

**Known bug class NOT fixed (R2-2):** the same unguarded `await` inside a
transition that crashed the app exists in `/projects/[id]` EditableDetails,
CollectionClient and the recipe editors. R2-2 fixed the inspector panel, where
it was reproduced. The rest wants its own pass.

---

## Out of scope / do not action

- **R2-3 — army-list import nesting.** DB rows suggest `"10x Intercessors"` was
  created as a root-level **Army** rather than a Unit under one, which
  contradicts the panel's "an Army with a project per unit". **Not reproduced**
  under controlled conditions; the rows predate the test. Needs a 30-second
  manual check from Ross before anyone changes parser behaviour.
- The failed-CI catalog commits on `main` — Ross's call.

## Verified working — do not "fix"

Paint scanner (reads labels, matches catalog); Send-to-Recipe; share-as-card
composer; sign-up end to end; tutorial; dialog keyboard handling (role,
aria-modal, focus trap, Esc, focus restore) on the Library FILTER and recipe slot
pickers; auth and admin gating; `/user` billing 503 (env-only, handled with a
clear message).

**Also do not "fix":** `/library` LIST at 375px reports a wide element, but the
page body does not scroll horizontally — the table scrolls inside its own
container, which is the correct pattern. That was a flaw in the audit's overflow
detector, not a defect.
