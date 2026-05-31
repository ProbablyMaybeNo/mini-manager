import { eq } from "drizzle-orm";
import { currentUserId } from "@/lib/auth-stub";
import { db } from "@/db/client";
import { listAllRecipesGrouped } from "@/db/queries/recipes";
import { namedModels, projects } from "@/db/schema";
import { NewRecipeButton } from "@/components/recipes/NewRecipeButton";
import { RecipeCard } from "@/components/recipes/RecipeCard";
import { AccentCounter } from "@/components/ui/AccentCounter";

export const dynamic = "force-dynamic";

export default async function RecipesPage() {
  const userId = await currentUserId();
  const grouped = await listAllRecipesGrouped(userId);

  const projectIds = grouped.byProject.map((g) => g.projectId);
  const namedModelIds = grouped.byNamedModel.map((g) => g.namedModelId);

  const projectNameById = new Map<string, string>();
  if (projectIds.length > 0) {
    const rows = await db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(eq(projects.ownerId, userId));
    for (const r of rows) projectNameById.set(r.id, r.name);
  }

  const namedModelLabelById = new Map<string, string>();
  if (namedModelIds.length > 0) {
    const rows = await db
      .select({
        id: namedModels.id,
        name: namedModels.name,
        projectName: projects.name,
      })
      .from(namedModels)
      .innerJoin(projects, eq(projects.id, namedModels.projectId))
      .where(eq(projects.ownerId, userId));
    for (const r of rows) {
      namedModelLabelById.set(r.id, `${r.projectName} · ${r.name}`);
    }
  }

  const isEmpty =
    grouped.standalone.length === 0 &&
    grouped.byProject.length === 0 &&
    grouped.byNamedModel.length === 0;

  if (isEmpty) {
    return (
      <div className="p-6 md:p-8 max-w-6xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl tracking-wide">RECIPES</h1>
          <p className="text-sm text-[var(--color-fg-muted)] max-w-xl font-sans leading-snug">
            Paint schemes the way you mix them — each recipe is a stack of
            colour slots, each slot a paint plus the technique you use on it.
          </p>
        </header>
        <EmptyState />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-6xl space-y-8">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl tracking-wide">RECIPES</h1>
          <p className="text-sm text-[var(--color-fg-muted)] mt-2 max-w-xl font-sans leading-snug">
            Paint schemes the way you mix them — each recipe is a stack of
            colour slots. Attach a recipe to a project, override it per
            named model, or save it standalone.
          </p>
        </div>
        <NewRecipeButton />
      </header>

      {grouped.standalone.length > 0 ? (
        <section className="space-y-3">
          <h2 className="section-title">Standalone · {grouped.standalone.length}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {grouped.standalone.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                attachment={{ kind: "standalone", label: "Standalone" }}
              />
            ))}
          </div>
        </section>
      ) : null}

      {grouped.byProject.length > 0 ? (
        <section className="space-y-3">
          <h2 className="section-title">
            Attached to projects ·{" "}
            {grouped.byProject.reduce((acc, g) => acc + g.recipes.length, 0)}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {grouped.byProject.flatMap((group) =>
              group.recipes.map((recipe) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  attachment={{
                    kind: "project",
                    label: projectNameById.get(group.projectId) ?? "Project",
                  }}
                />
              )),
            )}
          </div>
        </section>
      ) : null}

      {grouped.byNamedModel.length > 0 ? (
        <NamedModelSection
          byNamedModel={grouped.byNamedModel}
          labelById={namedModelLabelById}
        />
      ) : null}
    </div>
  );
}

function NamedModelSection({
  byNamedModel,
  labelById,
}: {
  byNamedModel: ReadonlyArray<{
    namedModelId: string;
    recipes: ReadonlyArray<import("@/db/schema").Recipe>;
  }>;
  labelById: ReadonlyMap<string, string>;
}) {
  const total = byNamedModel.reduce((acc, g) => acc + g.recipes.length, 0);
  return (
    <section className="space-y-3">
      <details>
        <summary className="section-title cursor-pointer list-none flex items-center gap-2">
          <span aria-hidden className="text-[var(--color-fg-subtle)]">▸</span>
          <span>Attached to named models · {total}</span>
        </summary>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-3">
          {byNamedModel.flatMap((group) =>
            group.recipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                attachment={{
                  kind: "named-model",
                  label: labelById.get(group.namedModelId) ?? "Named model",
                }}
              />
            )),
          )}
        </div>
      </details>
    </section>
  );
}

function EmptyState() {
  return (
    <div className="relative frame p-8 text-center space-y-4 overflow-hidden">
      <AccentCounter value="03" />
      <h2 className="text-lg glow-cyan">No recipes yet</h2>
      <p className="text-sm text-[var(--color-fg-muted)] font-sans max-w-md mx-auto leading-snug">
        Build your first scheme: add a colour slot, pin a paint from the
        library, pick a technique. Attach it to an army when you&apos;re
        ready, or keep it as a saved palette.
      </p>
      <NewRecipeButton label="Create your first recipe" />
    </div>
  );
}
