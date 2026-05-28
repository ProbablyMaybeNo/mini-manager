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
import { ProgressBar } from "@/components/ProgressBar";
import { OwnedCounter } from "@/components/OwnedCounter";
import { StageCounter } from "@/components/StageCounter";
import { NamedModelsPanel } from "@/components/NamedModelsPanel";
import { ProjectTree } from "@/components/ProjectTree";
import { AggregateCountersDisplay } from "@/components/AggregateCountersDisplay";
import { ShoppingForThisPanel } from "@/components/wishlist/ShoppingForThisPanel";
import {
  aggregateCounters,
  displayStatus,
  isLeafProject,
  progressPercent,
} from "@/lib/progress";

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

  return (
    <div className="p-6 md:p-8 max-w-5xl space-y-6">
      <nav className="text-xs font-mono text-[var(--color-fg-muted)]">
        <Link href="/projects" className="hover:text-[var(--color-green)]">
          ← Projects
        </Link>
        {" > "}
        <span className="text-[var(--color-fg)]">{project.name}</span>
      </nav>

      <header className="space-y-2">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl">┌─ {project.name.toUpperCase()} ─</h1>
          <span
            aria-disabled
            className="text-2xs font-mono text-[var(--color-fg-subtle)] uppercase tracking-wider cursor-not-allowed select-none"
            title="Edit project — coming soon"
          >
            [ edit ]
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono text-[var(--color-fg-muted)] uppercase tracking-wide">
          <span>{project.type}</span>
          {project.faction ? <span>· {project.faction}</span> : null}
          <span>
            · {headerTotalModels} model{headerTotalModels === 1 ? "" : "s"}
          </span>
          <span className="text-[var(--color-green)]">· {status} {percent}%</span>
        </div>
        <ProgressBar percent={percent} width={32} className="block pt-1" />
      </header>

      {isContainer && aggregate ? (
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-6">
          <section className="space-y-3 order-2 md:order-1">
            <h2 className="section-title flex items-center justify-between gap-3 mb-0 pb-2">
              <span>Sub-projects · {children.length}</span>
            </h2>
            <ProjectTree
              projects={children}
              namedModelCountByProjectId={namedCountByProject}
            />
          </section>

          <section className="space-y-3 order-1 md:order-2">
            <h2 className="section-title mb-0 pb-2">Aggregated stages</h2>
            <AggregateCountersDisplay
              aggregate={aggregate}
              childCount={descendants.length}
            />
          </section>
        </div>
      ) : showInteractiveCounters ? (
        <>
          <section className="space-y-3">
            <h2 className="section-title">Roster</h2>
            <OwnedCounter snapshot={ownedSnapshot} />
          </section>

          <section className="space-y-3">
            <h2 className="section-title">Stages</h2>
            <StageCounter snapshot={stageSnapshot} />
          </section>
        </>
      ) : (
        <section className="space-y-3">
          <h2 className="section-title">Stages</h2>
          <StageCounter snapshot={stageSnapshot} />
        </section>
      )}

      <NamedModelsPanel projectId={project.id} namedModels={namedModels} />

      <ShoppingForThisPanel projectId={project.id} />
    </div>
  );
}
