import { notFound } from "next/navigation";
import Link from "next/link";
import { currentUserId } from "@/lib/auth-stub";
import {
  getProjectById,
  listAllProjects,
  listChildProjects,
} from "@/db/queries/projects";
import type { Project } from "@/db/schema";
import { OwnedCounter } from "@/components/OwnedCounter";
import { StageCounter } from "@/components/StageCounter";
import { ProjectTree } from "@/components/ProjectTree";
import { AggregateCountersDisplay } from "@/components/AggregateCountersDisplay";
import {
  aggregateCounters,
  childAddLabel,
  childNoun,
  displayStatus,
  isLeafProject,
  progressPercent,
} from "@/lib/progress";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DeleteProjectButton } from "@/components/projects/DeleteProjectButton";
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
  getRecipeWithSlots,
  listOwnedRecipesLean,
  listRecipesForProject,
} from "@/db/queries/recipes";
import type { RecipeOption } from "@/components/recipes/AttachRecipeModal";

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

/**
 * P13.2 — Project workspace simplification.
 *
 * Per Ross's batch (PHASE13_PLAN.md):
 *   - The AttachedRecipePanel is gone — recipe info already lives in
 *     ProjectColorSchemeBox; rendering it twice on the same page is
 *     visual noise.
 *   - The ShoppingForThisPanel is gone — replaced by a `+ Wishlist`
 *     button rendered next to the existing `+ Add unit` action.
 *   - The leaf workspace stack is now:
 *       Header → ColorSchemeBox → Progress Table → Stages →
 *         action button row
 */
