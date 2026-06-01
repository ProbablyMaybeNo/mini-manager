# Phase 14 — Dashboard Expansion: PLANNER section

Ross's call 2026-06-01 post-Round-10-🟢: build the PLANNER section before any monetization wire-up. The FOCUS half shipped in P13.11; this phase builds out everything you do *outside* a paint session.

**Status:** PLANNED, 2026-06-01.

## Resolved decisions

- **Section name** → **PLANNER** (locked, Ross's call — simpler at-a-glance than Campaign / Studio / HQ).
- **Inspo image hosting** → external URL pastes only (Pinterest / IG / ArtStation). No Vercel Blob, no S3, no upload pipeline.
- **No "Coming Soon" middle step.** Ship features as features; the eventual paid tier will gate via Phase 15 Stripe wire. Don't build placeholder upgrade teases.
- **Free-vs-Pro tier split** → deferred to Phase 15. Phase 14 builds everything; gating decisions come after we see what's used.
- **Stopwatch + paint-session log** → deferred. FOCUS half is considered shipped enough for now; revisit after PLANNER lands.

## Schema additions

One migration covers all three tables.

```
events                          activity_log                    inspo_images
  id text pk                      id text pk                      id text pk
  user_id text fk users           user_id text fk users           user_id text fk users
  name text                       kind text                       url text
  event_date integer (unix ms)    ref_id text                     alt_text text
  kind text                       created_at integer              position_index integer
  notes text                                                      is_displayed integer (boolean)
  created_at integer
```

- `events.kind` enum: `tournament` / `deadline` / `battle` / `other`.
- `activity_log.kind` enum: `stage_bump` / `recipe_created` / `project_created` / `paint_added` / `slot_added` (extensible).
- `inspo_images.is_displayed` boolean — Ross's "user sets which images are on display."

## Milestones (build in this order)

### P14.1 — Schema + activity_log emit wiring (FOUNDATION — do FIRST) ✅
- Drizzle migration adding the three tables above.
- Wire `activity_log` writes into existing server actions:
  - `bumpStage*` actions → emit `stage_bump`
  - `createRecipe` → emit `recipe_created`
  - `createProject` / quick-add → emit `project_created`
  - `addPaintToWishlist` / `markBought` → emit `paint_added` (helps the activity stream feel alive)
  - `addSlot` → emit `slot_added`
- Single write helper `logActivity(userId, kind, refId?)` to keep the call sites narrow.
- **Acceptance:** existing baselines unchanged. New tables created. activity_log rows accumulate as user interacts.
- **Shipped 2026-06-01 · commit 4a1823a.** 1224 → 1233 passing (+9), typecheck clean. Wires: createProject, bumpCounter, bumpProjectStatus (all branches), createRecipe, addZone, addSlotWithPaint, markBoughtAsNewProject, markBoughtAsExistingUnit.

### P14.2 — PLANNER section scaffold on /projects ✅
- Add PLANNER section header below the existing FOCUS section + above the dashboard table.
- Empty-state copy describing what's coming: "Your painting cadence — events, streak, recent activity, inspiration. Add an event or paint a model to start it up."
- Two-column responsive grid skeleton (Calendar left / Activity+Streak+Heatmap+Inspo stacked right on desktop; full stack on mobile).
- **Acceptance:** section renders, empty states friendly, no widget logic yet.
- **Shipped 2026-06-01 · commit 37d61a3.** 1233 → 1246 passing (+13), typecheck clean. Five sibling cells (Calendar / Activity / Streak / Heatmap / Inspo) ready for the P14.3–7 widget builders to fill in.

### P14.3 — Calendar widget ✅
- Month-view grid (current month default, prev/next nav).
- Days with events render a coloured dot (per `event.kind`).
- "Add event" inline form: name + date picker + kind dropdown + notes. Server action `createEvent` + `updateEvent` + `deleteEvent`.
- Click a day → list events for that day with edit/delete affordances.
- Highlight today's cell.
- Mobile: full-width single column, tappable day cells.
- **Shipped 2026-06-01 · commit d2dee1e.** 1246 → 1279 passing (+33), typecheck clean. Surface: `src/db/queries/events.ts`, `src/lib/actions/events.ts` (createEvent / updateEvent / deleteEvent — Zod-validated, owner-scoped), `CalendarMonthGrid` (7-col grid + Prev/Today/Next nav writing `?calYear`/`?calMonth`, coloured dots per kind, today-ring highlight, day-expand panel with inline edit/delete), `AddEventForm` (solid-fill success — CREATE intent).

### P14.4 — Activity stream widget
- Reads from `activity_log`, last 20 rows for current user, ordered desc by `created_at`.
- Each row: timestamp + kind glyph + sentence ("Built Intercessor Squad · 2h ago", "Created recipe Necron Bone · yesterday", etc.).
- Time-ago helper. Resolve `ref_id` to the entity's name where useful.
- Empty state: "No activity yet. Bump a stage or create a recipe to populate the stream."

### P14.5 — Streak counter widget
- Derived from `activity_log` — count consecutive days with at least one stage-bump or recipe-create action.
- Display: big number + "days" label + microcopy ("On a 6-day painting streak — keep it up." / "Last paint: 3 days ago — break it open."), per state.
- Mobile-tight.

### P14.6 — Heatmap widget
- 90-day grid of cells (one per day), colour intensity by activity count for that day.
- Title row with month labels.
- Hover/tap → tooltip "5 actions · Mon 26 May."
- Reads from `activity_log` grouped by date.
- Mobile: scrollable horizontally OR collapsed to last-30-day view.

### P14.7 — Inspo gallery widget ✅
- 3- or 4-column Notion-style image grid of `inspo_images.url` pastes (where `is_displayed = true`).
- "Add inspo" form: paste URL + optional alt text. Server validates URL shape, doesn't fetch. Display via `<img src={url}>`.
- "Manage" button → full list with show/hide toggles + delete + reorder (drag) → `is_displayed` and `position_index` persist.
- Empty state: "Paste a URL from Pinterest, Instagram, or ArtStation to start your reference board."
- **No fetch, no storage, no thumbnail generation.** External URL passthrough only.
- **Shipped 2026-06-01 · commit e53e7f5.** 1279 → 1321 passing (+42), typecheck clean. Surface: `src/db/queries/inspoImages.ts` (displayed / all / per-row owner check), `src/lib/actions/inspoImages.ts` (addInspoImage / toggleInspoDisplay / deleteInspoImage / reorderInspoImages — URL-shape Zod refine accepts http+https only, NEVER fetches the pasted URL), `InspoGalleryGrid` (2-col mobile / 3-col desktop, `<img src={url} loading="lazy">` — no Next/Image proxy), `AddInspoForm` (solid-fill success), `ManageInspoModal` (per-row show/hide / delete / native HTML5 drag-to-reorder + Save order, Escape + click-outside dismiss).

### P14.8 — Mobile responsiveness pass on the PLANNER section
- Calendar collapses to a friendly compact month at <md.
- Activity stream stacks naturally.
- Streak counter renders inline with heatmap on a tight strip.
- Heatmap last-30-day strip or horizontal scroll fallback.
- Inspo gallery 2-column on mobile.

### P14.9 — Round 11 UX audit
- Dispatch ux-auditor against live deploy after P14.1–8 ship.
- Verify PLANNER section + widgets work end-to-end as fresh recruit.
- Flag mobile / accessibility / discoverability issues.

## Out of scope (Phase 15+)

- Stripe wire + free/paid gating (Phase 15)
- Stopwatch + paint-session timing
- Photo-to-palette eyedropper on uploaded images
- Recurring events / Google Calendar sync
- Inspo image upload (vs. external URL pastes) — locked decision, do not re-open
- Cross-device sync / team painting

## Convention

- Land each milestone as its own commit. Commit message prefix: `feat(p14.N):` or `fix(p14.N):` etc.
- Tests INTO the commit. No orphans.
- `npm test` stays green throughout. Baseline: 1224 passing, 1 skipped.
- `npx tsc --noEmit` clean before every commit.
- Local commit only — Billy merges + pushes.
- Solid-fill Button discipline (P13.1) holds. No `[ ]` brackets.
- Cyan banned from action buttons.
- Use existing `@theme` tokens.
