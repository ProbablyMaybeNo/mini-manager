import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { currentUserId } from "@/lib/auth-stub";
import { loadAppData } from "@/lib/appData";
import { db } from "@/db/client";
import { projects } from "@/db/schema";
import { countProjectImages } from "@/db/queries/projectImages";
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

  // Timeline / DETAILS / NOTES fields not carried on the dashboard view-model
  // (created date, deadline, notes, tags) — read straight from the row so the
  // 13:4 right-rail TIMELINE + DETAILS/NOTES accordions show REAL data only.
  const metaRows = await db
    .select({
      createdAt: projects.createdAt,
      targetDate: projects.targetDate,
      notesMd: projects.notesMd,
      faction: projects.faction,
      game: projects.game,
    })
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.ownerId, userId)))
    .limit(1);
  const row = metaRows[0];
  const meta = {
    createdAtIso: row?.createdAt ? row.createdAt.toISOString().slice(0, 10) : null,
    deadlineIso: row?.targetDate ? row.targetDate.toISOString().slice(0, 10) : null,
    notes: row?.notesMd ?? null,
    tags: [row?.game, row?.faction].filter((t): t is string => !!t),
  };

  // Recipe picker options (recently-used first) so the RECIPE card's attach
  // flow can open the same dropdown the dashboard uses — no dead /recipes link.
  const recipeOptions = (data.recipes ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    swatches: r.slots.map((s) => s.swatch),
  }));

  // Seed the full-page layout: the photo column only mounts when the project
  // already has a photo, otherwise the page reads left-heavy with an empty
  // column. Uploading the first one (via the inline UPLOAD affordance) flips it.
  const initialHasPhotos = (await countProjectImages(id)) > 0;

  return (
    <ProjectPageClient
      project={project}
      ancestors={ancestors.map((a) => ({ id: a.id, title: a.title, type: a.type }))}
      loggedMinutes={loggedMinutes}
      meta={meta}
      recipeOptions={recipeOptions}
      initialHasPhotos={initialHasPhotos}
    />
  );
}
