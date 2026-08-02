# Audit batch — 2026-08-02

Eight items from the full-app audit. Evidence and measurements:
`ux-audit/full-app-2026-08-02/HANDOFF.md`.

**Rules for this batch**
- Work on branch `fix/audit-batch-2026-08-02`. **Never push to `main`** — Ross
  reviews before anything deploys.
- Commit per item, so any one can be reverted alone.
- `npm run typecheck` (0 errors) + `npm run lint` (0 errors) + `npm run test:unit`
  + `npm run test:integration` must pass before each commit.
- Match the conventions in neighbouring files. No new dependencies. No
  refactors beyond the item.
- If an item needs a product decision, skip it, leave the box unchecked, and
  say why in the final report. Do not guess at Ross's intent.

---

- [x] **B1 · P0 · Signed-out visitors hit a paywall dead end on all 5 tool pages**
  `/tools/wheel`, `/tools/match`, `/tools/dropper`, `/tools/stacking`,
  `/tools/scan` render the LOCKED gate to signed-out visitors with **no
  `/sign-in`, `/sign-up` or `/` link anywhere in the document** (verified across
  all five). `/tools` and `/gallery` do carry the public header; these do not.
  It asks a stranger for money before they can have an account, and strands them
  with no navigation. These are shareable URLs.
  **Fix:** render the public header on tool routes when signed out, and when
  there is no session make the gate's primary CTA "Create a free account"
  (→ `/sign-up`); keep the sponsor CTA for signed-in non-subscribers.

- [x] **B2 · P1 · Every container project is labelled WISHLIST regardless of progress**
  An Army with 50 models, all units BASED, 43% complete shows status WISHLIST on
  its page header and every roster row. In `src/lib/appData.ts` `mapProject`:
  `completionPercent` uses the aggregated subtree (`agg`) while
  `status: displayStatus(p)` uses the container's own row — and a container's own
  `count` is always 0 because its models live in its children, so `displayStatus`
  returns WISHLIST. Status drives the roster filter and sort, and WISHLIST means
  "I don't own this yet".
  **Fix:** derive container status from the same aggregate the bar uses, e.g.
  `displayStatus({ ...p, ...agg })`. Add a unit test asserting a container whose
  children are part-painted never reports WISHLIST.

- [ ] **B3 · P1 · Recipe slot picker: searching the LIBRARY by name finds nothing**
  The picker lists paints within ΔE ≤ 10 of the slot's colour and the search box
  filters *inside that window* instead of searching the library. Measured on a
  new recipe's first slot: no search → 200 matches; `Abaddon` → 0; `Mephiston`
  → 0; `Citadel` → 18. `Citadel / Abaddon Black #151414` is in the catalog. The
  placeholder reads "Search by paint name, brand, or line…".
  **Fix:** a name/brand/line search queries the whole catalog and bypasses the
  ΔE window; the window applies only when there is no search term. Keep the ΔE
  badges for results that have a distance.

- [ ] **B4 · P1 · `/collection` is the heaviest page and scales with the collection**
  TTFB 334–365ms vs 31–92ms elsewhere; 784KB payload; **246 rows / 7,370 DOM
  nodes** for a 120-item collection with two dropdowns per row and no
  virtualisation. `/library` renders 1,031 nodes for 7,576 paints because its
  grid *is* virtualised.
  **Fix:** virtualise the collection table using the same primitive the library
  grid already uses, or cap the initial render with a "load more". Preserve
  search, filtering, sort and row actions.

- [ ] **B5 · P2 · Library FILTER panel wastes its width and truncates the company list**
  The panel spans ~62% of the screen but each row is a left-aligned label with
  its checkbox pinned to the far right — ~840px of empty space per row — while
  the COMPANY list is cut off mid-entry at "HUMBROL" inside a 2030px-tall panel.
  This is the reproducible version of Ross's "huge space… expand the list of
  paints and the filter list of companies".
  **Fix:** lay the colour and company checkboxes out in 2–3 columns so every
  option is visible without scrolling, checkbox adjacent to its label.

- [ ] **B6 · P2 · Slot picker shows 5 of 200 results, then hands the panel to filters**
  Same cramped-results/roomy-filters shape as B5. Fix in the same pass so the
  two panels end up consistent.

- [ ] **B7 · P2 · Dead space on two tool pages**
  `/tools/scan`: 541px empty below content at 1440×900 and 461px at 375×812 —
  ~60% empty at both. `/tools/dropper`: 358px at 1440×900.
  **Fix:** let the content fill the available height, or reduce the reserved
  space, without introducing horizontal overflow at 375px.

- [ ] **B8 · P2 · AI affordance inconsistent between the two recipe surfaces**
  `/recipes/new` hides the AI button entirely for non-subscribers; the
  `/recipes` detail panel shows it to everyone badged `PRO` and opens the
  paywall on click.
  **Fix:** make both surfaces behave like the detail panel — visible, badged
  `PRO`, opening the paywall for non-subscribers.

---

## Out of scope for this batch

- The failed-CI catalog commits on `main` (`4c907a7`, `21693c7`) — Ross's call,
  revert vs fix forward. Do not touch `public/data/paints.json`.
- Auto-populate (collection URL paste) — unverified, needs a manual check first.
- The AI recipe fix — already done on `fix/ai-recipe-grounding`, which this
  branch builds on top of.
