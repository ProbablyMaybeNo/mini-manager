# Audit batch — round 2d, 2026-08-02

Six items found while batches 2b and 2c were running. Two are systematically
enumerated bug classes, two are distribution defects on the share surface, one
is an unproven security lead, one is cosmetic.

Evidence: `ux-audit/round2-2026-08-02/REPORT.md`.

**Rules for this batch**
- You are on branch `fix/audit-batch-r2-2026-08-02`, which already holds twelve
  round-2 fixes. Stay on it. **Never push or merge to `main`.**
- Commit per item, referencing its id.
- Before EVERY commit: `npm run typecheck` (0 errors), `npm run lint` (0 errors;
  51 pre-existing warnings are fine), `npm run test:unit`,
  `npm run test:integration`. Baselines: **809 unit**, **510 integration + 1
  skipped**. Fix causes, never skip a test to go green.
- Do NOT touch `public/data/paints.json`. Do NOT delete any file in
  `public/brand/`.
- No new dependencies. Match neighbouring file conventions.
- If an item needs a product decision, skip it, leave the box unchecked, say why.

---

- [x] **R2-14 · P1 · The unguarded-await crash class — 19 blocks in 13 files**
  The same shape R2-2, R2-9 and R2-10 each fixed a slice of: an `await`ed server
  action inside `startTransition` with no `try` and no `guarded()`. Every one
  handles `!res.ok` correctly; it is only the **rejection** path that escapes to
  `src/app/error.tsx` and replaces the whole app with the fault screen.

  | file | blocks | actions |
  |---|---|---|
  | `app/(app)/focus/FocusClient.tsx` | **6** | `setFocusProject`, `clearFocusProject`, `logSession`, `setProjectComplete`, `addInspo`, `deleteInspo` |
  | `app/admin/comp/AdminCompPanel.tsx` | 2 | `grantCompAccess`, `revokeCompAccess` |
  | `app/(public)/sign-in/page.tsx` | 1 | **`signInAction`** |
  | `app/(public)/sign-up/page.tsx` | 1 | **`signUpAction`** |
  | `app/(app)/user/account/AccountClient.tsx` | 1 | **`deleteAccount`** |
  | `app/(app)/user/SettingsClient.tsx` | 1 | `exportAllUserData` |
  | `app/(app)/library/LibraryClient.tsx` | 1 | `setPaintOwnershipStatus` |
  | `components/recipe/CloneButton.tsx` | 1 | **`cloneRecipeFromSlug`** |
  | `components/recipe/AssignToRecipeDialog.tsx` | 1 | `sendPaletteToRecipe` |
  | `components/dashboard/PriorityDropdown.tsx` | 1 | `updateProjectPriority` |
  | `components/tools/usePaletteSaver.tsx` | 1 | `createPalette` |
  | `components/user/ExtensionTokenPanel.tsx` | 1 | `onGenerate` / `onRegenerate` (props) |
  | `app/admin/gallery/AdminGalleryReview.tsx` | 1 | `approveGallerySubmission`, `rejectGallerySubmission` |

  The three that matter most, each **verified by reading**, not just by sweep:
  - **`sign-in/page.tsx:22`** — a flaky connection turns "couldn't reach the
    server" into the whole-app fault screen **on the page someone is using to
    get in**. Worst first impression the app can make.
  - **`CloneButton.tsx:51`** — on `/r/<slug>` and every `/gallery` card. The
    highest-value click in the funnel: a stranger arriving from a shared link.
  - **`AccountClient.tsx:85`** — `deleteAccount`. A crash leaves the user with
    no idea whether their account was deleted.

  **Fix:** apply the existing `src/lib/actionGuard.ts` `guarded()` helper (or
  `guardedMessage`) to all 19. Mechanical — every call already returns the same
  `ActionResult` union the helper is typed for, and every site already has
  somewhere to put a message. `ExtensionTokenPanel` has a correctly `try`-wrapped
  `copy()` a few lines below its unguarded block, so these are oversights rather
  than a house style.
  **Method note:** this list was derived twice. A first windowed sweep said 18
  and missed `ExtensionTokenPanel` because the regex did not tolerate
  `startTransition(\n  async () => {`. Re-derived with exact brace matching over
  complete blocks → **19**. Confirm each site as you go rather than trusting the
  table.
  **Verify:** Playwright `context.setOffline(true)` on at least `sign-in`,
  `CloneButton` and `FocusClient` — assert the fault screen does NOT render and
  an inline message appears.

