import { currentUserId } from "@/lib/auth-stub";
import { listAllProjects } from "@/db/queries/projects";
import {
  getProjectPalettesMap,
  getProjectFirstRecipeMap,
  listOwnedRecipesLean,
} from "@/db/queries/recipes";
import { QuickAddBar } from "@/components/QuickAddBar";
import { RecentlyBoughtLine } from "@/components/dashboard/RecentlyBoughtLine";
import { type ProjectDashboardRow } from "@/components/ProjectsDashboardTable";
import { DashboardProjectsTable } from "@/components/projects/DashboardProjectsTable";
import { DashboardWidgets } from "@/components/dashboard/DashboardWidgets";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { displayStatus, progressPercent } from "@/lib/progress";

export const dynamic = "force-dynamic";

/**
 * FOCUS-DASH (2026-06-04) — `/projects` is the DASHBOARD.
 *
 * Supersedes the D2 master-detail two-pane workspace: the IA restructure
 * unwinds the split + the detail inspector (detail-focus is gone, rows
 * already navigate to the project page) so the PROJECTS table spans full
 * width on every breakpoint. The FOCUS bench MOVED to the FOCUS screen
 * (/planner); the planner widgets (calendar / activity / streak) MOVED
 * here, below the table.
 *
 * Surface (top to bottom):
 *   - Page header retitled DASHBOARD + the quick-add / import / new row.
 *   - PROJECTS table (full-width, the existing dense desktop table + M3
 *     mobile comparison table inside `ProjectsDashboardTable`).
 *   - DASHBOARD widget row: streak, activity, calendar (the relocated
 *     planner cells, reused verbatim).
 *   - RecentlyBoughtLine — passive spend readout.
 *
 * DASH-RECIPES (2026-06-05) — the dashboard recipes table was removed.
 * /recipes is now the single primary surface for the recipe list, so the
 * dashboard no longer duplicates it. The grid re-balances around the
 * project table + widget row.
 */
interface DashboardPageProps {
  /** P14.3 — calendar prev/next nav writes `?calYear` + `?calMonth`
   *  client-side via `router.replace`. The dashboard then re-renders the
   *  calendar widget against the new month. Next hands searchParams as an
   *  awaited promise per the App-Router rules. */
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const params = (await searchParams) ?? {};
  const calYearRaw = params.calYear;
  const calMonthRaw = params.calMonth;
  const calYear = Array.isArray(calYearRaw) ? calYearRaw[0] : calYearRaw;
  const calMonth = Array.isArray(calMonthRaw) ? calMonthRaw[0] : calMonthRaw;

  const userId = await currentUserId();
  const [
    allProjects,
    palettesByProjectId,
    firstRecipeByProjectId,
    ownedRecipes,
  ] = await Promise.all([
    listAllProjects(userId),
    getProjectPalettesMap(userId),
    getProjectFirstRecipeMap(userId),
    listOwnedRecipesLean(userId),
  ]);

  const isEmpty = allProjects.length === 0;

  // Build name lookup so the inline AttachRecipeModal can label recipes
  // that are currently attached elsewhere.
  const projectNameById: Record<string, string> = {};
  for (const p of allProjects) projectNameById[p.id] = p.name;

  // Compute depth per project: 0 for top-level, 1 for children, 2 for
  // grandchildren. Three-level cap is enforced application-side.
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
    <div className="content-cap p-6 md:p-8 space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl tracking-wide">DASHBOARD</h1>
          <p className="text-sm text-[var(--color-fg-muted)] mt-2 max-w-xl font-sans">
            Your wargaming workbench at a glance — every project, your
            painting rhythm, and your recipes, all on one screen.
          </p>
        </div>
        <div className="flex flex-col items-stretch md:items-end gap-2 w-full md:w-auto">
          <QuickAddBar />
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
        <Card title="PROJECTS" accentColor="cyan">
          <DashboardProjectsTable
            rows={rows}
            ownedRecipes={ownedRecipes}
            projectNameById={projectNameById}
          />
        </Card>
      )}

      {/* The planner widgets that moved here from the FOCUS screen. */}
      <DashboardWidgets calYear={calYear} calMonth={calMonth} />

      <RecentlyBoughtLine />
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
          single mini, or a piece of terrain. Sub-projects let you nest units
          inside armies.
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
        Got a BattleScribe roster or a Warhammer App PDF? Drop it in and
        we&apos;ll populate the project tree in seconds.
      </p>
    </div>
  );
}
