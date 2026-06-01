import { eq } from "drizzle-orm";
import { currentUserId } from "@/lib/auth-stub";
import { db } from "@/db/client";
import {
  getRecipeWithZones,
  listRecipesForProject,
  paletteForRecipe,
} from "@/db/queries/recipes";
import { projects, recipes } from "@/db/schema";
import type { Recipe } from "@/db/schema";
import { AttachRecipeTrigger } from "@/components/recipes/AttachRecipeTrigger";
import { AttachedRecipeSummary } from "@/components/recipes/AttachedRecipeSummary";
import type { RecipeOption } from "@/components/recipes/AttachRecipeModal";
import { Card } from "@/components/ui/Card";

/**
 * Build the candidate list shown in AttachRecipeModal — every recipe
 * the user owns except those already attached to THIS project (showing
 * them again would be confusing — they're already in the workspace).
 * Already-attached-elsewhere recipes are included with a heads-up so
 * picking them MOVES the attachment.
 *
 * P13.4 — the named-model attachment branch is gone since recipes can
 * only attach to projects now.
 */
async function buildCandidatesForProject(
  userId: string,
  projectId: string,
): Promise<ReadonlyArray<RecipeOption>> {
  const rows = await db
    .select()
    .from(recipes)
    .where(eq(recipes.ownerId, userId));

  const projectRows = await db
    .select()
    .from(projects)
    .where(eq(projects.ownerId, userId));
  const projectNameById = new Map(projectRows.map((p) => [p.id, p.name]));

  return rows
    .filter((r) => r.attachedProjectId !== projectId)
    .map<RecipeOption>((r) => ({
      id: r.id,
      name: r.name,
      attachmentLabel: r.attachedProjectId
        ? projectNameById.get(r.attachedProjectId) ?? "(project)"
        : null,
    }));
}

/**
 * Server component. Renders the attached-recipe slot for a project
 * workspace. When none is attached, shows the trigger button only;
 * when one IS attached, renders a read-only summary inline + edit /
 * detach actions.
 */
export async function AttachedRecipePanel({
  projectId,
}: {
  projectId: string;
}) {
  const userId = await currentUserId();
  const attached = await listRecipesForProject(userId, projectId);
  const candidates = await buildCandidatesForProject(userId, projectId);

  if (attached.length === 0) {
    return (
      <Card
        title="Recipe"
        headerActions={
          <AttachRecipeTrigger
            projectId={projectId}
            candidates={candidates}
          />
        }
      >
        <p className="text-xs font-sans text-[var(--color-fg-muted)] leading-snug">
          Attach a paint recipe to drive your scheme. Each colour slot
          maps to a paint and the technique you&apos;ll use on it.
        </p>
      </Card>
    );
  }

  return (
    <Card
      title={`Recipe${attached.length > 1 ? "s" : ""} · ${attached.length}`}
      headerActions={
        <AttachRecipeTrigger
          projectId={projectId}
          candidates={candidates}
          label="Attach another"
          variant="subtle"
        />
      }
    >
      <div className="space-y-3">
        {attached.map((recipe) => (
          <AttachedRecipeBlock key={recipe.id} recipe={recipe} />
        ))}
      </div>
    </Card>
  );
}

async function AttachedRecipeBlock({ recipe }: { recipe: Recipe }) {
  const userId = await currentUserId();
  const full = await getRecipeWithZones(userId, recipe.id);
  if (!full) return null;
  const palette = await paletteForRecipe(full);
  return (
    <AttachedRecipeSummary
      recipe={recipe}
      zones={full.zones.map((z) => ({
        id: z.id,
        name: z.name,
        silhouetteZoneId: z.silhouetteZoneId,
        stepCount: z.steps.length,
        swatchHex:
          z.steps[0]?.customColorHex ??
          (z.silhouetteZoneId ? palette.get(z.silhouetteZoneId) ?? null : null) ??
          palette.get(z.id) ??
          null,
      }))}
      editHref={`/recipes/${recipe.id}` as `/recipes/${string}`}
    />
  );
}
