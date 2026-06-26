# IA pages — DOP-005 (FOCUS/PLANNER) + DOP-017 (Projects list)

Ross greenlit both (2026-06-26). Branch `redesign/project-panel`, NOT deployed (preview-gated).
Build each as its own commit; `npm run typecheck` + unit + integration green; reference the id; push to the branch. Do NOT merge/deploy. Do NOT start a dev server while editing. Reuse existing primitives + match the vintage-terminal aesthetic.

## DOP-005 — Give the calendar its own PLANNER page (FOCUS stays the bench)
**The problem:** the nav's **FOCUS** is the painting bench (one-model recipe/notes/timer), but the *calendar* is also called "PLANNER" and only exists as a dashboard widget + the mobile planner screen — and `/planner` currently redirects to FOCUS. New users can't tell them apart.

**The call (Ross delegated):** FOCUS stays exactly as-is = the bench. The calendar/events/activity become a real, standalone **PLANNER page** at `/planner`.

- [x] **DOP-005a — Real `/planner` page.** Remove the `/planner → /focus` (or `/planner → /dashboard`) redirect in `next.config.ts` (or wherever it lives) and add a real `(app)/planner/page.tsx`. The page is the full planner: the month **calendar**, the **events list + "+ Event"**, and the **activity tracker** — reuse the existing `RightRail` / `PlannerScreen` / `PlannerCalendar` pieces rather than rebuilding. Page header "PLANNER" + a `//` descriptor (e.g. "// tournaments, deadlines & your hobby calendar"). Uses the tightened calendar (RF-9).
  - Done: removed `/planner` redirect; added `(app)/planner/page.tsx` reusing `PlannerCalendar` (calendar + "+ Date" add-event) + `ActivityFeed` in a full-page two-column layout. Added an optional `calendarClassName` prop to PlannerCalendar so the page widens the month grid without changing the compact rail/mobile usages.
- [x] **DOP-005b — Make it reachable + distinct.** The dashboard's PLANNER widget header becomes a link to `/planner` (e.g. "PLANNER ▸"); the mobile Upcoming-Events bar should land on the same planner experience (keep the existing full-screen PlannerScreen on mobile, or route to `/planner` — pick one and keep it consistent). Do NOT add PLANNER to the primary nav (keep it lean) unless it reads cleaner — implementer's judgment, flag it. Confirm FOCUS's descriptor still clearly reads as "the bench."
  - Done: RightRail PLANNER panel gains an "OPEN PLANNER ▸" link → `/planner`. Mobile keeps the existing full-screen PlannerScreen takeover (unchanged, consistent). PLANNER NOT added to primary nav (kept lean — reachable from the dashboard widget, which is where users meet the calendar).
- Acceptance: visiting `/planner` shows a real planner page (calendar + events + activity), NOT a redirect to FOCUS; it's reachable from the dashboard; FOCUS and PLANNER are now obviously different surfaces.

## DOP-017 — Real `/projects` list page (manage many projects)
**The problem:** `/projects` 308-redirects to `/dashboard`; there's no focused place to manage a large roster.

- [ ] **DOP-017 — `/projects` resource-list page.** Replace the `/projects → /dashboard` redirect with a real `(app)/projects/page.tsx`. It's the **power-user management view** — the projects list with controls the dashboard lacks:
  - **Search** by name.
  - **Filter** by status (Wishlist/Owned/Building/Priming/Painting/Basing/Complete/Shelved), type (Army/Warband/Unit/Model/Terrain/Diorama), and priority.
  - **Sort** by name / completion % / priority / recently-updated.
  - Reuse the existing `ProjectsTable` (desktop table + mobile cards) for the rows so row actions (open inspector, focus, delete, attach) all carry over. Drive the inspector the same way the dashboard does (`onOpenProject`).
  - NO welcome card / stat strip / calendar — just the filterable list (that's what differentiates it from the dashboard). Page header "PROJECTS" + a `//` descriptor (e.g. "// every army, warband & model you're tracking").
  - Bulk actions (multi-select delete/archive) are NICE-TO-HAVE — include if clean, otherwise defer and flag.
  - **Reachable:** add a link from the dashboard PROJECTS panel header (e.g. a small "ALL PROJECTS ▸" / "Manage" affordance) → `/projects`. Keep it out of the primary nav unless it reads cleaner (flag the choice).
- Acceptance: `/projects` renders a searchable/filterable/sortable project list (no redirect); reachable from the dashboard; opening a project works; mobile uses the cards.

## DOP-014 — One consistent content grid (kill the inconsistent right-gutter) — Ross: "do whatever you think is best"
**The problem:** pages disagree on content width — some cap content and leave a ~270px wasted right gutter, others run full-width, so the app feels inconsistent page-to-page.

**The call:** pick ONE content-container convention and apply it uniformly across the main app pages (dashboard, projects, library, collection, recipes, tools, focus, planner). Recommended: a single shared max-width content wrapper (e.g. a `PageContainer` / consistent `max-w-*` + horizontal padding) so any gutter is uniform and intentional, OR consistent full-bleed with standard padding — implementer picks the one that reads best with the existing pages and applies it everywhere.

- [ ] **DOP-014 — Consistency pass.** Introduce/standardize one content-width convention and apply it to the main pages so the right-gutter is consistent (not a per-page accident). Keep it LIGHT — this is a consistency pass, not a redesign: don't change each page's internal layout, just normalize the outer content container. If a page genuinely needs to be full-width (Library color-map, Tools wheel), exempt it intentionally and note why. Acceptance: main pages share one content-width rule; no page has a uniquely odd wasted gutter; nothing overflows. If this balloons beyond a contained change, do the high-value pages and FLAG the rest rather than sprawling.

### Notes
- Both DOP-005 + DOP-017 touch routing — remove the redirects in `next.config.ts` carefully (there were `/projects` and possibly `/planner` redirect rules; check `qa_*` e2e specs that may assert the redirect and update them since the behavior intentionally changed).
- Keep the desktop two-pane inspector working from `/projects` (opening a project from the list should open the same InspectorPane/bottom-sheet as the dashboard).
- Order: build DOP-005, then DOP-017, then DOP-014 (the consistency pass last so it normalizes the two new pages too).
