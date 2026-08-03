# Round 2 audit — 2026-08-02

Started after the eight round-1 fixes shipped (`84663fd`, live and CI-green).
Ends only when a full sweep finds nothing. Audit only — no fixes; everything
goes to a builder as one batch at the end.

## Verified on PRODUCTION (post-deploy regression checks)

### B1 · FIXED AND LIVE
All five tool routes, signed out, now serve the public header plus auth links —
the P0 dead end is gone on the real site, not just in tests.

| route | auth links before | after (live) | CTA |
|---|---|---|---|
| `/tools/wheel` | 0 | sign-in + sign-up | Get Started |
| `/tools/match` | 0 | 3 | Get Started |
| `/tools/dropper` | 0 | 3 | Get Started |
| `/tools/stacking` | 0 | 3 | Get Started |
| `/tools/scan` | 0 | sign-in + sign-up | Get Started |

### Broken-link sweep · CLEAN
Every unique in-app link reachable from `/`, `/pricing`, `/gallery`, `/sign-in`
and `/sign-up` on production — 18 of them — returns 200/307/308. No dead links.

Also of note: the Vercel bot mitigation that blocked me earlier has expired, so
production spot-checks are usable again (used sparingly — that block was
self-inflicted by polling).

## Verified working locally (round 2)

- **Send-to-Recipe** — opens ASSIGN TO RECIPE listing every recipe with a CREATE
  option. No console errors, no failed requests.
- **Share as card** — the composer opens with a live card preview, 1:1 / 9:16
  ratio toggle, MODEL PHOTO slot, notes, DOWNLOAD CARD and POST TO GALLERY, plus
  the moderation notice. No errors. (My first probe reported `canvas: 0` and I
  nearly logged that as a fault — the preview is DOM-rendered, not canvas. Not a
  finding.) PNG export itself is covered by `qa_share_card`, which passes.
  The preview shows hexes without paint names only because the seeded recipe
  uses non-existent paint ids — the same test-data artifact cleared in round 1.

## FINDINGS (round 2)

### R2-1 · P2 · Clipboard writes are fire-and-forget: false "copied" toasts + uncaught rejections
Observed live in the browser: clicking SHARE LINK raised
`NotAllowedError: Failed to execute 'writeText' on 'Clipboard': Write permission
denied.` as an **uncaught** page error. Cause is a shared pattern — five sites
call `void navigator.clipboard?.writeText(...)`, and `void` discards the promise,
so a rejection is never handled.

Clipboard writes fail for ordinary reasons: denied permission, an insecure
context, browser policy, or no user-gesture (Firefox). The consequence differs
per site, and one is materially wrong:

| site | on failure | severity |
|---|---|---|
| `src/app/(app)/tools/match/page.tsx:38` | toasts **"Copied {name} · {hex}"** — and the hex is nowhere else on screen | **worst: claims success, user loses the value** |
| `src/app/(app)/library/LibraryClient.tsx:207` | silent; no toast either way, so no feedback at all | confusing |
| `src/components/recipe/RecipeWorkbench.tsx:169` | toasts "Public link copied" but `setShareUrl` also reveals the URL | mitigated |
| `src/app/(app)/recipes/[id]/RecipeEditorClient.tsx:185` | same as above | mitigated |

`src/components/public/ShareLinkBar.tsx:21` is the correct model already —
`await` inside `try/catch`, with the link visible and selectable regardless.

**Fix:** `.catch()` every clipboard write; only toast success on resolve; on
failure surface the value so it can be copied by hand (the Match tool needs this
most). ShareLinkBar's pattern is the template.

### R2-2 · P1 · A failed save destroys the whole app and the user's edit
Renaming a project with the network down replaces the **entire application**
with the global fault screen — "FAULT / SOMETHING BROKE / An unexpected error
interrupted the session" and a RETRY button. Not an inline message: everything
else on the page is gone too.

The typed value is gone with it. Verified: after reconnecting and reloading, the
rename had not persisted and was not recoverable — the user simply loses the
edit and has to find their way back.

Reproduce: open a project inspector, go offline, edit the NAME field, blur.

Why it matters more than it looks: this is a *transient* failure. A phone
dropping to no signal for two seconds is the common case, not an exceptional
one, and this app is used heavily on mobile at a painting desk. The correct
shape is an inline "couldn't save — retry" that keeps the typed value and
leaves the rest of the app usable; a whole-app error boundary should be for
unrecoverable render faults, not a failed fetch.

Evidence: `r2-offline-save.png`

### R2-8 · P2 · The CSP is permanently decorative — report-only with nowhere to report
Production sends `Content-Security-Policy-Report-Only`, never the enforcing
header. `next.config.ts` documents that as deliberate: ship report-only first,
*"flip the header key to `Content-Security-Policy` to enforce once the violation
reports are clean."*

**But no reports are being collected.** The header carries no `report-uri`, no
`report-to`, and there is no `Reporting-Endpoints` header — verified on
production. Violations surface only in individual visitors' consoles, where
nobody sees them.

So the policy is in a stable no-op state:
- report-only **blocks nothing**, so it provides no protection today, and
- with no report sink, the stated exit criterion ("once the reports are clean")
  **can never be evaluated**, so it will stay report-only indefinitely.

Honest caveat on the value of enforcing it as written: the policy allows
`script-src 'self' 'unsafe-inline' 'unsafe-eval'`, which defeats most of what a
CSP is for. The config explains why (Next's inline bootstrap, Tailwind inline
styles). Enforcing this exact policy would be a modest gain, not a large one.

**Fix — pick one and close it out:**
- Point reports at Sentry (already in the stack and it ingests CSP reports),
  watch for a week, then enforce; or
- Accept that it is decorative and say so in the config comment, so the next
  reader does not assume the app is protected.

Everything else in the header set is correct and worth noting: HSTS 2 years with
`includeSubDomains`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin`.

### R2-7 · P2 · Unknown URLs redirect to sign-in instead of 404ing
On production, any unmatched path is treated as a protected route:

```
/does-not-exist   → 307 → /sign-in?from=%2Fdoes-not-exist
/totally/made/up  → 307 → /sign-in?from=%2Ftotally%2Fmade%2Fup
/Dashboard        → 307 → /sign-in?from=%2FDashboard   (case-typo of a real route)
```

`/r/nope-not-real` **does** return a proper 404 with the branded ERROR page, so
the 404 exists — unmatched *top-level* paths just never reach it.

Two consequences:

1. **Users get the wrong message.** A typo'd or stale link lands on a sign-in
   page, so the visitor concludes the content needs an account rather than that
   it does not exist. `/Dashboard` — a plausible capitalisation slip — is the
   clearest case.
2. **It is a soft-404 for search engines.** A crawler following a dead link gets
   a 307 into sign-in rather than a clean 404, which is the pattern search
   engines specifically handle badly. The sitemap is otherwise well built —
   13 URLs including all 8 share pages — so this is the one weak spot in an
   otherwise tidy SEO surface.

**Fix:** only redirect to sign-in for paths that actually match a protected
route; let genuinely unknown paths fall through to the existing 404.

**Verified fine alongside it:** `robots.txt` correctly allows the public pages
and disallows `/api/`, `/dashboard`, `/library`; `sitemap.xml` includes every
public page and every gallery share page.

### R2-6 · P1 · The public share page overflows horizontally on a phone
`/r/<slug>` — the page a stranger lands on from a shared recipe link — is wider
than the device at 375px:

```
window.innerWidth        487   <- layout viewport forced 30% wider than the phone
document.scrollWidth     487
uncontained overflow:    div.flex        w=471  right=487
                         button.shrink-0 w=88   right=474
```

The share-link bar (URL text + COPY button) does not wrap or truncate enough, so
it forces the whole page wider. Nothing here is inside a scroll container — this
is genuine page-level horizontal scroll, which this project's own rule forbids.

Consequence: on a real phone the browser zooms out to fit, so every recipe row
renders smaller than intended and the page scrolls sideways. This is the
**growth surface** — the first thing a prospective user sees when someone shares
a recipe.

**Confirmed on PRODUCTION, and worse there:**

```
prod /gallery                              @375 → body 375  (fine)
prod /r/stormcast-eternals-sigmarite-gold  @375 → body 557  (48% wider than the phone)
local same page                            @375 → body 487
```

The production gallery is seeded with real share cards, so these are live,
shareable URLs that do not fit on a phone today.

**Isolated to exactly one surface.** Full production public sweep at 375×812:

| route | body width | |
|---|---|---|
| `/` `/pricing` `/gallery` `/sign-in` `/sign-up` `/privacy` `/terms` | 375 | fits |
| `/r/stormcast-eternals-sigmarite-gold` | **557** | overflows |
| `/r/khorne-berzerkers-brass-and-blood` | **557** | overflows |

Seven of eight public routes are fine. The one that is not is the one people
share — and both slugs give the identical 557, so it is the page template, not
one bad recipe.

Found by the mobile click crawl (8 gallery cards all led here). Verified by
navigating straight to the share URL, so it is not a click artefact.

Evidence: `r2-mobile-gallery-card.png`

### R2-5 · P1 · The live camera sampler cannot work — the app's own header blocks it
Found by the click crawl: clicking **USE CAMERA** on `/tools/dropper` logs
`Permissions policy violation: camera is not allowed in this document.`

The app sends this on every response, verified live on production:

```
Permissions-Policy: camera=(), microphone=(), geolocation=(), browsing-topics=()
```

`camera=()` is an **empty allowlist — the camera is disabled for every origin,
including the site itself.** Meanwhile `src/components/tools/CameraSampler.tsx`
calls `navigator.mediaDevices.getUserMedia({ video: … })` to stream the rear
camera for live colour sampling, rendered by the Eyedropper tool. It cannot
succeed on production.

Two things make it worse than a dead button:

1. **The feature-detect passes, so the button is shown.** It only checks that
   `navigator.mediaDevices.getUserMedia` *exists* — which it does; the policy
   blocks the call, not the API. So the control advertises itself as available.
2. **The error blames the user's device.** The rejection is a `NotAllowedError`,
   so the user is told *"Camera permission denied. Drop or paste an image
   instead."* They will go hunting through browser settings for a permission
   they never denied — the site denied it to itself.

This is a whole feature of the paid tool suite that cannot function.

**Fix:** allow self in the policy — `camera=(self)` — keeping it denied to
third parties. If live camera sampling is *not* wanted, remove the button and
the component instead of shipping a control that cannot work.

### R2-4 · P1 · Auto-populate fails on every retailer it advertises, and says nothing
**The item Ross asked about, reproduced under control and then narrowed.**

The scraper is not broken. Pasting `https://example.com/` creates a row with
`title="Example Domain"`, `vendor="example.com"` — it fetches, parses and saves
correctly. But every *advertised* retailer fails:

| pasted URL | row created | time | user told anything |
|---|---|---|---|
| `example.com` | **yes** — title + vendor | ~5s | — |
| Games Workshop | **no** | 4.6s | **no** |
| Element Games | **no** | 9.1s | **no** |
| Amazon | **no** | 9.1s | **no** |

All three land on a blank ADD PAINT dialog with no explanation. Each burned
5–9 seconds first, so the user waits, then gets an empty form.

**Most likely cause: those sites block server-side fetches** (bot protection).
That is an external constraint, not a coding mistake — but it makes the product
claim false, and the failure mode is the bug:

1. The panel promises *"Auto-fills from: Games Workshop, Element Games, Wayland
   Games, … Amazon, eBay"*. Three of the named retailers were tested; none
   auto-filled.
2. **Nothing tells the user.** No "couldn't read that page", no mention that
   auto-fill was even attempted.
3. The panel's other promise — *"Other links still add a row"* — is not kept
   when the fetch is BLOCKED: `example.com` got a row, the three retailers got
   nothing at all.

Fix, whatever the cause: surface the failure, keep the pasted URL on a row so
the work is not lost, and either make the retailer list reflect what actually
works or route blocked hosts through something that can fetch them (the Chrome
extension the panel advertises as "coming soon" would side-step this entirely —
it reads the page the user is already on).

Evidence: `r2-autofill.png`

### R2-3 · NEEDS VERIFICATION · army import may create units as root-level Armies
The UPLOAD ARMY LIST panel promises: *"We'll turn it into an Army with a project
per unit."* Rows in the local DB that exactly match the panel's own sample list
suggest that is not what happens:

```
"10x Intercessors" | type=Army | count=0 | parent=ROOT     <- expected: Unit under an Army
"Captain"          | type=Unit | count=1 | parent=<army>   <- correct
```

**Not confirmed as a bug, and I am not reporting it as one.** I could not
reproduce it: my own `fill()` never landed in the textarea, so those rows came
from an earlier session, not from a controlled test. They may predate current
parser behaviour.

What IS verified about this panel:
- The textarea is genuinely empty; that sample text is a `placeholder`.
- **PARSE LIST is correctly disabled while empty** — my hypothesis that clicking
  it blank creates junk projects was wrong.

**To settle it:** paste a two-line list (`10x Intercessors` / `1x Captain`),
press PARSE LIST, and check whether the units land *under* one new Army or as
separate root-level Armies. A 30-second manual check.

### Non-finding · `/library` LIST view "overflow" at 375px — detector flaw, not a bug
The mobile crawl flagged `div.min-w-[680px] right=709` on `/library` after
switching to LIST. Measured properly:

```
body.scrollWidth        375
documentElement.scrollWidth 375
viewport                375
wide element's right    709   <- inside div.h-full.overflow-auto (349px wide)
```

