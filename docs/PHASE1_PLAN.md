# Mini Manager — Phase 1 Build Plan

Source of truth for the milestone-builder agent. Each unchecked item is a self-contained milestone with scope, patterns, and acceptance criteria. Build top-down. Tick the box when shipped.

**Already shipped (do not re-run):**
- [x] P1.1 — Scaffold Next.js 16 / React 19 / TypeScript strict / Tailwind v4
- [x] P1.2 — Drizzle schema + SQLite local dev DB + stage cascade CHECK constraint
- [x] P1.4 — Terminal design tokens + NavRail + root layout
- [x] P1.5 — Projects dashboard (Backlog / Active / All) reading from DB

**Remaining (build in this order):**

---

## P1.6 — New Project modal + quick-add parser

- [x] Build this milestone

**Context.** Right now the [+] New project button links to `/projects/new` but no page exists. This milestone wires up project creation end-to-end with two affordances: a full modal (type picker + count + parent) and a single-input quick-add bar that parses "Necron Warriors x20" → name + count guessed.

**Files to create.**
- `src/lib/quickAdd.ts` — pure parser. Exports `parseQuickAdd(input: string): { name: string; count: number; type: ProjectType }`. Heuristics: trailing `x10` / `x 20` / `×20` → count; "single", "warband", "army", "terrain" hints in the input → infer type; default count=1, type="Single Model". Add unit tests inline via `if (require.main === module)` block or skip tests — milestone-builder may not have a test runner wired up yet.
- `src/lib/actions/projects.ts` — server actions. Export `createProject(input)` that validates with Zod, inserts via Drizzle using `currentUserId()` from `@/lib/auth-stub`, then `revalidatePath("/projects")` and `redirect(\`/projects/\${id}\`)`. Input shape: `{ name, type, count, parentId? }`. Use the existing `projectTypes` enum from schema.
- `src/app/projects/new/page.tsx` — full New Project form. Server-rendered shell with a small client component for the form. Type select (radio cards), name input, count input (default 1), optional parent select (populated from `listTopLevelProjects` filtered to type='Army' or 'Warband'). Submit → server action → redirect to the new project workspace.
- `src/components/QuickAddBar.tsx` — client component used on `/projects` dashboard. Single text input with placeholder `'e.g. "Necron Warriors x20" or "Sergeant Vraks"'`. On submit: parse via `parseQuickAdd`, call `createProject`. Keyboard: `/` to focus from anywhere on `/projects`.

**Files to modify.**
- `src/app/projects/page.tsx` — add `<QuickAddBar />` above the header right side, next to the existing `[ + ] New project` link.

**Patterns to follow.**
- Server actions: file starts with `"use server"`. Always validate with Zod. Always `revalidatePath` after a mutation. Use the `currentUserId()` stub.
- Component style: match `ProjectRow.tsx` for tone (mono labels, sans prose, `clsx` for conditional classes). Match `frame` / `frame-strong` / `tap-target` / `section-title` utility classes already defined in globals.css.
- Forms: native `<form action={serverAction}>` for the full page; client component with `useTransition` for the inline QuickAddBar.

**Implementation notes.**
- Project type picker on `/projects/new`: render the 6 types from `projectTypes` as a vertical list of radio cards (label + 1-line description). Don't over-engineer — basic radio cards work.
- Count input: clamp to ≥0. For type "Army"/"Warband" allow count=0 (the parent is conceptual). For "Single Model" force count=1.
- Parent select: optional. Only show for type Unit/Single Model/Terrain Piece. Filter the parent options to Army or Warband types only.
- `parseQuickAdd` examples to handle: `"Necron Warriors x20"` → name="Necron Warriors", count=20, type="Unit". `"Sergeant Vraks"` → name="Sergeant Vraks", count=1, type="Single Model". `"Ruined Cathedral terrain"` → name="Ruined Cathedral", count=1, type="Terrain Piece". `"Astra Militarum army"` → name="Astra Militarum", count=0, type="Army".

**Acceptance criteria.**
- `npm run typecheck` exits 0.
- Visiting `/projects/new` shows a form. Submitting creates a row in `project` and redirects to `/projects/[id]`.
- QuickAddBar on `/projects` accepts `"Test Squad x5"` and creates a Unit named "Test Squad" with count=5.
- The dashboard re-renders to show the new project (server action revalidates).

