import { notFound } from "next/navigation";
import Link from "next/link";
import { currentUserId } from "@/lib/auth-stub";
import {
  countNamedModelsByProject,
  getProjectById,
  listAllProjects,
  listChildProjects,
  listNamedModelsByProject,
} from "@/db/queries/projects";
import type { Project } from "@/db/schema";
import { OwnedCounter } from "@/components/OwnedCounter";
import { StageCounter } from "@/components/StageCounter";
import { NamedModelsPanel } from "@/components/NamedModelsPanel";
import { ProjectTree } from "@/components/ProjectTree";
import { AggregateCountersDisplay } from "@/components/AggregateCountersDisplay";
import { ShoppingForThisPanel } from "@/components/wishlist/ShoppingForThisPanel";
import { AttachedRecipePanel } from "@/components/recipes/AttachedRecipePanel";
import {
  aggregateCounters,
  displayStatus,
  isLeafProject,
  progressPercent,
} from "@/lib/progress";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ProjectHeaderStrip } from "@/components/ProjectHeaderStrip";
import {
  ProjectColorSchemeBox,
  type ColorSchemeSlot,
} from "@/components/ProjectColorSchemeBox";
import {
  ProjectProgressTable,
  type ProgressRow,
} from "@/components/ProjectProgressTable";
import {
  getPaintMetaMap,
  getProjectPalettesMap,
  getRecipeWithZones,
  listRecipesForProject,
} from "@/db/queries/recipes";

export const dynamic = "force-dynamic";

/**
 * Collect every descendant of `root` from a flat project list by
 * walking the `parentId` chain in memory. Cheaper than recursive SQL
 * for the volumes we expect (a single user's whole project list),
 * and avoids a CTE for SQLite.
 */
