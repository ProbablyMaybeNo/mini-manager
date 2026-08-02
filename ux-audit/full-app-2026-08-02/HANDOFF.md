# Mini Mainframe — full-app audit, 2026-08-02

**10 passes complete.** Live Playwright run-throughs against the local dev build,
signed in as a seeded account with realistic volume (72 projects, 16 recipes,
120-paint collection), desktop 1440×900 plus a full 375×812 mobile pass.

Nothing below was fixed by the audit except **F-1**, which Ross explicitly asked
for mid-run. Everything else is untouched and ready to hand to a builder.

---

## PART 1 — FIXES ALREADY MADE

### F-1 · AI recipe generation · branch `fix/ai-recipe-grounding` · NOT MERGED
Ross's report: *"I couldn't get the AI to generate a recipe."* Two independent
bugs, either of which alone breaks it.

1. **The prompt taught the model a bad id.** Candidate lines rendered as
   `- id:16162 | Citadel | Macragge Blue | …`, and the instruction said to copy a
   paintId exactly from a candidate — so the model copied `id:16162`.
   `groundProposal` matches exactly, so all 12 slots were dropped and the route
   422'd with *"The AI couldn't ground its picks to real paints"*, blaming the
   user's phrasing for our formatting. Intermittent, because the model sometimes
   stripped the prefix itself.
2. **Candidate selection ignored the requested colour.** `buildCandidates`
   round-robins across paint types ordered by id. "Ultramarines space marine,
   Citadel paints" sent the model **1 blue out of Citadel's 68**. With no blues
   available it invented ids or rationalised a red in — one run produced an
   Ultramarines scheme built on Khorne Red, annotated *"Khorne Red serves as deep
   blue substitute"*.

Verified live after the fix:
```
Ultramarines, Citadel  → Macragge Blue, Regal Blue, Guilliman Blue,
                         Lightning Bolt Blue, Blue Horror, Runefang Steel,
                         Mithril Silver, Asurmen Blue Wash
Forest goblin, Vallejo → correct greens + browns
candidates: 1 blue → 62 blues
```
767 unit + 505 integration pass, 0 type errors.

---

## PART 2 — BATCH FOR THE BUILDER

Ordered by severity. Each item is independently shippable.

### B1 · P0 · Signed-out visitors hit a paywall dead end on all 5 tool pages
`/tools/wheel`, `/tools/match`, `/tools/dropper`, `/tools/stacking`,
`/tools/scan` shown to a signed-out visitor render the LOCKED card with
"SPONSOR THE MAINFRAME · $3.99/MO" and **no sign-in or sign-up link anywhere** —
measured: zero `/sign-in`, `/sign-up` or `/` anchors in all five documents.
`/tools` and `/gallery` both carry the public header; these five do not.

It asks a stranger for money before they can have an account, and strands them
with no navigation. These are shareable URLs — this is what a prospect sees if
anyone links a tool.

**Fix:** render the public header on tool routes when signed out, and make the
gate's primary CTA "Create a free account" with no session, keeping the sponsor
CTA for signed-in non-subscribers.

### B2 · P1 · Every container project is labelled WISHLIST regardless of progress
An Army with 50 models, all five units BASED and a 43% bar shows status
**WISHLIST**, on its page header and every roster row:
```
Army 1 | 50 models | WISHLIST | 43%
Army 2 | 50 models | WISHLIST | 42%
Army 3 | 50 models | WISHLIST | 42%
```
**Cause, one line** — `src/lib/appData.ts` `mapProject`:
```ts
completionPercent: progressPercent(agg),   // aggregated subtree
status: displayStatus(p),                  // the container's OWN row
```
`displayStatus` returns WISHLIST when `count === 0`, and a container's models
live in its children. Status drives the roster filter and sort, and WISHLIST
means *"I don't own this yet"*.

**Fix:** `displayStatus({ ...p, ...agg })` so the two numbers on one card cannot
disagree.

### B3 · P1 · Recipe slot picker: searching the LIBRARY by name finds nothing
The picker lists paints within ΔE ≤ 10 of the slot's current colour, and the
search box filters *inside that window* rather than searching the library:

| picker state | matches |
|---|---|
| open, no search | **200** |
| search `Abaddon` | **0** — "No paints within ΔE 10" |
| search `Mephiston` | **0** |
| search `Citadel` | 18 |

`Citadel / Abaddon Black #151414` is in the catalog. The placeholder even reads
*"Search by paint name, brand, or line…"* — it promises the thing that fails.
**This is very likely the "colour wheel is missing paints from library" report.**

**Fix:** name/brand search queries the whole catalog and bypasses the ΔE window;
the window applies only when there is no search term.

