# Mini Manager — Phase 3 Build Plan

Source of truth for the milestone-builder agent. Each unchecked item is a self-contained milestone with scope, patterns, and acceptance criteria. Build top-down. Tick the box when shipped.

**Phase goal (per V2-BUILD-PLAN §11.3):** Recipes — the connective tissue between projects and library. A painter can build a recipe (ordered zones × technique stacks × pinned paints) and bind it to a project, a named model, or stand it alone. Body silhouette: **Infantry only** in Phase 3 (Vehicle / Monster / Terrain deferred to Phase 6). Technique Guides deferred to a later phase per Ross.

**Ship criterion (V2-BUILD-PLAN):** Ross builds 3 real recipes for actual projects and uses them while painting.

**Already shipped (do not re-run):** none — Phase 3 starts fresh on top of Phase 2.

**Remaining (build in this order):**

---

## P3.1 — Recipe data model + migrations

- [x] Build this milestone

**Context.** Three new tables + relations. Recipes are first-class entities (per V2-BUILD-PLAN §4.3) — they can attach to a project, attach to a named model, or stand alone. Each recipe is an ordered list of zones; each zone is an ordered list of technique steps; each step pins a paint from the catalog OR holds a custom hex (mixes).

**Files to create.**
- `src/db/schema.ts` additions:
  ```
  recipe (sqliteTable "recipe")
    id (nanoid)
    ownerId (fk → users.id, cascade)
    name (text, not null)
    bodyType (text enum: "infantry" | "vehicle" | "monster" | "terrain", default "infantry")
    attachedProjectId (fk → projects.id, set null on delete, nullable)
    attachedNamedModelId (fk → namedModels.id, set null on delete, nullable)
    isStandalone (boolean, default false)
    publicSlug (text, unique, nullable)        -- Phase 5 will write this
    notesMd (text, nullable)
    createdAt / updatedAt
  -- Indexes: (ownerId, isStandalone); (attachedProjectId); (attachedNamedModelId)
  -- A recipe can be attached to at most one project OR one named model.
  -- Both null + isStandalone=true means a saved free-floating recipe.

  recipeZone (sqliteTable "recipe_zone")
    id (nanoid)
    recipeId (fk → recipe.id, cascade)
    position (integer, not null)
    name (text, not null)                       -- e.g. "Power Armor — Primary"
    silhouetteZoneId (text, nullable)           -- maps to the silhouette JSON id
    createdAt
  -- Unique index on (recipeId, position)
  -- Index on (recipeId)

  recipeStep (sqliteTable "recipe_step")
    id (nanoid)
    zoneId (fk → recipeZone.id, cascade)
    position (integer, not null)
    technique (text enum: "basecoat" | "layer" | "wash" | "drybrush" |
               "edge_highlight" | "glaze" | "stipple" | "wet_blend" |
               "two_thin_coats" | "zenithal_prime")
    paintId (text, nullable)                    -- references paints.json by id; no SQL FK
    customColorHex (text, nullable)             -- for "this is a mix"
    notesMd (text, nullable)
    createdAt
  -- Unique index on (zoneId, position)
  -- Index on (zoneId)
  -- App-layer check: exactly one of paintId / customColorHex must be set
  ```
  Add relations to `usersRelations`, `projectsRelations`, `namedModelsRelations`.
- `src/lib/recipes/types.ts` — shared TS types: `TechniqueKey`, `BodyType`, `RecipeWithZones` (the full nested shape used by the editor).
- New Drizzle migration via `npm run db:generate`.

**Files to modify.**
- `src/db/schema.ts` — add the three tables + the new relations.

**Patterns to follow.**
- Singular SQL names (matches existing `project`, `named_model`).
- JS const exports plural (`recipes`, `recipeZones`, `recipeSteps`).
- Use the existing `id()` helper for nanoid PKs.
- Use `timestamps` partial for `createdAt`/`updatedAt` on `recipe`; zones + steps only need `createdAt`.

