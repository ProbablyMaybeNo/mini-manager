# Audit batch — round 2c, 2026-08-02

Four items found after batch 2b was dispatched: one P1 defect the previous
builder's own fix did not reach, one flaky E2E test it surfaced and proved
pre-existing, and the two page-weight optimizations from the payload pass.

Evidence: `ux-audit/round2-2026-08-02/REPORT.md`.

**Rules for this batch**
- You are on branch `fix/audit-batch-r2-2026-08-02`, which already holds the
  eight round-2 fixes. Stay on it. **Never push or merge to `main`.**
- Commit per item, referencing its id (R2-10, R2-11, O-2, O-3).
- Before EVERY commit: `npm run typecheck` (0 errors), `npm run lint` (0 errors;
  51 pre-existing warnings are fine), `npm run test:unit`,
  `npm run test:integration`. Baselines: **803 unit**, **510 integration + 1
  skipped**. Fix causes, never skip a test to go green.
- Do NOT touch `public/data/paints.json`.
- No new dependencies. Match neighbouring file conventions.
- If an item needs a product decision, skip it, leave the box unchecked, say why.

---

- [x] **R2-10 · P1 · The crash-on-failed-save pattern survives on BOTH password-reset pages**
  R2-9 fixed four clients and introduced `src/lib/actionGuard.ts`. It did not
  reach the two `(public)` reset pages, which have the identical shape —
  an `await`ed server action inside `startTransition` with **no try/catch**:

  | file | awaited action | try-blocks |
  |---|---|---|
  | `src/app/(public)/reset/page.tsx:41` | `requestPasswordReset` | **0** |
  | `src/app/(public)/sign-in/reset/page.tsx:39` | `applyPasswordReset` | **0** |

  `src/app/error.tsx` is the **root** boundary, so it covers `(public)` too — a
  rejection replaces the whole app with the fault screen, exactly as R2-2
  reproduced. Both pages verified live (HTTP 200).

  This is the worst surface for it to happen on: the user is **already locked
  out of their account**. On `/sign-in/reset` the token is single-use, so a
  crash mid-submit can leave them unsure whether the reset applied, with a
  possibly-spent token and no message.
  **Fix:** apply the existing `guarded()` helper to both. `applyPasswordReset`
  already handles `!res.ok` — it is only the *rejection* path that escapes.
  **Also:** both discard the pending flag (`const [, startTransition]`), so
  neither button shows in-flight state and neither is disabled while submitting
  — a double-submit on a single-use token fails the second attempt with an
  invalid-token error after the first succeeded. Wire up `isPending`, disable
  the submit button while in flight.
  **Verify:** Playwright `context.setOffline(true)` on both pages — assert the
  fault screen does NOT render, the form stays mounted, an inline message
  appears, and (on `/reset`) the typed username survives.

- [x] **R2-11 · P2 · `qa_project_recipe` M12.2 fails under full-suite parallel load**
  E2E on this branch: 24 passed, 4 skipped, **1 failed**. The previous builder
  did the right thing and proved it pre-existing — it checked all six of its
  changed files back out to `71101f2` and re-ran the same suite against the same
  dev server, getting an identical result. So this is NOT a regression from the
  round-2 work; it is a flaky test that predates it and lives on `main`.
  It **passes in isolation** and fails only under parallel load, which points at
  shared state or a race in the `openProjectPage` helper rather than at the
  application.
  **Fix:** diagnose the race — most likely the helper proceeds before the page
  is interactive, or two workers contend for the same seeded project. Make the
  helper wait on a real readiness signal, or isolate the fixture per worker.
  Do NOT mark it skipped or serial-only to go green; that hides it.
  **Verify:** the full `chromium` + `chromium-mobile` suite passes repeatedly
  (at least 3 consecutive full runs) with no `--workers=1` crutch.

- [x] **O-3 · P1 · The landing page ships a 2.09MB video for a 327px logo**
  Measured on production. `/` transfers **2,849KB total, of which 2,143KB is
  `mini-mainframe-logo.mp4`** — every other public route is 11–80KB:

  | route | transfer |
  |---|---|
  | `/` | **2,849KB** |
  | `/gallery` | 80KB |
  | `/pricing` | 40KB |
  | `/sign-in` | 19KB |
  | `/r/<slug>` | 16KB |
  | `/sign-up` | 11KB |

  `ffprobe`: h264, **1080×1080, 25.1s, 754 frames** — displayed at **327×327**
  on a phone. It is `autoPlay muted loop playsInline`, so it downloads in full
  on first paint, before anything a visitor came for. This is the **first page
  every new visitor sees**, and the one Ross is driving distribution traffic to.
  `ffmpeg 7.1.1` is available on this machine.
  **Fix (in preference order, do as many as hold up):**
  1. Re-encode. 1080×1080 is ~3.3× the largest rendered size. Encode at
     540×540 (still 2× for retina at 327px) with a modern CRF, and add a
     WebM/VP9 or AV1 `<source>` ahead of the mp4 so browsers pick the smaller.
  2. Do not autoload it on small screens — the reduced-motion branch already
     renders the poster via `next/image`; reuse that path under a width
     condition so phones never fetch the video at all.
  Target: **under 300KB** for the mp4. Keep the animation visually intact at
  327×327 and at desktop size — compare frames before/after, do not just trust
  the byte count.
  **Verify:** re-measure `/` with Resource Timing `transferSize` (NOT
  `content-length` — responses are brotli-compressed and omit it) and report
  before/after totals per resource.

