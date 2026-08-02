# Full-app audit — 2026-08-02

**Status: IN PROGRESS (pass 9 of ~10).** Read-only audit. Nothing has been fixed.

Method: live Playwright run-throughs against the local dev build at
`localhost:3000`, signed in as a seeded account with realistic volume
(72 projects, 16 recipes, 120-paint collection). Desktop viewport 1440×900
unless stated.

## Harness corrections made before trusting any result

Pass 1 initially reported 22 findings. Two were instrument bugs, not app bugs,
and both are fixed in `audit-sweep.local.mjs`:

- **"Every route is slow (~3.6s)"** — the script measured wall-clock around its
  own `waitForTimeout(3500)` settle. Replaced with the Navigation Timing API.
  Real TTFB is 31–92ms locally.
- **"`/tools/match` crashes"** — the crash regex matched the substring `FAULT`
  inside the word **DE-FAULT** on the page. Tightened to the app's real error
  boundary copy.

Recording this because the corrected numbers below are the ones to act on.

---

## Verified findings

### A1 · P2 · `/library` — FILTER panel wastes most of its width, truncates the company list
The panel spans x=545→1440 (~62% of the screen) but every row is a left-aligned
label with its checkbox pinned to the far right, leaving **~840px of empty space
per row**. Meanwhile the COMPANY list is cut off mid-entry at "HUMBROL" and
requires scrolling through a 2030px-tall panel to reach the rest.

Both halves of Ross's complaint land here: the wasted space and the truncated
company list are the same layout problem. Two or three columns of checkboxes
would show every colour and every company at once with no scrolling.

Evidence: `probe-library-filter.png`

### A2 · P2 · `/tools/dropper` — 358px of dead space below the content
Content ends at y=542 in a 900px viewport.
Evidence: `_tools_dropper.png`

### A3 · P2 · `/tools/scan` — 541px of dead space below the content
Content ends at y=359 in a 900px viewport — the page is 60% empty.
Evidence: `_tools_scan.png`

### A4 · P1 · `/collection` — the heaviest page in the app, and it scales with your collection
TTFB 334–365ms vs 31–92ms everywhere else; 784KB of payload measured against the
same account. **Mechanism confirmed in pass 7:** the page renders **246 table
rows and 7,370 DOM nodes** for a 120-item collection, with two dropdown
components per row and no virtualisation.

For scale, `/library` renders **1,031 DOM nodes for 7,576 paints** because its
grid *is* virtualised. The collection builds ~7× the DOM for 1/60th the data.
Cost grows linearly with the collection, and Ross bulk-scans paints, so this is
the page that degrades first.

Suggested fix (for the builder, not applied): virtualise the collection table the
way the library grid already is, or cap the initial render with a "load more".
The primitive to copy already exists in this codebase.

### A5 · info · `/user/account` redirects to `/user`
Not broken, but worth confirming it is intentional rather than a stale route.

---

### B1 · P1 · Recipe slot picker — searching the LIBRARY by name finds nothing
**This is almost certainly the "colour wheel is missing paints from library" report.**

The picker's LIBRARY tab lists paints within ΔE ≤ 10 of the slot's current
colour. The search box filters *inside that window* instead of searching the
library, so a paint you name is only findable if it already happens to sit near
the current colour. Measured on a new recipe's first slot:

| picker state | matches shown |
|---|---|
| open, no search | **200** |
| search `Abaddon` | **0** — "No paints within ΔE 10" |
| search `Mephiston` | **0** — "No paints within ΔE 10" |
| search `Citadel` | 18 |
| search `Black` | 14 |

`Citadel / Abaddon Black #151414` is present in the catalog — verified directly
in `public/data/paints.json`. The user types the name of a paint they own, gets
"No paints within ΔE 10", and reasonably concludes the library is missing paints.

The empty-state copy makes it worse: "No paints within ΔE 10. Try 'Show more
matches'." explains the *mechanism* rather than the fix, and the mechanism is not
what the user asked for — they asked for a paint by name.

The search box's own placeholder reads **"Search by paint name, brand, or
line…"** — the control explicitly promises the thing that fails.

Suggested fix (for the builder, not applied): name/brand search should query the
whole catalog and bypass the ΔE window; the ΔE window should apply only when no
search term is present.