The page body does **not** scroll horizontally; the wide table scrolls inside
its own container — exactly the rule this project already follows ("wide content
must scroll inside its own overflow-x container, the page body must never scroll
horizontally").

**The flaw is in my detector**, which compares each element's `right` against the
viewport without checking for an ancestor scroll container. Any correctly-built
horizontal scroller trips it. Noted so the same false positive from the
remaining mobile routes is discounted rather than reported.

### Non-finding · `/user` MANAGE SUBSCRIPTION returns 503 locally
The click crawl flagged `HTTP 503 /api/billing/portal`. That status is
**documented behaviour when Stripe has no secret key**, which is the case on
this machine and not in production (Stripe is live there). More importantly the
failure is handled: the user gets a "not configured" message and stays on the
page. No silent failure, nothing to fix.

## Dialog keyboard + focus behaviour · VERIFIED OK

Both real modals are implemented correctly — `role="dialog"`, `aria-modal="true"`,
focus moved inside on open, focus held through 25 Tab presses (no escape),
Escape closes, and focus restored to the opening control:

| dialog | role | aria-modal | focus trapped | Esc closes | focus restored |
|---|---|---|---|---|---|
| Library FILTER | ✅ | ✅ | ✅ | ✅ | ✅ → FILTER button |
| Recipe slot picker | ✅ | ✅ | ✅ | ✅ | ✅ → + ADD PAINT |

**Non-finding, recorded so it isn't re-opened:** the Collection "SCAN PAINTS"
control reported no `role="dialog"`. It opens the OS file chooser, not an
in-page modal — there is no dialog to mark up. My probe measured a native
dialog it cannot see.

## Share / SEO metadata on production · VERIFIED OK

Checked because a blank OG image was a launch blocker previously, and because
the share page is the growth surface:

| surface | og:title | og:description | og:image |
|---|---|---|---|
| `/` | ✅ | ✅ | ✅ 1200×630, **247KB real PNG** |
| `/r/<slug>` | ✅ per-recipe | ✅ "…7 slots" | ✅ **per-recipe dynamic image, 91KB real PNG** |
| `/gallery` | ✅ | ✅ | + `twitter:card=summary_large_image` |

`robots.txt` and `sitemap.xml` both 200. Per-recipe dynamic OG images are a nice
piece of work — a shared recipe link previews with its own artwork.

Worth stating the contrast plainly: the share page's **metadata layer is
healthy while its layout is not** (R2-6). A shared link previews beautifully and
then lands the visitor on a page 48% wider than their phone.

## O-3 · optimization · the landing page autoplays a 2.1MB video on mobile

**The single largest performance item found in either round.** Measured on
production at 375×812 via the Resource Timing API:

| resource | transfer | note |
|---|---|---|
| `/brand/mini-mainframe-logo.mp4` | **2,143KB** | `autoPlay muted loop playsInline` |
| `/brand/mini-mainframe-logo-poster.jpg` | 249KB | the `<video poster>`, served raw |
| all JavaScript | 308KB | |
| six feature screenshots | 326KB total | AVIF, fine |
| CSS + fonts | 58KB | |
| **page total** | **2,849KB** | |

**2.4MB of a 2.85MB page — 84% — is the hero logo animation**, and it autoplays
the moment a phone opens the marketing page. Everything else on the page is
well-optimised; this one element outweighs all of it five times over.

Credit where due: `LandingView` already branches on `reducedMotion` and serves
the poster through `next/image` in that path — so an optimised route exists and
someone thought about it. The default path is the problem.

**Fix — two independent wins:**
1. **Do not autoplay the full video on phones.** Show the poster and play on tap
   below a breakpoint, or ship a much smaller encode for mobile. The video is
   1080×1080 rendered at **327×327** — an appropriately-sized encode is a small
   fraction of 2.1MB.
2. **Right-size the poster** (see O-2) — it is the same 1080×1080 asset served
   raw as a `<video poster>`, and it also loads via `SidebarRail` on every
   signed-in page.

Together these should take the landing page from ~2.85MB to well under 700KB
without changing how it looks on a desktop.

**The problem is one asset on one page.** Payload per public route, mobile:

| route | total transfer | of which video |
|---|---|---|
| **`/`** | **2,849KB** | **2,143KB** |
| `/pricing` | 40KB | 0 |
| `/gallery` | 80KB | 0 |
| `/sign-in` | 19KB | 0 |
| `/sign-up` | 11KB | 0 |
| `/r/<slug>` | 16KB | 0 |

The landing page is **36× heavier than the next heaviest page**. Every other
public route is genuinely lean. Nothing else on this site has a payload problem.

*Measurement caveat, stated honestly:* `/` was measured first on a cold context;
the later routes reuse cached shared JS and fonts, so their totals are warm-path
and would be somewhat higher cold. That does not affect the conclusion — the
2.1MB video exists only on `/`, and no other route loads anything comparable.

## O-2 · optimization · a 249KB logo is 69% of the landing page's image weight

Measured on production at 375×812, after scrolling to trigger lazy loads:
**9 image/font requests, 363KB total** — and one file is 249KB of it.

| asset | size | delivery |
|---|---|---|
| `/brand/mini-mainframe-logo-poster.jpg` | **249KB** | **raw — bypasses `/_next/image`** |
| six feature screenshots | 8–16KB each | AVIF via `/_next/image` ✅ |
| font (woff2) | 39KB | ✅ |

The screenshots are exemplary — the image pipeline is working exactly as it
should for them. The logo poster is the outlier:

- natural size **1080×1080**, displayed at **327×327** on a phone — roughly 11×
  more pixels than are used
- served raw, so it gets no format conversion, no responsive sizing, no AVIF
- used in **three** places: `LandingView` twice (an `<img>` and a `<video
  poster>`) and **`SidebarRail`** — meaning it also loads on every signed-in
  page, not just the landing page

**Fix:** route it through `next/image` like the screenshots already are, or ship
a right-sized poster. On the evidence of the screenshots (8–16KB as AVIF), this
should land near 15–25KB — roughly **230KB saved** on first load of both the
landing page and the app shell.

Landing timing for context: domReady 429ms, load 481ms — so this is payload
weight rather than a blocking-render problem, and it hurts most on the phone
data connections the landing page is built for.

## R2-22 · ~~P1-if-confirmed~~ **RETRACTED — premise disproven empirically (see below)**

Chased the qualification below to the client source rather than leaving it as
"unverified". Three facts, each read from the installed packages:

1. **`libsql:` resolves to `https`.** `@libsql/core/lib-cjs/config.js:73-82` —
   `scheme = preferHttp ? "https" : "wss"`, and
   `@libsql/client/lib-cjs/node.js:28` calls `expandConfig(config, **true**)`.
   `preferHttp` is **true** on the Node client.
2. **The HTTP transport is stream-per-statement.** `http.js:96-104`, in its own
   comment: *"Pipeline all operations, so `hrana.HttpClient` can open the
   stream, execute the statement and close the stream in a single HTTP
   request."* Every `execute()` calls `openStream()` … `closeGracefully()`.
3. **`PRAGMA foreign_keys` is connection/stream-scoped.**

Therefore the one-shot `PRAGMA foreign_keys = ON` in `src/db/client.ts:29`
applies to a stream that is **closed immediately**, and every later query runs on
a fresh stream where it was never set. **On Turso over HTTP, the pragma cannot
be in effect for application queries.**

**If that is the whole story, `deleteAccount` leaves orphaned rows in all 17
child tables** — projects, recipes, images, wishlist, feedback, sponsorships —
after a user has asked to be deleted. Privacy consequence, not just bloat.

**What I have NOT verified, and it is decisive:** whether **Turso's server**
enforces foreign keys by default irrespective of the client pragma. SQLite's
compile-time default is OFF, but libSQL server may differ. I cannot read that
from here, and I will not claim the bug without it. I also could not read the
production `DATABASE_URL` (a secret) — `dialect: "turso"` plus Turso's URL
convention makes `libsql://` near-certain, but it is an inference.

**The one query that settles it**, against production:
```sql
PRAGMA foreign_keys;             -- 0 = not enforced, 1 = enforced
```
Or behaviourally: create a throwaway account with one project, delete the
account, then count that project's rows.

**Deliberately NOT dispatched to a builder.** Every other finding this round was
verified before it was handed over. "Make the pragma reliable" is plausible
churn on the database layer that may be entirely unnecessary — and if Turso does
*not* enforce server-side, the correct fix is probably explicit cascading
deletes in `deleteAccount`, not a pragma at all. That is a design decision, and
it should follow the answer rather than precede it.

## R2-23 · P2 · Route-level crashes were ACTIVELY SUPPRESSED from Sentry (worse than filed) — which is why nobody knew

`Sentry.captureException` appears in **exactly one place** in `src/`:
`global-error.tsx:18`. There is no `reactErrorHandler`, no `onCaughtError`, and
**no capture in `src/app/error.tsx`** — which does not even bind `error`, it
destructures only `{ reset }`.

**`global-error.tsx` only fires when the ROOT LAYOUT crashes** — rare and
catastrophic. Everything else — every route-level error — is caught by
`src/app/error.tsx`, renders "SOMETHING BROKE", and **emits no Sentry event.**

Verified against the SDK rather than assumed: App Router `error.tsx` boundaries
do **not** auto-report. `captureUnderscoreErrorException` is Pages-Router
`_error`; `reactErrorHandler` is an **opt-in** helper for React 19's
`onCaughtError`. Neither is wired here.

**This is the "why didn't we know" answer for the whole round.** R2-2, R2-9,
R2-10 and R2-14 were the same class — 32+ unguarded awaits whose *rejections*
escape into `src/app/error.tsx`. **Every one of those crashes showed a user the
fault screen and produced zero monitoring signal.** That is precisely why they
accumulated to 32 and why Ross was surprised by them: the app's own error
reporting could not see its most common failure.

**Fix:** bind `error` in `error.tsx` and capture it —
```tsx
useEffect(() => { Sentry.captureException(error); }, [error]);
```
matching what `global-error.tsx` already does. Optionally also wire
`Sentry.reactErrorHandler` into the client root for component errors React
hands to boundaries.

**Verify:** trigger a route-level throw and confirm an event arrives — or, if
that spends quota, assert in a unit test that `error.tsx` calls
`captureException`, mirroring the existing `global-error` behaviour.

**CORRECTION — worse than I filed it.** I described an omission. Builder 7
verified against the installed 10.65.0 on four independent points and found
**suppression**: in Next 16.2.10 an error reaching the **built-in** boundary
goes `onUncaughtError` → `reportGlobalError` → `reportError()`, raising a window
error event that Sentry's default `globalHandlersIntegration` **does** capture.
An explicit `error.tsx` diverts it to `onCaughtError`, whose production branch is
a bare `console.error` — and `captureConsoleIntegration` is not a browser
default. **So having that file was strictly worse for monitoring than not having
it**: it pulled crashes out of the one path that reported them.

Also corrected: my spec said to mirror "the existing `global-error` coverage".
There was none — nothing referenced that file either. The new test covers both.

`reactErrorHandler` deliberately not wired: the App Router owns `hydrateRoot`,
so there is nothing in `src/` to attach it to without a fake root or a
double-report.

**Open for Ross (monitoring design, not a bug):** a server-side crash now emits
**two** events — `onRequestError` from `instrumentation.ts` plus this boundary's
client event, which production redacts down to a `digest`. Attaching that digest
as a Sentry tag would correlate them instead of leaving what looks like
unrelated noise. Builder 7 declined to do it unasked, correctly.

**Not a user-facing bug.** It is the monitoring blind spot that hid twenty-one
user-facing bugs, which is why it is worth fixing now rather than after the next
class accumulates.

## R2-8 — the CSP spend call, reframed (still Ross's decision)

Builder 2 declined to route CSP reports to Sentry because they share the quota
`tracesSampleRate: 0` exists to protect, and called it Ross's spend to
authorise. Correct call. But the **size** of that risk depends on how permissive
the policy is, which is checkable. Live header:

```
default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none';
form-action 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval';
style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:;
font-src 'self' data:; connect-src 'self' https:; frame-src 'self'
```

**This is a permissive policy.** `script-src` allows `'unsafe-inline'` **and**
`'unsafe-eval'`; `img-src` and `connect-src` allow **any** `https:` origin. Only
`object-src 'none'`, `frame-ancestors 'none'`, `base-uri` and `form-action` are
genuinely strict — those four are the real protection it currently provides.

**What that implies for the spend decision.** A policy this lax should produce
**near-zero violations from the app's own behaviour** — same-origin scripts,
same-origin styles, any-https images and connections all pass. So the "unbounded
firehose" is not steady-state app traffic.

**The real volume risk is browser extensions**, which routinely inject scripts
and styles into pages and generate CSP reports en masse — noise unrelated to
app health, scaling with user count rather than with anything going wrong. That
is a sharper reason for caution than "unbounded", and it is exactly what a
**per-key rate limit in the Sentry UI** exists to cap — the precondition builder
2 already identified.

**So the decision is not "will this flood my quota".** It is: *am I willing to
set a per-key rate limit and tolerate extension noise, in exchange for the
ability to eventually graduate this policy to enforcing?* Worth noting the prize
is modest — with `'unsafe-inline' 'unsafe-eval'` still in `script-src`,
enforcing buys less than it appears to, which the config comment already says.

**I am deliberately not estimating volumes.** I have no data on this app's
traffic or extension prevalence, and inventing a number would be worse than
leaving the shape of the decision clear.

## R2-17 — the UX call, with the options named (still Ross's decision)

R2-17 is genuinely Ross's ruling, but he should not have to re-derive the
trade-off. Here it is.

**What MOP-004 is trying to do**, stated in `ProjectPanelStack.tsx:56-67`:
mirror the drill stack into browser history so OS/browser Back pops **one tier**
(sub-project → parent → closed) and **never exits the app**. On a phone,
back-swiping out of the app when you meant to close a panel is jarring — this is
a deliberate mobile-UX win, not incidental.

**Why it misbehaves.** It calls `window.history.pushState` directly. Next
**patches** that method, so each call becomes an app-router action:
1. an action still pending when a later navigation commits makes Next re-push
   the previous canonical URL → **the user is yanked back to `/dashboard`**;
2. Next's own `replaceState` overwrites the custom state, so `mmInspector` is
   usually gone by the time the close-unwind checks for it → **the unwind never
   runs, and every inspector open leaves a stale history entry.**

**So the feature half-works today** — Back sometimes does the intended thing,
sometimes yanks to the dashboard, and entries accumulate.

**Three options, and (c) is what currently ships:**

- **(a) Keep the UX, own the history properly** — drive the drill stack through
  the router (route state / search params) so Next owns history instead of
  fighting it. Keeps the mobile win. Largest change, and I have not designed it —
  I am naming the direction, not claiming a plan.
- **(b) Remove the integration** — let Next handle Back natively. Simplest and
  fully correct, but **loses the deliberate property**: back-swipe would leave
  the page rather than closing a panel.
- **(c) Leave it** — accept intermittent yank-to-dashboard and accumulating
  history entries.

The audit's only opinion: **(c) is the one option where the bug stays and the
feature still is not reliable**, so it is worth ruling between (a) and (b) rather
than by default.

## R2-4 — the product call now has DATA (still Ross's decision)

R2-4's error-surfacing shipped; what was left to Ross was "consider narrowing the
advertised retailer list", which is a product call with no evidence attached.
Here is the evidence.

**8 stores are advertised and 8 parsers exist.** Fetched each host server-side,
following redirects:

| host | result | |
|---|---|---|
| **games-workshop.com** | **403** (46KB block page) | blocks the fetch |
| **goblingaming.co.uk** | **429** immediately | rate-limits the fetch |
| **gamekastle.com** | **429** immediately | rate-limits the fetch |
| elementgames.co.uk | 200 · 124KB | responds |
| waylandgames.co.uk | 200 · 645KB | responds |
| nobleknight.com | 200 · 416KB | responds |
| miniaturemarket.com | 200 · 416KB | responds |
| gamersroll.com | 200 · 343KB | responds |

**The GW 403 corroborates round 2's live observation exactly** — a Games Workshop
URL produced no row and no message, and this is why. The tension for the product
call is sharp: **the single most-expected retailer for this audience is the one
that demonstrably blocks us.**

**Four caveats, because this narrows the question without closing it:**
1. Fetched from **my** IP, not Vercel's. Vercel's egress ranges are well-known
   datacentre blocks and may fare **worse**, not better.
2. **Homepages, not product pages** — protection can differ per path.
3. A 429 may be transient rate-limiting rather than a standing block.
4. A 200 proves the host *responds*; it does not prove the parser extracts
   correctly from a real product page.

**Method note:** my first run reported 301/302/308 for five hosts and looked like
mass failure. That was `curl` without `-L` — I had not followed redirects. The
table above is the corrected run. Reporting the first one would have been
badly wrong in the alarming direction.

## Failed-CI catalog commits on `main` · CLOSED — main's tip is green

Carried as an open item since round 1, where I said B3's picker fix had "very
likely" resolved it and explicitly declined to claim more. Now confirmed rather
than inferred — `gh run list --branch main`:

| commit | CI | |
|---|---|---|
| **`84663fd`** | **success** (20:37) | ← main's tip, and the commit production runs |
| `bdfdc89` | failure | |
| `21693c7` | failure | ← one of the two originally flagged |
| `f4133fa` | cancelled | |
| `4c907a7` | failure | ← the other |
| `b6aea4d` | success | |

So there was a genuine red window (08:10 → 09:02) and **it is over**. Three
commits in `main`'s history failed CI — a historical fact, visible in `git log`,
not a live problem — and the tip that is actually deployed passed.

**Nothing to action.** Recording it because "there are failed-CI commits on
main" sat on Ross's list for two rounds as an unresolved worry, and the honest
resolution is that it resolved itself.

**Second open item closed this session by checking rather than escalating**
(after R2-3). Both had been written down as needing Ross.

## R2-3 CLOSED by code inspection — the importer nests correctly

R2-3 has been parked as "needs Ross's 30-second manual check" since this round
opened. It did not need one.

`applyImport` (`src/lib/actions/imports.ts:276-311`) does exactly what the panel
promises:

1. inserts **one** `type: "Army"` project, no `parentId` — the root container;
2. then, per unit, inserts `type: "Unit"` with **`parentId: armyId`**.

And it is the **only** writer. Every other `type: "Army"` insert in the codebase
is something else: `DashboardClient.tsx:94` is the "+ New Project" button (which
creates a root-level Army *by design* — the user's choice), plus `seed.ts` and
`fixtures.ts`. The documented flow is `fetchImportForPreview` → `applyImport`,
single path.

**So the flat rows I observed were not the importer.** As I noted when filing it,
they predated the test — they came from manual creation or seed data. The
original filing was right to refuse to change parser behaviour on that evidence;
it was over-cautious in assuming only Ross could settle it.

**Honest limit:** resolved by reading, not by running an import end to end. The
code has one path and it is unambiguous, so the residual doubt is small — but if
Ross ever sees a flat import again, the parser (`editedTree.units`) is where to
look, not the writer.

**One item removed from Ross's list**, which is the point of chasing it.

## Counter concurrency · VERIFIED OK — the race is explicitly handled

The usage pattern that matters here is hold-tapping +/- at a painting desk, so a
read-modify-write counter would silently lose increments. `bumpCounter` does not
do that:

```js
// Atomic increment — `SET col = col + delta` instead of `SET col = N`.
// Under concurrent + clicks (the UI no longer disables the button on
// isPending so users can hold-tap +), two writes both reading the
// same old snapshot would lose-update if we wrote literal values.
// The DB CHECK bounds catch any over-increment that slips past the
// pre-validation read.
await db.update(projects).set({ [col]: sql`${projects[col]} + ${delta}` })
```

Three layers: **atomic SQL increment** (lost updates impossible), the
`project_stage_bounds` DB CHECK as a second line of defence against an
over-increment slipping past the pre-validation read, and that constraint
violation caught and translated to *"That would put the count outside 0–the
model count."* rather than surfacing a raw SQLite error. Owner-scoped in the
`WHERE`, so it is IDOR-safe too.

**One nuance, observed but NOT raised as a defect and NOT measured.** The action
returns `{...snap, ...patch}` — the value computed from the *stale* pre-read,
not the true post-increment value. Under two genuinely concurrent bumps both
responses carry the same "next" number while the database holds both
increments. `revalidatePath` is called for `/projects/[id]` and `/dashboard`, so
server-rendered values converge; the DB is authoritative throughout and no data
is corrupted. It would at most be a brief display lag during rapid tapping. I
did not reproduce it, and saying more than that would be inflating a guess into
a finding.

## Time / timezone handling · VERIFIED OK — nothing found

A timezone bug in expiry logic costs a paying subscriber their access early, so
it is worth checking rather than assuming.

**Every timestamp is stored as `integer(..., { mode: "timestamp_ms" })`** —
`planExpiresAt`, `founderClaimedAt`, `freeForeverGrantedAt`, every `createdAt` —
and **every comparison is epoch-millisecond on both sides**:

| site | comparison |
|---|---|
| `billing/plans.ts:142` | `planExpiresAt.getTime() > now.getTime()` |
| `auth/passwordReset.ts:162` | `row.expires.getTime() < Date.now()` |
| `auth/recoveryEmail.ts:115` | same |
| `auth/signupEmail.ts:39` | same |

No date-string comparisons, no local-calendar arithmetic, nothing that shifts
with the server's zone. The single calendar-day concept — `utcDay()` in
`quota.ts` — is explicitly UTC and identical for every user.

**One polarity worth naming.** `getPlanForUser` treats a `pro_monthly` user with
**no** `planExpiresAt` as **active**: *"Stripe hasn't sent the first
`customer.subscription.updated` ping"*. So someone who has just paid is not
locked out while the webhook is in flight. That is **failing open on billing** —
the opposite of the five fail-closed security gates, and correct in both cases:
each direction is the one that protects the user rather than the system.

## R2-22 RETRACTED — libSQL enforces foreign keys BY DEFAULT

I kept digging instead of stopping at "needs Ross", and disproved my own
finding. Run against the installed client:

```
fresh :memory: libSQL client, NO pragma set
  -> PRAGMA foreign_keys = 1
  -> parent deleted, child rows remaining = 0   (cascade FIRED)
```

**libSQL defaults `foreign_keys` to ON — unlike stock SQLite, whose
compile-time default is OFF.** That single assumption is what R2-22 rested on,
and it is false for this engine.

The transport analysis was correct as far as it went (`libsql:` → `https` →
stream-per-statement, so the module-init pragma genuinely does not persist), but
it does not matter: **enforcement never depended on that pragma.**
`src/db/client.ts:29` is belt-and-braces. The clinching evidence was in the repo
the whole time — `tests/integration/_helpers/testDb.ts` sets **no pragma at
all**, yet the `deleteAccount` cascade test passes in the 533-test run.

**Residual, stated honestly:** this tests the local sqlite3/in-memory transport.
Turso's server runs libSQL too, so the same engine default applies — but that is
inference from "same engine", not a direct Turso query. It is a far weaker
uncertainty than the one I raised: turning it off would require a deliberate
server-side override.

**And the impact analysis stands, which is why this mattered.** `deleteAccount`
does exactly one delete — `db.delete(users)` — with no explicit child deletes.
The cascade is the **only** mechanism. So the question was worth chasing; the
answer is simply that the mechanism works.

**Fourth correction to my own work this round, and the most consequential:** had
I stopped one pass earlier, Ross would have been handed an alarming P1 about
deleted accounts leaving their data behind, and it would have been **wrong**.
"Needs the user to verify" is a legitimate ending, but it is not an excuse to
stop looking.

## QUALIFICATION to my own referential-integrity claim — declared, not proven

Applying R2-21's lesson (*I verified a declaration; the truth was in the
runtime*) to my earlier conclusion that "account deletion cascades cleanly".
I verified `onDelete: cascade` in **`schema.ts`**. SQLite only enforces foreign
keys when `PRAGMA foreign_keys=ON` is set **per connection** — so a correct
schema proves nothing on its own.

**The concern is already known and handled.** `src/db/client.ts:23-31` carries
the exact risk in its own comment — *"SQLite leaves foreign-key enforcement OFF
by default, so `ON DELETE CASCADE` in the schema silently do nothing and deletes
leave orphaned child rows"* — and issues the pragma. Found and fixed in an
earlier round (labelled E6/O4). Not a new defect, and I am not raising one.

**But the code hedges, and the hedge is the honest state of my claim:**

```js
// … enforcement is best-effort on remote engines.
void client.execute("PRAGMA foreign_keys = ON").catch(() => {});
```

Two properties follow. The pragma is **fire-and-forget** (module init is sync,
so it cannot be awaited), and it is **connection-scoped** — on Turso's remote
protocol there is no guarantee that every subsequent request lands on the
connection where it was set.

**So the accurate statement is: the cascades are correctly declared and
best-effort enabled. Whether they actually fire against production Turso is
UNVERIFIED.** My earlier section overstated it. I cannot close this from here —
it needs one query against the production database (delete a throwaway account,
then count its child rows), which is Ross's to run, not mine.

## CORRECTION to R2-21 — the finding was real but INVERTED, and worse than filed

Builder 6 read the SDK's **runtime resolver**, not just its JSDoc, and the
result flips the item. Confirmed independently —
`@sentry/core/build/cjs/utils/data-collection/resolveDataCollectionOptions.js:16`:

```js
const base = options.dataCollection != null ? DEFAULTS : defaultPiiToCollectionOptions(options.sendDefaultPii);
```

It branches on whether the **key is present**, not on what it contains. `{} != null`,
so the scaffold's commented-out block — an empty but *present* `dataCollection`
object — selected the **permissive** branch:

| state | userInfo | httpBodies | genAI |
|---|---|---|---|
| `dataCollection` **absent** | `false` | `[]` | both off |
| `dataCollection: {}` ← the repo's actual state | **`true`** | **all 4 targets** | **both on** |

**The commented-out block was strictly worse than having no block at all.**

**Two corrections to what I filed:**
1. I recorded `userInfo` as "default `false` — already fine". That is the JSDoc
   default, and it holds **only on the branch this repo was not on**. It
   resolved **`true`**: `user.*` auto-population was live. I under-reported.
2. My prescribed fix — `httpBodies: []` — would have been **incomplete**. It
   leaves `dataCollection` present, so `userInfo`, `cookies` and `queryParams`
   keep resolving *more* permissively than simply deleting the block. All fields
   are now set explicitly.

**My one speculative check paid off:** I flagged that I had only found the
server and edge configs and asked the builder to check
`src/instrumentation-client.ts`. It had the identical gap — and is arguably the
load-bearing one, since the sign-in POST originates in the browser. Three
runtimes fixed, blocks byte-identical, with a test pinning that so they cannot
drift.

**And the builder correctly refused my other lean.** I suggested weighing
`stackFrameVariables: false` (a `password` local is held across the throwing
await in `signInAction`). In 10.65.0 **nothing reads that option** — capture is
gated on the separate `includeLocalVariables`, which is unset, so it is already
off. Setting it would be *"a placebo that reads like protection."* It guarded
the option that actually controls it instead. **Honest limit: I verified the
resolver branch myself; I did not independently confirm the
`includeLocalVariables` gate — my grep found no matching file at the cited
path.**

Verified: typecheck 0, **843 unit** (829 + 14), 533 integration + 1 skipped,
`origin/main` untouched.

## Service worker · VERIFIED OK in source AND in production — nothing found

A bad service worker serves stale content indefinitely — the classic "I deployed
but users still see the old build". This one is careful in both directions.

**Never cached** (all pass straight through): non-GET requests, cross-origin,
Range requests (206 partials that would poison the cache — the paint loader
Range-peeks the catalog header), anything carrying an `Authorization` header,
all of `/api/**`, and page-navigation HTML *"because it may be authed"*. The
multi-user leak — caching one user's authed response and serving it to another —
is explicitly reasoned about, not incidental.

**Cache-versioning verified live.** The comment records that this exact area
caused two prior incidents: a fixed `mm-shell-v1` name that never changed
(stranding returning users on an old shell, producing a React #418 hydration
mismatch), and a later fix that stamped at **post**build and therefore shipped an
**unstamped** `sw.js`. Both are the sort of regression that recurs silently, so I
checked production rather than the source:

`https://www.mini-mainframe.com/sw.js` → `const BUILD_ID = "84663fdb50a8"` —
the short SHA of `origin/main`. Cache names resolve to `mm-shell-84663fdb50a8` /
`mm-data-84663fdb50a8`; `activate` deletes every cache not in `KEEP_CACHES`, then
`skipWaiting()` + `clients.claim()`. **Correctly stamped, not recurred.**

**Nearly a false lead:** `grep -c "__BUILD_ID__"` on the deployed file returns
**2**, which reads as "the placeholder was never replaced". Both occurrences are
in the **prose comment** describing the token — the stamp script touches only the
`const BUILD_ID = …` line, deliberately. Checking *where* the matches were, not
how many, is the same discipline that resolved the XSS probe.

## Gallery READ path · VERIFIED OK — the leak guard holds end to end

The previous section verified the *producer* sets `isListed` correctly. The
complementary question — and the one that actually decides whether anything
leaks — is whether the **reader** honours it. A careful write path with a
forgetful read path is a real and common gap.

It does not exist here. Every consumer of `isListed` checked:

- **`src/db/queries/recipes.ts:931`** —
  `.where(and(isNotNull(recipes.publicSlug), eq(recipes.isListed, true)))`,
  commented as a **"leak guard"**. It requires **both** a minted public slug and
  the listed flag, so a card cannot surface on one condition alone.
- **`src/db/schema.ts:671`** — `isListed` is
  `.notNull().default(false)`: a new recipe row is **unlisted unless explicitly
  listed**. That is the fifth fail-closed default in this codebase.
- Admin approve/reject set it explicitly to `true` / `false`.

Producer, storage default, and consumer all agree, and the consumer is stricter
than the producer. Nothing to fix.

## Gallery moderation gate · VERIFIED OK — fail-closed at every branch

The gallery is the public shop window, so the question is whether unmoderated
content can reach it. `submitRecipeToGallery` was read in full:

1. `let status: "approved" | "pending" = "pending"` — **pending is the default**.
2. `moderation.verdict === "pass"` is the **only** path to `approved`.
3. Even on a clean pass, if `ensurePublicSlug` fails the status **stays
   pending** — "fall back to `pending` rather than losing the submission".
4. `isListed: status === "approved"` — a pending or flagged image can never
   appear on `/gallery`.
5. Missing `ANTHROPIC_API_KEY` → `verdict: "error"` → not `pass` → pending.
   **A moderation outage degrades to human review, not to open publishing.**

**The resubmit bypass is closed too.** `isListed` is rewritten on *every*
update, so publishing something clean and then resubmitting something else
**delists** the card rather than leaving the approved flag standing. That is the
obvious attack on a moderate-once design, and the comment names it.

**Fourth instance of the same architectural discipline** — after the admin
allowlist (`MM_ADMIN_EMAILS` unset ⇒ nobody is admin), `BILLING_ENFORCED`, and
the test-auth gate. This codebase fails closed by habit.

Which sharpens R2-20 usefully: the test-auth back-door was not a lapse in
standards, it was **the single place the habit was not doubled up** — one
condition where everywhere else has two. That is why it was worth raising
despite not being live.

## Server-side result-union sweep · VERIFIED OK — the refined rule tested again

Testing the refined rule (*risk lives where a TYPE claims to enumerate its
failures*) on the one surface with no `guarded()` boundary: **server components
and route handlers** awaiting the same `ActionResult` unions. A rejection there
is a 500, not a client fault screen.

**23 sites found. All safe, for two different reasons:**

- **20 are server actions calling other server actions.** R2-14's `guarded()`
  sits at the *client* call site and catches whatever the entire server chain
  throws — composition behind a guard is not an unguarded surface.
- **3 are route handlers**, which have no such boundary. Chased the most
  promising — `/api/extension/add` — four levels down:
  `route.ts` (only `try` wraps the JSON parse) → `scrapeAndInsertWishlistItem`
  (`await scrapeUrl(url)` outside its `try`) → `scrapeUrl` → `safeFetchHtml`.

  **`scrapeUrl` catches internally and returns `null`** — `safeFetchHtml` wraps
  its `fetch` in `try/catch → null`, and the vendor parse has its own. The chain
  cannot reject from the scrape path.

**Twenty-fifth false lead avoided.** The hypothesis was good: an unguarded
rejection there would return a bare Next 500 **without** the CORS headers every
other response in that route sets, so the browser extension — running on a
retailer's origin — would see a CORS failure instead of a readable error.
Plausible, specific, and wrong. External scraping is exactly the case the author
already hardened, because scraping is *obviously* unreliable.

**Which is the refined rule holding a second time.** Calls that look fallible
get guarded. The 32 that did not were the ones whose type said `{ok} | {error}`
and therefore looked complete.

## Throwing-parser sweep · VERIFIED OK — the root-cause theory tested and refined

The previous section proposed that the crash class came from an **assumption
about which calls can fail**, and predicted the next instance would appear
"wherever a call looks reliable enough not to need guarding". Tested that
directly against the three classic total-looking throwers:

| call | throws on | unguarded sites | verdict |
|---|---|---|---|
| `decodeURIComponent` | malformed `%`-escape | **0** | clean |
| `JSON.parse` | bad JSON | 4 | all parse the **shipped catalog**, not user input |
| `new URL()` | invalid URL | 11 | 8 take runtime-provided `req.url`; **3 take user input** |

The three user-controlled ones — `extension/add`, `extension/preview`,
`gallerySubmissions` — are **all validated at the boundary first**
(`z.string().url()`, which itself uses `new URL()`), so nothing malformed can
reach them. `gallerySubmissions` goes further with `isProxiableBlobUrl()`,
commented: *"`z.url()` alone let a signed-in user point `imageUrl` at any
host"* — the SSRF/content-injection concern, anticipated.

**Zero findings, and the theory is sharper for it.** The prediction was too
broad. It is not "anything that looks reliable" — input parsing has **no**
illusion of totality (every developer knows `JSON.parse` throws), so it got
guarded consistently. The crash class was specific to **awaited server actions**,
where a typed `ActionResult` union *manufactures* a false sense of totality:
the type enumerates the failures, so `!res.ok` reads as the complete failure
surface and the rejection path is invisible.

**Refined rule: the risk is not code that looks safe — it is code whose TYPE
claims to enumerate its failures.** That predicts a much narrower and more
checkable target than "be careful", and it is why 32 instances accumulated in
one shape while three other throwing-call classes have none.

## Analytics payloads · VERIFIED OK — nothing found

Same privacy family as R2-21: what leaves the app, to whom. Analytics goes to
`@vercel/analytics` — the host, not an additional third party — and every
property at every call site is **non-PII**:

`{ brand }` (a paint brand), `{ priceKey }`, `{ plan }`, `{ location: "hero" }`,
`{ recipeId }` (an opaque id for the user's own recipe). **No email, username,
or user id is ever sent.**

**The contrast with R2-14 is the interesting part.** `trackServer` wraps its
await in `try/catch` and documents itself: *"Never throws — analytics is
strictly best-effort and must never break the user action it rides along
with."* That is exactly the discipline the 32 unguarded server-action call
sites lacked, in the same codebase, by the same author.

So the crash class was never carelessness — it was an **assumption about which
calls can fail**. Analytics is *known* flaky, so it got defensive treatment. A
server action returning `ActionResult` *looks* total, so `!res.ok` was treated
as the whole failure surface and the rejection path went unconsidered. That is
a far more useful root cause than "someone forgot a try/catch", and it predicts
where the next instance will appear: wherever a call looks reliable enough not
to need guarding.

## R2-21 · P2 · Sentry collects HTTP request bodies by default — including the sign-in POST

`sentry.server.config.ts` and `sentry.edge.config.ts` leave the scaffold's
`dataCollection` block **entirely commented out**:

```js
dataCollection: {
  // userInfo: false,
  // httpBodies: [],
},
```

Read from the **installed SDK's own type definitions** (`@sentry/nextjs`
10.65.0 → `@sentry/core/.../datacollection.d.ts`), not inferred:

| option | default | assessment |
|---|---|---|
| `userInfo` | **false** | fine — off already |
| `cookies` | `true`, but *"sensitive values like keys and tokens are **always** filtered out"* | **session token is safe** |
| `httpHeaders` | `{request: true, response: true}` | same filtering applies |
| `queryParams` | `true` | same filtering applies |
| **`httpBodies`** | **`['incomingRequest','outgoingRequest','incomingResponse','outgoingResponse']`** | **the concern** |
| `genAI` | `{inputs: true, outputs: true}` | user recipe prompts recorded |
| local variables in stack frames | `true` | a `password` local in a throwing frame |

**The scope, stated precisely.** The always-filtered guarantee in the SDK docs
attaches to `CollectBehavior` — the key-value surfaces (cookies, headers, query
params). It is **not** stated for **bodies**. This app POSTs plaintext
credentials to sign-in and sign-up, and errors on that path are realistic — R2-14
just fixed unguarded awaits on `signInAction`/`signUpAction` that threw on any
network blip. An error there can carry the incoming request body.

**What I verified:** the SDK defaults, from the installed package's types.
**What I did NOT verify:** that a credential has ever actually reached Sentry,
or how the Sentry project's own server-side scrubbers are configured (they strip
`password`-like fields by default, which may already mitigate this — but that is
a dashboard setting, not something this repo controls or that I can read from
here).

