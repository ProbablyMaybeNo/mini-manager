# Vercel comments — Ross's decision queue

**Snapshot:** 2026-06-27 · **Project:** mini-manager (`prj_YyXdoYrGrIiJxECmHx2AmYKWTEZ3`) · **Prod:** miniaturemanager.vercel.app
**7 unresolved threads** need your call. This is the single durable home for the "blocked / needs-Ross" list — the `vercel-comment-loop` routine regenerates it each run. Thread links: `https://vercel.com/rkhilarysignups-8609s-projects/mini-manager/c/<id>`.

> **This run (2026-06-27):** built 2 clear, bounded fixes — `pnzYXjHjgFpp` (calendar event-dot now sits below the day number instead of touching it) and `X2BittFA6UwD` ("JUN 2026" planner month label kept on one line) — on branch `fix/vercel-comments-2026-06-27` (PR #78). **Both are BLOCKED, not shipped:** CI is red and I will not merge into a red gate. The redness is **pre-existing and unrelated** — `main`'s Playwright E2E has failed the same 5 tests on the last four builds (since 2026-06-24); my fixes pass typecheck + unit + integration + build and add zero new failures. See the 🚨 banner below — fixing the E2E suite needs a human. Two threads also need your input (`377k9jxJmpIC`, `FGqJI1COa7Fx`); five carry over from earlier runs (below).

---

## 🚨 BLOCKER — `main` CI (Playwright E2E) has been red since 2026-06-24

The autonomous merge gate is stuck: no Vercel-comment fix can ship until this is resolved. **Needs a human.**

- **What:** the `Playwright E2E` job in `.github/workflows/ci.yml` fails 5 of 24 tests; typecheck/unit/integration/build all pass.
- **Since:** last green `main` CI run was 2026-06-24 (run 143). Runs 145, 146, 147, 148 (current `main` HEAD `43fad6c`) all fail the **same 5 tests** — deterministic, not flaky.
- **Failing tests:** `qa_dashboard_workspace` M11.1 (add calendar event → ticker) & M11.2 (sub-project + stepper); `qa_project_workspace` M3.1 (project page → focus stepper); `qa_mobile_flows` M6.1 (mobile nav sheet) & M6.2 (create project on mobile → focus stepper).
- **Root cause (from traces):** a first-run onboarding dialog (`role="dialog"`, body text *"Track your project from the macro to the micro…"* — the welcome/tour card) renders over the project page and **intercepts pointer events**, so Playwright can't click the "Open in focus" / nav buttons (click times out at 30–60s). Something merged after 2026-06-24 made this tour modal block core flows on a fresh test user.
- **Suggested next step:** ensure the first-run tour can be dismissed/skipped (or isn't modal-blocking) so a fresh user — and the E2E suite — can reach the project-page actions. This may also be a real UX regression for new users, not just a test issue.

---

## 🔴 NEEDS YOUR CALL

| Thread | Page | Ask | Why it's open / question asked |
|---|---|---|---|
| `377k9jxJmpIC` | /dashboard | Make the four tracker numbers the same font as their title, both white, number smaller than the title. | Making the numbers **white** reverses the per-box accent colours (ACTIVE cyan / COMPLETION green / STREAK yellow / TIME purple) you asked for earlier, and `StatBox` is shared. Asked: drop the accent colours entirely (all white), or keep the colour-coding and only change font + size? *(new 2026-06-27)* |
| `FGqJI1COa7Fx` | /dashboard | Make "this" the same font as the project-table column titles (Flexi IBM VGA True) and white. | Selection landed on the whole PROJECTS panel; the project-name cells are already white, so this is really a typeface swap, and the table is shared with `/projects`. Asked: confirm target = project-name cells → Flexi IBM VGA True in both places? *(new 2026-06-27)* |
| `trogZqV-Yo8w` | /collection | Rebuild +ADD MODEL / +ADD PAINT into a full modal: AUTO-ADD URL paste **+** MANUAL-ADD form (name, game, faction, price, project dropdown, status) → save into the table; plus an edit pencil next to the X on each row. | Substantial feature (new modal layout, manual-entry form + validation, an edit/update flow, a new row action) — beyond the safe auto-fix scope. Asked: confirm the manual fields, and should the edit pencil reuse the same modal pre-filled? |
| `d0MWLSNNjDTd` | /collection | Simplify the stats bar (drop "COLLECTION" title; format as `PAINT: 00 OWNED 00 WISHLIST $00 SPENT $00 REMAINING / MODELS: …`; drop progress tracking here) **and** a new per-project budget feature. | Two asks bundled + an open "let me know your ideas" question. The stats-bar relabel I can ship once the exact line format is locked; the budget system is a net-new feature. Asked: confirm the exact stat order/labels for the relabel so I can ship that piece on its own, and we'll scope budgeting separately. |
| `8Wxk5lw0uh5c` | /tools/stacking | "Add layer button doesn't do anything — either remove it or make it add another circle." | Can't reproduce from source: the **+ Add layer** button is wired and adds a Layer N block (hex + opacity), enabled until 6 layers. "Add another circle" is ambiguous — the predicted-result Venn only renders 2 (undercoat ∩ top glaze). Asked: when you click it, does no new Layer block appear — or did you expect a 3rd Venn circle rather than a layer row? |
| `aANKU9jIO6ih` | /focus | Separate the PROGRESS "x/100" numbers into their own font group and bump to 18px | **Confirmed:** they share the `num2` category (VT323, ~15.5px) with the calendar day numbers, the projects-table Time column, and the progress-bar % labels, so `num2` can't be bumped globally without enlarging all of those. Asked: OK to add a dedicated token (same VT323 face) at 18px for the focus stat only? *(carried over from 2026-06-21)* |
| `0Uwugdcrguxb` | /focus | "Not letting me change my focus using the dropdown." | A functional bug not reproducible from source (the Listbox + URL-driven focus look wired correctly). Asked: when you pick a different project, does the menu not open, do the options not click, or does it select but the bench header not update? *(carried over from 2026-06-21)* |

---

## 🟡 BUILT BUT BLOCKED ON CI (PR #78, NOT resolved — do not close the threads)

These passed typecheck + unit + integration + build and are ready; they are held only by the pre-existing red E2E suite above. Resolve the threads after the E2E suite is green, this PR merges, and prod serves the commit.

| Thread | Page | Change | Files |
|---|---|---|---|
| `pnzYXjHjgFpp` | /dashboard | Calendar event-dot now renders below the day number in normal flow (flex-col, 2px gap) instead of an absolutely-positioned dot overlapping the digits | `src/components/kit/MiniCalendar.tsx` |
| `X2BittFA6UwD` | /dashboard | Planner month label dropped to a smaller OSD size + `whitespace-nowrap` so "JUN 2026" stays on one line in the narrow rail (was ~89px in a ~88px slot → wrapped) | `src/components/dashboard/PlannerCalendar.tsx` |