Evidence: `probe-slot-picker-search.png`, `probe-picker-search-showmore.png`

### B2 · P0 · A commit that FAILED CI is on `main` and deploying — **needs Ross**
Two automated commits landed on `main` during this session and are already
pushed (`origin/main == HEAD`):

- `4c907a7` "Liquitex: 105 placeholder rows become 537 real colours" — **Playwright E2E = failure**
- `21693c7` "Army Painter: add the range and SKU to 388 paints" — CI still running at time of writing

Both rewrite `public/data/paints.json` (7,144 → 7,576 rows). I confirmed locally,
before finding the CI result, that swapping to the 7,576-row catalog flips
`qa_ux002_recipe_picker` and `qa_share_card` from passing (2.7s) to failing; CI
independently reached the same verdict on `4c907a7`.

This is not a UI issue and not something I should fix inside an audit loop, but
it is the most serious thing found so far: a red-CI commit is on the production
branch. **Ross needs to decide** whether to revert it or fix forward.

Note: B1 is NOT caused by this — the name-search bug reproduces identically
against the old 7,144-row catalog.

---

### C1 · P2 · Slot picker shows 5 of 200 results, then hands the rest of the panel to filters
With no search term the picker reports **200 matches** but renders only **five**
rows before the search box and the COMPANY filter list take over the panel. The
thing you are choosing from gets five rows; the thing that narrows it gets more.

This is the same shape as A1 on `/library` — cramped results, roomy filters —
so the two should be fixed together as one space-allocation pass.

Evidence: `probe-picker-library-200.png`

### C2 · resolved · Recipe row layout is NOT broken — that was my test data
Ross reported "the paint recipe side panel is formatted all wrong". In the
seeded recipes the rows do show a wide empty gap where the paint name belongs,
**but my seed wrote non-existent paint ids** (`catalog-N`), so name and brand
came back blank.

Verified by filling a slot through the UI with a real library paint: the row
renders `Blue Fs15044 / Mr. Hobby` correctly and the gap is gone. **No app bug
here** — recording it so nobody re-reports it.

Still worth one more check next pass: a slot holding a *custom colour* from the
WHEEL/DROPPER tools has no catalog paint behind it either, so tool-generated
recipes may legitimately render the same blank-name row. Not yet reproduced —
the wheel tab's confirm button did not respond to the label I tried.

### C3 · P2 · `/tools/scan` is mostly empty at every viewport
461px of dead space below the content at 375×812, 541px at 1440×900 — the page
is roughly 60% empty on both. Same for `/tools/dropper` on desktop (A2).

---

### D1 · P0 · Signed-out visitors hit a paywall dead end on all 5 tool pages
Visit `/tools/wheel`, `/tools/match`, `/tools/dropper`, `/tools/stacking` or
`/tools/scan` **without being signed in** and you get the LOCKED card with
"SPONSOR THE MAINFRAME · $3.99/MO →" — and **no link to sign in or sign up
anywhere on the page**. Measured across all five: zero `/sign-in`, `/sign-up` or
`/` anchors in the document.

Three things wrong at once:
1. **It asks a stranger for money before they can have an account.** You cannot
   sponsor without signing up, and nothing on the page offers that.
2. **It is a navigational dead end** — no header, no nav, only a "← TOOLS" link
   back to the hub. `/tools` and `/gallery` both carry the public header with
   GALLERY / SPONSOR / SIGN IN / GET STARTED; these five do not.
3. Content ends at y≈703 of a 900px viewport and occupies only the left ~470px,
   so it reads as a broken page as well as a closed door.

These are linkable, shareable URLs — this is the first thing a prospective user
sees if anyone links to a tool. The gate itself is correct; the missing signup
path is the bug.

Suggested fix (for the builder, not applied): render the public header on tool
routes for signed-out users, and make the gate's primary CTA "Create a free
account" when there is no session, keeping the sponsor CTA for signed-in
non-subscribers.

Evidence: `probe-wheel-signedout.png`

