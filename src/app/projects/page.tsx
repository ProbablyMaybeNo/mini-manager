import { currentUserId } from "@/lib/auth-stub";
import {
  countNamedModelsByProject,
  listActiveProjects,
  listBacklogUnits,
  listTopLevelProjects,
} from "@/db/queries/projects";
import { ProjectRow } from "@/components/ProjectRow";
import { QuickAddBar } from "@/components/QuickAddBar";
import { TopWishesPanel } from "@/components/wishlist/TopWishesPanel";
import { RecentlyBoughtLine } from "@/components/dashboard/RecentlyBoughtLine";
import { Card } from "@/components/ui/Card";
import { AccentCounter } from "@/components/ui/AccentCounter";
import { Button } from "@/components/ui/Button";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const userId = await currentUserId();
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
          <h1 className="text-3xl tracking-wide">PROJECTS</h1>
          <p className="text-sm text-[var(--color-fg-muted)] mt-2 max-w-xl font-sans">
            Your wargaming workbench. Track armies, units, and individual models
            from wishlist to completed.
          </p>
        </div>
        <div className="flex flex-col items-stretch md:items-end gap-2 w-full md:w-auto">
          <QuickAddBar />
          <div className="flex gap-2 self-start md:self-end">
            <Button as="a" href="/projects/import" variant="ghost" size="md">
              Import army list
            </Button>
            <Button as="a" href="/projects/new" variant="primary" size="md">
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
    <div className="relative frame p-8 text-center space-y-6 overflow-hidden">
      <AccentCounter value="01" />
      <div>
        <h2 className="text-lg glow-cyan mb-3">No projects yet</h2>
        <p className="text-sm text-[var(--color-fg-muted)] font-sans max-w-md mx-auto">
          Start with anything you&apos;re painting — an army, a warband, a single
          mini, or a piece of terrain. Sub-projects let you nest units inside
          armies.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Button as="a" href="/projects/import" variant="secondary" size="lg">
          Import army list
        </Button>
        <Button as="a" href="/projects/new" variant="primary" size="lg">
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
