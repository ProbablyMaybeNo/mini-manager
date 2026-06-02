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
import {
  getInProgressSession,
  getSessionRollups,
} from "@/db/queries/paintSessions";
import { QuickAddBar } from "@/components/QuickAddBar";
import { TopWishesPanel } from "@/components/wishlist/TopWishesPanel";
import { RecentlyBoughtLine } from "@/components/dashboard/RecentlyBoughtLine";
import {
  ProjectsDashboardTable,
  type ProjectDashboardRow,
} from "@/components/ProjectsDashboardTable";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FocusPicker } from "@/components/focus/FocusPicker";
import {
  FocusPanel,
  type FocusStepView,
  type FocusZoneView,
} from "@/components/focus/FocusPanel";
import { Stopwatch } from "@/components/focus/Stopwatch";
import { PlannerSection } from "@/components/planner/PlannerSection";
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
 * The TopWishesPanel + RecentlyBoughtLine sit below the table so the
 * dashboard stays both queueable (paint shopping) and trackable
 * (paint history).
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

  // P13.11 — Build the FocusPanel's view model from the bundle.
  // Resolves paintId to brand+name+hex via the cached paint catalog.
  const focusZones: FocusZoneView[] = focusBundle
    ? focusBundle.zones.map((z) => {
        const steps: FocusStepView[] = z.steps.map((s) => {
          const meta = s.paintId ? paintMeta.get(s.paintId) ?? null : null;
          const hex = s.customColorHex ?? meta?.hex ?? null;
          const label = meta?.label ?? null;
          return {
            id: s.id,
            zoneId: s.zoneId,
            position: s.position,
            technique: s.technique,
            paintHex: hex,
            paintLabel: label,
            notes: s.notes,
          };
        });
        const firstStep = z.steps[0];
        const swatchHex =
          firstStep?.customColorHex ??
          (firstStep?.paintId
            ? paintMeta.get(firstStep.paintId)?.hex ?? null
            : null);
        return {
          id: z.id,
          name: z.name,
          position: z.position,
          swatchHex,
          steps,
        };
      })
    : [];

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

  return (
    <div className="p-6 md:p-8 max-w-7xl space-y-6">
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
          <div className="flex gap-2 self-start md:self-end">
            <Button as="a" href="/projects/import" variant="warning" size="sm">
              Import army list
            </Button>
            <Button as="a" href="/projects/new" variant="success" size="sm">
              New project
            </Button>
          </div>
        </div>
      </header>

      {isEmpty ? (
        <EmptyState />
      ) : (
        <>
          {/* P13.11 — FOCUS section. Renders above the dashboard table
              so the painter can sit at the desk and read the recipe of
              the project they're working on without navigating away.
              The section header reads "FOCUS" (locked label, Ross's
              call); empty state nudges the painter to pick a project. */}
          <Card title="FOCUS" accentColor="green">
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
              {focusBundle ? (
                <FocusPanel
                  projectId={focusBundle.project.id}
                  projectName={focusBundle.project.name}
                  recipeName={focusBundle.recipe.name}
                  zones={focusZones}
                  recipes={focusBundle.allRecipes}
                  activeRecipeId={focusBundle.recipe.id}
                />
              ) : (
                <FocusEmptyState
                  hasCandidates={focusCandidates.length > 0}
                />
              )}
            </div>
          </Card>

          {/* P14.2 — PLANNER section. Sits between FOCUS + the
              dashboard table. Scaffold-only here: each cell is an
              empty-state placeholder ready for the P14.3–7 widget
              builders to fill in. */}
          <PlannerSection calYear={calYear} calMonth={calMonth} />

          <TopWishesPanel />
          <ProjectsDashboardTable
            rows={rows}
            ownedRecipes={ownedRecipes}
            projectNameById={projectNameById}
          />
          <RecentlyBoughtLine />
        </>
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
            Choose one from the picker above to see its slot grid + per-step
            notes textareas, ready to scribble in.
          </>
        ) : (
          <>
            Attach a recipe from any project workspace first (open a project
            → tap a swatch in the Color scheme box). Then it&apos;ll show up
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
