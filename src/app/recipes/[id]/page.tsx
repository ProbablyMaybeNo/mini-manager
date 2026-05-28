import { notFound } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { currentUserId } from "@/lib/auth-stub";
import { db } from "@/db/client";
import {
  getRecipeWithZones,
  paletteForRecipe,
} from "@/db/queries/recipes";
import { namedModels, projects } from "@/db/schema";
import { RecipeHeader } from "@/components/recipes/RecipeHeader";
import { RecipeEditorClient } from "@/components/recipes/RecipeEditorClient";
import type { ZoneListItem } from "@/components/recipes/ZoneList";

export const dynamic = "force-dynamic";

interface AttachmentSummary {
  kind: "project" | "named-model" | "standalone";
  label: string;
  href?: string;
}

async function resolveAttachment(
  recipe: { attachedProjectId: string | null; attachedNamedModelId: string | null },
): Promise<AttachmentSummary> {
  if (recipe.attachedProjectId) {
    const rows = await db
      .select({ name: projects.name })
      .from(projects)
      .where(eq(projects.id, recipe.attachedProjectId))
      .limit(1);
    const name = rows[0]?.name ?? "(unknown project)";
    return {
      kind: "project",
      label: name,
      href: `/projects/${recipe.attachedProjectId}`,
    };
  }
  if (recipe.attachedNamedModelId) {
    const rows = await db
      .select({
        name: namedModels.name,
        projectId: namedModels.projectId,
      })
      .from(namedModels)
      .where(eq(namedModels.id, recipe.attachedNamedModelId))
      .limit(1);
    const row = rows[0];
    if (row) {
      return {
        kind: "named-model",
        label: row.name,
        href: `/projects/${row.projectId}`,
      };
    }
    return { kind: "named-model", label: "(unknown model)" };
  }
  return { kind: "standalone", label: "Standalone" };
}

export default async function RecipeEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await currentUserId();
  const recipe = await getRecipeWithZones(userId, id);
  if (!recipe) notFound();

  const palette = await paletteForRecipe(recipe);
  const attachment = await resolveAttachment(recipe);

  // Slim the nested shape to what each client component actually needs.
  const zoneItems: ZoneListItem[] = recipe.zones.map((z) => {
    const firstStep = z.steps[0];
    const swatchHex =
      firstStep?.customColorHex ??
      (firstStep?.paintId
        ? palette.get(z.silhouetteZoneId ?? z.id) ?? null
        : null);
    return {
      id: z.id,
      name: z.name,
      silhouetteZoneId: z.silhouetteZoneId,
      stepCount: z.steps.length,
      swatchHex,
    };
  });

  const paletteBySilhouetteId = new Map<string, string>();
  for (const [key, hex] of palette) paletteBySilhouetteId.set(key, hex);

  const initialSelectedZoneId = zoneItems[0]?.id ?? null;

  return (
    <div className="p-6 md:p-8 max-w-7xl space-y-6">
      <nav className="text-xs font-mono text-[var(--color-fg-muted)]">
        <Link href="/recipes" className="hover:text-[var(--color-green)]">
          ← Recipes
        </Link>
        {" > "}
        <span className="text-[var(--color-fg)]">{recipe.name}</span>
      </nav>

      <RecipeHeader recipe={recipe} attachment={attachment} />

      <RecipeEditorClient
        recipe={recipe}
        zones={zoneItems}
        paletteBySilhouetteId={paletteBySilhouetteId}
        initialSelectedZoneId={initialSelectedZoneId}
      />
    </div>
  );
}
