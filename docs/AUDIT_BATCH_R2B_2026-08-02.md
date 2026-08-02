# Audit batch — round 2b, 2026-08-02

Three items: two found after the first round-2 batch was already dispatched, and
one scope limit the previous builder flagged and I then verified myself.

Evidence: `ux-audit/round2-2026-08-02/REPORT.md`.

**Rules for this batch**
- You are on branch `fix/audit-batch-r2-2026-08-02`, which already holds the five
  round-2 fixes. Stay on it. **Never push or merge to `main`.**
- Commit per item, referencing its id (R2-7 … R2-9).
- Before EVERY commit: `npm run typecheck` (0 errors), `npm run lint` (0 errors;
  ~51 pre-existing warnings are fine), `npm run test:unit`,
  `npm run test:integration`. Baselines: **786 unit**, **510 integration + 1
  skipped**. Fix causes, never skip a test to go green.
- Do NOT touch `public/data/paints.json`.
- No new dependencies. Match neighbouring file conventions.
- If an item needs a product decision, skip it, leave the box unchecked, say why.

---

- [ ] **R2-9 · P1 · The crash-on-failed-save pattern still exists in four more files**
  R2-2 fixed `ProjectWorkspaceBody`, where an `await`ed server action that
  *rejects* (rather than returning `{ok:false}`) escapes the transition and hits
  the route error boundary — replacing the whole app with the fault screen and
  losing the user's input. The previous builder flagged that the same shape
  survives elsewhere; **I verified it**:

  | file | awaited server actions | try-blocks |
  |---|---|---|
  | `src/app/(app)/collection/CollectionClient.tsx` | 9 | **0** |
  | `src/app/(app)/recipes/[id]/RecipeEditorClient.tsx` | 5 | **0** |
  | `src/components/recipe/RecipeWorkbench.tsx` | 5 | **0** |
  | `src/app/(app)/projects/[id]/ProjectPageClient.tsx` | 3 | **0** |

  22 unguarded awaits. Each is the same whole-app crash plus data loss, one
  network blip away — and `/collection` is the highest-traffic of them.
  **Fix:** apply the same treatment `ProjectWorkspaceBody` now uses — catch the
  rejection, surface an inline retryable error that keeps the user's input, and
  leave the rest of the app mounted. Prefer one shared helper over four copies if
  the call shapes allow it.
  **Verify:** for at least `CollectionClient` and one recipe editor, reproduce
  with Playwright `context.setOffline(true)`, and assert the fault screen does
  NOT render, the field stays mounted, and the typed value survives.

- [ ] **R2-7 · P2 · Unknown URLs redirect to sign-in instead of 404ing**
  On production every unmatched path is treated as a protected route:
  ```
  /does-not-exist   → 307 → /sign-in?from=%2Fdoes-not-exist
  /totally/made/up  → 307 → /sign-in?from=%2Ftotally%2Fmade%2Fup
  /Dashboard        → 307 → /sign-in?from=%2FDashboard   (case slip on a real route)
  ```
  `/r/nope-not-real` **does** return the branded 404, so the page exists —
  unmatched *top-level* paths never reach it. Users conclude the content needs an
  account rather than that it is gone, and crawlers get a soft-404 into sign-in.
  **Fix:** only redirect to sign-in for paths that match a known protected route;
  let genuinely unknown paths fall through to the existing 404.
  **Verify:** `/does-not-exist` returns 404 and renders the branded ERROR page,
  while `/dashboard` signed-out still redirects to `/sign-in`.

- [ ] **R2-8 · P2 · The CSP is report-only with nowhere to report**
  Production sends `Content-Security-Policy-Report-Only` and **no `report-uri`,
  `report-to` or `Reporting-Endpoints`** — verified live. So it blocks nothing,
  and the stated exit criterion in `next.config.ts` ("enforce once the violation
  reports are clean") can never be evaluated because no reports are collected.
  Honest caveat: the policy allows `script-src 'self' 'unsafe-inline'
  'unsafe-eval'`, so enforcing it as written is a modest gain, not a large one.
  **This one needs a judgement call — if you cannot make it, skip it and say so.**
  The two defensible options are (a) route reports to Sentry, which is already in
  the stack and ingests CSP reports, so the policy can eventually graduate, or
  (b) leave it report-only but correct the config comment so the next reader does
  not believe the app is protected. Do NOT flip it to enforcing without a
  reporting period — that risks breaking the render.

---

## Out of scope

- **R2-3 — army-list import nesting.** Unreproduced; needs Ross's manual check.
- **R2-4 retailer list** — narrowing the advertised retailers is a product call.
- The failed-CI catalog commits on `main`.
- Real-device camera verification for R2-5 (needs Ross's phone).