### D2 · verified OK · auth + admin gating
Signed out, every protected route (`/dashboard`, `/library`, `/collection`) and
every admin route (`/admin/users`, `/admin/comp`, `/admin/gallery`) correctly
redirects to `/sign-in`. A bad share slug (`/r/does-not-exist`) returns a real
404 with a branded page. Free (non-subscriber) signed-in users get the gate on
tools, same as intended. No leaks found.

---

### E1 · P1 · Every container project is labelled WISHLIST no matter how far along it is
An Army with 50 models, all five of its units at BASED, and a 43% progress bar
displays the status **WISHLIST** — on its own page header and on every dashboard
roster row. Measured across the whole roster:

```
Army 1 | ARMY | 50 models | WISHLIST | 43%
Army 2 | ARMY | 50 models | WISHLIST | 42%
Army 3 | ARMY | 50 models | WISHLIST | 42%
```

**Cause is one line.** In `src/lib/appData.ts` `mapProject`:

```ts
completionPercent: progressPercent(agg),   // aggregated over the whole subtree
modelCount: agg.count,
status: displayStatus(p),                  // the container's OWN row only
```

`displayStatus` returns `WISHLIST` when `count === 0`, and a container's models
live in its children, so its own `count` is always 0. The comment directly above
these lines explains that completion aggregates deliberately — status was simply
never given the same treatment, so the same card shows an aggregated 43% next to
a non-aggregated WISHLIST.

Why it matters beyond cosmetics: status is the primary at-a-glance signal in a
tracking app, it drives the roster's status filter and sort, and "WISHLIST"
specifically means *"I don't own this yet"* — the app is telling Ross he doesn't
own an army he has half-painted.

Suggested fix (for the builder, not applied): derive container status from the
same aggregate the progress bar uses — `displayStatus({ ...p, ...agg })` — so
the two numbers on one card can never disagree.

Evidence: `probe-projectpage.png`

### E2 · verified OK · focus bench, gallery, settings, project page
No JS exceptions, no console errors, no failed requests on any of them. The
focus bench renders a working session timer (`00:00:00` + START + LOG) with the
project picker populated. Gallery renders (only 2 images locally — it is unseeded
here, not a defect). All pages scroll rather than clipping.

---

### F1 · NOT REPRODUCED · "huge space at the bottom" of the library
Ross reported: *"on the library tab there is a huge space at the bottom of the
panel which we should get rid of by expanding the list of paints and the filter
list of companies."* I could not reproduce bottom dead space in the library:

| viewport | view | space below last content |
|---|---|---|
| 1440×900 | GRID, scrolled to bottom | −7px (none) |
| 1920×1080 | GRID | −204px (content exceeds viewport, i.e. it scrolls) |
| 2560×1440 | GRID | −196px (same) |
| 1440×900 | LIST | −626px (same) |

The grid scroller and the COLOR MAP column both grow with the viewport
(691 → 871 → 1231px), so the layout scales rather than leaving a gap.

**The real, reproducible version of this complaint is A1** — the FILTER panel,
where every row wastes ~840px of width and the COMPANY list is truncated and
must be scrolled. That matches "expand the list of paints and the filter list of
companies" exactly. I believe A1 is what Ross saw; if he meant something else,
**he should say which view and screen size**, because it is not in the grid.

### F2 · two candidate findings investigated and DISPROVED
Recorded so nobody re-opens them:

- **Library LIST view is not un-virtualised.** Its scroll height is 280,722px
  for 7,576 paints, which looks alarming, but the rendered DOM is *smaller* than
  GRID's (637 nodes vs 1,031) — that height is the virtualiser's spacer, which
  is the correct pattern. A search keystroke repaints in 133ms.
- **The GRID/LIST toggle is not missing a11y state.** It carries
  `aria-checked="true"/"false"` inside a proper `role="radiogroup"`. An earlier
  probe of mine reported nulls because its selector swept in ordinary buttons.

---

### G1 · verified OK · the four remaining tool screens
`/tools/match`, `/tools/dropper`, `/tools/stacking`, `/tools/scan` all render for
a subscriber with no JS exceptions, no console errors and no failed requests.
Nothing extends past the 1440px viewport on any of them. The dead space on
dropper (358px) and scan (541px) is already logged as A2/A3.