**Fix:** uncomment the block the scaffold already provides —
`httpBodies: []` at minimum. Consider `genAI.inputs: false` too: recipe prompts
are user content going to a third party for no diagnostic benefit. Scrubbing at
the source does not depend on a dashboard setting staying right.

## Share-slug predictability · VERIFIED OK — nothing found

The public share slugs visible in `sitemap.xml` are human-readable
(`ultramarines-classic`, `necrons-living-metal`), which reads as *slugs are
derived from recipe names* — meaning anyone could guess or enumerate other
people's share links, and "share by link only" would be no privacy at all.

**Not what happens.** `publishRecipe` mints via `generatePublicSlug()`:
**10 characters from a 33-char alphabet — 33^10 ≈ 1.5×10^15.** Not derived from
the name, not sequential, not enumerable. The readable ones in the sitemap are
seeded demo content. Publishing is also idempotent — re-publishing returns the
existing slug rather than minting a second live URL for the same recipe.

**The alphabet choice is worth noting** — `a-z` minus `l`, plus digits `2-9`,
deliberately excluding `0`/`1`/`l` because they are misread *"when a friend
types the URL off a screenshot or copies it from a QR scan glitch"*. That is a
usability decision made for exactly how these links travel in this hobby —
photographed off a phone at a painting table — not a generic
unambiguous-alphabet cargo-cult.