export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  /** UX-907 — `?recipe=<id>` switches which attached recipe the
   *  COLOR SCHEME box renders when 2+ are attached. */
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const userId = await currentUserId();
  const project = await getProjectById(userId, id);
  if (!project) notFound();

  const sp = (await searchParams) ?? {};
  const recipeParamRaw = sp.recipe;
  const recipeParam = Array.isArray(recipeParamRaw)
    ? recipeParamRaw[0]
    : recipeParamRaw;

  // P13.4 — Army, Warband AND Unit can host sub-projects (which are
  // always Unit-typed per the new sub-project rule). The container
  // workspace surface (sub-project table, aggregated counters) shows
  // for any project that's allowed to nest children.
  const canHaveChildren =
    project.type === "Army" ||
    project.type === "Warband" ||
    project.type === "Unit";

  // Containers fetch the wider context they need for aggregation; leaf
  // projects skip these queries entirely so the workspace stays cheap.
  // UX-904 — `ownedRecipes` is fetched ALWAYS now (cheap lean shape)
  // so the COLOR SCHEME box can open the AttachRecipeModal with "Pick
  // existing" + "Create new" tabs from any project — leaf or container.
  // We need the projects list too for the recipe-attachment-label
  // lookup, so widen the fetch beyond containers.
  const [children, allProjects, ownedRecipes] = await Promise.all([
    canHaveChildren
      ? listChildProjects(userId, project.id)
      : Promise.resolve([] as ReadonlyArray<Project>),
    listAllProjects(userId),
    listOwnedRecipesLean(userId),
  ]);

  // A project is a "container view" only when it both can host children
  // AND has a count of 0 (no rank-and-file of its own). A Unit with
  // count=10 stays a leaf-style workspace even if it gains a sub-Unit
  // later — the rank-and-file counters belong to this row, the child
  // counters roll up via the Progress table.
  const hasChildren = children.length > 0;
  const isContainer = canHaveChildren && hasChildren && project.count === 0;

  const descendants = isContainer
    ? collectDescendants(project, allProjects)
    : [];
  const aggregate = isContainer ? aggregateCounters(project, descendants) : null;

  // Header progress / status: derive from aggregate for containers so
  // a top-level Army with `count=0` still reflects its child work.
  const headerProject = isContainer && aggregate
    ? { ...project, ...aggregate, isShelved: project.isShelved }
    : project;
  const status = displayStatus(headerProject);
  const percent = progressPercent(headerProject);
  const headerTotalModels = headerProject.count;

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

  const showInteractiveCounters = isLeafProject(project);

  // Recipe box. If a recipe is attached, surface its
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

  // P12.10 — Build the Progress table's row VM from sub-projects in
  // createdAt order from listChildProjects. Each row carries the
  // palette swatches, status, percent, and count.
  const progressRows: ProgressRow[] = children.map((c) => ({
    id: c.id,
    kind: "project" as const,
    name: c.name,
    type: c.type as string,
    count: c.count,
    paletteHexes: projectPalettes.get(c.id) ?? [],
    status: displayStatus(c),
    percent: progressPercent(c),
    priority: c.priority,
  }));

  // UX-904 — Build the AttachRecipeModal candidate list. Filters out
  // recipes already attached to THIS project (they'd be no-ops to
  // re-attach) and labels the rest with their current attachment so
  // the painter sees "moves from: <project>" warnings inline.
  const projectNameById: Record<string, string> = {};
  for (const p of allProjects) projectNameById[p.id] = p.name;
  const attachCandidates: ReadonlyArray<RecipeOption> = ownedRecipes
    .filter((r) => r.attachedProjectId !== project.id)
    .map((r) => ({
      id: r.id,
      name: r.name,
      attachmentLabel: r.attachedProjectId
        ? projectNameById[r.attachedProjectId] ?? "(project)"
        : null,
    }));

  // UX-907 — when 2+ recipes are attached we render a tab strip and
  // honour `?recipe=<id>` for the active selection. Fall back to most-
  // recently-updated (already the listRecipesForProject default order).
  const attachedRecipe =
    (recipeParam
      ? attachedRecipes.find((r) => r.id === recipeParam)
      : null) ??
    attachedRecipes[0] ??
    null;
  let colorSchemeSlots: ColorSchemeSlot[] = [];
  if (attachedRecipe) {
    const full = await getRecipeWithSlots(userId, attachedRecipe.id);
    if (full) {
      const paintMeta = await getPaintMetaMap();
      colorSchemeSlots = full.slots.map((slot, idx) => {
        const meta = slot.paintId ? paintMeta.get(slot.paintId) : null;
        const hex = slot.customColorHex ?? meta?.hex ?? null;
        return {
          slotId: slot.id,
          hex,
          name: meta?.label ?? `Slot ${idx + 1}`,
        };
      });
    }
  }

  // P13.2 — Action button row below the Stages card on leaf
  // workspaces. The `+ Wishlist` button replaces the removed
  // ShoppingForThisPanel; it deep-links to the filtered wishlist
  // page for this project.
  const actionButtonRow = (
    <div className="flex flex-wrap items-center gap-2">
      {canHaveChildren ? (
        <Button
          as="a"
          href={`/projects/new?parent=${project.id}`}
          variant="success"
          size="sm"
        >
          {childAddLabel(project.type)}
        </Button>
      ) : null}
      <Button
        as="a"
        href={`/wishlist?project=${project.id}`}
        variant="warning"
        size="sm"
      >
        Shop for this →
      </Button>
    </div>
  );

  // D5/M5 — breadcrumb keeps the parent chain visible. Walk parentId up
  // from this project (Model → Unit → Army) so a nested node always shows
  // where it lives, not just "Projects > <self>". Bounded by the 3-level
  // cap; the in-memory walk over the user's own list is cheap.
  const projectsById = new Map<string, Project>();
  for (const p of allProjects) projectsById.set(p.id, p);
  const ancestors: Project[] = [];
  {
    let pid = project.parentId;
    let guard = 0;
    while (pid && guard < 8) {
      const parent = projectsById.get(pid);
      if (!parent) break;
      ancestors.unshift(parent);
      pid = parent.parentId;
      guard += 1;
    }
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl space-y-6">
      <nav className="text-xs font-mono text-[var(--color-fg-muted)] flex items-center justify-between gap-3">
        <span className="min-w-0 truncate">
          <Link href="/projects" className="hover:text-[var(--color-accent)]">
            ← Projects
          </Link>
          {ancestors.map((a) => (
            <span key={a.id}>
              {" > "}
              <Link
                href={`/projects/${a.id}`}
                className="hover:text-[var(--color-accent)]"
              >
                {a.name}
              </Link>
            </span>
          ))}
          {" > "}
          <span className="text-[var(--color-fg)]">{project.name}</span>
        </span>
        {/* UX-1208 — destructive actions must read as destructive. The
            inline text-link tone was indistinguishable from a benign
            link; render the solid red `variant="danger"` Button so the
            irreversible delete is visually distinct. The confirm step
            lives in DeleteProjectModal. */}
        <DeleteProjectButton
          projectId={project.id}
          projectName={project.name}
          redirectToProjectsOnSuccess
        />
      </nav>

      <ProjectHeaderStrip
        projectId={project.id}
        name={project.name}
        type={project.type}
        faction={project.faction}
        status={status}
        percent={percent}
        totalModels={headerTotalModels}
        // Army / Warband / Unit can nest child Units. Terrain Piece /
        // Diorama stay leaf-only.
        showAddChild={canHaveChildren}
      />

      <ProjectColorSchemeBox
        projectId={project.id}
        projectName={project.name}
        attachedRecipeId={attachedRecipe?.id ?? null}
        attachedRecipeName={attachedRecipe?.name ?? null}
        slots={colorSchemeSlots}
        attachedRecipes={attachedRecipes.map((r) => ({
          id: r.id,
          name: r.name,
        }))}
        attachCandidates={attachCandidates}
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
              title={`${childNoun(project.type, true)} · ${children.length}`}
              headerActions={
                <Button
                  as="a"
                  href={`/projects/new?parent=${project.id}`}
                  variant="success"
                  size="sm"
                >
                  {childAddLabel(project.type)}
                </Button>
              }
            >
              {children.length === 0 ? (
                <p className="text-xs font-sans text-[var(--color-fg-muted)] leading-relaxed">
                  Add {childNoun(project.type, true)} under this{" "}
                  {project.type.toLowerCase()} to track them. Each child's stage
                  counters roll up into the aggregated view on the right.
                </p>
              ) : (
                <ProjectTree projects={children} />
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
        <div className="space-y-6">
          {showInteractiveCounters ? (
            <Card title="Roster">
              <OwnedCounter snapshot={ownedSnapshot} />
            </Card>
          ) : null}

          <Card title="Stages" accentColor="cyan">
            <StageCounter snapshot={stageSnapshot} />
          </Card>

          {actionButtonRow}
        </div>
      )}
    </div>
  );
}
