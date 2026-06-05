import { notFound } from "next/navigation";
import Link from "next/link";
import { and, asc, eq, isNull } from "drizzle-orm";
import { currentUserId } from "@/lib/auth-stub";
import { db } from "@/db/client";
import {
  getPaintMetaMap,
  getRecipeWithSlots,
  listInspoForRecipe,
} from "@/db/queries/recipes";
import { listInventoryByUser } from "@/db/queries/inventory";
import { projects } from "@/db/schema";
import { RecipeHeader } from "@/components/recipes/RecipeHeader";
import { RecipeEditorClient } from "@/components/recipes/RecipeEditorClient";
import type { AssignProjectOption } from "@/components/recipes/RecipeActionsBar";
import type { SlotListItem } from "@/components/recipes/SlotList";
import type { MarkdownInput, MarkdownSlot } from "@/lib/recipes/markdown";

export const dynamic = "force-dynamic";

interface AttachmentSummary {
  kind: "project" | "standalone";
  label: string;
  href?: string;
}

async function resolveAttachment(
  recipe: { attachedProjectId: string | null },
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
  return { kind: "standalone", label: "Standalone" };
}

export default async function RecipeEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await currentUserId();
  const recipe = await getRecipeWithSlots(userId, id);
  if (!recipe) notFound();

  const [paintMeta, attachment, inventoryEntries, assignProjects, inspoRows] =
    await Promise.all([
      getPaintMetaMap(),
      resolveAttachment(recipe),
      listInventoryByUser(userId),
      // P12.4 — fetch the user's projects for the "Assign to project ▾"
      // dropdown in the recipe header. Non-archived only; alphabetical
      // by name. Top-level + nested both surface so the painter can
      // pick a unit or single-model child too.
      db
        .select({
          id: projects.id,
          name: projects.name,
          type: projects.type,
        })
        .from(projects)
        .where(
          and(eq(projects.ownerId, userId), isNull(projects.archivedAt)),
        )
        .orderBy(asc(projects.name)),
      // Item 4 — the recipe's saved inspo links / image URLs.
      listInspoForRecipe(recipe.id),
    ]);
  const assignProjectsOptions: ReadonlyArray<AssignProjectOption> =
    assignProjects.map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
    }));

  // Slim the flat slot list to what the editor client needs.
  const slotItems: SlotListItem[] = recipe.slots.map((slot) => {
    const meta = slot.paintId ? paintMeta.get(slot.paintId) : null;
    return {
      id: slot.id,
      paintId: slot.paintId,
      customColorHex: slot.customColorHex,
      swatchHex: slot.customColorHex ?? meta?.hex ?? null,
      paintLabel: meta?.label ?? null,
      technique: slot.technique,
    };
  });

  const ownedPaintIds = new Set<string>();
  // Item 2 — the slot side panel's WISHLIST / OWNED buttons need the
  // currently-selected paint's full inventory state, not just ownership.
  const inventoryByPaintId = new Map<
    string,
    { ownedCount: number; isWishlisted: boolean }
  >();
  inventoryEntries.forEach((entry, paintId) => {
    if (entry.ownedCount > 0) ownedPaintIds.add(paintId);
    inventoryByPaintId.set(paintId, {
      ownedCount: entry.ownedCount,
      isWishlisted: entry.isWishlisted,
    });
  });

  // Build a MarkdownInput for the share modal — resolves paint name + hex
  // server-side so the client doesn't need the catalog map. Pure-flat:
  // one section, one entry per slot.
  const markdownSlots: MarkdownSlot[] = recipe.slots.map((slot) => {
    const meta = slot.paintId ? paintMeta.get(slot.paintId) : undefined;
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
      technique: slot.technique,
      paintName,
      paintBrand,
      hex: slot.customColorHex ?? meta?.hex ?? null,
      notesMd: slot.notesMd,
    };
  });
  const markdownInput: MarkdownInput = {
    recipe: {
      name: recipe.name,
      bodyType: recipe.bodyType,
      notesMd: recipe.notesMd,
    },
    slots: markdownSlots,
  };

  return (
    // Item 5 — wider editor canvas (96rem, was 80rem) so the RECIPE SLOTS
    // grid can grow without squeezing RECIPE NOTES, and the full-width
    // Inspo table below has room to breathe. Explicit rem value (the
    // max-w-screen-* utilities were dropped in Tailwind v4).
    <div className="p-6 md:p-8 max-w-[96rem] space-y-6">
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
        assignProjects={assignProjectsOptions}
        share={{
          markdown: markdownInput,
          jsonPayload: {
            __exportVersion: 2,
            recipe: {
              id: recipe.id,
              name: recipe.name,
              bodyType: recipe.bodyType,
              notesMd: recipe.notesMd,
              slots: recipe.slots.map((slot) => ({
                technique: slot.technique,
                paintId: slot.paintId,
                customColorHex: slot.customColorHex,
                notesMd: slot.notesMd,
              })),
            },
          },
        }}
      />

      <RecipeEditorClient
        recipe={recipe}
        slots={slotItems}
        ownedPaintIds={ownedPaintIds}
        inventoryByPaintId={inventoryByPaintId}
        inspo={inspoRows.map((row) => ({
          id: row.id,
          url: row.url,
          label: row.label,
        }))}
      />
    </div>
  );
}