**Implementation notes.**
- The `isStandalone` flag is redundant with `attachedProjectId IS NULL AND attachedNamedModelId IS NULL` but explicit is clearer in query filters. Set it as a generated column? No — keep it a real boolean and write it consistently in the actions. Cheaper than a CHECK constraint.
- Constraint that "at most one attachment" is enforced application-side in P3.2's actions; do NOT add a DB CHECK that ANDs the two foreign keys — SQLite's CHECK semantics around FK validity get awkward.
- Step `paintId` is text (not FK) because paints live in JSON, not the DB. Same pattern as P2.3's `InventoryEntry.paintId`.

**Acceptance criteria.**
- `npm run typecheck` exits 0.
- `npm run db:migrate` applies the new migration cleanly.
- A throwaway insert of a recipe + one zone + one step round-trips correctly (verify in `data/local.db` with a SQL probe).

**Commit message:** `P3.1: recipe / zone / step schema + migration`

---

## P3.2 — Recipe queries + server actions (CRUD + attach/detach)

- [x] Build this milestone

**Context.** All the server-side plumbing the editor needs. No UI yet — just the data layer + actions.

**Files to create.**
- `src/db/queries/recipes.ts`:
  - `listStandaloneRecipes(userId)` — all `isStandalone=true` for the user, newest first.
  - `listRecipesForProject(userId, projectId)` — attached to that project.
  - `listRecipesForNamedModel(userId, namedModelId)` — attached.
  - `getRecipeWithZones(userId, recipeId)` — full nested shape (`Recipe + zones[] + zones[].steps[]`), ownership-checked. Returns `null` if not found / not owned.
  - `getProjectRecipeMap(userId)` — Map<projectId, recipe[]> for the dashboard.
- `src/lib/actions/recipes.ts` — server actions:
  - `createRecipe(input)` — `{ name, bodyType, attachedProjectId?, attachedNamedModelId? }`. Zod-validated. Auto-sets `isStandalone` based on attachments. Reject if both attachment fields are non-null.
  - `updateRecipe(id, patch)` — partial update of `name`, `bodyType`, `notesMd`.
  - `deleteRecipe(id)` — cascade-deletes zones + steps via FK.
  - `attachRecipeToProject(recipeId, projectId)` — set `attachedProjectId`, clear `attachedNamedModelId`, set `isStandalone=false`.
  - `attachRecipeToNamedModel(recipeId, namedModelId)` — analogous.
  - `detachRecipe(recipeId)` — clear both attachments, set `isStandalone=true`.
- `src/lib/actions/recipeZones.ts` — server actions:
  - `addZone(recipeId, name, silhouetteZoneId?)` — appends at `max(position)+1`.
  - `updateZone(id, patch)` — name / silhouetteZoneId.
  - `deleteZone(id)` — cascades to steps.
  - `reorderZones(recipeId, orderedIds)` — atomic position rewrite.
- `src/lib/actions/recipeSteps.ts` — server actions:
  - `addStep(zoneId, input)` — `{ technique, paintId? | customColorHex?, notesMd? }`. Reject if neither paint nor hex is supplied; reject if both.
  - `updateStep(id, patch)` — technique / paint pin / hex / notes.
  - `deleteStep(id)`.
  - `reorderSteps(zoneId, orderedIds)`.

**Files to modify.**
- none beyond P3.1's schema.

**Patterns to follow.**
- Same as Phase 1/2 actions: `"use server"`, Zod, `currentUserId()`, ownership check before mutation, `revalidatePath(...)` for affected routes, return `ActionResult<T>`.
- For ownership: every action takes a recipe/zone/step id and verifies the recipe's `ownerId === currentUserId()`. For zone/step ops, JOIN through recipe.
- `revalidatePath`s to fire: `/recipes`, `/recipes/[id]`, and any attached project/named-model workspace.

**Implementation notes.**
- Position rewrites for `reorderZones` / `reorderSteps`: use a SQL transaction to set positions to negative offsets first (avoids unique-index collisions), then to the final positions. Or: bump every position by 10000 first, then assign final. Pick whichever is shorter.
- Don't fetch the full recipe inside the create-step action. Only fetch what's needed for the ownership check.
- For `getRecipeWithZones`, return zones ordered by `position ASC`, steps ordered by `position ASC`.