function collectDescendants(
  root: Project,
  all: ReadonlyArray<Project>,
): ReadonlyArray<Project> {
  const out: Project[] = [];
  const stack: string[] = [root.id];
  while (stack.length > 0) {
    const parentId = stack.pop();
    if (parentId === undefined) break;
    for (const candidate of all) {
      if (candidate.parentId === parentId && candidate.id !== root.id) {
        out.push(candidate);
        stack.push(candidate.id);
      }
    }
  }
  return out;
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await currentUserId();
  const project = await getProjectById(userId, id);
  if (!project) notFound();

  const namedModels = await listNamedModelsByProject(userId, project.id);

  const isContainer = project.type === "Army" || project.type === "Warband";

  // Containers fetch the wider context they need for aggregation; leaf
  // projects skip these queries entirely so the workspace stays cheap.
  const [children, allProjects, namedCountByProject] = isContainer
    ? await Promise.all([
        listChildProjects(userId, project.id),
        listAllProjects(userId),
        countNamedModelsByProject(userId),
      ])
    : [
        [] as ReadonlyArray<Project>,
        [] as ReadonlyArray<Project>,
        {} as Record<string, number>,
      ];

  const descendants = isContainer
    ? collectDescendants(project, allProjects)
    : [];
  const aggregate = isContainer
    ? aggregateCounters(project, descendants, namedCountByProject)
    : null;

  // Header progress / status: derive from aggregate for containers so
  // a top-level Army with `count=0` still reflects its child work.
  const headerProject = isContainer && aggregate
    ? { ...project, ...aggregate, isShelved: project.isShelved }
    : project;
  const status = displayStatus(headerProject);
  const percent = progressPercent(headerProject, namedModels);
  const headerTotalModels = headerProject.count + namedModels.length;

  // Slim, serialisable snapshots passed to the client counter components.
  // Avoids shipping Date instances or any fields the panels don't read.
  const stageSnapshot = {
    id: project.id,
    count: project.count,
    ownedCount: project.ownedCount,
    buildCount: project.buildCount,
    primeCount: project.primeCount,
    paintCount: project.paintCount,
    baseCount: project.baseCount,
    completeCount: project.completeCount,
  };

  const ownedSnapshot = {
    id: project.id,
    count: project.count,
    ownedCount: project.ownedCount,
    buildCount: project.buildCount,
  };

  const showInteractiveCounters = isLeafProject(project, namedModels.length);

  // P12.9 — Color Scheme box. If a recipe is attached, surface its
  // slot palette so the box can pre-fill. We pick the first attached
  // recipe (a project typically has one scheme — multiple attachments
  // exist for the "unit override" pattern but the box reads top-
  // level scheme only).
  // P12.10 — Progress table also needs per-row palette swatches for
  // each child project; fetch the project palettes map in parallel.
  const [attachedRecipes, projectPalettes] = await Promise.all([
    listRecipesForProject(userId, project.id),
    getProjectPalettesMap(userId),
  ]);

  // P12.10 — Build the Progress table's row VM. Sub-project rows
  // come first (in createdAt order from listChildProjects), then
  // named-model rows for any individuals on the parent itself. Each
  // row carries the palette swatches, status, percent, and count.
  const progressRows: ProgressRow[] = [
    ...children.map((c) => ({
      id: c.id,
      kind: "project" as const,
      name: c.name,
      type: c.type as string,
      count: c.count,
      paletteHexes: projectPalettes.get(c.id) ?? [],
      status: displayStatus(c),
      percent: progressPercent(c),
      priority: c.priority,
    })),
    ...namedModels.map((m) => ({
      id: m.id,
      kind: "named-model" as const,
      name: m.name,
      type: "Model",
      count: 1,
      paletteHexes: [] as string[],
      // Named-model "status" derives from its booleans the same way
      // displayStatus does for projects — we synthesise a Project-
      // shaped object so the helper still works.
      status: displayStatus({
        count: 1,
        ownedCount: 1,
        buildCount: m.isBuilt ? 1 : 0,
        primeCount: m.isPrimed ? 1 : 0,
        paintCount: m.isPainted ? 1 : 0,
        baseCount: m.isBased ? 1 : 0,
        completeCount: m.isComplete ? 1 : 0,
        isShelved: false,
      }),
      percent: progressPercent(
        { count: 0, buildCount: 0, primeCount: 0, paintCount: 0, baseCount: 0, completeCount: 0 },
        [m],
      ),
      priority: null,
    })),
  ];

  const attachedRecipe = attachedRecipes[0] ?? null;
  let colorSchemeSlots: ColorSchemeSlot[] = [];
  if (attachedRecipe) {
    const full = await getRecipeWithZones(userId, attachedRecipe.id);
    if (full) {
      const paintMeta = await getPaintMetaMap();
      colorSchemeSlots = full.zones.map((z) => {
        const firstStep = z.steps[0];
        const hex =
          firstStep?.customColorHex ??
          (firstStep?.paintId
            ? paintMeta.get(firstStep.paintId)?.hex ?? null
            : null);
        return {
          zoneId: z.id,
          firstStepId: firstStep?.id ?? null,
          hex,
          name: z.name,
        };
      });
    }
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl space-y-6">
      <nav className="text-xs font-mono text-[var(--color-fg-muted)]">
        <Link href="/projects" className="hover:text-[var(--color-accent)]">
          ← Projects
        </Link>
        {" > "}
        <span className="text-[var(--color-fg)]">{project.name}</span>
      </nav>

      <ProjectHeaderStrip
        projectId={project.id}
        name={project.name}
        type={project.type}
        faction={project.faction}
        status={status}
        percent={percent}
        totalModels={headerTotalModels}
        // Single Model / Terrain Piece / Diorama are leaf-only — no
        // children allowed. Army / Warband / Unit can hold a sub-tree.
        showAddChild={
          project.type === "Army" ||
          project.type === "Warband" ||
          project.type === "Unit"
        }
      />

      <ProjectColorSchemeBox
        projectId={project.id}
        projectName={project.name}
        attachedRecipeId={attachedRecipe?.id ?? null}
        attachedRecipeName={attachedRecipe?.name ?? null}
        slots={colorSchemeSlots}
      />

      <ProjectProgressTable
        parentType={project.type}
        parentId={project.id}
        rows={progressRows}
      />

      {isContainer && aggregate ? (
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-6">
          <div className="order-2 md:order-1">
            <Card
              title={`Sub-projects · ${children.length}`}
              headerActions={
                <Button
                  as="a"
                  href={`/projects/new?parent=${project.id}`}
                  variant="primary"
                  size="sm"
                >
                  + Add unit
                </Button>
              }
            >
              {children.length === 0 ? (
                <p className="text-xs font-sans text-[var(--color-fg-muted)] leading-relaxed">
                  Add Units, Single Models, or Terrain Pieces under this {project.type.toLowerCase()} to track them.
                  Each child's stage counters roll up into the aggregated view on the right.
                </p>
              ) : (
                <ProjectTree
                  projects={children}
                  namedModelCountByProjectId={namedCountByProject}
                />
              )}
            </Card>
          </div>

          <div className="order-1 md:order-2">
            <Card title="Aggregated stages" accentColor="cyan">
              <AggregateCountersDisplay
                aggregate={aggregate}
                childCount={descendants.length}
              />
            </Card>
          </div>
        </div>
      ) : (
        <>
          {/*
            Leaf-project layout — StageCounter (or Stages-only fallback)
            sits left, the attached-recipe panel sits right. On mobile
            they stack; on md+ the recipe panel fills the middle of the
            workspace so the page doesn't have a dead-zone after the
            header. P11.2 — Phase 11 layout sweep.
          */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <div className="space-y-6">
              {showInteractiveCounters ? (
                <Card title="Roster">
                  <OwnedCounter snapshot={ownedSnapshot} />
                </Card>
              ) : null}

              <Card title="Stages" accentColor="cyan">
                <StageCounter snapshot={stageSnapshot} />
              </Card>
            </div>

            <AttachedRecipePanel projectId={project.id} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <NamedModelsPanel projectId={project.id} namedModels={namedModels} />
            <ShoppingForThisPanel projectId={project.id} />
          </div>
        </>
      )}
    </div>
  );
}
