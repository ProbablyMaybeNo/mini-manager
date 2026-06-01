import { currentUserId } from "@/lib/auth-stub";
import {
  countNamedModelsByProject,
  listAllProjects,
} from "@/db/queries/projects";
import {
  getProjectFirstRecipeMap,
  getProjectPalettesMap,
  listOwnedRecipesLean,
} from "@/db/queries/recipes";
import { db } from "@/db/client";
import { namedModels } from "@/db/schema";
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
  const [
    allProjects,
    namedCountByProject,
    palettesByProjectId,
    firstRecipeByProjectId,
    ownedRecipes,
    allNamedModels,
  ] = await Promise.all([
    listAllProjects(userId),
    countNamedModelsByProject(userId),
    getProjectPalettesMap(userId),
    getProjectFirstRecipeMap(userId),
    listOwnedRecipesLean(userId),
    db
      .select({ id: namedModels.id, name: namedModels.name })
      .from(namedModels),
  ]);

  const isEmpty = allProjects.length === 0;

  // Build name lookups so the inline AttachRecipeModal can label
  // recipes that are currently attached elsewhere.
  const projectNameById: Record<string, string> = {};
  for (const p of allProjects) projectNameById[p.id] = p.name;
  const namedModelNameById: Record<string, string> = {};
  for (const m of allNamedModels) namedModelNameById[m.id] = m.name;

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
    totalModels: p.count + (namedCountByProject[p.id] ?? 0),
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
          <TopWishesPanel />
          <ProjectsDashboardTable
            rows={rows}
            ownedRecipes={ownedRecipes}
            projectNameById={projectNameById}
            namedModelNameById={namedModelNameById}
          />
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
