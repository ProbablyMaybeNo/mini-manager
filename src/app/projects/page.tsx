import { currentUserId } from "@/lib/auth-stub";
import {
  countNamedModelsByProject,
  listTopLevelProjects,
} from "@/db/queries/projects";
import { getProjectPalettesMap } from "@/db/queries/recipes";
import { QuickAddBar } from "@/components/QuickAddBar";
import { TopWishesPanel } from "@/components/wishlist/TopWishesPanel";
import { RecentlyBoughtLine } from "@/components/dashboard/RecentlyBoughtLine";
import {
  ProjectsDashboardTable,
  type ProjectDashboardRow,
} from "@/components/ProjectsDashboardTable";
import { AccentCounter } from "@/components/ui/AccentCounter";
import { Button } from "@/components/ui/Button";
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
export default async function ProjectsPage() {
  const userId = await currentUserId();
  const [topLevel, namedCountByProject, palettesByProjectId] =
    await Promise.all([
      listTopLevelProjects(userId),
      countNamedModelsByProject(userId),
      getProjectPalettesMap(userId),
    ]);

  const isEmpty = topLevel.length === 0;

  const rows: ProjectDashboardRow[] = topLevel.map((p) => ({
    id: p.id,
    name: p.name,
    type: p.type,
    faction: p.faction,
    priority: p.priority,
    status: displayStatus(p),
    paletteHexes: palettesByProjectId.get(p.id) ?? [],
    progressPercent: progressPercent(p),
    totalModels: p.count + (namedCountByProject[p.id] ?? 0),
    updatedAt: p.updatedAt.getTime(),
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
            <Button as="a" href="/projects/import" variant="warning" size="md">
              Import army list
            </Button>
            <Button as="a" href="/projects/new" variant="success" size="md">
              New project
            </Button>
          </div>
        </div>
      </header>

      {isEmpty ? (
        <EmptyState />
      ) : (
        <>
          <TopWishesPanel />
          <ProjectsDashboardTable rows={rows} />
          <RecentlyBoughtLine />
        </>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="relative frame p-8 text-center space-y-6 overflow-hidden">
      <AccentCounter value="01" />
      <div>
        <h2 className="text-lg glow-cyan mb-3">No projects yet</h2>
        <p className="text-sm text-[var(--color-fg-muted)] font-sans max-w-md mx-auto">
          Start with anything you&apos;re painting — an army, a warband, a
          single mini, or a piece of terrain. Sub-projects let you nest
          units inside armies.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Button as="a" href="/projects/import" variant="warning" size="lg">
          Import army list
        </Button>
        <Button as="a" href="/projects/new" variant="success" size="lg">
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
