import { notFound } from "next/navigation";
import { currentUserId } from "@/lib/auth-stub";
import { loadAppData } from "@/lib/appData";
import { rollupProjectMinutes } from "@/lib/projectTime";
import type { Project } from "@/lib/types";
import { ProjectPageClient } from "./ProjectPageClient";

export const dynamic = "force-dynamic";

/**
 * Locate a project by id and return the ancestor chain that leads to it
 * (root-first, EXCLUDING the project itself). Used for the breadcrumb on the
 * project page so the depth reads DASHBOARD ▸ Army ▸ Unit ▸ … (PP-2).
 */
function findWithAncestors(
  list: Project[],
  id: string,
  trail: Project[] = [],
): { project: Project; ancestors: Project[] } | null {
  for (const p of list) {
    if (p.id === id) return { project: p, ancestors: trail };
    if (p.children) {
      const hit = findWithAncestors(p.children, id, [...trail, p]);
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
  const hit = findWithAncestors(data.projects ?? [], id);
  if (!hit) notFound();
  const { project, ancestors } = hit;
  const loggedMinutes = rollupProjectMinutes(project, data.projectMinutes ?? {});
  return (
    <ProjectPageClient
      project={project}
      ancestors={ancestors.map((a) => ({ id: a.id, title: a.title, type: a.type }))}
      loggedMinutes={loggedMinutes}
    />
  );
}
