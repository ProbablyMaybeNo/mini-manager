import Link from "next/link";
import { currentUserId } from "@/lib/auth-stub";
import {
  countNamedModelsByProject,
  listActiveProjects,
  listBacklogUnits,
  listTopLevelProjects,
} from "@/db/queries/projects";
import { ProjectRow } from "@/components/ProjectRow";
import { QuickAddBar } from "@/components/QuickAddBar";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const userId = currentUserId();
  const [topLevel, backlog, active, namedCountByProject] = await Promise.all([
    listTopLevelProjects(userId),
    listBacklogUnits(userId),
    listActiveProjects(userId),
    countNamedModelsByProject(userId),
  ]);

  const isEmpty = topLevel.length === 0;

  return (
    <div className="p-6 md:p-8 max-w-6xl space-y-8">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl">┌─ PROJECTS ─</h1>
          <p className="text-sm text-[var(--color-fg-muted)] mt-2 max-w-xl font-sans">
            Your wargaming workbench. Track armies, units, and individual models
            from wishlist to completed.
          </p>
        </div>
        <div className="flex flex-col items-stretch md:items-end gap-2 w-full md:w-auto">
          <QuickAddBar />
          <Link
            href="/projects/new"
            className="inline-flex items-center gap-2 px-4 py-2 frame-strong tap-target text-sm font-mono hover:bg-[color-mix(in_srgb,var(--color-green)_8%,transparent)] hover:text-[var(--color-green)] self-start md:self-end"
          >
            [ + ] New project
          </Link>
        </div>
      </header>

      {isEmpty ? (
        <EmptyState />
      ) : (
        <>
          {backlog.length > 0 ? (
            <section>
              <h2 className="section-title flex items-center gap-3">
                <span>Backlog</span>
                <span className="text-[var(--color-amber)] normal-case tracking-normal">
                  · {backlog.length} unit{backlog.length === 1 ? "" : "s"} waiting
                </span>
              </h2>
              <div className="frame">
                {backlog.map((p) => (
                  <ProjectRow
                    key={p.id}
                    project={p}
                    namedModelCount={namedCountByProject[p.id] ?? 0}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {active.length > 0 ? (
            <section>
              <h2 className="section-title">Active</h2>
              <div className="frame">
                {active.map((p) => (
                  <ProjectRow
                    key={p.id}
                    project={p}
                    namedModelCount={namedCountByProject[p.id] ?? 0}
                  />
                ))}
              </div>
            </section>
          ) : null}

          <section>
            <h2 className="section-title">All projects</h2>
            <div className="frame">
              {topLevel.map((p) => (
                <ProjectRow
                  key={p.id}
                  project={p}
                  namedModelCount={p.namedModelCount}
                />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="frame p-8 text-center">
      <h2 className="text-lg glow-cyan mb-3">No projects yet</h2>
      <p className="text-sm text-[var(--color-fg-muted)] font-sans mb-6 max-w-md mx-auto">
        Start with anything you&apos;re painting — an army, a warband, a single
        mini, or a piece of terrain. Sub-projects let you nest units inside
        armies.
      </p>
      <Link
        href="/projects/new"
        className="inline-flex items-center gap-2 px-4 py-3 frame-strong tap-target text-sm font-mono hover:bg-[color-mix(in_srgb,var(--color-green)_8%,transparent)] hover:text-[var(--color-green)]"
      >
        [ + ] Create first project
      </Link>
    </div>
  );
}