**Acceptance criteria.**
- `npm run typecheck` exits 0.
- Create a recipe via action, add 2 zones, add 3 steps to each, fetch with `getRecipeWithZones` — order is correct.
- Reorder zones via `reorderZones` and confirm.
- Detach a recipe from a project and confirm `isStandalone=true`.
- Attempting to attach a recipe with both `projectId` AND `namedModelId` returns `{ ok: false, error }`.

**Commit message:** `P3.2: recipe / zone / step queries + actions`

---

## P3.3 — Infantry SVG silhouette with clickable zones

- [x] Build this milestone

**Context.** The recipe editor's left pane: a front-view humanoid infantry figure where each body region is an interactive SVG path. Zones map by `silhouetteZoneId` to the corresponding `recipeZone` row. Drives both "click to add a zone to the recipe" and "highlight existing zones with their swatches."

**Files to create.**
- `src/lib/silhouettes/infantry.ts` — static export of the zone metadata:
  ```ts
  export const INFANTRY_ZONES = [
    { id: "head", name: "Head / Face",            defaultStepCount: 3 },
    { id: "helmet", name: "Helmet",               defaultStepCount: 3 },
    { id: "armor-primary", name: "Armor — Primary", defaultStepCount: 4 },
    { id: "armor-secondary", name: "Armor — Secondary", defaultStepCount: 4 },
    { id: "armor-trim", name: "Armor — Trim",     defaultStepCount: 3 },
    { id: "cloak", name: "Cloak / Cape",          defaultStepCount: 4 },
    { id: "weapon-main", name: "Weapon — Main",   defaultStepCount: 3 },
    { id: "weapon-secondary", name: "Weapon — Secondary", defaultStepCount: 3 },
    { id: "weapon-metal", name: "Weapon — Metal", defaultStepCount: 3 },
    { id: "leather", name: "Leather / Straps",    defaultStepCount: 3 },
    { id: "skin", name: "Exposed Skin",           defaultStepCount: 4 },
    { id: "base", name: "Base",                   defaultStepCount: 3 },
  ] as const;
  export type InfantryZoneId = (typeof INFANTRY_ZONES)[number]["id"];
  ```
