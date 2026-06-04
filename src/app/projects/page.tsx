import { currentUserId } from "@/lib/auth-stub";
import { listAllProjects } from "@/db/queries/projects";
import {
  getPaintMetaMap,
  getProjectFirstRecipeMap,
  getProjectPalettesMap,
  listOwnedRecipesLean,
} from "@/db/queries/recipes";
import {
  getFocusedRecipeBundle,
  listFocusCandidates,
} from "@/db/queries/focus";
import { getCompletedStepIds } from "@/db/queries/stepCompletion";
import { getPaintNotesMap } from "@/db/queries/paintNotes";
import {
  getInProgressSession,
  getSessionRollups,
} from "@/db/queries/paintSessions";
import { QuickAddBar } from "@/components/QuickAddBar";
import { RecentlyBoughtLine } from "@/components/dashboard/RecentlyBoughtLine";
import { type ProjectDashboardRow } from "@/components/ProjectsDashboardTable";
import { Button } from "@/components/ui/Button";
import { FocusPicker } from "@/components/focus/FocusPicker";
import {
  FocusPanel,
  type FocusSlotView,
} from "@/components/focus/FocusPanel";
import { buildFocusSlots } from "@/lib/focus/rollup";
import { Stopwatch } from "@/components/focus/Stopwatch";
import { PlannerSection } from "@/components/planner/PlannerSection";
import { ProjectsWorkspace } from "@/components/projects/ProjectsWorkspace";
import { displayStatus, progressPercent } from "@/lib/progress";

export const dynamic = "force-dynamic";

/**
 * P12.6 — Projects dashboard is now a single sortable table.
 * Replaces the prior three card sections (backlog units / active
 * projects / all-projects) with one dense surface that scales to a
 * painter's full project list.
 *
 * Columns Ross locked:
 *   Name · Type · Recipes (palette squares) · Status · Priority ·
 *   Completion (bar with red < 25% / yellow 25-75% / green >= 75%)
 *
 * UX (2026-06 walkthrough): the Top Wishes section was removed — /projects
 * is the project workspace, not a dashboard. The lightweight
 * RecentlyBoughtLine remains below the table as a passive spend readout.
 */