- [x] **R2-15 · P2 · A rejected action leaves the control permanently dead, silently**
  Distinct from R2-14: plain async **event handlers**, not transitions, so they
  do not crash. They set a loading flag, `await` with no `try`, and clear the
  flag on the next line. On a rejection the clear never runs — the flag stays
  set forever, an early-return guard makes every later click a no-op, and
  **nothing is shown**. Dead until a full reload. All four verified by reading:

  | file | flag | action | what dies |
  |---|---|---|---|
  | `components/recipe/AssignPaintMenu.tsx:83` | `setPending` | `addPaintToOwned` | Add to Owned **and** Add to Wishlist (shared flag) |
  | `components/recipe/AssignPaintMenu.tsx:96` | `setPending` | `addPaintToWishlist` | same pair |
  | `components/dashboard/PlannerCalendar.tsx:95` | `setBusy` | `createEvent` | the create-event form; can't submit |
  | `app/(app)/user/account/AccountClient.tsx:36` | `setResendPending` | `resendSignupVerification` | resend-verification — an **account-recovery** path |

  Re-derived with complete function bodies: still exactly these 4.
  **Fix:** `try/finally` so the flag always clears, plus a message on the
  failure path.
  **Verify:** offline, click once, then confirm the control still responds.

- [x] **R2-13 · P1 · Every shared recipe unfurls on X with the GENERIC site title**
  `src/app/layout.tsx:31` declares a global `twitter:` block.
  `src/app/r/[slug]/page.tsx:45` overrides **only** `openGraph` — no `twitter`
  override — so the layout's generic values win. Verified live on
  `/r/ultramarines-classic`:

  | tag | value |
  |---|---|
  | `og:title` | **"Ultramarines — Classic Blue · The Mini Mainframe"** correct |
  | `twitter:title` | "The Mini Mainframe — paint & project manager for miniatures" wrong |
  | `og:description` | **"A paint recipe shared via The Mini Mainframe — 7 slots."** correct |
  | `twitter:description` | "One terminal for your whole hobby — 7,000+ paints…" wrong |

  Per the X cards spec `twitter:*` takes precedence over `og:*` when both are
  present, so on X every shared recipe presents as the generic product rather
  than the recipe someone wanted to show off. **The image is already correct and
  good** — `/r/<slug>/opengraph-image` renders the recipe name and its real paint
  swatches (verified by eye on two recipes). The picture does the work and the
  title undoes it.
  **Fix:** give `generateMetadata` in `r/[slug]/page.tsx` a `twitter` block
  mirroring its `openGraph` title/description. Apply the same to `/gallery` and
  `/pricing`, which have the identical omission.
  **Verify:** assert `twitter:title` on `/r/<slug>` equals its `og:title`. A
  unit test over `generateMetadata` is enough; live X rendering needs a real
  post and is out of scope.

- [x] **R2-12 · P2 · `/gallery` unfurls with NO image at all**
  `/gallery` emits **zero** `og:image` / `twitter:image` tags — verified live
  (`grep -c og:image` → 0). Every other public route has one. Cause: the
  file-based `opengraph-image.tsx` / `twitter-image.tsx` live in the `(public)`
  route group, but the gallery is `src/app/(app)/gallery/page.tsx` and inherits
  nothing. It still declares `twitter:card = summary_large_image`, promising a
  large image and supplying none, which degrades to a bare or dropped card.
  The gallery is the curated shop-window for the recipe moat, so this is the
  link most worth unfurling well.
  **Fix:** point its metadata at the existing root image, or give it its own.
  **Verify:** `/gallery` emits a resolvable `og:image` and `twitter:image`.

- [x] **R2-16 · P3 · Post-auth redirect guard may allow a backslash bypass — UNVERIFIED**
  `src/lib/actions/auth.ts:19`, used by BOTH `signInAction` and `signUpAction`:
  ```js
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  ```
  Correctly rejects `https://evil.com` and protocol-relative `//evil.com`. The
  residual is **`/\evil.com`** — starts with `/`, not `//`, so it passes, and
  Chrome and Firefox normalise `\` to `/` when parsing a `Location` header,
  which would make it `//evil.com`.
  **I did NOT verify this live** — reaching that redirect needs real
  credentials. Treat it as a lead to confirm, not a proven hole. Impact if real
  is modest: the victim must follow a crafted link AND authenticate before
  landing off-site — a phishing aid, not account takeover.
  **Fix:** add `&& !next.includes("\\")`. One clause, worth doing whichever way
  the verification lands.
  **Verify:** sign in with `?from=/\example.com` and observe the resulting
  `Location`; add a unit test over `safePostAuthPath` covering `/\evil.com`,
  `//evil.com`, `https://evil.com` and a legitimate `/pricing`.

- [x] **O-4 · P3 · Orphaned word on the root share card**
  `/opengraph-image` (1200×630) is otherwise correct and on-brand — verified by
  eye. Its tagline "Plan your projects. Track your paints. Manage your minis."
  wraps so that **"minis." sits alone on a second line**. It is the card for
  every homepage link.
  **Fix:** widen the text container or drop the font size a step so it breaks
  two-and-two, or add an explicit break after "Track your paints."
  **Verify:** re-render and look at it.

---