Trivial, not raised: `recipeSharing.ts` says "~8.2×10^14 possible slugs" where
`slug.ts` computes 1.5×10^15. Both are far past "vanishingly rare"; the comment
is just slightly stale.

## Username homoglyph / normalisation · VERIFIED OK — closed by construction

Applying R2-16's generalisable rule (*the raw string is not what the system acts
on*) to the next string guard: username uniqueness. Two different Unicode
sequences can render identically — NFC vs NFD, or Cyrillic `а` for Latin `a` —
so an un-normalised uniqueness check lets someone register a username visually
indistinguishable from another user's. A real impersonation class.

**This app is immune, and not by normalising — by charset.**
`USERNAME_RE = /^[a-z0-9][a-z0-9_-]{2,19}$/` is **ASCII-only**: lowercase
letters, digits, `_`, `-`. No non-ASCII character can ever be a username, so
there is nothing to normalise and no homoglyph pair to collide.

Checked the edges too:
- `"Admin "` → trimmed + lowercased → `admin` → caught by `RESERVED_USERNAMES`;
- Cyrillic-`а` `аdmin` → passes the reserved check (different string) but is
  rejected by the regex as `invalid-chars`, so it cannot be registered at all;
- `İ`.toLowerCase() yields `i` + combining dot, which fails the regex — the
  Turkish dotless-I trap is closed by the same rule.

**Twenty-first false lead avoided.** Restricting the alphabet is a stronger
defence than normalising it, because it removes the class rather than handling
it. Worth noting as a design decision that is doing real security work quietly.

## R2-16 RESOLVED — it was real, and my proposed fix would have left a hole

I filed R2-16 as **UNVERIFIED**, reasoning from browser normalisation rather
than an observed redirect, and said so. Builder 4 drove it through a real
sign-up in a real browser with off-origin requests stubbed:

| `?from=` | result |
|---|---|
| `/\example.com` | **ESCAPED → http://example.com/** |
| `/\/example.com` | **ESCAPED → http://example.com/** |
| `/<TAB>/example.com` | **ESCAPED → http://example.com/** |
| `//example.com` | held → `/dashboard` |
| `https://example.com` | held → `/dashboard` |

**Real — and my proposed fix was insufficient.** `!next.includes("\\")` closes
the two backslash variants and **leaves the TAB one open**: browsers strip
TAB/LF/CR from anywhere in a URL exactly as they normalise `\` to `/`. That is
the worst kind of patch — one that looks like it closed the hole. The guard now
rejects control characters too and moved to `src/lib/auth/postAuthPath.ts`,
because `lib/actions/auth.ts` is `"use server"` where every export must be an
async action, so it could not be unit-tested where it lived.

**The generalisable rule, worth more than the fix:** the raw string is not what
the browser acts on. Any guard over a URL or identifier must be tested against
the *normalised* form, not the literal one.

Two further corrections from the same batch:
- **`/pricing` declared NEITHER metadata block**, not just `twitter` — worse
  than I filed. And **Next REPLACES a declared metadata field rather than
  merging it into the parent's**, so every new `twitter` block must restate
  `card: "summary_large_image"`. That rule cost `/pricing` its inherited image
  mid-fix — newly creating the exact defect R2-12 describes, in the act of
  fixing R2-13.
- **O-4** was fixed with a hard line break rather than a measured retune,
  because Satori renders against a **system** font stack — any measured fix is
  only correct for the font it was measured against.

**New, deliberately not actioned:** `useInstallPrompt.promptInstall`
(`src/components/pwa/useInstallPrompt.ts:69`) is a fifth stuck-flag-*shaped*
await, but it wraps a browser API rather than a server action, and fixing it
requires deciding what a failed install prompt should show. Product call, P3.

## Email surface RE-DERIVED behaviour-first — complete, and R2-19 gets a better fix

My rate-limit sweep was scoped by **directory** (`src/lib/auth/`) — scoping by
location rather than behaviour is the same class of blind spot as scoping by
name. Re-derived from the behaviour instead:

**Exactly one module in the whole codebase talks to a mail provider** —
`src/lib/auth/sendVerificationEmail.ts`, a single
`fetch("https://api.resend.com/emails")`. A grep for `resend|nodemailer|
sendgrid|postmark|mailgun|smtp` across all of `src/` finds no other sender.
Five call sites, all routing through it.

So the directory-scoped sweep **was** complete — now known rather than assumed,
and **R2-19 remains the whole picture**: `requestPasswordReset` is the only
unauthenticated, unthrottled sender.

**This upgrades R2-19's fix.** Because every email in the app funnels through
one primitive, a limiter can sit **there** as a backstop that no future caller
can forget, rather than being applied per-caller. Per-caller limiting is still
right for the *user-facing* behaviour (the reset path needs its silent-ok
cooldown to preserve non-enumeration), but a chokepoint guard in
`sendVerificationEmail` means the next email feature added cannot ship
unthrottled by omission. Worth doing both.

## IDOR sweep RE-DERIVED name-agnostically — conclusion holds, method had a 50% blind spot

Applying the convention-binding test to my most security-critical sweep. The
original examined functions **named** `delete*`/`remove*`. Server-action names
have **no binding convention** — the same category as `useTransition`, not the
same as `setX`. So I re-derived it by finding every function that performs
`db.delete(` regardless of name:

**18 functions delete rows. My original sweep could see 9 of them.**

The 9 that were **invisible** to it: `applyImport`, `cloneRecipeFromSlug`,
`saveRecipe`, `requestPasswordReset`, `applyPasswordReset`,
`resendSignupVerification`, `destroyCurrentSession`, `signUpWithCredentials`,
`applyOwnershipToInventory`.

**Result: still zero IDOR.** All 18 are correctly scoped. The two the heuristic
flagged as lacking a user reference are false positives, both verified by
reading:
- `destroyCurrentSession` deletes by the session token from the **caller's own
  cookie** — inherently self-scoped;
- `requestPasswordReset` deletes `verificationTokens` by an identifier
  **derived from the looked-up `user.id`**.

Neither uses a literal `userId` variable, which is all the text heuristic could
see.

**The honest part: the conclusion was right, but I published it from a sweep
that could only see half the surface.** It survived because the other half
happens to be correct too — that is luck, not method. "Zero IDOR" is now
grounded in all 18 sites and can be relied on; before this pass it could not.

## R2-15 re-validated name-agnostically — complete, and here is WHY it survived

Having learned R2-14's lesson the hard way, I applied it to my own remaining
enumeration. R2-15's sweep matched a **fixed list of flag names**
(`Pending|Loading|Busy|Saving|Submitting`) — the identical buried assumption
that cost R2-14 thirteen blocks.

Re-derived **name-agnostically**: harvest every `const [x, setX] = useState`
setter per file, then look for *any* of them set truthy → `await` → cleared,
with no `try`. Run against the tree **before** builder 4's fix (`1258123^`):

**3 file+setter pairs — `AccountClient/setResendPending`,
`PlannerCalendar/setBusy`, `AssignPaintMenu/setPending` — exactly the 4 blocks
already reported. No undercount.**

(Run against the current tree it returns **0**, which is the fix landing, not a
broken script. I checked that before believing either number — a "better" method
returning fewer hits than a verified one is a bug until proven otherwise.)

**The refined lesson — it is not "never assume a name":** it is *know whether a
convention actually binds*. `useState` setters are `setX` by near-universal
React idiom, so a name-based sweep is safe. `useTransition`'s second element has
**no** naming convention, and this codebase used **seven** different names for
it. Same assumption, opposite safety, decided by whether the ecosystem enforces
the convention — not by how careful the regex looks.

## CORRECTION — R2-14 was 32 blocks, not 19. My sweep's ASSUMPTION was wrong.

Builder 4 re-derived the class and found **32 unguarded blocks across 19
files** — 13 more than my table. **All 19 of mine were real (no false
positives); I undercounted by 41%.**

The cause is worth recording precisely, because I had already "fixed" this sweep
once and believed it was solid. My regex matched `startTransition(`. **This app
destructures `useTransition` under six other names** — `start`, `startAttach`,
`startSave`, `startDelete`, `startBulkTransition`, `creatingProject` — so
identical blocks in `ArmyImportPanel` (2), `DashboardClient` (3),
`AccountClient/startSave` (2), `ModelCounterGrid` (2), `LibraryClient/bulk` (1),
`CreateProjectView` (1), `ProjectsTable` (1) and `GenerateRecipeDialog` (1) were
invisible to it. The builder resolved each file's own transition names, brace-
matched complete blocks, and blanked comments first.

**This is the fifth costume of the same lesson, and the most instructive.** The
earlier four were precision failures — a window too short, a HEAD request, a
source reference, the wrong SQL engine — and I caught each one. This was a
**recall** failure: I twice re-derived the list, fixed a whitespace bug, and
took the improved number as evidence the method was sound. I never tested the
underlying *assumption* that the destructured name is always `startTransition`.

Re-deriving a result with the same buried assumption reproduces the assumption,
not the truth. "I checked it twice" is not the same as "I checked what I assumed."

## R2-20 · P3 · Test-auth back-door is one env var from a total auth bypass (NOT currently exploitable)

`src/app/api/test/sign-in/route.ts` mints a session for **any email posted to
it**, with no password — it exists so Playwright can skip the login flow.

**It is correctly off in production. Verified live: `POST /api/test/sign-in` →
404 "Not found".** The gate has the right polarity — opt-in, fails closed:

```js
if (process.env.ALLOW_TEST_AUTH !== "1") return new NextResponse("Not found", { status: 404 });
```

**The hardening:** that is the *only* condition. It is not also gated on
`NODE_ENV !== "production"`. So a single stray env var — a preview config
copy-pasted into the production project, a `.env` promoted by accident — turns
this into an open endpoint that mints a session for **any account, including an
admin's**, with no credential. Builders set `ALLOW_TEST_AUTH=1` routinely for
local dev and the Playwright web server, so the value does circulate.

**To be clear: this is not a live vulnerability.** It is defence in depth on the
one endpoint whose failure mode is complete account takeover, and the fix is one
clause:

```js
if (process.env.NODE_ENV === "production" || process.env.ALLOW_TEST_AUTH !== "1") …
```

**Verify:** the E2E suite still authenticates locally, and the route still 404s
in a production build even with `ALLOW_TEST_AUTH=1` set.

Also checked: `/dev` and `/dev/theme` 307 to sign-in in production
(`isPublicPath` only opens `/dev` when `NODE_ENV !== "production"`), so the dev
theme studio is not publicly reachable.

## Admin gating · VERIFIED OK (live + source) — nothing found

`/admin/comp` grants free Pro access, so a weak gate here is self-service Pro.

**Live, signed out:** `/admin`, `/admin/comp`, `/admin/gallery` all **307 →
`/sign-in`**.

**Source — four layers, each closing a bypass the previous one leaves open:**

1. **Fails closed.** `MM_ADMIN_EMAILS` unset or empty ⇒ empty set ⇒ **nobody**
   is admin. No hard-coded fallback address, and the file says why: a missing
   env var must not silently promote a hard-coded email, nor let whoever can
   register that address self-grant moderation.
2. **Requires a VERIFIED email.** This is the one that matters most — users set
   their own email, so without the verification requirement the allowlist would
   be self-service: set your address to the admin's, become admin. `isAdminUser`
   returns false on no email, unverified email, or an off-list email.
3. **Action-level gate, not just page-level.** `adminComp.ts` runs its own
   `requireAdmin()` (`currentUserId()` + DB lookup) so invoking the server
   action directly does not bypass the page gate. Page gating alone would be
   bypassable.
4. **`notFound()`, not a redirect,** for a signed-in non-admin — the route does
   not confirm it exists.

The allowlist module is also deliberately free of `@/auth` imports so the same
check can be shared by server components and action files.

Nothing to fix. Worth knowing this rests on `MM_ADMIN_EMAILS` being set in the
Vercel env **and** the admin account's email being verified — if admin pages
ever 404 for Ross, that pair is the thing to check, not a bug.

## Migration chain · VERIFIED OK — nothing found

Nothing surfaces a broken migration until someone provisions a fresh
environment, so I checked both the catalogue and the execution.

**Journal integrity:** 42 entries, 42 `.sql` files, exact 1:1 mapping — zero
journal entries without a file, zero files missing from the journal, `idx`
contiguous 0..41, no duplicate tags, timestamps monotonic.

**Actually applied:** all 42 replayed in journal order into a throwaway SQLite in
the scratchpad (never near `data/local.db`). **42/42 files, 0 statement
failures**, producing **24 tables and 61 indexes**.

**Twentieth false lead avoided — and this one looked severe.** The first run
died at `0006_make_email_nullable_add_password` with
``near "ALTER": syntax error`` on:

```sql
ALTER TABLE `user` ALTER COLUMN "email" TO "email" text;
```

Read as *"migration 6 of 42 is broken; a fresh environment cannot be
provisioned"* — alarming and completely wrong. `ALTER COLUMN` is a **libSQL
extension**, not standard SQLite. `drizzle.config.ts` declares
`dialect: "turso"`, so drizzle-kit emitted libSQL syntax **on purpose**, in
exactly 2 of 42 files. Turso runs it; Python's bundled SQLite 3.50.2 cannot.
The empirical clincher: production runs on Turso with all 42 already applied.

**The harness was wrong, not the migrations** — the same lesson as the truncated
windows and the HEAD-request compression check, in a fourth costume. Re-running
with those 2 statements skipped verified the remaining 40 in full rather than
abandoning the axis.

## Query indexing on owner columns · VERIFIED OK — nothing found

Every user-scoped query in this app filters by owner, so an unindexed owner
column means a full table scan that degrades as the app grows.

**16 of 17 owner columns carry an index** — `projects.ownerId`,
`recipes.ownerId`, `wishlistItems.ownerId`, `inventoryEntries.ownerId`,
`palettes.ownerId`, `imports.ownerId`, `projectImages.ownerId`, and
`userId` on `accounts`, `recipeStepCompletion`, `paintNotes`, `events`,
`activityLog`, `inspoImages`, `paintSessions`, `feedback`, `sponsorships`.
That is deliberate, not lucky.

**Nineteenth false lead avoided.** The 17th — `sessions.userId` — has no index,
which reads as "every authenticated request scans the session table". It does
not: `sessionToken` is the **primary key**, and every session query goes through
it (`where(eq(sessions.sessionToken, …))`). `userId` is touched only by the
`onDelete: cascade` when an account is deleted — rare, on a small table.
Correct as written.

**This closes a loop from earlier in the session.** Ross's original complaint
was lag on the project page. The database is properly indexed, so that lag was
never query performance — it was the two round-trips plus whole-account payload
identified in the earlier performance work. Worth stating so nobody goes looking
for a slow query that does not exist.

## Referential integrity / account deletion · VERIFIED OK — nothing found

Deleting an account is a privacy-relevant path: any child table without a
cascade leaves that person's rows behind after they asked to be gone.

Parsed **every** `.references(...)` call in `src/db/schema.ts` to its matching
paren (not a line grep — many span lines):

**28 FK references, 28 with an explicit `onDelete`. Zero without.**

| onDelete | count |
|---|---|
| `cascade` | 23 |
| `set null` | 5 |

**All 17 tables referencing `users.id` cascade** — `accounts`, `sessions`,
`projects`, `inventoryEntries`, `wishlistItems`, `recipes`, `palettes`,
`imports`, `recipeStepCompletion`, `paintNotes`, `events`, `activityLog`,
`inspoImages`, `projectImages`, `paintSessions`, `feedback`, `sponsorships`.
Nothing is orphaned by `deleteAccount`.

**And the 5 `set null` entries are all the right way round** — every one points
at `projects.id` or `recipes.id`, so deleting a *project* nulls the link on a
wishlist item or recipe instead of deleting it, and `users.focusProjectId`
simply clears. Deleting a project does not silently take your wishlist with it.

Noted, not raised: `sponsorships` cascades too, so a deletion removes the local
payment record. Stripe remains the authoritative ledger, and erasing local
billing rows is the privacy-respecting reading of a deletion request — but it
is a choice worth being aware of rather than a bug.

**Method note:** a naive `grep -c` said "54 references, 28 onDelete" — a
26-column gap that reads as a serious privacy hole. `references` also appears in
comments and type imports, and real declarations span lines. Parsing properly
gives 28/28. Same trap as the earlier truncated-window errors, caught before
reporting.

## Paywall enforcement · VERIFIED OK on deployed `main` — nothing found

`isProUser()` (`src/lib/billing/enforce.ts:68`) opens with:

```js
if (!BILLING_ENFORCED) return true;   // everyone is Pro
```

Deliberate — it kept Pro surfaces open for testing pre-launch — but it means the
**entire paywall hinges on one constant**, and a stale `false` would silently
give every gated feature away for free. So I checked what production actually
runs rather than what the working branch says:

`git show origin/main:src/lib/billing/plans.ts` → **`BILLING_ENFORCED = true`**.

It is a hardcoded constant, not an env var, so it cannot drift per-environment
or be lost in a Vercel settings change.

Model on `main` matches the intended one: free tier keeps projects, recipes and
wishlist **unlimited**; the wall is the creator's tools (wheel, matching,
layering, AI); `pro_monthly` $3.99/mo is the only tier sold; `pro_lifetime` and
`founder` are dormant. Tier is derived from columns the Stripe webhook
populates, plus `freeForeverGrantedAt` for admin comps.

**Scope limit:** I verified the flag, its source of truth, and the code path. I
did **not** drive a live signed-in non-subscriber against a gated feature to see
a 402 — that needs credentials against production.

With this, the money surface is verified end to end: **payments in** (webhook
signature-verified and not spoofable), **entitlement** (enforced on the deployed
constant), **spend out** (AI and storage both capped).

## Stripe webhook · VERIFIED OK in production — nothing found

The highest-consequence endpoint in the app: forge a subscription event and you
grant yourself Pro, or corrupt someone's billing state. Verified in source
**and** live.

Source (`src/app/api/billing/webhook/route.ts`):

| control | present |
|---|---|
| signature verification via `stripe.webhooks.constructEvent` | YES |
| **raw** body — `await req.text()`, never `req.json()` first | YES |
| webhook secret from env | YES |
| idempotency (replayed events not double-applied) | YES |
| rejects with 400 | YES |

The raw-body detail is the one that most often goes wrong — parsing the JSON
before verification silently breaks the signature check. This code does it right
and says so in a comment.

**Live against production:**

| request | response |
|---|---|
| unsigned POST with a `customer.subscription.created` payload | **400 "Missing signature"** |
| POST with forged `stripe-signature: t=1,v1=deadbeef` | **400 "Invalid signature"** |

Not spoofable. Combined with the earlier sweeps, every money-touching surface in
the app — payments in, AI spend out, storage — is now verified bounded and
authenticated.

## Blob-upload spend surface · VERIFIED OK — nothing found

`api/project-images/upload` and `api/gallery-submissions/upload` both showed
**no `RateLimitBucket`**, which reads as uncapped writes to **paid** Blob
storage — and would have contradicted the "spend is always capped" pattern I
had just written down. **Seventeenth false lead avoided:** they have a stronger
control than a daily bucket.

`onBeforeGenerateToken` is the only place a tampered client cannot bypass, and
it enforces, per upload:

| control | value |
|---|---|
| caller signed in | 401 before token issue |
| caller **owns** the target project | `and(eq(id), eq(ownerId, userId))` |
| per-project image cap | **`MAX_IMAGES_PER_PROJECT` = 12** |
| max file size | **`MAX_IMAGE_BYTES` = 8MB** |
| allowed types | PNG / JPEG / WEBP only |
| filename collision | `addRandomSuffix: true` |

`allowedContentTypes` and `maximumSizeInBytes` are returned to Vercel Blob and
**enforced by Blob on the PUT**, not merely trusted client-side, and
`recordProjectImage` re-checks ownership and the cap before writing the row.
`src/lib/blob/limits.ts` is a single source of truth shared by the client
pre-flight, the token route, and the record action.

Honest residual, **not** raised: the cap is per project, and project creation
itself is unlimited, so a determined authenticated user could create many
projects to hold many images. That needs sustained deliberate abuse and is a far
weaker concern than an uncapped endpoint. The design is sound.

**So the pattern from the previous section holds after checking rather than
assuming:** every surface that costs Ross money is bounded — LLM calls and paint
scans by daily buckets, Blob storage by ownership plus hard caps. The only gaps
remain the two auth paths where abuse is free to the attacker (R2-18, R2-19).

## AI cost exposure · VERIFIED OK — nothing found

Every path that can spend Anthropic money, checked:

| surface | auth | subscriber gate | daily limit | validation |
|---|---|---|---|---|
| `/api/recipe/ai` | YES | YES (402) | YES (`RecipeAi`) | YES |
| `scanPaintsFromPhoto` | YES | YES | YES (`PaintScan`) | YES |
| `generateRecipeFromColors` | YES | **n/a** | **n/a** | YES |

**Sixteenth false lead avoided.** `generateRecipeFromColors` showed "no limiter,
no gate" in my sweep — which reads as *uncapped paid API calls for any signed-in
user*, a compelling spend-exposure finding. It is **not an AI action at all**.
Its own docstring: *"NOT Pro-gated: this is the free, no-LLM hook."* It is
deterministic ΔE2000 grounding against the local catalog. Nothing to cap.

**The pattern worth naming, which R2-18 and R2-19 belong to.** The rate limiter
is applied consistently everywhere a request **costs Ross money directly**
(LLM calls, paint scans) — that threat model is complete and well executed. It
is absent everywhere the abuse is **free to the attacker but harmful to a user**
— unlimited sign-in attempts (R2-18) and unlimited password-reset emails
(R2-19). Not an oversight in one place; a threat model that covered spend and
not abuse. Fixing the two auth gaps completes it, and the machinery already
exists.

## R2-19 · P2 · `requestPasswordReset` is unauthenticated, unthrottled, and sends email

Swept every function in `src/lib/auth/`. Six send email; only **two** are rate
limited (`signUpWithCredentials`, `resendSignupVerification`). The one that
matters is `requestPasswordReset` — read in full:

- **no auth check** — anyone can call it with any username;
- **no throttle** of any kind;
- **sends an email on every single call.**

Everything *else* about it is careful: silent `ok: true` for malformed, unknown,
and no-email-on-file alike (non-enumerating), a 1-hour token lifetime, and it
deletes any outstanding token first so only one is ever live.

**That last, good decision is what makes this worse than inbox spam.** Because
each request invalidates the previous token, an attacker hammering a victim's
username **continuously destroys the reset link the victim is trying to use** —
a sustained attack means the victim can never complete a password reset. That is
a denial of account recovery, not just noise.

Second cost: mass sends to one address invite spam complaints, which damages
sender reputation on the `mail.` subdomain set up specifically for
deliverability — and burns Resend quota.

**Fix:** a short-window limiter keyed on **username** (not only IP — the target
is the username, and an attacker can rotate IPs), plus a cooldown that returns
the same silent `ok: true` so the non-enumeration property is preserved. Do NOT
switch it to a visible error on throttle; that would hand back the enumeration
oracle the silent-ok design deliberately avoids.

| `src/lib/auth/*` | limiter | sends email |
|---|---|---|
| `requestPasswordReset` | **no** | **YES** — unauthenticated |
| `resendRecoveryEmailVerification` | no | YES (needs a session) |
| `verifyRecoveryEmailToken` | no | YES (token-gated) |
| `sendVerificationEmail` | no | YES (internal; its caller is limited) |
| `signUpWithCredentials` | YES | YES |
| `resendSignupVerification` | YES | YES |

## R2-18 · P2 · Sign-in has no rate limiting, in an app that already has the machinery

`signInWithCredentials` (`src/lib/auth/signUp.ts`) verified by reading:
**no `enforceDailyLimit`, no `RateLimitBucket`, no lockout, no backoff.**
Password attempts against a known username are unlimited.

The app already has a working limiter — `src/lib/rateLimit/quota.ts` — with
exactly four buckets: `RecipeAi`, `GallerySubmit`, `Signup`, `PaintScan`.
**Sign-in was never wired to it.** So this is an omission, not a missing
capability.

**Severity is moderate, and the reasons matter:**
- bcryptjs at **cost 10 (~50ms/attempt)** is a genuine natural throttle. This is
  not an offline-speed guessing surface.
- Sign-in already returns a single generic *"Wrong username or password"* for
  malformed input, unknown user, and bad password alike — **no enumeration
  oracle**. That part is done right.
- What remains: unlimited **credential-stuffing** attempts (known email/password
  pairs; bcrypt does not help there — each pair is one request), and every
  attempt is a **billed serverless invocation**, so a sustained attack is also a
  cost event.

**The fix needs a design choice, so do not apply the existing helper blindly.**
`enforceDailyLimit` is a **UTC-day counter keyed per IP**. Used on sign-in that
would lock out legitimate users behind a shared IP — office, university, CGNAT —
for the rest of the day. There is direct evidence this bites: the signup bucket
is 10/IP/day, and builder 3 found a few full E2E runs exhausted it, with the
failure reading exactly like a flake. Prefer a **short-window** limiter keyed on
**username + IP** with exponential backoff, not a daily cap.

**Verify:** N failed attempts in quick succession start being rejected; a
correct password still succeeds immediately from a different IP; and a
legitimate user is never locked out for a day.

## Paint-catalog delivery · VERIFIED OK — nothing found

`/data/paints.json`, the 7,000-paint catalog:

| property | value |
|---|---|
| uncompressed | 1,758,429 B |
| **on the wire (brotli)** | **181,410 B** |
| `Cache-Control` | `public, max-age=300, s-maxage=3600` |
| ETag | strong, present |
| CDN | `X-Vercel-Cache: HIT` |

**Fifteenth false lead avoided.** `max-age=300` on a 1.7MB catalog reads as
"every returning visitor re-downloads it after five minutes" — an alarming and
very reportable-sounding finding. I tested the conditional request instead of
assuming:

- `If-None-Match` → **304, 0 bytes, 83ms**
- unconditional → 200, 181,410 bytes, 110ms

So the real cost after expiry is one revalidation returning **zero bytes**, not
a re-download. Revalidation is working exactly as intended.

Optional micro-win, **not** raised as a defect: raising `max-age` (the URL is
stable, not content-hashed, so `immutable` is not available) would spare even
that 83ms round trip, at the price of the catalog being up to that long stale
for someone who already holds a copy. That is a freshness call, and the current
setting is defensible.

## CORRECTION to my O-2 finding — the builder was right, I was wrong

I wrote that `SidebarRail` shipped the full **254,751-byte** poster as an
`<img>` on every signed-in page. **It did not.** It already used `next/image`
and pulled 19,787 B on desktop. I inferred the cost from the source reference
without measuring the delivered bytes.

The real waste was different and subtler: DPR-driven variant selection meant a
**3× phone fetched a 384px render (41,354 B) for a rail that is `hidden` below
`desk:`** — bytes for something never shown. Capping the source at 300px caps
every variant. Same conclusion, wrong reasoning, and the number in my spec was
off by an order of magnitude.

Builder 3's measured result: rail desktop 19,787 → **13,083 B**, iPhone
41,354 → **18,682 B**; and the landing still + `<video poster>` now share one
WebP so the desktop hero stops downloading the artwork twice.

**Lesson, same family as the truncated-window errors:** a source reference
tells you what is *asked for*, not what is *delivered*. `next/image` sits
between them. Measure the wire.

## PWA manifest + icons · VERIFIED OK — nothing found

`/manifest.webmanifest` → 200 `application/manifest+json`, well-formed: `name`,
`short_name`, `description`, `start_url: /dashboard`, `display: standalone`,
background/theme `#06080a`, and three icons including a **maskable** 512.

Every icon fetched and its real pixel dimensions read from the PNG header —
a declared-size mismatch is a silent Android install failure, so the declaration
alone is not evidence:

| icon | actual | declared | |
|---|---|---|---|
| `icon-192.png` | 192×192 | 192×192 | MATCH |
| `icon-512.png` | 512×512 | 512×512 | MATCH |
| `icon-maskable-512.png` | 512×512 | 512×512 | MATCH |
| `apple-touch-icon.png` | — | — | 200, 32KB |

Install will work.

Minor, **not** batched: `icon-512.png` is 293KB and the maskable 184KB, heavy
for flat logo artwork that should compress far smaller. They load at install
time only, not on page load, so the user-facing cost is negligible — noting it
in case the O-2 asset pass is touching that folder anyway.

## Hostile-input robustness on public routes · VERIFIED OK — nothing found

Edge inputs against `/r/<slug>` on production:

| input | result |
|---|---|
| unknown slug | 404 branded page |
| 300-character slug | 404 |
| `../../etc/passwd` | **400** — rejected at the URL layer |
| `%2e%2e%2f` (encoded traversal) | 404 |
| `<script>alert(1)</script>` | 404 |
| `null`, `0` | 404 |

**No 500s, no stack traces, no crashes.**

**No reflected XSS.** The XSS probe echoes into the 404 document, so I located
every occurrence rather than trusting the status code: all six are the
**percent-encoded** form `%3Cscript%3E…`, sitting either in quoted `og:image` /
`twitter:image` attributes (no `<`, `>` or `"` to break out with) or
JSON-escaped inside the RSC Flight payload. The raw tag appears nowhere. The
`/sign-in?from=` parameter is clean too (0 raw tags).

**Dead share links degrade gracefully.** `/r/<nonexistent>/opengraph-image`
returns 200 `image/png` — a fallback card reading "Shared paint recipe" with the
wordmark and no swatches, verified by eye. So a deleted or mistyped recipe link
unfurls as a tidy branded card rather than a broken image, and shows no
`undefined`.

## Focus visibility (WCAG 2.4.7) · VERIFIED OK in a real browser — nothing found

All 8 focusable controls on `/sign-in` carry a **2px solid outline** — cyan
`#00F5FF`, white `#E6E5E5`, blue `#4AA8DA` — every one high-contrast on the dark
surface. **Zero controls with no focus indicator.**

**Method check, because the obvious version of this test lies.** Programmatic
`el.focus()` can match `:focus` while real keyboard navigation uses
`:focus-visible` — so an outline seen this way can be one a keyboard user never
gets. I tested which pseudo-class actually matched:

- every element returns `el.matches(':focus-visible') === true`, so the measured
  outline **is** the keyboard outline;
- the stylesheet carries **2 `:focus-visible` rules and 0 plain `:focus` rules**.

That is the modern pattern applied deliberately: keyboard users get a ring,
mouse users do not. Nothing to fix.

## Live browser pass on public pages · console clean, and O-3 quantified exactly

Real Chromium against production (no local server — builder still running).

**Console: 0 errors, 0 warnings** on `/` and `/gallery`.

**Landing-page resource timing — the video is 99.5% of the page:**

| metric | value |
|---|---|
| total transfer | 2,152KB |
| `mini-mainframe-logo.mp4` | **2,143KB** |
| everything else, all 52 other requests | **~9KB** |
| requests over 90KB | **1** — the video |
| TTFB / DOMContentLoaded / load | 69ms / 82ms / 156ms |

So the app itself is genuinely fast; the landing page is a ~9KB page wearing a
2MB coat. That is the sharpest possible statement of O-3's value.

**Nuance for O-2:** the 254KB poster does **not** appear in the landing page's
resource list — autoplay starts the video and the browser skips the poster
entirely. O-2's cost is therefore real only on **signed-in** pages via
`SidebarRail`, which is how it is written up. Do not expect O-2 to move the
landing-page number.

**Builder 3's O-3 result, measured on disk:** mp4 2,193,706 → **277,892** bytes
(-87%) plus a **172,948**-byte WebM source. Beats the under-300KB target. Not
yet deployed — production still serves the old 2.09MB file, which is why the
table above still shows it.

## Accessibility, PUBLIC surfaces · VERIFIED OK in a real browser — nothing found

First attempt was a static sweep and it produced **only** false positives — the
3 "missing `alt`" hits were `<img>` written inside doc comments, and all 10
"unlabelled buttons" had their text stripped by my own regex before the test.
So I re-ran it properly: Playwright against **production**, reading the live DOM
(no local dev server needed, so no collision with the running builder).

| page | buttons | links | imgs | unnamed | headings | `lang` |
|---|---|---|---|---|---|---|
| `/` | 5 | 16 | 8 | **0** | 1,2,2,2 — no jumps, one `h1` | en |
| `/sign-up` | 2 | — | — | **0** (3/3 inputs labelled) | single `h1` | en |
| `/r/<slug>` | 1 | 4 | 1 | **0** | single `h1` | en |

Also confirmed on the share page: the colour swatches carry
`aria-label="#1B3066"` etc., so a scheme is **announced by value** rather than
being colour-only information — that is a real WCAG 1.4.1 trap, avoided
deliberately. And `document.body.scrollWidth === window.innerWidth` (1251 =
1251), so R2-6's overflow fix holds.

**Scope limit, stated plainly:** this covers the PUBLIC pages only. The
signed-in app — dashboard, projects, library, tools, collection — needs
credentials I do not have against production, and I will not start a local dev
server while a builder is editing the repo. **Authenticated surfaces remain
unaudited for accessibility.** Round 1 verified dialog keyboard handling and
`aria-checked` on the GRID/LIST toggle in a browser; beyond that, the app
interior is untested on this axis and worth its own scoped run.

## Cache revalidation after mutation · VERIFIED OK — nothing found

The "I changed it and nothing happened" class. Every action in
`src/lib/actions/` that runs `db.insert/update/delete`, checked for a
`revalidate*` call.

Result: **5 mutating actions have none, and all 5 are correct by design** —
`deleteAccount` (caller does `window.location.href = "/"`, a full reload),
`changePasswordAction` (renders nothing), `completeTutorialAction` (a flag the
client already acts on), `setLibraryBrandFilterAction` and `resumeSession`
(preference/state the client holds). The three that would actually have shown a
stale list — `duplicateProject`, `saveRecipe`, `sendPaletteToRecipe` — all
revalidate correctly.

**My method was wrong twice before it was right, both times inflating the
count:**
1. First pass reported **27**. It only counted a literal `revalidatePath(` and
   missed the per-file helpers (`revalidateForProject`, `revalidateGallery`,
   `revalidateAdminComp`). → 8.
2. Second pass still reported `duplicateProject` as missing. It does revalidate
   — the calls sit ~100 lines in, past the 2500-character window I was reading.
   Splitting on top-level `export function` so each body is complete → **5**.

Third time this round a regex window has produced a confident wrong answer
(after the extension-route auth sweep and the IDOR delete table). **Pattern
worth naming: a truncated window reads exactly like an absent guard.** Any
sweep in this report that says "N sites lack X" should be re-derived from
complete bodies before a builder acts on it — including R2-14's 18, which I
spot-verified by reading but did not re-derive this way.

## R2-16 · P3 · Post-auth redirect guard may allow a backslash bypass — UNVERIFIED

`src/lib/actions/auth.ts:19`, used by BOTH `signInAction` and `signUpAction`:

```js
function safePostAuthPath(next?: string): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/dashboard";
}
```

It correctly rejects `https://evil.com` (no leading `/`) and protocol-relative
`//evil.com` — both explicitly called out in its own comment. The residual is
**`/\evil.com`**: it starts with `/`, does not start with `//`, so it passes —
and Chrome and Firefox normalise `\` to `/` when parsing a `Location` header,
which turns it into `//evil.com`.

**I did NOT verify this live.** Reaching the post-auth redirect requires real
credentials, and starting a local dev server while a builder is editing the repo
risks corrupting its `.next` — so this is reasoning from the browser
normalisation behaviour, not an observed redirect. **Treat it as a lead to
confirm, not a proven hole.**

Impact if real is modest: it needs the victim to follow a crafted sign-in link
AND authenticate successfully before landing off-site — a phishing aid, not
account takeover. The fix is one clause, so it is worth doing regardless of
which way the verification lands:
`&& !next.includes("\\")`.
**Verify:** sign in with `?from=/\example.com` and observe the resulting
`Location`.

## Server-action authorization (IDOR) sweep · VERIFIED OK — nothing found

The highest-stakes class in the app: **102 exported server actions** across 35
files in `src/lib/actions/`. Can one account touch another's rows?

- Every action taking an `id`/`slug` references `currentUserId()` / `auth()` in
  its body. **Zero** with no user reference at all.
- Then the sharper test — the 9 `delete*` actions, since a delete is the least
  recoverable. Two scope the delete's own `WHERE` by user
  (`deleteAccount`, `deleteWishlistItem`). The other seven appear unscoped to a
  regex and are **all fine**:
  - four delete by `existing.id` / `owned.row.id` / `owned.slot.id` — ids that
    only exist because an ownership lookup already returned them;
  - three (`deleteEvent`, `deleteInspoImage`, `deleteProjectImage`) I read in
    full. Each runs
    `select … where and(eq(tbl.id, id), eq(tbl.userId, userId)).limit(1)` and
    returns early if it misses, so the delete is unreachable for a row you do
    not own.

They also return **"not found"** rather than "forbidden", so the error does not
confirm that someone else's row exists. That is the right call and appears to be
deliberate.

**Twelfth false lead avoided.** My own heuristic flagged 7 of 9 deletes as
unscoped — a 100% false-positive rate, because it read only the `.where()`
attached to `.delete()` and not the guard above it. Reporting that table
unverified would have sent a builder hunting seven IDORs that do not exist.

## R2-15 · P2 · A rejected action leaves the control permanently dead, silently

Distinct from R2-14: these are plain async **event handlers**, not transitions,
so they do NOT crash the app. They set a loading flag, `await` an action with no
`try`, and clear the flag on the line after. On a rejection the clear never
runs — the flag stays set forever, an early-return guard makes every later click
a no-op, and **nothing is shown**. The control is dead until a full reload.

All four verified by reading:

| file | flag | action | what dies |
|---|---|---|---|
| `components/recipe/AssignPaintMenu.tsx:83` | `setPending` | `addPaintToOwned` | Add to Owned + Add to Wishlist, both, for that paint |
| `components/recipe/AssignPaintMenu.tsx:96` | `setPending` | `addPaintToWishlist` | same pair (shared flag) |
| `components/dashboard/PlannerCalendar.tsx:95` | `setBusy` | `createEvent` | the whole create-event form; can't submit |
| `app/(app)/user/account/AccountClient.tsx:36` | `setResendPending` | `resendSignupVerification` | resend-verification — an **account-recovery** path |

`AssignPaintMenu` guards with `if (!swatch.paintId || pending) return;`, so one
rejected click disables both menu items permanently.

**Re-derived and unchanged.** Re-run with exact brace matching over complete
function bodies (not a 700-character window): still exactly these **4**. Bodies
are 7–23 lines, so the window had been adequate and the pattern matched cleanly.
Unlike R2-14's count, this one needed no correction.

**Fix:** `try/finally` to clear the flag, plus a message on the failure path.
The `guarded()` helper from R2-9 covers the message; the `finally` is what stops
the control dying.

**Eleventh false lead avoided.** `src/lib/undo/store.ts:39` does
`void entry.invert()` and `popUndo()` returns the entry "so a caller can surface
*Undid <label>*" — i.e. it claims success before knowing the invert resolved,
the exact false-success shape as R2-1's clipboard toast, and the entry is
already popped so there is no retry. I had it written up as a P1. Then I checked
callers: **the module has zero imports anywhere in `src/`** — `pushUndo`,
`popUndo`, `canUndo`, `clearUndo` are referenced only by their own tests. Dead
code, so no live defect. Worth Ross knowing an undo system exists half-built.

**Also killed:** the 5 `void copyText(...)` sites. `src/lib/clipboard.ts` is
R2-1's fix and documents itself as "Never throws and never rejects, so callers
can `void` the result safely" — verified by reading. Correct as written.

## R2-14 · P1 · The unguarded-await crash class, ENUMERATED — 19 blocks in 13 files

R2-2 fixed one instance, R2-9 fixed four files, R2-10 covers two more. Rather
than keep surfacing these one per pass, I swept every `.tsx` in `src/` for
`startTransition(async …)` blocks containing an `await`ed call with **no
`try` and no `guarded()`** in scope, then spot-verified the critical ones by
reading them.

**19 unguarded blocks across 13 files** (the two reset pages already show
`guardedMessage`, so builder 3 has fixed those mid-flight and they are excluded):

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
| `app/admin/gallery/AdminGalleryReview.tsx` | 1 | `approveGallerySubmission`, `rejectGallerySubmission` |
| `components/user/ExtensionTokenPanel.tsx` | 1 | `onGenerate` / `onRegenerate` (actions passed as props) |

Every one handles `!res.ok` correctly — it is only the **rejection** path that
escapes to `src/app/error.tsx` and replaces the whole app.

**The three that matter most:**
- **`sign-in/page.tsx:22`** — verified by reading. A flaky connection turns
  "couldn't reach the server" into the whole-app fault screen **on the page
  someone is using to get in**. Worst first impression the app can make.
- **`CloneButton.tsx:51`** — on `/r/<slug>` and every `/gallery` card. This is
  the single highest-value click in the funnel: a stranger arriving from a
  shared link, converting. It already has an error slot and a working
  `isPending`; only the rejection path is unhandled.
- **`AccountClient.tsx:85`** — `deleteAccount`, verified by reading. A crash
  here leaves the user with no idea whether their account was deleted.

**Fix:** apply the existing `src/lib/actionGuard.ts` `guarded()` helper to all
19. This is mechanical — every call already returns the same `ActionResult`
union the helper is typed for, and every site already has somewhere to put the
message.

**Method note — this list WAS re-derived properly, and the count went UP.**
The first pass used a 900-character window and reported 18. Re-running it with
exact brace matching (each block read to its true closing brace) gives **19**:
it found `ExtensionTokenPanel.tsx:31`, missed originally not because of
truncation but because the regex did not tolerate the whitespace in
`startTransition(
  async () => {`.

Every block is 3–18 lines, so the window had in fact been adequate; the miss was
pattern-matching, not length. `sign-in`, `AccountClient` and
`ExtensionTokenPanel` were each verified by reading. Worth noting
`ExtensionTokenPanel` has a correctly `try`-wrapped `copy()` a few lines below
the unguarded block — the author knows the pattern, so these are oversights
rather than a convention.

## O-4 · P3 · Orphaned word on the root share card

`/opengraph-image` (246,939B, 1200×630) verified by eye: correct wordmark,
tagline, domain, on-brand CRT treatment. Readable at thumbnail size. **Good.**

One cosmetic flaw — the tagline "Plan your projects. Track your paints. Manage
your minis." wraps so that **"minis." sits alone on a second line**. It is the
primary card for every homepage link, so it is worth the five minutes: widen the
text container or drop the font size a step so it breaks two-and-two, or add an
explicit break after "Track your paints."

Cosmetic only. Nothing is unreadable or wrong.

## R2-13 · P1 · Every shared recipe unfurls on X with the GENERIC site title

`src/app/layout.tsx:31` declares a global `twitter:` block. `src/app/r/[slug]/page.tsx:45`
overrides **only** `openGraph` — there is no `twitter` override — so the root
layout's generic values win on every share page. Verified live on
`/r/ultramarines-classic`:

| tag | value |
|---|---|
| `og:title` | **"Ultramarines — Classic Blue · The Mini Mainframe"** ✅ |
| `twitter:title` | "The Mini Mainframe — paint & project manager for miniatures" ❌ |
| `og:description` | **"A paint recipe shared via The Mini Mainframe — 7 slots."** ✅ |
| `twitter:description` | "One terminal for your whole hobby — 7,000+ paints…" ❌ |

Per the X/Twitter cards spec `twitter:*` takes precedence over `og:*` when both
are present, so on X every shared recipe presents as the generic product rather
than the recipe someone actually wanted to show off. The image is correct
(`/r/<slug>/opengraph-image` → 200, image/png, 81,978B), so the card renders —
just titled wrong.

This lands on the one loop built to grow the product: share a recipe → someone
sees the scheme → they come look. **Fix:** give `generateMetadata` a `twitter`
block mirroring its `openGraph` title/description. Same omission on `/gallery`
and `/pricing`.
**The image itself is verified GOOD — do not touch it.** I downloaded and
visually inspected two: `/r/ultramarines-classic` and `/r/necrons-living-metal`.
Each renders its own recipe name in the terminal-cyan display face, its own
paint swatches in the correct colours (Ultramarines: blues + gold; Necrons:
metals + green), and the `MINI-MAINFRAME.COM` wordmark. Distinct byte sizes
(81,978 / 89,078) confirm they are generated per recipe, not a static file.
That makes R2-13 sharper, not softer: **the picture does the work and the
title undoes it.**

Not raised as a defect (product call, Ross's): the lower ~40% of the card is
empty. There is room for the paint names or a short call to action if the card
is ever worth another pass.

**Honest scope:** I verified the emitted tags and the documented spec
precedence. I did not verify X's live rendering — that needs a real post, or
the X Card Validator.

## R2-12 · P2 · `/gallery` unfurls with NO image at all

`/gallery` emits **zero** `og:image` / `twitter:image` tags — verified live
(`grep -c og:image` → 0). Every other public route has one. Cause: the
file-based `opengraph-image.tsx` / `twitter-image.tsx` live in the `(public)`
route group, but the gallery is `src/app/(app)/gallery/page.tsx`, so it inherits
nothing.

It still declares `twitter:card = summary_large_image`, which promises a large
image and supplies none — that degrades to a bare or dropped card.
The gallery is the curated shop-window for the recipe moat, so this is the link
most worth unfurling well. **Fix:** point its metadata at the existing root
image, or give the gallery its own.

Verified fine, do not "fix": the root `/opengraph-image` and `/twitter-image`
both return 200 image/png (246,939B), and `/pricing` carries a correct image —
only its `og:title` is generic where its `<title>` is specific.

## Sitemap + robots integrity · VERIFIED OK — nothing found

All 13 `sitemap.xml` URLs fetched live: **13/13 HTTP 200**, each rendering its
own content with a distinct, correct `<title>` — including all 8 `/r/<slug>`
share pages, so the sitemap advertises no dead recipe.

`robots.txt` disallows every gated surface (`/api/`, `/dashboard`, `/library`,
`/collection`, `/projects`, `/recipes`, `/tools`, `/focus`, `/user`, `/dev`) and
leaves `/r/` crawlable, which is right — those are the public share pages.

**Tenth false lead avoided.** A `grep` for 404 copy matched **every** page,
including `/` — reading as "the entire site is serving the 404 page". The
string lives in the escaped RSC Flight payload (`[\"$\",\"h1\",…]`) inside
`self.__next_f.push(...)`, because Next serialises the not-found boundary into
every page. Rendered output was correct throughout. This is the same
curl-plus-grep trap as harness bug 5, in a new costume — the second time this
round that a text search over a Next.js document produced a confident wrong
answer.

## API authorization sweep · VERIFIED OK — nothing found

All 16 `src/app/api/**/route.ts` handlers, checked statically then live.

| route | gate | verified |
|---|---|---|
| `extension/add`, `extension/preview` | `Bearer` + `verifyExtensionToken` | live **401** on missing AND bogus token |
| `billing/*`, `feedback`, `recipe/ai`, `*/upload`, `wishlist/list` | session | gated by `src/proxy.ts` + own check |
| `blob-proxy` | session; host-locked to `.public.blob.vercel-storage.com`, https-only | live 307 → sign-in |
| `auth/check-username` | public **by design** | leaks no more than the sign-up POST; documented |
| `auth/has-recovery-email` | public **by design** | collapses unknown / malformed / no-email into one `false` — non-enumerating |

**Ninth false lead avoided, two parts:**
1. My static sweep reported "auth-refs=0" for the extension routes, which reads
   as *unauthenticated write endpoints* — a serious finding. The grep pattern
   simply didn't include `verifyExtensionToken`/`bearerToken`. The routes are
   correctly gated; **the sweep was wrong, not the code.**
2. Protected API routes 307 to an HTML sign-in page rather than returning 401
   JSON, which normally means a client treats a 200 sign-in page as success.
   It doesn't here: every caller guards on a **payload field**
   (`data.proposal`, `data.ok`) rather than `res.ok` alone, so an HTML body
   falls into the error branch. `startCheckout.ts` handles a real 401 explicitly.
   Untidy, not a defect.

Minor, not raised as a finding: on a session that expires mid-page, the AI
dialog says "Couldn't generate a recipe. Try rephrasing." when the real cause is
being signed out. Wrong hint, but recoverable on reload.

## Compression on production · VERIFIED OK — nothing found

| resource | Content-Encoding |
|---|---|
| `/` (HTML) | **br** — 45,172 bytes identity → ~8KB on the wire |
| `/_next/static/…js` | br |
| `/data/paints.json` (1.7MB) | br |

**Eighth false lead avoided:** a `HEAD` request returned no `Content-Encoding`
for the HTML, which reads as "the document is served uncompressed". Many servers
simply skip compression for HEAD. A real GET shows `Content-Encoding: br`.
Checked before reporting.

## Caching on production · correct, with one optimization opportunity

| resource | Cache-Control | CDN |
|---|---|---|
| `/` | `public, max-age=0, must-revalidate` | HIT (age 5435s) |
| `/_next/static/…css` | `public, max-age=31536000, immutable` | HIT |
| `/data/paints.json` (1.7MB) | `public, max-age=300, s-maxage=3600` | MISS→cacheable |
| `/gallery` | `private, no-cache, no-store` | never cached |

Static assets, the landing page and the paint catalog are all configured
correctly.

**O-1 · optimization, not a bug · `/gallery` is uncacheable for everyone
because it personalises for someone.** The page calls `auth()` and uses
`userId`, so `private, no-store` is the *correct* header as written — I checked
before reporting, rather than filing the `no-store` as a misconfiguration.

But the consequence is worth weighing: `/gallery` is the public browse surface,
it is the slowest public page measured (282ms TTFB vs 118ms for `/`), and
**every visit runs the function with no CDN help — including for signed-out
visitors, who have nothing to personalise.** Splitting a cacheable public shell
from the small personalised part (or serving a cached variant when there is no
session) would make the community browse page fast for exactly the audience it
is meant to attract.

Not batched: this is a design change with a caching-correctness risk, and it is
Ross's call whether the gallery is worth that work.

## Production runtime errors · VERIFIED OK — nothing found

Real browser against production, collecting uncaught exceptions, console errors,
failed requests and any 4xx/5xx, across every public page:

`/` `/pricing` `/gallery` `/sign-in` `/sign-up` `/privacy` `/terms`
`/r/ultramarines-classic` — **all clean.**

## All 8 production share pages · VERIFIED OK — nothing found

Every recipe in the live gallery renders correctly: HTTP 200, 5–7 slots each,
technique labels present, and the CLONE TO MY LIBRARY action available. No error
boundary on any of them.

| slug | slots | clone action |
|---|---|---|
| blood-angels-crimson | 7 | ✅ |
| death-guard-rotting-plate | 7 | ✅ |
| khorne-berzerkers-brass-and-blood | 7 | ✅ |
| necrons-living-metal | 6 | ✅ |
| nurgle-daemons-plague | 6 | ✅ |
| speedpaint-one-coat-bones | 5 | ✅ |
| stormcast-eternals-sigmarite-gold | 7 | ✅ |
| ultramarines-classic | 7 | ✅ |

So the gallery content itself is healthy — R2-6 is purely the page's width on a
phone, not its data.

## Accessibility of production public pages · VERIFIED OK — nothing found

| page | h1 count | img missing alt | unlabelled inputs | heading-level jumps | empty links |
|---|---|---|---|---|---|
| `/` | 1 | 0 | 0 | 0 | 0 |
| `/sign-up` | 1 | 0 | 0 | 0 | 0 |
| `/r/<slug>` | 1 | 0 | 0 | 0 | 0 |
| `/pricing` | 1 | 0 | 0 | 0 | 0 |

Exactly one `h1` per page, every image carries `alt`, every form control is
labelled, no heading levels skipped, no link without an accessible name. Combined
with the earlier dialog result (role, aria-modal, focus trap, Escape, focus
restore all correct), the accessibility layer of this app is in good shape — the
first pass in either round to come back completely empty.

## Production response times · VERIFIED OK — nothing found

Ross listed "slow response times" as a target. Measured against production:

| route | TTFB | total | transferred |
|---|---|---|---|
| `/` | 118ms | 129ms | 45KB |
| `/pricing` | 127ms | 127ms | 27KB |
| `/gallery` | 282ms | 295ms | 51KB |
| `/sign-in` | 118ms | 118ms | 19KB |
| `/r/<slug>` | 222ms | 238ms | 36KB |

Nothing here is slow. The two DB-backed pages (gallery, share) are the slowest
as expected and still well inside a good budget. The region pin to `pdx1`
alongside the Turso instance is clearly doing its job.

Note this is the WARM path. Cold starts on low-traffic functions remain a known
open item from the 2026-07-07 perf pass (~1.7s first hit) and are not something
a request-timing sweep can surface.

## Support address + placeholder copy on production · VERIFIED OK — nothing found

Chased because the LOCAL sign-in page renders
`CHANGE_ME@mini-mainframe.com`, and `src/lib/support.ts` carries a
"NEEDS-ROSS: set SUPPORT_EMAIL **and** NEXT_PUBLIC_SUPPORT_EMAIL in Vercel"
note — with an explicit warning that a bare `SUPPORT_EMAIL` is stripped from
client bundles. `AuthView` is a client component, so the placeholder leaking to
production looked plausible.

It does not. Measured in a real browser on production:

| page | mailto | rendered text |
|---|---|---|
| `/sign-in` (client-rendered) | `support@mini-mainframe.com` | same |
| `/` | `support@mini-mainframe.com` | — |
| `/privacy` | `support@mini-mainframe.com` | same |

Both env vars are set. No `CHANGE_ME`, `TODO`, `lorem ipsum` or `example.com`
anywhere in the public surface. The local placeholder is purely a missing local
env var.

**Method note (sixth false lead):** my first pass used `curl | grep` and found
"no email" on `/sign-in`, which looked like a real gap. These pages are
client-rendered, so the text is not in the raw HTML — curl-grep gives false
NEGATIVES on them. Browser-verified before reporting.

## Round-1 fixes re-verified in the deployed code

Independently measured, not taken from the builder's report:

| fix | before | now |
|---|---|---|
| B1 signed-out tool pages | 0 auth links | sign-in + sign-up + CTA (**checked on production**) |
| B2 container status | `Army 1 … WISHLIST … 43%` | `Army 1 … BASED … 43%` |
| B3 picker name search | `Abaddon` → 0 matches | finds **Abaddon Black** |
| B4 `/collection` weight | 7,370 nodes / 246 rows | **3,316 nodes / 108 rows**, "SHOWING 50 OF 121" |
| B5 filter option row | 863px wide, 820px gap | **277px**, panel 2,062px → 900px |

All holding.

## Verified fixed in round 2

- **B2 (container status)** — the dashboard roster now reads
  `Army 1 | ARMY | 50 | BASED | 43%`. It said WISHLIST before the fix.
- **Sign-up end to end** — fresh account created, landed on `/dashboard`, zero
  console errors and no failed requests.
- **Tutorial** — opens from the nav with no errors.

## In flight

- **Exhaustive click crawl** (`audit-clicker.local.mjs`): reloads the page fresh
  before every control, clicks each button / link / tab / radio / checkbox on 17
  routes, and records crashes, JS exceptions, console errors, 4xx-5xx and
  horizontal overflow per control. Destructive controls (sign out, delete,
  checkout) are skipped by design. Still running; writes
  `click-findings-1440.json` on completion.

## Still to cover this round

- Army-list auto-build, Send-to-Recipe from each tool, share-as-card,
  image moderation.
- Sign-up end to end, `/r/[slug]` with a real slug, admin pages as an admin.
- Tutorial / walkthrough, keyboard navigation, error states (offline, failed
  save, expired session).
- Mobile click crawl at 375×812.
- Auto-populate — still unverified from round 1; four automated attempts failed
  on selectors, not on the feature.
