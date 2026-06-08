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
import {
  aggregateCounters,
  displayStatus,
  isLeafProject,
  progressPercent,
} from "@/lib/progress";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DeleteProjectButton } from "@/components/projects/DeleteProjectButton";
import { ProjectHeaderStrip } from "@/components/ProjectHeaderStrip";
import { StageProgressProvider } from "@/components/projects/StageProgressContext";
import { RosterProvider } from "@/components/projects/RosterContext";
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
  getProjectFirstRecipeMap,
  getProjectPalettesMap,
  getRecipeWithSlots,
  listOwnedRecipesLean,
  listRecipesForProject,
} from "@/db/queries/recipes";
import type { RecipeOption } from "@/components/recipes/AttachRecipeModal";
import {
  WarbandModelsTable,
  type WarbandModelRow,
} from "@/components/projects/WarbandModelsTable";

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

  // Army, Warband AND Unit can HAVE sub-projects to display: an Army /
  // Warband nests Units + Models, and a Unit can have Models assigned to
  // it. The container workspace surface (sub-project Progress table)
  // shows for any of these.
  const canHaveChildren =
    project.type === "Army" ||
    project.type === "Warband" ||
    project.type === "Unit";

  // 2026-06-05 containment rules (Ross): the in-project "+ Add" menu only
  // ADDS sub-projects from Army / Warband. A Unit shows no add menu (you
  // can't add a unit or model from inside a unit — a Model is assigned to
  // a unit via the new-project parent picker, not created from the unit's
  // menu). Terrain is top-level only, added from the initial /projects/new
  // page, never from an in-project menu.
  const canAddChild =
    project.type === "Army" || project.type === "Warband";

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

  // batch/model-warband — on a Warband, the recipe box at the top is
  // replaced by a "+ Model" + models table. Models are the child Unit
  // sub-projects. Build the per-model row VMs here (palette swatches +
  // first-recipe link + derived status/percent + the new modelClass).
  const isWarband = project.type === "Warband";
  let warbandModelRows: ReadonlyArray<WarbandModelRow> = [];
  if (isWarband) {
    const firstRecipeMap = await getProjectFirstRecipeMap(userId);
    warbandModelRows = children.map((c) => ({
      id: c.id,
      name: c.name,
      modelClass: c.modelClass,
      priority: c.priority,
      status: displayStatus(c),
      paletteHexes: projectPalettes.get(c.id) ?? [],
      progressPercent: progressPercent(c),
      firstAttachedRecipeId: firstRecipeMap.get(c.id) ?? null,
    }));
  }

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
  //
  // Item 1 — the add-child affordance was removed from this row. All
  // "add unit / terrain / model" entry points now live in the single
  // "+ Add ▾" menu in the header strip; this row keeps only the
  // (lateral) "Shop for this" action.
  const actionButtonRow = (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        as="a"
        href={`/collections?mproject=${project.id}`}
        variant="warning"
        size="sm"
      >
        + Collection
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
    <StageProgressProvider>
    <RosterProvider>
    <div className="p-6 md:p-8 max-w-5xl space-y-6">
      {/* PHASE-2 cohesion — a coordinate-style channel caption above the
          breadcrumb, mirroring the dashboard's `SYS ▸ …` banner so the
          unit workspace reads as a mission-control screen. The channel is
          the project type (ARMY / WARBAND / UNIT …). */}
      <p className="font-mono text-2xs uppercase tracking-[0.2em] text-[var(--color-cyan)]">
        SYS ▸ {project.type.toUpperCase()} / WORKSPACE
      </p>
      {/* UX-005 — the breadcrumb root reads DASHBOARD, matching the nav rail
          + mobile tab bar's active item (both light "Dashboard" on
          /projects/[id]). Previously the nav said DASHBOARD while the
          breadcrumb said "Projects", so the only location cues disagreed.
          Naming them identically gives one coherent "you are here:
          DASHBOARD ▸ … ▸ <this unit>" trail. */}
      {/* UX-013 — the DELETE PROJECT action moved OUT of this top
          breadcrumb (it was above the fold, next to a wrapping title on
          mobile — easy to mis-tap) down to a dedicated danger zone at the
          page bottom. The breadcrumb is now navigation only. */}
      <nav
        aria-label="Breadcrumb"
        className="text-xs font-mono text-[var(--color-fg-muted)] flex items-center gap-3"
      >
        <span className="min-w-0 truncate">
          <Link href="/projects" className="hover:text-[var(--color-accent)]">
            ← DASHBOARD
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
      </nav>

      <ProjectHeaderStrip
        projectId={project.id}
        name={project.name}
        type={project.type}
        faction={project.faction}
        status={status}
        percent={percent}
        totalModels={headerTotalModels}
        // 2026-06-05 — only Army / Warband expose the in-project add menu
        // (Add unit / Add model). Units, Models, Terrain + Diorama show no
        // add menu per the containment rules.
        showAddChild={canAddChild}
      />

      {/* batch/model-warband — a Warband swaps the recipe-at-top box for
          a "+ Model" + models table (its models ARE the child Unit
          sub-projects). Every other project type keeps the recipe box. */}
      {isWarband ? (
        <WarbandModelsTable
          warbandId={project.id}
          rows={warbandModelRows}
          ownedRecipes={ownedRecipes}
          projectNameById={projectNameById}
        />
      ) : (
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
      )}

      {/* The Warband models table already lists every child model with
          per-row status/recipe/completion, so the generic Progress table
          would be redundant for a Warband — render it only for non-
          Warband container types. */}
      {isWarband ? null : (
        <ProjectProgressTable parentType={project.type} rows={progressRows} />
      )}

      {/* Note (Ross 2026-06-05): the Progress / Units / Aggregated-stages
          trio on a container workspace all said the same thing. The
          Progress table above is the single, most-informative
          representation (per-child name · type · count · recipe · status ·
          progress), so the redundant "Units" tree card and "Aggregated
          stages" roll-up card were removed. Containers now render the
          Progress table only; the editable Roster + Stages counters stay
          for leaf projects (actual miniatures on the desk). */}
      {isContainer ? null : (
        <div className="space-y-6">
          {showInteractiveCounters ? (
            // PHASE-2 cohesion — the Roster + Stages panels carry the same
            // corner ticks + coordinate tech labels as the dashboard KPI
            // cards so the leaf workspace reads as one mission-control
            // surface rather than mixed card styles.
            <Card title="Roster" accentColor="amber" ticks techLabel="OPS ▸ ROSTER">
              <OwnedCounter snapshot={ownedSnapshot} />
            </Card>
          ) : null}

          <Card title="Stages" accentColor="cyan" ticks techLabel="OPS ▸ STAGES">
            <StageCounter snapshot={stageSnapshot} />
          </Card>

          {actionButtonRow}
        </div>
      )}

      {/* UX-013 — danger zone: the destructive DELETE PROJECT lives here at
          the page bottom (was the top breadcrumb), rendered as a red-OUTLINE
          button (DeleteProjectButton default tone) behind the
          DeleteProjectModal confirm step. Demoted + standardized with the
          recipe-detail delete (also a bottom danger-outline + confirm). */}
      <div className="pt-4 mt-2 border-t border-[var(--color-border)] flex items-center justify-between gap-3 flex-wrap">
        <p className="text-2xs font-mono uppercase tracking-wider text-[var(--color-fg-muted)]">
          Danger zone
        </p>
        <DeleteProjectButton
          projectId={project.id}
          projectName={project.name}
          redirectToProjectsOnSuccess
        />
      </div>
    </div>
    </RosterProvider>
    </StageProgressProvider>
  );
}
