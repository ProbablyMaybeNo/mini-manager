import Link from "next/link";
import { currentUserId } from "@/lib/auth-stub";
import {
  countNamedModelsByProject,
  listActiveProjects,
  listBacklogUnits,
  listTopLevelProjects,
} from "@/db/queries/projects";
import {
  getProjectRecipeMap,
  paletteStripsForRecipes,
} from "@/db/queries/recipes";
import { ProjectRow } from "@/components/ProjectRow";
import { QuickAddBar } from "@/components/QuickAddBar";
import { TopWishesPanel } from "@/components/wishlist/TopWishesPanel";
import { RecentlyBoughtLine } from "@/components/dashboard/RecentlyBoughtLine";
import { Card } from "@/components/ui/Card";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const userId = await currentUserId();
  const [topLevel, backlog, active, namedCountByProject, projectRecipeMap] =
    await Promise.all([
      listTopLevelProjects(userId),
      listBacklogUnits(userId),
      listActiveProjects(userId),
      countNamedModelsByProject(userId),
      getProjectRecipeMap(userId),
    ]);

  // Pick a primary recipe per project (newest first per the map's order)
  // and bulk-load palettes for all of them in one pass — avoids N+1
  // queries from rendering many palette strips.
  const primaryRecipeByProject = new Map<string, string>();
  for (const [projectId, list] of projectRecipeMap) {
    const first = list[0];
    if (first) primaryRecipeByProject.set(projectId, first.id);
  }
  const recipeIdsToLoad = Array.from(
    new Set(primaryRecipeByProject.values()),
  );
  const paletteByRecipe = await paletteStripsForRecipes(
    userId,
    recipeIdsToLoad,
  );

  const swatchesForProject = (projectId: string): ReadonlyArray<string> => {
    const recipeId = primaryRecipeByProject.get(projectId);
    if (!recipeId) return [];
    return paletteByRecipe.get(recipeId) ?? [];
  };

  const isEmpty = topLevel.length === 0;

  return (
    <div className="p-6 md:p-8 max-w-6xl space-y-8">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl tracking-wide">PROJECTS</h1>
          <p className="text-sm text-[var(--color-fg-muted)] mt-2 max-w-xl font-sans">
            Your wargaming workbench. Track armies, units, and individual models
            from wishlist to completed.
          </p>
        </div>
        <div className="flex flex-col items-stretch md:items-end gap-2 w-full md:w-auto">
          <QuickAddBar />
          <div className="flex gap-2 self-start md:self-end">
            <Link
              href="/projects/import"
              className="inline-flex items-center gap-2 px-4 py-2 frame tap-target text-sm font-mono hover:bg-[color-mix(in_srgb,var(--color-cyan)_8%,transparent)] hover:text-[var(--color-cyan)]"
            >
              [ ↥ ] Import army list
            </Link>
            <Link
              href="/projects/new"
              className="inline-flex items-center gap-2 px-4 py-2 frame-strong tap-target text-sm font-mono hover:bg-[color-mix(in_srgb,var(--color-accent)_8%,transparent)] hover:text-[var(--color-accent)]"
            >
              [ + ] New project
            </Link>
          </div>
        </div>
      </header>

      {isEmpty ? (
        <EmptyState />
      ) : (
        <>
          <TopWishesPanel />

          {backlog.length > 0 ? (
            <Card
              title="Backlog"
              accentColor="amber"
              headerActions={
                <span className="font-mono text-2xs text-[var(--color-amber)] normal-case tracking-wider">
                  {backlog.length} unit{backlog.length === 1 ? "" : "s"} waiting
                </span>
              }
              bodyClassName="p-0"
            >
              {backlog.map((p) => (
                <ProjectRow
                  key={p.id}
                  project={p}
                  namedModelCount={namedCountByProject[p.id] ?? 0}
                  recipeSwatches={swatchesForProject(p.id)}
                />
              ))}
            </Card>
          ) : null}

          {active.length > 0 ? (
            <Card title="Active" accentColor="cyan" bodyClassName="p-0">
              {active.map((p) => (
                <ProjectRow
                  key={p.id}
                  project={p}
                  namedModelCount={namedCountByProject[p.id] ?? 0}
                  recipeSwatches={swatchesForProject(p.id)}
                />
              ))}
            </Card>
          ) : null}

          <Card title="All projects" bodyClassName="p-0">
            {topLevel.map((p) => (
              <ProjectRow
                key={p.id}
                project={p}
                namedModelCount={p.namedModelCount}
                recipeSwatches={swatchesForProject(p.id)}
              />
            ))}
          </Card>

          <RecentlyBoughtLine />
        </>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="frame p-8 text-center space-y-6">
      <div>
        <h2 className="text-lg glow-cyan mb-3">No projects yet</h2>
        <p className="text-sm text-[var(--color-fg-muted)] font-sans max-w-md mx-auto">
          Start with anything you&apos;re painting — an army, a warband, a single
          mini, or a piece of terrain. Sub-projects let you nest units inside
          armies.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Link
          href="/projects/import"
          className="inline-flex items-center gap-2 px-4 py-3 frame-strong tap-target text-sm font-mono hover:bg-[color-mix(in_srgb,var(--color-cyan)_8%,transparent)] hover:text-[var(--color-cyan)]"
        >
          [ ↥ ] Import army list
        </Link>
        <Link
          href="/projects/new"
          className="inline-flex items-center gap-2 px-4 py-3 frame-strong tap-target text-sm font-mono hover:bg-[color-mix(in_srgb,var(--color-accent)_8%,transparent)] hover:text-[var(--color-accent)]"
        >
          [ + ] Create first project
        </Link>
      </div>
      <p className="text-xs font-mono text-[var(--color-fg-muted)]">
        Got a BattleScribe roster or a Warhammer App PDF? Drop it in and we&apos;ll
        populate the project tree in seconds.
      </p>
    </div>
  );
}