## Shipped — 2026-08-02, branch `fix/audit-batch-r2-2026-08-02` (not pushed)

| item | commit | note |
|---|---|---|
| R2-14 | `d88ffb2` | **32 blocks, not 19** — see below |
| R2-15 | `1258123` | exactly 4, as filed |
| R2-13 | `df4d655` | `/pricing` was worse than filed — see below |
| R2-12 | `2549002` | its own gallery card |
| R2-16 | `fd233ec` | **verified: real, and wider than filed** — see below |
| O-4 | `7e15c84` | hard break, not a retune |

Gate on every commit: `typecheck` 0 · `lint` 0 errors (51 pre-existing
warnings) · **823 unit** (809 + 14 new) · **510 integration + 1 skipped**.
Full Playwright suite after the last commit: **34 passed, 4 skipped** (all four
skips pre-existing `describe.skip`).

### Three corrections to this brief

**R2-14 — the count is 32, not 19.** All 19 in the table are real; none was a
false positive. But the table was derived by sweeping for `startTransition`,
and this app destructures `useTransition` under six other names (`start`,
`startAttach`, `startSave`, `startDelete`, `startBulkTransition`,
`creatingProject`), so 13 more blocks of the identical shape were invisible to
it — including "+ New Project" on the dashboard, the army-list import, the
model counters, and the project-row delete. Re-derived by resolving each file's
own transition names, brace-matching complete blocks, and blanking comments
first (prose about `` `await action()` `` was otherwise scored as code).

**R2-13 — `/pricing` declared NEITHER block**, not just the `twitter` one, so
both `og:title` and `twitter:title` fell through to the layout. Also: Next
REPLACES a declared metadata field rather than merging into the parent's, which
means every new `twitter` block has to restate
`card: "summary_large_image"`, and which cost `/pricing` its inherited image
mid-fix. Both handled; see the commit.

**R2-16 — verified, and the filed fix was not enough.** Driven through a real
sign-up in a real browser with off-origin requests stubbed:
`?from=/\example.com`, `/\/example.com` and `/<TAB>/example.com` each landed
the authenticated visitor on `http://example.com/`. `//evil.com` and
`https://evil.com` held. The proposed `!next.includes("\\")` closes the two
backslash variants and leaves the TAB one open — browsers strip TAB/LF/CR from
anywhere in a URL, exactly as they normalise `\` to `/`. The guard now rejects
control characters too, moved to `src/lib/auth/postAuthPath.ts` (it could not be
exported from a `"use server"` file, so it could not be tested where it lived).

---

## Out of scope — needs Ross, do NOT action

- **R2-17 · the MOP-004 inspector history integration** — surfaced by the
  previous builder while fixing R2-11, and it is a real user-facing defect, not
  a test artefact: `ProjectPanelStack` calls `window.history.pushState`
  directly; Next patches that method, so a call still pending when a later
  navigation commits causes Next to re-push the previous canonical URL and
  **yank the user back to `/dashboard`**. Separately Next's `replaceState`
  overwrites the custom state, so `mmInspector` is usually gone by the time the
  close-unwind checks for it and the unwind never runs, leaving a stale history
  entry per inspector open. Fixing it changes shipped behaviour on a deliberate
  UX decision, so it is Ross's call, not a builder's.
- **`public/brand/logo.png` (1.51MB)** and
  **`mini-mainframe-logo-poster.jpg` (254,751 B)** are now unreferenced by
  `src/` (the poster survives as an E2E fixture). Deleting brand assets is
  Ross's call.
- **R2-8 Sentry CSP reporting** — a spend decision.
- **R2-3** army-list nesting, **R2-4** retailer list, **R2-5** real-device
  camera, and the failed-CI catalog commits on `main`.
- **Accessibility of the signed-in app** is unaudited — the public pages were
  verified clean in a real browser, the interior needs credentials and its own
  scoped run.

### Found while working this batch, deliberately NOT actioned

- **`useInstallPrompt.promptInstall` (`src/components/pwa/useInstallPrompt.ts:69`)**
  — the broadened R2-15 sweep turned this up as a fifth instance of the
  stuck-flag SHAPE, but it is not the same class: the await is a browser API
  (`BeforeInstallPromptEvent.prompt()`), not a server action. It clears
  `deferred` on the line after the await, so a rejected prompt leaves the
  Install button on screen and `InstallBanner:66` awaits it in a plain click
  handler, unhandled. `try/finally` would fix the escape but also decide what a
  failed install prompt should do — hide the button, or keep it and say
  nothing? That is a product call and there is no message surface designed for
  it, so it is left alone. P3 at most.
- **R2-15's four handlers now catch, but none of the four is covered by an
  offline test for the OTHER two AssignPaintMenu entries** — "Add to Wishlist"
  shares `pending` with "Add to Owned", and only the latter is driven in the
  browser. Same three lines, same file; called out rather than padded.
