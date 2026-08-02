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
