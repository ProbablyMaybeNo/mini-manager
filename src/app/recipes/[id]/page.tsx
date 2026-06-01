import { notFound } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { currentUserId } from "@/lib/auth-stub";
import { db } from "@/db/client";
import {
  getPaintMetaMap,
  getRecipeWithZones,
} from "@/db/queries/recipes";
import { listInventoryByUser } from "@/db/queries/inventory";
import { namedModels, projects } from "@/db/schema";
import { RecipeHeader } from "@/components/recipes/RecipeHeader";
import { RecipeEditorClient } from "@/components/recipes/RecipeEditorClient";
import type { ZoneListItem } from "@/components/recipes/ZoneList";
import type { StepRowData } from "@/components/recipes/StepRow";
import type { MarkdownInput, MarkdownZone } from "@/lib/recipes/markdown";

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

  const [paintMeta, attachment, inventoryEntries] = await Promise.all([
    getPaintMetaMap(),
    resolveAttachment(recipe),
    listInventoryByUser(userId),
  ]);

  // Slim the nested shape to what each client component actually needs.
  const zoneItems: ZoneListItem[] = recipe.zones.map((z) => {
    const firstStep = z.steps[0];
    const swatchHex =
      firstStep?.customColorHex ??
      (firstStep?.paintId
        ? paintMeta.get(firstStep.paintId)?.hex ?? null
        : null);
    return {
      id: z.id,
      name: z.name,
      silhouetteZoneId: z.silhouetteZoneId,
      stepCount: z.steps.length,
      swatchHex,
      // P12.2 — the ColorPicker side panel needs this to call
      // updateStep when the painter swaps the paint on an already-
      // filled slot. null when the slot has no step yet (rare; can
      // happen mid-edit if a step was deleted but the zone wasn't).
      firstStepId: firstStep?.id ?? null,
      // P12.3 — the slot's layer chip (top-right corner) renders this
      // and the side-panel layer selector defaults to it. The picker
      // surfaces the locked Phase-12 layer set; this technique is
      // typed widely (full TechniqueKey union) so legacy values from
      // older recipes still display.
      firstStepTechnique: firstStep?.technique ?? null,
    };
  });

  const stepsByZoneId = new Map<string, StepRowData[]>();
  for (const z of recipe.zones) {
    const rows: StepRowData[] = z.steps.map((s) => {
      const meta = s.paintId ? paintMeta.get(s.paintId) : null;
      return {
        id: s.id,
        technique: s.technique,
        paintId: s.paintId,
        customColorHex: s.customColorHex,
        swatchHex: s.customColorHex ?? meta?.hex ?? null,
        paintLabel: meta?.label ?? null,
        notesMd: s.notesMd,
      };
    });
    stepsByZoneId.set(z.id, rows);
  }

  const ownedPaintIds = new Set<string>();
  inventoryEntries.forEach((entry, paintId) => {
    if (entry.ownedCount > 0) ownedPaintIds.add(paintId);
  });

  const initialSelectedZoneId = zoneItems[0]?.id ?? null;

  // Build a MarkdownInput for the share modal — resolves paint name + hex
  // server-side so the client doesn't need the catalog map.
  const markdownZones: MarkdownZone[] = recipe.zones.map((z) => ({
    name: z.name,
    steps: z.steps.map((s) => {
      const meta = s.paintId ? paintMeta.get(s.paintId) : undefined;
      let paintBrand: string | null = null;
      let paintName: string | null = null;
      if (meta?.label) {
        // `meta.label` is `"<Brand> <Name>"` (see getPaintMetaMap). Split on
        // the first space so the markdown can show "Brand Name `#HEX`".
        const idx = meta.label.indexOf(" ");
        if (idx > 0) {
          paintBrand = meta.label.slice(0, idx);
          paintName = meta.label.slice(idx + 1);
        } else {
          paintName = meta.label;
        }
      }
      return {
        technique: s.technique,
        paintName,
        paintBrand,
        hex: s.customColorHex ?? meta?.hex ?? null,
        notesMd: s.notesMd,
      };
    }),
  }));
  const markdownInput: MarkdownInput = {
    recipe: {
      name: recipe.name,
      bodyType: recipe.bodyType,
      notesMd: recipe.notesMd,
    },
    zones: markdownZones,
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl space-y-6">
      <nav className="text-xs font-mono text-[var(--color-fg-muted)]">
        <Link href="/recipes" className="hover:text-[var(--color-accent)]">
          ← Recipes
        </Link>
        {" > "}
        <span className="text-[var(--color-fg)]">{recipe.name}</span>
      </nav>

      <RecipeHeader
        recipe={recipe}
        attachment={attachment}
        share={{
          markdown: markdownInput,
          jsonPayload: {
            __exportVersion: 1,
            recipe: {
              id: recipe.id,
              name: recipe.name,
              bodyType: recipe.bodyType,
              notesMd: recipe.notesMd,
              zones: recipe.zones.map((z) => ({
                name: z.name,
                silhouetteZoneId: z.silhouetteZoneId,
                steps: z.steps.map((s) => ({
                  technique: s.technique,
                  paintId: s.paintId,
                  customColorHex: s.customColorHex,
                  notesMd: s.notesMd,
                })),
              })),
            },
          },
        }}
      />

      <RecipeEditorClient
        recipe={recipe}
        zones={zoneItems}
        initialSelectedZoneId={initialSelectedZoneId}
        stepsByZoneId={stepsByZoneId}
        ownedPaintIds={ownedPaintIds}
      />
    </div>
  );
}