### G2 · DISPROVED · the coloured field borders on the project page are not error states
The DETAILS section renders STATUS with a yellow border and PRIORITY with an
amber one on an untouched form, which reads like validation failure. It is not —
it is the accent system (`statusAccent` WISHLIST → yellow, `priorityAccent`
Med → amber) working as specified in the colour contract. Recorded so nobody
re-opens it.

That screenshot does, however, show **E1** at its worst: the army's own STATUS
field reads WISHLIST in warning-yellow while every one of its five units is
BASED and QUICK STATS reports 50 models with 5 in progress.

---

## AI pass (pass 8) — Ross's "I couldn't get the AI to generate a recipe"

### H1 · answering Ross's report: three possible causes, and what each looks like
Every AI gate behaves **correctly** in local testing, so I cannot reproduce a
silent failure. What Ross saw was one of these — the on-screen difference tells
us which, and he can identify it in seconds:

| what he'd have seen | cause | fix |
|---|---|---|
| Red line in the dialog: *"AI recipes are not configured (ANTHROPIC_API_KEY missing)"* | production is missing the key | set the env var |
| A **SPONSOR THE MAINFRAME · $3.99/MO** panel | his account isn't recognised as a subscriber | the unresolved comp/`MM_ADMIN_EMAILS` thread from earlier today |
| **No AI button at all** in the recipe editor | same as above — the button is hidden for non-subscribers on `/recipes/new` | as above |
| Something else entirely | a real prod bug | needs prod logs / Sentry |

Given Ross reported "all the tools are still locked" earlier today and the
`/admin/comp` 404 was never resolved, **row 2 or 3 is the most likely.** If so
the AI feature is fine and the real bug is his account's subscriber state.

### H2 · verified OK · AI failure handling is genuinely good
Driven end to end with the key absent: the dialog opens, accepts a prompt, and
on failure shows an explicit red message naming the exact missing config, with
`HTTP 422` from `/api/recipe/ai`. It does **not** fail silently, spin forever, or
show a generic "something went wrong". A non-subscriber clicking `AI GENERATE
PRO` gets a proper paywall panel with the price. Nothing here is broken.

### H3 · P2 · The AI affordance is inconsistent between the two recipe surfaces
- `/recipes/new` (editor): the AI button is **hidden entirely** for non-subscribers.
- `/recipes` (detail panel): the button is **shown to everyone**, badged `PRO`,
  and opens the paywall when clicked.

So a non-subscriber can discover the feature from the recipe list but not from
the editor. One of the two is wrong; showing it badged (the detail panel's
behaviour) is the better upsell and should probably win.

### H5 · FIXED · AI recipe generation (was Ross's report)
Ross supplied a working `ANTHROPIC_API_KEY` mid-audit and asked for this one to
be fixed rather than just reported. **Two independent bugs**, either of which
alone breaks it. Fixed on branch `fix/ai-recipe-grounding`, NOT merged.

1. **The prompt taught the model a bad id.** Candidate lines rendered as
   `- id:16162 | Citadel | Macragge Blue | …` while the instruction said to copy
   a paintId exactly from a candidate, so the model copied `id:16162`.
   `groundProposal` matches exactly → all 12 slots dropped → 422. Observed
   directly: `dropped: ["id:16162","id:16092","id:16094", …] grounded: 0`.
   Intermittent because the model sometimes stripped the prefix itself, which is
   why it read as flaky rather than broken.
2. **Candidate selection ignored the requested colour.** `buildCandidates`
   round-robins by paint TYPE ordered by id. "Ultramarines space marine, Citadel
   paints" sent the model **1 blue out of Citadel's 68**. With no blues it
   invented ids or rationalised a red in — one run returned an Ultramarines
   recipe built on Khorne Red, annotated *"Khorne Red serves as deep blue
   substitute"*.

Verified against the live API after the fix:
```
Ultramarines, Citadel  → Macragge Blue, Regal Blue, Guilliman Blue,
                         Lightning Bolt Blue, Blue Horror, Runefang Steel,
                         Mithril Silver, Asurmen Blue Wash
Forest goblin, Vallejo → correct greens + browns
candidates for that prompt: 1 blue → 62 blues
```
767 unit + 505 integration pass, 0 type errors.

