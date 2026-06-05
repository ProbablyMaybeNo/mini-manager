import { and, asc, eq, isNull } from "drizzle-orm";
import { currentUserId } from "@/lib/auth-stub";
import { db } from "@/db/client";
import { listRecipesForTable } from "@/db/queries/recipes";
import { projects } from "@/db/schema";
import { NewRecipeButton } from "@/components/recipes/NewRecipeButton";
import type { AssignProjectOption } from "@/components/recipes/RecipeActionsBar";
import {
  RecipesTable,
  type RecipeRowVm,
} from "@/components/recipes/RecipesTable";

export const dynamic = "force-dynamic";

/**
 * P12.5 — Single table view of every recipe, replacing the prior
 * three-section card grid. Ross's brief: name / body type / palette
 * squares / step count / created — with per-row Assign + Share.
 *
 * The attachment label (which project a recipe is attached to) is
 * resolved server-side here so the table component stays
 * presentational. Standalone recipes show "standalone" muted.
 *
 * P13.4 — the "named model" attachment branch was removed when named
 * models folded into Unit projects.
 */
export default async function RecipesPage() {
  const userId = await currentUserId();
  const rows = await listRecipesForTable(userId);

  if (rows.length === 0) {
    return (
      <div className="p-6 md:p-8 max-w-7xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl tracking-wide">RECIPES</h1>
          <p className="text-sm text-[var(--color-fg-muted)] max-w-xl font-sans leading-snug">
            Paint schemes the way you mix them — each recipe is a stack of
            colour slots, each slot a paint plus the layer you use on it.
          </p>
        </header>
        <EmptyState />
      </div>
    );
  }

  // Every non-archived project owned by the user — powers the per-row
  // "Assign to project ▾" dropdown (reuses the recipe-editor data path:
  // attachRecipeToProject) AND resolves the "attached to" labels. One read.
  const projectRows = await db
    .select({ id: projects.id, name: projects.name, type: projects.type })
    .from(projects)
    .where(and(eq(projects.ownerId, userId), isNull(projects.archivedAt)))
    .orderBy(asc(projects.name));

  const projectNameById = new Map<string, string>();
  for (const p of projectRows) projectNameById.set(p.id, p.name);

  const assignProjects: ReadonlyArray<AssignProjectOption> = projectRows.map(
    (p) => ({ id: p.id, name: p.name, type: p.type }),
  );

  const vm: RecipeRowVm[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    bodyType: r.bodyType,
    attachmentKind: r.attachmentKind,
    attachedProjectId: r.attachedProjectId,
    attachmentLabel: r.attachedProjectId
      ? projectNameById.get(r.attachedProjectId) ?? "Project"
      : null,
    paletteHexes: r.paletteHexes,
    palette: r.palette,
    slots: r.slots,
    slotCount: r.slotCount,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    publicSlug: r.publicSlug,
  }));

  return (
    <div className="p-6 md:p-8 max-w-7xl space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl tracking-wide">RECIPES</h1>
          <p className="text-sm text-[var(--color-fg-muted)] mt-2 max-w-xl font-sans leading-snug">
            Every paint scheme in your library. Click a name to edit;
            use the row actions to assign to a project or share.
          </p>
        </div>
        <NewRecipeButton />
      </header>
      <RecipesTable rows={vm} assignProjects={assignProjects} />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="relative frame p-8 text-center space-y-4 overflow-hidden">
      <h2 className="text-lg glow-cyan">No recipes yet</h2>
      <p className="text-sm text-[var(--color-fg-muted)] font-sans max-w-md mx-auto leading-snug">
        Build your first scheme: click a + slot, pick a paint from the
        wheel / library / eyedropper, assign it a layer. Attach the
        finished recipe to an army when you&apos;re ready.
      </p>
      <NewRecipeButton label="Create your first recipe" />
    </div>
  );
}
