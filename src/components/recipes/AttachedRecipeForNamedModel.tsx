import { eq } from "drizzle-orm";
import { currentUserId } from "@/lib/auth-stub";
import { db } from "@/db/client";
import {
  getRecipeWithZones,
  listRecipesForNamedModel,
  paletteForRecipe,
} from "@/db/queries/recipes";
import { namedModels, projects, recipes } from "@/db/schema";
import type { Recipe } from "@/db/schema";
import { AttachRecipeTrigger } from "@/components/recipes/AttachRecipeTrigger";
import { NamedModelOverrideSummary } from "@/components/recipes/NamedModelOverrideSummary";
import type { RecipeOption } from "@/components/recipes/AttachRecipeModal";

async function buildCandidatesForNamedModel(
  userId: string,
  namedModelId: string,
): Promise<ReadonlyArray<RecipeOption>> {
  const rows = await db
    .select()
    .from(recipes)
    .where(eq(recipes.ownerId, userId));

  const projectRows = await db.select().from(projects).where(eq(projects.ownerId, userId));
  const projectNameById = new Map(projectRows.map((p) => [p.id, p.name]));
  const nmRows = await db.select().from(namedModels);
  const nmNameById = new Map(nmRows.map((m) => [m.id, m.name]));

  return rows
    .filter((r) => r.attachedNamedModelId !== namedModelId)
    .map<RecipeOption>((r) => {
      let label: string | null = null;
      if (r.attachedProjectId) {
        label = projectNameById.get(r.attachedProjectId) ?? "(project)";
      } else if (r.attachedNamedModelId) {
        label = nmNameById.get(r.attachedNamedModelId) ?? "(unit)";
      }
      return { id: r.id, name: r.name, attachmentLabel: label };
    });
}

/**
 * Slim attached-recipe slot for a NamedModel row. v1 default behaviour
 * is "inherit the unit's recipe" — when the painter wants to override
 * a single hero / character with a different scheme, they attach a
 * recipe here and it overrides the unit's recipe FOR THAT MODEL only.
 *
 * Server component: fetches the override (if any) + the candidate pool.
 */
export async function AttachedRecipeForNamedModel({
  namedModelId,
}: {
  namedModelId: string;
}) {
  const userId = await currentUserId();
  const overrides = await listRecipesForNamedModel(userId, namedModelId);
  const candidates = await buildCandidatesForNamedModel(
    userId,
    namedModelId,
  );

  const override = overrides[0] ?? null;

  if (!override) {
    return (
      <div className="flex items-center justify-between gap-3 text-2xs font-mono">
        <span className="text-[var(--color-fg-muted)] uppercase tracking-wider">
          uses unit recipe
        </span>
        <AttachRecipeTrigger
          mode="named-model"
          namedModelId={namedModelId}
          candidates={candidates}
          variant="subtle"
          label="Override"
        />
      </div>
    );
  }

  return (
    <OverrideBlock override={override} />
  );
}

async function OverrideBlock({ override }: { override: Recipe }) {
  const userId = await currentUserId();
  const full = await getRecipeWithZones(userId, override.id);
  const palette = full ? await paletteForRecipe(full) : new Map<string, string>();
  const zones = full
    ? full.zones.map((z) => ({
        id: z.id,
        name: z.name,
        silhouetteZoneId: z.silhouetteZoneId,
        stepCount: z.steps.length,
        swatchHex:
          z.steps[0]?.customColorHex ??
          (z.silhouetteZoneId ? palette.get(z.silhouetteZoneId) ?? null : null) ??
          palette.get(z.id) ??
          null,
      }))
    : [];

  return <NamedModelOverrideSummary recipe={override} zones={zones} />;
}