### H6 · verified OK · paint scanner works end to end
Uploaded a generated image of three labelled pots. Every label was read and
matched to the real catalog: *Citadel Macragge Blue*, *Citadel Mephiston Red*,
*Citadel Averland Sunset*, each with OWNED/WISHLIST toggles behind a confirm
step. No errors. AI feature 2 of 3 confirmed working.

### H4 · STILL UNVERIFIED · auto-populate
The affordance exists: a PAINT/MODEL toggle, a URL field and an ENTER button,
with supported retailers listed (Games Workshop, Element, Wayland, Goblin
Gaming, Noble Knight, Miniature Market, Game Kastle, Gamers Roll, Amazon, eBay).

**I could not drive it successfully and I am NOT claiming it is broken.** Three
attempts failed on my own selectors — the panel re-renders when the PAINT/MODEL
toggle changes, and the submit control is labelled `ENTER`, which my first probe
did not match. No row with a `source_url` was created, but since the submit
click never landed that proves nothing about the feature.

Needs a hand-driven check (or a better probe) before any verdict. Also still
untested: army-list auto-build, Send-to-Recipe, share-as-card, and image
moderation — the last of which additionally needs `BLOB_READ_WRITE_TOKEN`,
absent locally.

---

## Mobile pass (375×812, touch emulation) — clean

Every route: no horizontal overflow, no crashes, no console errors, no failed
requests. TTFB 35–365ms. The only findings were C3 above and the `/user/account`
redirect. The mobile work from earlier sessions is holding up.

---

## Open / not yet verified

### PRIORITY (added by Ross mid-audit, 2026-08-02): AI + auto-populate
Ross: *"I couldn't get the AI to generate a recipe."* Next pass covers every AI
and auto-fill path end to end:

- **AI recipe generation** — the `AI GENERATE [PRO]` button on the recipe detail
  panel. Ross's reported failure; reproduce and capture the actual error.
- **Paint scanner** (`/tools/scan`) — photo → Haiku vision → catalog match →
  confirm → bulk-add.
- **Collection URL paste** — `scrapeAndCreateWishlistItem`: does pasting a
  product URL still auto-fill cost / company / vendor / image?
- **Army-list auto-build** — "paste a list and it fills your whole project tree",
  advertised on the paywall gate.
- **Send-to-Recipe** hand-off from each colour tool.
- **Recipe SHARE AS CARD** image generation.

**Known constraint to resolve first:** this local dev environment holds only
`DATABASE_URL`, `AUTH_SECRET` and `AUTH_URL` — there is no `ANTHROPIC_API_KEY`
and no `BLOB_READ_WRITE_TOKEN`. Every AI call will therefore fail locally
*regardless of whether the app is correct*, so a local failure proves nothing
about Ross's production failure. Pass 8 will establish which of these is true
before reporting anything:
  1. the feature is broken in code (reproducible given a key), or
  2. it fails only for missing local env (then Ross's prod failure is separate
     and needs prod logs / Sentry), or
  3. it fails *gracefully* vs *silently* — the error handling itself is the bug
     worth reporting, since "nothing happened" is what Ross experienced.

- **Recipe side panel formatting** (Ross-reported) — the panel is the
  master-detail pane on `/recipes` (clicking a recipe does not navigate). Rows
  show a wide gap between the hex value and the notes field, but my seeded
  recipes use non-existent paint ids so the paint name/brand is blank in that
  gap. MUST be re-checked with a recipe built through the UI before reporting —
  the gap may be entirely my test data.
- Sign-up flow completion, `/r/[slug]` with a real slug, collection row
  interactions, the four remaining tool screens (match / dropper / stacking /
  scan) driven properly, library LIST view and the paint detail panel.
- The custom-colour slot path described in C2.
- The project page DETAILS section renders its PRIORITY field with a red border
  on an untouched form — possibly a validation state showing before input. Not
  yet confirmed.

## Environment note that affects paint-related findings

The working tree currently holds a **regenerated `public/data/paints.json`**
(7,576 rows vs the committed 7,144) that was written by something else today.
I verified earlier that swapping it deterministically flips the paint-match
tooling from working to failing. The library above reads "7,576 PAINTS", so this
audit is running against that catalog. Any paint-matching finding must be
re-checked against the committed catalog before being attributed to the app.