- `src/components/recipes/InfantrySilhouette.tsx` — `'use client'`. Renders an inline SVG of a 3/4-front-view humanoid (rough stick-figure-with-armor shape is fine — visual-fidelity isn't the goal; click affordance is). Each zone is a separate `<path>` with `data-zone-id` + accessible label. Props:
  ```ts
  interface Props {
    paintedZones: ReadonlyMap<InfantryZoneId, { swatchHex: string }>;
    selectedZoneId: InfantryZoneId | null;
    onSelectZone: (id: InfantryZoneId) => void;
  }
  ```
  Paths fill with the swatch hex when present; otherwise muted border. Selected zone gets a glow outline. Hover state is the cyan focus ring.

**Files to modify.**
- `src/db/queries/recipes.ts` — add `paletteForRecipe(recipe)` helper that walks zones → steps → derives the dominant swatch hex per zone (first step's paint hex OR customColorHex). This feeds InfantrySilhouette's `paintedZones`.

**Patterns to follow.**
- SVG should be a single component file with the path data inline. No external SVG asset — keeps the file searchable and the path data type-safe.
- Use the existing `var(--color-green)` / `var(--color-cyan)` / `var(--color-fg-muted)` tokens for the un-painted / hover / selected states.
- Accessibility: each `<path>` has `role="button"`, `tabIndex={0}`, `aria-label={zone.name}`, and Enter / Space activates onSelectZone.
- The component renders inline — don't lazy-load. Total path data should be under 8KB.

**Implementation notes.**
- Drawing approach: 600×800 viewBox. Hand-build the paths in the file using a single front-view rig. Don't try for anatomical accuracy; readability of zones at 200px wide is what matters.
- Zone paths should not overlap; tiny gaps between zones are fine (they read as panel lines on a model).
- A small "zone label" tooltip on hover (using `<title>` element inside the path) — native SVG tooltip, no JS popover needed.
- v1 leaves vehicles, monsters, and terrain for Phase 6. Show a `"Body type other than 'infantry' is not yet supported"` message in the recipe editor if the user somehow lands there with a different bodyType.

**Acceptance criteria.**
- `npm run typecheck` exits 0.
- A throwaway `/recipes/_test` route renders the silhouette; clicking each zone fires `onSelectZone` with the right id.
- Passing a `paintedZones` map containing `{ "armor-primary": { swatchHex: "#0E4A8A" } }` renders that zone filled in Macragge Blue.
- Keyboard tab cycles through all 12 zones; Enter selects.

**Commit message:** `P3.3: infantry SVG silhouette + zone metadata`

---

## P3.4 — Recipe editor page + three-pane layout

- [ ] Build this milestone

**Context.** The editor itself. Single page at `/recipes/[id]`. Three panes on desktop (silhouette / zones+steps / notes); tabs on mobile. No step UI yet — that's P3.5. This milestone gets the shell + zone CRUD wired.

**Files to create.**
- `src/app/recipes/[id]/page.tsx` — server component. Fetches the recipe via `getRecipeWithZones`. 404 if missing / not owned. Renders the three-pane layout with `RecipeEditorClient` as the interactive shell.
- `src/components/recipes/RecipeEditorClient.tsx` — `'use client'`. Owns the editor state machine: which zone is selected, optimistic step ordering, save spinner. Wraps the three panes.
- `src/components/recipes/RecipeHeader.tsx` — `'use client'`. Top bar above the panes: editable name (inline contentEditable, debounced save via `updateRecipe`), bodyType pill (read-only v1, only "infantry" supported), attachment chip (`[ Attached to: Tactical Squad Alpha ]` or `[ Standalone ]`), `[ Delete recipe ]` icon with confirm.
- `src/components/recipes/ZoneList.tsx` — middle pane. Server-rendered initially, with a small client child for add/reorder. Lists zones with: zone name, swatch preview, step count, drag handle, click-to-select. `[ + Add zone ]` button at bottom — opens a small popover with `<select>` of silhouette zone names (filtered to unused) OR a free-text "Custom zone name" input.
- `src/components/recipes/RecipeNotes.tsx` — right pane (or bottom-tab on mobile). Markdown textarea, debounced save via `updateRecipe`. No live preview in v1 — Reddit-style raw markdown is fine.

**Files to modify.**
- `src/app/recipes/page.tsx` — currently placeholder. Add a `[ + New recipe ]` action linking to a `createRecipe` server action that creates an empty recipe + redirects to `/recipes/[newId]`. Leave the actual grid of standalone recipes for P3.7.
- `src/components/NavRail.tsx` — already has `[R] Recipes`. No change.

**Patterns to follow.**
- Desktop layout (md+): three CSS-grid columns `[300px, 1fr, 320px]`. Silhouette + zones flex within their columns.
- Mobile: tabs at the top (`[ BODY · ZONES · NOTES ]`) with single-pane viewports below. Reuse the same components, just hide via CSS.
- Inline-editable name uses `contentEditable` with debounced save (~600ms after last keystroke). No separate "Save" button.
- Optimistic UI everywhere: `useTransition`, local state flips first, server reconciles via `revalidatePath`.

**Implementation notes.**
- Don't put a separate `/recipes/[id]/edit` route — there's no read-only "view" mode in v1. The editor IS the view.
- Selecting a zone in `ZoneList` or `InfantrySilhouette` should sync both — they're two views on the same state. Hold the selected zone in `RecipeEditorClient`.
- For "Add zone from silhouette zone": after selecting a silhouette zone that isn't already a recipe zone, show an inline "Add this zone to the recipe?" pill in the silhouette panel — single click adds.
- Delete-recipe confirm uses a native `<dialog>` element to avoid adding a modal library. Per the rule in PHASE2_PLAN.

**Acceptance criteria.**
- `npm run typecheck` exits 0.
- Visiting `/recipes/[id]` for a freshly created recipe shows the editor shell.
- Adding a zone via the silhouette + via the `[ + Add zone ]` button both work; zones appear in `ZoneList` immediately (optimistic).
- Renaming the recipe via the header persists across refresh.
- Notes textarea persists.
- Delete-recipe confirm + accept → redirects to `/recipes`.

**Commit message:** `P3.4: recipe editor page + three-pane shell`

---

## P3.5 — Step builder: technique selector + paint slot picker

- [ ] Build this milestone

**Context.** The flagship UX of Phase 3. Inside a selected zone, the painter adds technique steps. Each step row has: technique dropdown, paint slot (clickable to open the Library popover), notes, drag handle, delete. Paint slot picker is the moment where the Library finally meets a Recipe.

**Files to create.**
- `src/components/recipes/StepList.tsx` — `'use client'`. Renders the selected zone's steps. `[ + Add step ]` button below. Drag handles for reorder (use HTML5 drag-and-drop — no library).
- `src/components/recipes/StepRow.tsx` — `'use client'`. Single row UI:
  ```
  ≡  [ basecoat ▾ ]  [ Citadel Macragge Blue ▾ ]  [ note... ]  [ × ]
  ```
  Technique dropdown is a native `<select>` with the 10 technique enum values. Paint slot opens `PaintSlotPicker`. Notes input is small inline text input. Delete with confirm.
- `src/components/recipes/PaintSlotPicker.tsx` — `'use client'`. Popover that opens above/below the slot. Top: search input + filter chips (brand multi-select compressed to a single dropdown, type chips). Body: scrollable list of paints with swatch + name (compact, ~32px rows). Click a paint → action `updateStep(stepId, { paintId })`, popover closes. Bottom: `[ Use custom hex ]` toggle that flips to a hex input + swatch preview → `updateStep(stepId, { customColorHex })`.
  - Loads the paints catalog via the P2.1 `loadPaints()` Dexie loader.
  - "Owned only" toggle at top, on by default (Ross is usually picking from his collection).
- `src/components/recipes/TechniqueLabel.tsx` — small helper that renders a technique enum value as a human label (basecoat → "Basecoat", `two_thin_coats` → "Two Thin Coats", `edge_highlight` → "Edge Highlight", etc.). Used in step rows + the technique dropdown.

**Files to modify.**
- `src/components/recipes/RecipeEditorClient.tsx` — embed `<StepList />` in the middle pane below `<ZoneList />` when a zone is selected. Empty state when none selected.
- `src/components/recipes/InfantrySilhouette.tsx` — once steps land, the `paintedZones` map populates from the first step of each zone. Verify `paletteForRecipe` from P3.3 still derives the right swatch (first step of each zone wins).

**Patterns to follow.**
- PaintSlotPicker reuses the P2.2 filter utilities (`filterByBrand`, `filterByType`) but with a compact UI — don't reuse the LibraryTable directly. The picker is its own compressed view.
- Optimistic step adds: local state shows the row immediately with a loading spinner; server confirms via revalidate.
- Notes input debounces ~500ms before calling `updateStep`.

**Implementation notes.**
- Drag-and-drop for steps: use the native HTML5 drag API. No `react-dnd` or similar. On drop, compute the new ordered ids and call `reorderSteps`. If this proves janky on mobile, follow up with up/down arrow buttons in a Phase 6 polish pass.
- The PaintSlotPicker should NOT close on accidental outside-clicks within the editor shell. Close only on: Escape, click outside the editor entirely, paint selected, custom hex confirmed.
- For custom hex: accept 3 / 6 / 8 char hex. Validate via regex; show error inline.
- Don't show the full PaintDetailPanel inside the picker — that's distracting. Click-through to `/library?paint=<id>` only if the painter explicitly asks via a small `[ ? ]` icon next to the paint.

**Acceptance criteria.**
- `npm run typecheck` exits 0.
- Selecting a zone shows the step list. `[ + Add step ]` creates a step.
- Picking a technique + a paint persists; the step row shows `[ basecoat | Mephiston Red ]`.
- The silhouette's zone fills with the picked paint's hex.
- Reordering steps via drag persists and re-renders in the new order.
- Custom hex mode: entering `#1A2B3C` creates a step with `customColorHex` and no `paintId`; the swatch shows the right colour.

**Commit message:** `P3.5: step builder — technique + paint slot picker`

---

## P3.6 — Attach recipe to project / named model

- [ ] Build this milestone

**Context.** Recipes need to bind to the things being painted. From a project workspace or a named-model row, the painter picks "use this recipe" — or "create new recipe" — and the binding is made.

**Files to create.**
- `src/components/recipes/AttachRecipeModal.tsx` — `'use client'`. Two tabs:
  - **Pick existing** — searchable list of the user's standalone + already-attached-elsewhere recipes (showing where currently attached).
  - **Create new** — single name input + `[ Create & attach ]` button. Calls `createRecipe({ name, attachedProjectId | attachedNamedModelId })`, redirects to the new recipe's editor.
- `src/components/recipes/AttachedRecipePanel.tsx` — server component for use inside a project workspace. Renders the attached recipe inline: zone list with swatches + steps (read-only summary view). `[ Edit recipe ]` link to `/recipes/[id]`. `[ Detach ]` icon. If no recipe attached, shows `[ + Attach recipe ]` button that opens the modal.
- `src/components/recipes/AttachedRecipeForNamedModel.tsx` — similar but slimmer. Embedded in `NamedModelRow.tsx`. Defaults to inheriting the unit's recipe (no override); when overridden, shows the override recipe inline + `[ Reset to unit recipe ]` link.

**Files to modify.**
- `src/app/projects/[id]/page.tsx` — render `<AttachedRecipePanel projectId={...} />` below `<NamedModelsPanel />`. Above the wishlist's "Shopping for this" panel from P2.6.
- `src/components/NamedModelRow.tsx` — add the `<AttachedRecipeForNamedModel />` slot in the row's expand area (collapsed by default — same row height as before).
- `src/db/queries/projects.ts` — extend `listChildProjects` / `getProject` to optionally include attached recipes via a JOIN. New: `getProjectWithRecipe(userId, id)`.

**Patterns to follow.**
- Modal uses `<dialog>` per project convention.
- Search in the "Pick existing" tab is a simple substring match on `name`. No fuzzy.
- After a successful attach, modal closes + the project workspace re-renders with the recipe visible.

**Implementation notes.**
- A recipe attached to a unit's named model OVERRIDES the unit's recipe FOR THAT MODEL only. The unit's main recipe still applies to rank-and-file.
- "Detach" doesn't delete the recipe — it just clears the attachment. The recipe becomes standalone.
- An attached-elsewhere recipe is still pickable in the modal: picking it MOVES the attachment (the previous attachment is cleared). Show a confirmation if doing so.

**Acceptance criteria.**
- `npm run typecheck` exits 0.
- From a project workspace with no recipe, clicking `[ + Attach recipe ]` opens the modal.
- Creating a new recipe attaches and redirects to its editor.
- Picking an existing recipe attaches and re-renders the workspace with the recipe visible.
- A named model's recipe override works: setting one shows the override; resetting restores inheritance.

**Commit message:** `P3.6: attach recipe to project / named model`

---

## P3.7 — Standalone recipes index page

- [ ] Build this milestone

**Context.** A grid of the painter's saved recipes at `/recipes`. Quick scan, jump to edit, see attachment status at a glance.

**Files to create.**
- `src/components/recipes/RecipeCard.tsx` — server component. One card per recipe. Renders: name, body-type pill, palette strip (8 swatches max, derived from `paletteForRecipe`), attachment chip (`[ Attached: Tactical Squad Alpha ]` or `[ Standalone ]`), step count summary (`24 steps · 6 zones`). Click → navigate to `/recipes/[id]`.

**Files to modify.**
- `src/app/recipes/page.tsx` — replace the placeholder. Fetch all recipes for the user (standalone + attached). Section the page:
  - **Standalone** (top) — palette of saved schemes ready to attach
  - **Attached to projects** — what's currently in flight
  - **Attached to named models** — collapsed by default; expand to see overrides
- Add the `[ + New recipe ]` action wired to `createRecipe({ name: "Untitled recipe", isStandalone: true })` + redirect.
- `src/db/queries/recipes.ts` — add `listAllRecipesGrouped(userId)` returning the three sections in one round-trip.

**Patterns to follow.**
- Card grid: responsive — `grid-cols-1` on mobile, `grid-cols-2` on md, `grid-cols-3` on lg.
- Palette strip: small swatches (16px), max 8, rest indicated by `+N` text.
- Section headers use `.section-title`. Empty sections hide entirely (don't show "0 recipes" placeholders).

**Implementation notes.**
- Search/filter in this page is deferred to a Phase 6 polish item. v1 just lists.
- The `[ + New recipe ]` button creates an empty recipe and redirects to its editor — same pattern as a project's `[ + New ]`.

**Acceptance criteria.**
- `npm run typecheck` exits 0.
- `/recipes` renders the three sections correctly when the user has recipes of each kind.
- Empty state: when the user has zero recipes, page shows a single `[ + Create your first recipe ]` CTA.
- Clicking a card navigates to its editor.

**Commit message:** `P3.7: standalone recipes index`

---

## P3.8 — Recipe at-a-glance inline in project workspace + dashboard

- [ ] Build this milestone

**Context.** Wrap-up milestone — small additions that make recipes feel native across the rest of the app. After P3.6 the recipe is visible in the project workspace, but only as a panel. This adds: palette strip on `ProjectRow`, recipe summary on the dashboard, hover-preview of the recipe in NavRail breadcrumbs.

**Files to create.**
- `src/components/recipes/RecipePaletteStrip.tsx` — tiny inline palette swatches used in project rows and dashboard cards. 16px height, derives from `paletteForRecipe`. Accepts a recipeId prop; fetches via server component.

**Files to modify.**
- `src/components/ProjectRow.tsx` — show a `<RecipePaletteStrip />` to the right of the name when the project has an attached recipe.
- `src/app/projects/page.tsx` — in the Active section, show the project's recipe palette strip beneath the progress bar for each card.
- `src/components/dashboard/RecentlyBoughtLine.tsx` — already exists from P2.8. No change but verify rendering coexists fine with the new recipe strip.

**Patterns to follow.**
- Palette strip swatches are square, 16×16px, with a 1px border in `--color-border`. No glow.
- Don't load the full recipe to render the strip — `paletteForRecipe(recipeId)` should return a precomputed 8-hex array via a single SELECT.

**Acceptance criteria.**
- `npm run typecheck` exits 0.
- A project row with an attached recipe shows the palette strip; one without doesn't show the slot at all.
- The dashboard Active section shows palette strips for active projects.
- No N+1 queries — verify by counting Drizzle calls when rendering `/projects` with 10 active projects.

**Commit message:** `P3.8: recipe palette strips across rows + dashboard`

---

## Phase 3 ship checklist

After P3.8 lands, before declaring Phase 3 done:

- Ross builds **3 real recipes** for his actual projects and uses them while painting.
- All Phase 3 milestones tick green in this file.
- `npm run typecheck` exits 0 across the project.
- A throwaway Playwright test asserts the round-trip: create recipe → add zone → add step with paint → silhouette renders that swatch.
- No Phase 1/2 regressions in the existing flows (Library / Inventory / Wishlist / Projects / Stage Counters).

**Deferred to later phases (do NOT build in Phase 3):**
- Vehicle / Monster / Terrain silhouettes → Phase 6
- 10 canonical Technique Guides + inline `?` panel → Phase 5 or later
- Public recipe sharing (short URL / QR / Markdown export) → Phase 5
- Recipe templates / community browse → Phase 7

---

## Conventions for milestone-builder

Same as PHASE1_PLAN.md / PHASE2_PLAN.md:

- **Commit only locally; do not push.** Ross reviews before pushing.
- **Pre-commit:** `npm run typecheck` 0 errors. Refuse to commit if it fails.
- **New dependencies** flagged in the commit body.
- **No `any`. No `@ts-ignore`.** Strict mode is mandatory.
- **Match existing patterns.** Read neighbouring files before introducing new ones.
- **Tailwind v4 syntax.** CSS-first `@theme`. Use existing tokens — no arbitrary hex.
- **Server-side first.** Default to server components. `'use client'` only when interactivity actually needs it.
- **Halt and report** if a milestone has an architectural decision the plan doesn't cover. Do not guess.