### B4 · P1 · `/collection` is the heaviest page and scales with the collection
TTFB 334–365ms vs 31–92ms elsewhere; 784KB payload; **246 rows and 7,370 DOM
nodes** for 120 items, two dropdowns per row, no virtualisation. `/library`
renders **1,031 nodes for 7,576 paints** because its grid *is* virtualised.

**Fix:** virtualise the collection table like the library grid, or cap the
initial render with "load more". The primitive already exists in the codebase.

### B5 · P2 · Library FILTER panel wastes its width and truncates the company list
The panel spans ~62% of the screen but each row is a left-aligned label with its
checkbox pinned far right — **~840px of empty space per row** — while the
COMPANY list is cut off mid-entry at "HUMBROL" and must be scrolled inside a
2030px-tall panel. **This is the reproducible version of Ross's library report.**

**Fix:** two or three columns of checkboxes so every colour and company is
visible without scrolling.

### B6 · P2 · Slot picker shows 5 of 200 results, then hands the panel to filters
Same shape as B5 — cramped results, roomy filters. Fix together as one
space-allocation pass.

### B7 · P2 · Dead space on two tool pages
`/tools/scan`: 541px empty below content at 1440×900, 461px at 375×812 — roughly
60% empty at both. `/tools/dropper`: 358px at 1440×900.

### B8 · P2 · AI affordance inconsistent between the two recipe surfaces
`/recipes/new` hides the AI button entirely for non-subscribers; the `/recipes`
detail panel shows it to everyone badged `PRO` and opens the paywall on click.
One is wrong — the badged version is the better upsell.

---

## PART 3 — NEEDS ROSS, NOT A BUILDER

### R1 · A commit that FAILED CI is on `main` and deploying
`4c907a7` "Liquitex: 105 placeholder rows become 537 real colours" — **Playwright
E2E = failure** — and `21693c7` "Army Painter: add range and SKU to 388 paints".
Both landed on `main` during this session from automation and are pushed. They
rewrite `public/data/paints.json` (7,144 → 7,576 rows). Confirmed locally that
the 7,576-row catalog flips `qa_ux002_recipe_picker` and `qa_share_card` from
passing to failing. **Revert or fix forward — Ross's call.**

### R2 · Auto-populate could not be verified — needs a 5-second manual check
The paste bar exists (`input[name="paste-url"]`, PAINT/MODEL toggle, ENTER) and
outbound network works (games-workshop.com returns 301 from this machine). Four
automated attempts failed on *my* selectors, not on the feature — the last one
opened the manual "ADD PAINT" dialog instead. No row was created, but no submit
provably landed either. **Not claiming it is broken.** Paste a GW URL and press
ENTER; if a populated row appears, it is fine.

### R3 · "Huge space at the bottom" of the library — NOT REPRODUCED
| viewport | view | space below content |
|---|---|---|
| 1440×900 | GRID, scrolled to bottom | −7px |
| 1920×1080 | GRID | −204px |
| 2560×1440 | GRID | −196px |
| 1440×900 | LIST | −626px |

The grid and colour-map column both grow with the viewport. I believe B5 is what
Ross saw; if not, which view and screen size?

---

## PART 4 — VERIFIED WORKING (do not re-open)

- **Paint scanner** — three labelled pots read and matched to real catalog rows
  (Macragge Blue / Mephiston Red / Averland Sunset) with a confirm step.
- **Auth + admin gating** — every protected and admin route redirects signed-out
  users to `/sign-in`; bad share slug 404s with a branded page; free users get
  the tool gate. No leaks.
- **Mobile, all routes at 375×812** — no horizontal overflow, no crashes, no
  console errors.
- **Focus bench, gallery, settings, project page** — no exceptions or failed
  requests; session timer works.
- **AI failure handling** — with the key absent, an explicit red message naming
  the missing config plus HTTP 422. No silent failure.

### Candidates investigated and DISPROVED — do not re-open
- Library LIST view is virtualised (637 DOM nodes vs GRID's 1,031); its
  280,722px scroll height is the virtualiser's spacer.
- GRID/LIST toggle has correct `aria-checked` inside a `role="radiogroup"`.
- Yellow/amber field borders on the project page are the accent system, not
  validation errors.
- The wide gap in seeded recipe rows was my test data using non-existent paint
  ids; a real paint renders `Blue Fs15044 / Mr. Hobby` correctly.

### Harness bugs found and fixed before any result was trusted
- "Every route is slow (~3.6s)" — measuring my own settle-sleep. Real TTFB is
  31–92ms.
- "`/tools/match` crashes" — my regex matched `FAULT` inside **DE-FAULT**.
