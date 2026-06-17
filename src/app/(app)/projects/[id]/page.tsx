import { notFound } from "next/navigation";
import { currentUserId } from "@/lib/auth-stub";
import { loadAppData } from "@/lib/appData";
import { rollupProjectMinutes } from "@/lib/projectTime";
import type { Project } from "@/lib/types";
import { ProjectPageClient } from "./ProjectPageClient";

export const dynamic = "force-dynamic";

/** Locate a project anywhere in the loaded tree by id. */
function findProject(list: Project[], id: string): Project | null {
  for (const p of list) {
    if (p.id === id) return p;
    if (p.children) {
      const hit = findProject(p.children, id);
      if (hit) return hit;
    }
  }
  return null;
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await currentUserId();
  const data = await loadAppData(userId);
  const project = findProject(data.projects ?? [], id);
  if (!project) notFound();
  const loggedMinutes = rollupProjectMinutes(project, data.projectMinutes ?? {});
  return <ProjectPageClient project={project} loggedMinutes={loggedMinutes} />;
}