**Commit message:** `P1.6: new project modal + quick-add parser`

---

## P1.7 — Project workspace with stage counter panel

- [x] Build this milestone

**Context.** The flagship UX of Phase 1. The placeholder at `/projects/[id]` currently shows stage counts but no interactivity. Replace with a counter panel where each of Build/Prime/Paint/Base/Complete has `−` and `+` buttons, constraint-enforced (can't have more primed than built), with keyboard shortcuts `B/P/A/S/C` to advance on desktop.

**Files to create.**
- `src/lib/actions/counters.ts` — server actions: `bumpCounter(projectId, stage, delta)` where `stage` ∈ `"owned" | "build" | "prime" | "paint" | "base" | "complete"` and `delta` ∈ `{1, -1}`. Validates the cascade constraint pre-write (returns a friendly error if violated; the DB CHECK is the second line of defense). Uses `currentUserId()`. After mutation: `revalidatePath(\`/projects/\${projectId}\`)` and `revalidatePath("/projects")`.
- `src/components/StageCounter.tsx` — client component. Five rows: Build / Prime / Paint / Base / Complete. Each row has: label (mono, uppercase, fixed width), current/total (mono), inline ProgressBar (reuse `src/components/ProgressBar.tsx`), and `−` / `+` buttons. On click: `useTransition` wraps a call to `bumpCounter`. Disable buttons that would violate cascade. Keyboard shortcuts on the page level: `B/P/A/S/C` to bump the matching stage by +1 (or +Shift to bump -1). Mobile: `tap-target` class for 44px buttons.
- `src/components/OwnedCounter.tsx` — same pattern but a separate row above the stage panel. Owned shows N / total, with `−` / `+` buttons. Constraint: `0 ≤ ownedCount ≤ count`; lowering owned below build/prime/etc. fails (return friendly error).

**Files to modify.**
- `src/app/projects/[id]/page.tsx` — replace the static stage list with `<OwnedCounter />` + `<StageCounter />`. Keep the breadcrumb + header (name / type / faction / progress %). Above the counters, add an `Edit project` link for later (no UI yet — just a placeholder).
- `src/lib/progress.ts` — already has `progressPercent` and `displayStatus`. Confirm they handle edge cases (count=0 → 0%). No changes needed unless edge cases are off.

**Patterns to follow.**
- Server actions: `"use server"` at top of file. Zod-validate inputs. Return `{ ok: true } | { ok: false, error: string }` for client to display.
- Client component idiom: `'use client'`, `useTransition` for optimistic UX during the server action call. Optimistic update of local state, server re-validates path on success.
- Style: match `ProgressBar.tsx` and `ProjectRow.tsx` — bracketed counters in mono, glow only on active states. The currently-most-advanced stage gets a subtle `text-[var(--color-green)]`; others stay `text-[var(--color-fg-muted)]`.

**Implementation notes.**
- Layout per stage row (desktop):
  ```
  BUILD     [ ████████░░░░░░░░░░░░ ]  10 / 20   [ − ] [ + ]
  ```
- Layout per stage row (mobile): the buttons stack to the right of the label/bar on screens ≥ 480px, full-width below.
- Button enable rules:
  - `+` on stage N is disabled when `stage[N] >= stage[N-1]` (or `>= count` for Owned, or `>= ownedCount` for Build).
  - `−` on stage N is disabled when `stage[N] <= stage[N+1]` (the stage above must not be higher).
- Keyboard handler attaches at the workspace page level (effect). Don't fire shortcuts when an input/textarea has focus.
- For `count=0` projects (Army parents in their default state), hide the counters entirely with a small message: "This Army has no rank-and-file. Aggregate counters appear when child units are added."

**Acceptance criteria.**
- `npm run typecheck` exits 0.
- `/projects/[id]` for "Tactical Squad Alpha" (seeded) shows the counters at 10 / 6 / 3 / 1 / 0.
- Clicking `+` on Paint → counter goes to 4, dashboard reflects it.
- Pressing keyboard `P` (page-level) advances Prime by 1.
- Attempting `+` on Paint when Prime=Paint disables the button (no DB call).

**Commit message:** `P1.7: project workspace + stage counter panel`

---

## P1.8 — Named models panel (hidden when empty)

- [x] Build this milestone

**Context.** A unit with one champion who needs a different scheme adds named-model entries inside the unit. Each named model has a name and 5 stage checkboxes (no counters — single mini). Panel is hidden when there are no named models for the project.

**Files to create.**
- `src/lib/actions/namedModels.ts` — server actions: `createNamedModel(projectId, name)`, `deleteNamedModel(id)`, `toggleNamedModelStage(id, stage)` where stage is one of the 5 booleans. Cascade: toggling `isPrimed` off when `isPainted` is on should fail (the DB CHECK enforces it; return friendly error).
- `src/components/NamedModelsPanel.tsx` — server component that fetches the list of named models for the project + renders. Inside, a small client component `NamedModelRow.tsx` for the toggle + delete UX.
- `src/components/NamedModelRow.tsx` — client. Row layout: name input (editable inline), 5 stage checkboxes (build / prime / paint / base / complete), `×` delete button. Toggling a checkbox calls `toggleNamedModelStage` via `useTransition`.

**Files to modify.**
- `src/app/projects/[id]/page.tsx` — fetch named models server-side, pass to `<NamedModelsPanel />`. Render below the stage counter panel. Header includes count: `"Named Models · 3"`.
- `src/db/queries/projects.ts` — add `listNamedModelsByProject(userId, projectId)`. Verifies project ownership before returning.
- `src/lib/progress.ts` — `progressPercent` already accepts named models as the second arg; verify the page passes them so the workspace header's % includes named models.

**Patterns to follow.**
- Add Named Model form is just an inline `<form>` at the bottom of the panel with one text input + submit button. No modal.
- Stage checkboxes are 5 ASCII-ish boxes (`[✓]` filled / `[ ]` empty) in mono. Tap target 44px on mobile.
- If `namedModels.length === 0`, render `[ + Add named model ]` button only (no list, no header). The full panel appears once the first is added.

**Acceptance criteria.**
- `npm run typecheck` exits 0.
- `/projects/[id]` for Tactical Squad Alpha shows Sergeant Vraks with isBuilt/isPrimed/isPainted checked.
- Clicking the Base checkbox toggles `is_based=1` in the DB.
- Adding a new named model "Apothecary Maelus" appears in the list.
- Header progress % updates to include the new model's contribution.

**Commit message:** `P1.8: named models panel`

---

## P1.9 — Sub-project nesting + aggregate counters up the tree

- [ ] Build this milestone

**Context.** When a project is an Army, render its child Units in a left tree. The Army's header counters become the SUM of its children's counters (this is what painters see when they ask "how done is my army?"). Reparenting child Units between Armies is out of scope for v1 — defer.

**Files to create.**
- `src/components/ProjectTree.tsx` — server component. Given a parent project, fetches direct children, renders a small vertical list with status + progress per child. Clicking a child navigates to its workspace (which then renders its own tree at the next level — recursive but 3-level cap means at most Army → Unit → NamedModel rendering).
- `src/db/queries/projects.ts` — add `listChildProjects(userId, parentId)` returning ordered children.

**Files to modify.**
- `src/app/projects/[id]/page.tsx` — if project type is Army or Warband, render the `<ProjectTree />` to the left of the counter panel (md+) or above it (mobile). The counter panel still appears but displays the AGGREGATED counters from `aggregateCounters` in `src/lib/progress.ts`. The actual editable counters on an Army are zeroed (count=0); only its child Units have editable counters.
- `src/lib/progress.ts` — `aggregateCounters` already exists. Wire it up. Add a small helper `isLeafProject(p): boolean` returning true when `p.count > 0 || namedModelCount > 0`.

**Patterns to follow.**
- For Army header counters, render them in a read-only style (no `+/−` buttons, no glow). Add a `(aggregated from N units)` caption beside the totals.
- For leaf Units, the editable counters work as P1.7.
- The tree is a vertical list of `<Link>` rows: `▸ Tactical Squad Alpha · UNIT · 40%`. Style matches existing `ProjectRow.tsx` but compact.

**Implementation notes.**
- Enforce the 3-level hard cap in the application layer: when creating a project (P1.6), if the parent's parent is non-null AND the new project would be type Unit/Single Model, reject ("Maximum 3 levels of nesting: Army → Unit → Model"). Note: NamedModel handles the third level, not a nested project.
- Deletion: deleting an Army cascades through `references(..., { onDelete: "cascade" })` already defined in the schema. Verify in the migration SQL.

**Acceptance criteria.**
- `npm run typecheck` exits 0.
- `/projects/[id]` for Salamanders 2k shows a tree with Tactical Squad Alpha as a child link.
- The Army's header counters show aggregated totals: Build 10/30, Prime 6/30, Paint 3/30, Base 1/30, Complete 0/30 (assuming Tac Squad 10 models + Ork Boyz Mob 20 models reparented as a test, or just the Tac Squad if Ork Boyz stays standalone).
- Clicking the child link navigates into the Unit workspace.

**Commit message:** `P1.9: sub-project nesting + aggregation`

---

## P1.3 — NextAuth (replaces the dev stub)

- [ ] Build this milestone

**Context.** Replace `currentUserId()` stub with real auth. Magic-link via Resend for dev (or console-log transport if Resend isn't set up), OAuth (Google + GitHub) configured but commented out until Ross provides credentials. Sign-in / sign-out flow. Session-protected routes.

**Files to create.**
- `src/auth.ts` — NextAuth v5 config. `DrizzleAdapter(db)` using the schema from `src/db/schema.ts`. EmailProvider with a custom `sendVerificationRequest` that console.logs the URL in dev. Exports `auth`, `signIn`, `signOut`, `handlers`.
- `src/app/api/auth/[...nextauth]/route.ts` — `export { GET, POST } from "@/auth"` boilerplate.
- `src/app/sign-in/page.tsx` — minimal sign-in screen. Email input → submit triggers magic link → "Check your email" confirmation.
- `src/middleware.ts` — protects all routes except `/sign-in`, `/api/auth/*`, and static assets. Redirects unauthenticated users to `/sign-in`.

**Files to modify.**
- `src/lib/auth-stub.ts` — replace internals with `const session = await auth(); return session?.user?.id`. Throw if missing (or redirect). Keep the export name `currentUserId` so nothing else in the codebase changes.
- `.env.example` — uncomment the AUTH_RESEND_KEY and OAuth blocks with comments explaining when they're needed.

**Patterns to follow.**
- NextAuth v5 docs: https://authjs.dev/getting-started/installation?framework=Next.js
- Drizzle adapter: https://authjs.dev/getting-started/adapters/drizzle
- Use the `users` / `accounts` / `sessions` / `verificationTokens` tables already in `src/db/schema.ts` — DO NOT redefine.

**Implementation notes.**
- Magic-link `sendVerificationRequest` in dev: just `console.log` the URL with bracket framing so it's visible in the server console.
- If `process.env.AUTH_RESEND_KEY` is set, use the Resend email transport. Otherwise console-log.
- The dev seed user (`dev_user__local`) won't have a real session — once auth is on, Ross signs in with his actual email and gets a real user row. The seeded data can be transferred to his real user via a one-off migration OR ignored. Note this in the commit body.

**Acceptance criteria.**
- `npm run typecheck` exits 0.
- Visiting `/` while signed-out redirects to `/sign-in`.
- Submitting an email on `/sign-in` triggers a verification email (or logs to console).
- Clicking the link signs the user in, creates a `user` row + `session` row, redirects to `/projects`.
- `/projects` then shows that user's projects (empty list — they're not the seeded dev user).

**Commit message:** `P1.3: NextAuth magic-link auth (OAuth deferred)`

---

## Conventions for milestone-builder

When working on these milestones:

- **Commit only locally; do not push.** Ross reviews before pushing.
- **Pre-commit:** run `npm run typecheck` and confirm 0 errors. Refuse to commit if it fails.
- **No new dependencies** without flagging in the commit body. The current `package.json` should cover everything.
- **No `any` types. No `@ts-ignore`.** Strict mode is mandatory.
- **Match existing patterns.** Read neighbouring files in `src/components/` and `src/db/` before introducing new patterns.
- **Tailwind v4 syntax.** CSS-first `@theme`. Use the existing tokens (`var(--color-green)`, etc.) — don't introduce arbitrary hex values.
- **Server-side first.** Default to server components. Only mark `'use client'` when interactivity (state, event handlers) is actually needed.
- **Halt and report** if a milestone has an architectural decision the plan doesn't cover. Do not guess.
