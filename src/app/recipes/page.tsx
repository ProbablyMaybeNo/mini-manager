import { eq } from "drizzle-orm";
import { currentUserId } from "@/lib/auth-stub";
import { db } from "@/db/client";
import { listRecipesForTable } from "@/db/queries/recipes";
import { namedModels, projects } from "@/db/schema";
import { NewRecipeButton } from "@/components/recipes/NewRecipeButton";
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
 * The attachment label (which project / named model a recipe is
 * attached to) is resolved server-side here so the table component
 * stays presentational. Standalone recipes show "standalone" muted.
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

  // Resolve attachment labels in one pass each — project name + named-
  // model label (project · model). Both are owner-scoped via the
  // projects join.
  const projectIds = Array.from(
    new Set(
      rows.flatMap((r) =>
        r.attachedProjectId ? [r.attachedProjectId] : [],
      ),
    ),
  );
  const namedModelIds = Array.from(
    new Set(
      rows.flatMap((r) =>
        r.attachedNamedModelId ? [r.attachedNamedModelId] : [],
      ),
    ),
  );

  const projectNameById = new Map<string, string>();
  if (projectIds.length > 0) {
    const prows = await db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(eq(projects.ownerId, userId));
    for (const p of prows) projectNameById.set(p.id, p.name);
  }

  const namedModelLabelById = new Map<string, string>();
  if (namedModelIds.length > 0) {
    const nmrows = await db
      .select({
        id: namedModels.id,
        name: namedModels.name,
        projectName: projects.name,
      })
      .from(namedModels)
      .innerJoin(projects, eq(projects.id, namedModels.projectId))
      .where(eq(projects.ownerId, userId));
    for (const r of nmrows) {
      namedModelLabelById.set(r.id, `${r.projectName} · ${r.name}`);
    }
  }

  const vm: RecipeRowVm[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    bodyType: r.bodyType,
    attachmentKind: r.attachmentKind,
    attachmentLabel: r.attachedProjectId
      ? projectNameById.get(r.attachedProjectId) ?? "Project"
      : r.attachedNamedModelId
        ? namedModelLabelById.get(r.attachedNamedModelId) ?? "Named model"
        : null,
    paletteHexes: r.paletteHexes,
    stepCount: r.stepCount,
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
      <RecipesTable rows={vm} />
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
