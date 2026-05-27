import { notFound } from "next/navigation";
import Link from "next/link";
import { currentUserId } from "@/lib/auth-stub";
import {
  getProjectById,
  listNamedModelsByProject,
} from "@/db/queries/projects";
import { ProgressBar } from "@/components/ProgressBar";
import { OwnedCounter } from "@/components/OwnedCounter";
import { StageCounter } from "@/components/StageCounter";
import { NamedModelsPanel } from "@/components/NamedModelsPanel";
import { progressPercent, displayStatus } from "@/lib/progress";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = currentUserId();
  const project = await getProjectById(userId, id);
  if (!project) notFound();

  const namedModels = await listNamedModelsByProject(userId, project.id);

  const status = displayStatus(project);
  const percent = progressPercent(project, namedModels);

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
          <span>· {project.count} model{project.count === 1 ? "" : "s"}</span>
          <span className="text-[var(--color-green)]">· {status} {percent}%</span>
        </div>
        <ProgressBar percent={percent} width={32} className="block pt-1" />
      </header>

      <section className="space-y-3">
        <h2 className="section-title">Roster</h2>
        <OwnedCounter snapshot={ownedSnapshot} />
      </section>

      <section className="space-y-3">
        <h2 className="section-title">Stages</h2>
        <StageCounter snapshot={stageSnapshot} />
      </section>

      <NamedModelsPanel projectId={project.id} namedModels={namedModels} />
    </div>
  );
}