interface ProjectsPageProps {
  /** P14.3 — calendar prev/next nav writes `?calYear` + `?calMonth`
   *  client-side via `router.replace`. The dashboard then re-renders
   *  the PLANNER calendar against the new month. Next 16 hands
   *  searchParams as an awaited promise per the App-Router rules. */
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ProjectsPage({
  searchParams,
}: ProjectsPageProps) {
  const params = (await searchParams) ?? {};
  const calYearRaw = params.calYear;
  const calMonthRaw = params.calMonth;
  const calYear = Array.isArray(calYearRaw) ? calYearRaw[0] : calYearRaw;
  const calMonth = Array.isArray(calMonthRaw) ? calMonthRaw[0] : calMonthRaw;
  // UX-907 — recipe-tab persistence. The FocusPanel's tab strip writes
  // `?focusRecipe=<id>` so the painter's selection survives reloads and
  // navigation. Unknown / unowned ids fall back to the most-recently-
  // updated recipe inside the query helper.
  const focusRecipeRaw = params.focusRecipe;
  const focusRecipeId = Array.isArray(focusRecipeRaw)
    ? focusRecipeRaw[0]
    : focusRecipeRaw;
  // P15.0 — active-slot persistence. The FocusPanel's slot activator +
  // the "Advance slot" quick-action write `?focusSlot=<zoneId>` so the
  // slot the painter is working on survives reload. Unknown / unowned
  // ids fall back to the first slot with an undone step below.
  const focusSlotRaw = params.focusSlot;
  const focusSlotParam = Array.isArray(focusSlotRaw)
    ? focusSlotRaw[0]
    : focusSlotRaw;

  const userId = await currentUserId();
  const [
    allProjects,
    palettesByProjectId,
    firstRecipeByProjectId,
    ownedRecipes,
    focusCandidates,
    focusBundle,
    paintMeta,
    inProgressSession,
    sessionRollups,
  ] = await Promise.all([
    listAllProjects(userId),
    getProjectPalettesMap(userId),
    getProjectFirstRecipeMap(userId),
    listOwnedRecipesLean(userId),
    // P13.11 — focus widget data.
    listFocusCandidates(userId),
    getFocusedRecipeBundle(userId, focusRecipeId ?? null),
    getPaintMetaMap(),
    // Phase-14 spillover — stopwatch state. Both calls are cheap;
    // the rollup totals are server-rendered once per page load.
    getInProgressSession(userId),
    getSessionRollups(userId),
  ]);

  const isEmpty = allProjects.length === 0;

  // P15.0 — resolve which of the focused recipe's slots the painter has
  // marked done, scoped to this recipe's slot ids so the lookup stays
  // bounded. Done-state is per-painter (keyed on user + slot; slot.id ==
  // the old step.id so completion rows carry across the flatten).
  const focusSlotIds = focusBundle
    ? focusBundle.slots.map((s) => s.id)
    : [];
  // P15.x — distinct paint ids across the focused recipe's paint-backed
  // slots. Per-paint notes are keyed on the paint, so we fetch the note
  // map bounded by these ids and thread the same note into every slot
  // that pins the paint.
  const focusPaintIds = focusBundle
    ? Array.from(
        new Set(
          focusBundle.slots.flatMap((s) => (s.paintId ? [s.paintId] : [])),
        ),
      )
    : [];
  const [completedSlotIds, paintNotesMap] = await Promise.all([
    getCompletedStepIds(userId, focusSlotIds),
    getPaintNotesMap(userId, focusPaintIds),
  ]);

  // P13.11 / P15.x — Build the FocusPanel's flat view model from the
  // bundle. Resolves paintId to brand+name+hex via the cached paint
  // catalog and threads each slot's per-painter done-state + the paint's
  // global note.
  const focusSlots: FocusSlotView[] = focusBundle
    ? buildFocusSlots(
        focusBundle.slots,
        paintMeta,
        completedSlotIds,
        paintNotesMap,
      )
    : [];

  // P15.0 — resolve the active slot. Honour `?focusSlot` when it points
  // at a real slot in the focused recipe; otherwise default to the first
  // undone slot (the one the painter would naturally pick up next),
  // falling back to the first slot when the recipe is fully done.
  const activeSlotId: string | null = (() => {
    if (focusSlots.length === 0) return null;
    if (focusSlotParam && focusSlots.some((s) => s.id === focusSlotParam)) {
      return focusSlotParam;
    }
    const firstUndone = focusSlots.find((s) => !s.done);
    return firstUndone?.id ?? focusSlots[0]!.id;
  })();

  // Build name lookup so the inline AttachRecipeModal can label
  // recipes that are currently attached elsewhere.
  const projectNameById: Record<string, string> = {};
  for (const p of allProjects) projectNameById[p.id] = p.name;

  // Compute depth per project: 0 for top-level, 1 for children of
  // top-level, 2 for grandchildren. Three-level cap is enforced
  // application-side (see schema notes) so we stop at depth 2.
  const projectById = new Map<string, (typeof allProjects)[number]>();
  for (const p of allProjects) projectById.set(p.id, p);
  const depthCache = new Map<string, number>();
  const depthOf = (id: string): number => {
    const cached = depthCache.get(id);
    if (cached !== undefined) return cached;
    const node = projectById.get(id);
    if (!node) return 0;
    const d = node.parentId ? depthOf(node.parentId) + 1 : 0;
    depthCache.set(id, d);
    return d;
  };

  const rows: ProjectDashboardRow[] = allProjects.map((p) => ({
    id: p.id,
    name: p.name,
    type: p.type,
    faction: p.faction,
    priority: p.priority,
    status: displayStatus(p),
    paletteHexes: palettesByProjectId.get(p.id) ?? [],
    progressPercent: progressPercent(p),
    totalModels: p.count,
    updatedAt: p.updatedAt.getTime(),
    parentId: p.parentId,
    depth: depthOf(p.id),
    firstAttachedRecipeId: firstRecipeByProjectId.get(p.id) ?? null,
  }));

  // D2 — the FOCUS bench, built once on the server and handed to the
  // workspace. On desktop it is the inspector's Focus tab; on mobile it
  // is the collapsed FOCUS disclosure section (M4). Recipe first (the
  // painter should see what they're painting under the picker), then the
  // stopwatch (a tool you start once).
  const focusBench = (
    <div className="space-y-4">
      <FocusPicker
        options={focusCandidates.map((c) => ({
          id: c.id,
          name: c.name,
          type: c.type,
          attachedRecipeName: c.attachedRecipeName,
        }))}
        currentFocusId={focusBundle?.project.id ?? null}
      />
      {focusBundle ? (
        <FocusPanel
          projectId={focusBundle.project.id}
          projectName={focusBundle.project.name}
          recipeName={focusBundle.recipe.name}
          slots={focusSlots}
          recipes={focusBundle.allRecipes}
          activeRecipeId={focusBundle.recipe.id}
          activeSlotId={activeSlotId}
          projectCounts={{
            buildCount: focusBundle.project.buildCount,
            primeCount: focusBundle.project.primeCount,
            paintCount: focusBundle.project.paintCount,
            completeCount: focusBundle.project.completeCount,
          }}
        />
      ) : (
        <FocusEmptyState hasCandidates={focusCandidates.length > 0} />
      )}
      {focusBundle ? (
        <Stopwatch
          projectId={focusBundle.project.id}
          inProgressSession={
            inProgressSession
              ? {
                  id: inProgressSession.id,
                  projectId: inProgressSession.projectId,
                  startedAt: inProgressSession.startedAt.getTime(),
                  pausedMs: inProgressSession.pausedMs,
                }
              : null
          }
          todaySeconds={sessionRollups.todaySeconds}
          weekSeconds={sessionRollups.weekSeconds}
        />
      ) : null}
    </div>
  );

  return (
    // D1/D2 — content-cap replaces the ad-hoc max-w-7xl so the
    // master-detail workspace centres + caps on ultrawide.
    <div className="content-cap p-6 md:p-8 space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl tracking-wide">PROJECTS</h1>
          <p className="text-sm text-[var(--color-fg-muted)] mt-2 max-w-xl font-sans">
            Your wargaming workbench. Track armies, units, and individual
            models from wishlist through to complete.
          </p>
        </div>
        <div className="flex flex-col items-stretch md:items-end gap-2 w-full md:w-auto">
          <QuickAddBar />
          {/* UX (2026-06) — match the action row to the QuickAddBar's
              420px width and split it evenly so the header reads balanced
              (the buttons were content-width before, breaking the column
              alignment with the search/text bar above). */}
          <div className="flex gap-2 w-full md:w-[420px]">
            <Button
              as="a"
              href="/projects/import"
              variant="warning"
              size="sm"
              className="flex-1 justify-center"
            >
              Import army list
            </Button>
            <Button
              as="a"
              href="/projects/new"
              variant="success"
              size="sm"
              className="flex-1 justify-center"
            >
              New project
            </Button>
          </div>
        </div>
      </header>

      {isEmpty ? (
        <EmptyState />
      ) : (
        <ProjectsWorkspace
          rows={rows}
          ownedRecipes={ownedRecipes}
          projectNameById={projectNameById}
          initialSelectedId={focusBundle?.project.id ?? null}
          focusSummary={
            focusBundle
              ? `Focused on ${focusBundle.project.name}`
              : "Pick a project to paint"
          }
          focusBench={focusBench}
          plannerSection={
            <PlannerSection calYear={calYear} calMonth={calMonth} bare />
          }
          belowTable={<RecentlyBoughtLine />}
        />
      )}
    </div>
  );
}

/**
 * P13.11 — Empty state for the FOCUS section. Differentiates between
 * "you have projects but none of them have recipes" (nudge toward
 * attaching one) and "you have recipes you could focus on right now"
 * (nudge toward picking one from the dropdown above).
 */
function FocusEmptyState({ hasCandidates }: { hasCandidates: boolean }) {
  return (
    <div className="frame p-4 space-y-2">
      <p className="text-sm font-sans text-[var(--color-fg)] leading-relaxed">
        Pick a project to focus on while you paint — its recipe will
        live here.
      </p>
      <p className="text-xs font-sans text-[var(--color-fg-muted)] leading-snug">
        {hasCandidates ? (
          <>
            Choose one from the picker above to see its slot grid + per-paint
            note fields, ready to scribble in.
          </>
        ) : (
          <>
            Attach a recipe from any project workspace first (open a project
            → tap a swatch in the Recipe box). Then it&apos;ll show up
            here as a focus target.
          </>
        )}
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="relative frame p-8 text-center space-y-6 overflow-hidden">
      <div>
        <h2 className="text-lg glow-cyan mb-3">No projects yet</h2>
        <p className="text-sm text-[var(--color-fg-muted)] font-sans max-w-md mx-auto">
          Start with anything you&apos;re painting — an army, a warband, a
          single mini, or a piece of terrain. Sub-projects let you nest
          units inside armies.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Button as="a" href="/projects/import" variant="warning" size="sm">
          Import army list
        </Button>
        <Button as="a" href="/projects/new" variant="success" size="sm">
          Create first project
        </Button>
      </div>
      <p className="text-xs font-mono text-[var(--color-fg-muted)]">
        Got a BattleScribe roster or a Warhammer App PDF? Drop it in and we&apos;ll
        populate the project tree in seconds.
      </p>
    </div>
  );
}