- [x] **O-2 · P2 · The 249KB poster loads on every signed-in page**
  `public/brand/mini-mainframe-logo-poster.jpg` is **254,751 bytes**. It is the
  video's `poster`, the reduced-motion still on the landing page, AND
  `src/components/shell/SidebarRail.tsx:30` — so it is fetched on **every
  signed-in page**, where it renders at rail size (small).
  **Fix:** serve it through `next/image` wherever it is an `<img>` so it gets
  resized and format-negotiated per breakpoint, and use an appropriately-sized
  source for the sidebar rail rather than the full poster. Note the `<video
  poster>` attribute cannot use `next/image` — give that one a compressed
  variant directly.
  **Verify:** measure the poster's `transferSize` on a signed-in page before and
  after; the rail should pull well under 50KB.

---

## Built — 2026-08-02

All four shipped on `fix/audit-batch-r2-2026-08-02`, one commit each, nothing
pushed and nothing merged. `803 → 809` unit (the six new `guardedMessage`
tests), `510 + 1 skipped` integration unchanged, lint 0 errors / 51 warnings,
typecheck clean before every commit. Full E2E `28 passed / 4 skipped / 0 failed`.

| item | commit | headline |
|---|---|---|
| R2-10 | `c19cbe7` | both reset pages survive a rejected action; submit disables in flight |
| R2-11 | `1c7d0e6` | M12.2's race diagnosed and absorbed; 3 consecutive clean full runs |
| O-3 | `c79605c` | hero video 2,193,706 → 172,948 B (webm) / 277,892 B (mp4); phones fetch none |
| O-2 | `4b763a1` | hero still 254,751 → 57,924 B, shared with the `<video poster>`; rail 19,787 → 13,083 B |

`/` transfer, production build, Resource Timing `transferSize`:
desktop **2,927KB → 762KB**, iPhone 12 **2,988KB → 653KB**.

## Left for Ross

- **The MOP-004 inspector history integration is quietly broken, and it is what
  made R2-11 flaky.** `ProjectPanelStack` calls `window.history.pushState`
  directly to mirror the drill stack. Next patches `history.pushState`, so each
  of those becomes an app-router action; when one is still pending as a
  subsequent navigation commits, Next later re-pushes the *previous* canonical
  URL and yanks the user back to `/dashboard`. Separately, Next's own
  `replaceState` overwrites the custom state, so `mmInspector` is usually gone
  by the time the close-unwind checks for it and the unwind never runs — each
  inspector open leaves a stale history entry behind. Both are real
  back-button behaviour, not test-only, but fixing them changes shipped
  behaviour on a deliberate UX decision, so it is a call rather than a fix.
  R2-11 is handled at the test helper, which is where the batch scoped it.
- **The E2E suite is capped at 10 sign-ups per IP per UTC day** (E7,
  `MM_SIGNUP_DAILY_LIMIT`), and M9.3/M9.4 register real accounts. A few
  full-suite runs in a day exhausted it and those missions started failing with
  "Too many sign-ups from your network today" — indistinguishable from a load
  flake. The Playwright web server now raises the limit for itself only; the
  app default is untouched. Worth knowing before the next CI decision.
- **`mini-mainframe-logo-poster.jpg` (254,751 B) is now unreferenced by `src/`.**
  It survives only as the photo-upload fixture in `qa_share_card.spec.ts`.
  Deleting brand assets is Ross's call, same as `logo.png`.
- **The phone hero still is a 540px source shown at ~342 CSS px on a 3x
  screen** — a ~1.9x upscale rather than a true 3x render. Deliberate: a
  genuine 3x variant of this artwork costs ~207KB against the still's 58KB.
  It reads clean in a real iPhone 12 render, but it is a quality/bytes trade
  someone else might call differently.

## Out of scope

- **`public/brand/logo.png` (1.51MB)** is referenced by nothing in `src/`
  except the proxy matcher exclusion. It costs users nothing unless requested,
  and deleting brand assets is Ross's call. Do not delete it.
- **R2-8 Sentry CSP reporting** — the previous builder deliberately did not
  route reports to Sentry (shared error quota). That remains Ross's spend call.
- **R2-3 army-list import nesting** — needs Ross's manual check.
- **R2-4 retailer list narrowing** — product call.
- Real-device camera verification for R2-5.
- The failed-CI catalog commits on `main`.
