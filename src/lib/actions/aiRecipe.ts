"use server";

import { z } from "zod";
import { currentUserId } from "@/lib/auth-stub";
import { isProUser } from "@/lib/billing/enforce";
import { getServerCatalog } from "@/lib/paints/serverCatalog";
import { saveRecipe } from "@/lib/actions/saveRecipe";
import { createWishlistItem } from "@/lib/actions/wishlist";
import { recipeRoles, ROLE_TO_TECHNIQUE, normaliseRole } from "@/lib/ai/recipeSchema";
import type { ActionResult } from "@/lib/actions/projects";

/**
 * Persistence actions for the AI Recipe Creator's confirmation card.
 *
 * SECURITY: the client posts back a proposal built from `/api/recipe/ai`, but
 * we never trust client-supplied paintIds — every paintId is RE-VALIDATED
 * against the real catalog here before anything is written. A forged or stale
 * id is dropped, so the same anti-hallucination guarantee that protects the
 * generate path also protects the save path.
 *
 * Both actions are Pro-gated (inert while BILLING_ENFORCED is false).
 */

const slotSchema = z.object({
  role: z.string(),
  paintId: z.string().min(1),
  note: z.string().optional(),
});

const proposalSchema = z.object({
  summary: z.string().optional(),
  techniqueNotes: z.string().optional(),
  slots: z.array(slotSchema).min(1),
});

/** Compose the recipe name from the summary's first clause, capped. */
function recipeNameFromSummary(summary: string | undefined): string {
  const s = (summary ?? "").trim();
  if (!s) return "AI recipe";
  const firstSentence = s.split(/[.!?\n]/)[0]?.trim() ?? s;
  return firstSentence.slice(0, 80) || "AI recipe";
}

/**
 * Build a real recipe from an approved AI proposal. Re-grounds every slot's
 * paintId against the catalog, fills the slot list, writes the technique
 * notes into the recipe notes, and persists via the existing `saveRecipe`
 * path (same write the manual editor uses).
 */
export async function saveRecipeFromAi(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const userId = await currentUserId();
  if (!(await isProUser(userId))) {
    return { ok: false, error: "The AI Recipe Creator unlocks when you sponsor the Mainframe.", upgradeUrl: "/pricing" };
  }

  const parsed = proposalSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid proposal" };
  }

  const catalog = await getServerCatalog();
  const byId = new Map(catalog.map((p) => [p.id, p]));

  const slots = parsed.data.slots
    .map((s) => {
      const paint = byId.get(s.paintId);
      if (!paint) return null; // re-grounding gate — drop unknown ids
      const role = (recipeRoles as readonly string[]).includes(s.role)
        ? (s.role as (typeof recipeRoles)[number])
        : normaliseRole(s.role);
      return {
        paintId: paint.id,
        hex: paint.hex,
        layer: ROLE_TO_TECHNIQUE[role],
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  if (slots.length === 0) {
    return { ok: false, error: "None of the proposed paints matched the catalog." };
  }

  const notes = (parsed.data.techniqueNotes ?? "").trim();
  const name = recipeNameFromSummary(parsed.data.summary);

  const result = await saveRecipe({
    id: null,
    name,
    slots,
    inspo: [],
  });
  if (!result.ok) return result;

  // saveRecipe doesn't take recipe-level notes; write the technique notes via
  // the same create path's follow-up. Reuse updateRecipe through saveRecipe's
  // sibling action for a single round trip would be ideal, but saveRecipe
  // already created the row — patch its notes now.
  if (notes) {
    const { updateRecipe } = await import("@/lib/actions/recipes");
    await updateRecipe({ id: result.data.id, notesMd: notes });
  }

  return { ok: true, data: { id: result.data.id } };
}

/**
 * Add the not-owned catalog paints from a proposal to the wishlist. Each id
 * is re-validated against the catalog, then created via the existing
 * `createWishlistItem` path (which applies the free-tier cap + kind
 * inference). Returns the count actually added.
 */
export async function wishlistMissingPaints(
  rawIds: unknown,
): Promise<ActionResult<{ added: number }>> {
  const userId = await currentUserId();
  if (!(await isProUser(userId))) {
    return { ok: false, error: "The AI Recipe Creator unlocks when you sponsor the Mainframe.", upgradeUrl: "/pricing" };
  }

  const parsed = z.array(z.string().min(1)).max(24).safeParse(rawIds);
  if (!parsed.success) return { ok: false, error: "Invalid paint list" };

  const catalog = await getServerCatalog();
  const byId = new Map(catalog.map((p) => [p.id, p]));

  let added = 0;
  for (const id of parsed.data) {
    const paint = byId.get(id);
    if (!paint) continue; // re-grounding gate
    const res = await createWishlistItem({
      title: `${paint.brand} ${paint.name}`,
      company: paint.brand,
      kind: "paint",
      status: "WISHLIST",
    });
    if (res.ok) added += 1;
    else if ("upgradeUrl" in res) {
      // Hit the free-tier cap — stop and report what we managed.
      break;
    }
  }

  return { ok: true, data: { added } };
}
