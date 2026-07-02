"use server";

import { z } from "zod";
import { currentUserId } from "@/lib/auth-stub";
import { getServerCatalog } from "@/lib/paints/serverCatalog";
import { saveRecipe } from "@/lib/actions/saveRecipe";
import { updateRecipe } from "@/lib/actions/recipes";
import type { ActionResult } from "@/lib/actions/projects";
import {
  buildLayerRamp,
  groundRampToCatalog,
  groundedColorsToSlots,
  scoreHarmony,
  type LayerRamp,
} from "@/lib/recipes/generate";
import { getHarmonyMeta } from "@/lib/tools/wheel/harmonies";

/**
 * Colour-first recipe generation (the deterministic path).
 *
 * Given a handful of colours the painter picked on the wheel, build a tinted
 * layer ramp per colour, ground every step to the nearest real catalog paint by
 * ΔE2000, and persist the result as a normal recipe. Grounding happens HERE, on
 * the server, against the real catalog — the client never supplies paintIds, so
 * the same anti-hallucination guarantee the AI creator has holds by construction.
 *
 * NOT Pro-gated: this is the free, no-LLM hook. The optional LLM technique-notes
 * refinement is what will sit behind Pro.
 */

const inputSchema = z.object({
  hexes: z.array(z.string().regex(/^#?[0-9a-fA-F]{6}$/, "Not a 6-digit hex")).min(1).max(8),
  attachedProjectId: z.string().nullish(),
  /** Optional brand filter — restrict grounding to paints the painter owns/likes. */
  brands: z.array(z.string()).max(20).optional(),
});

/** Human-readable recipe notes describing what was generated + any caveats. */
function composeNotes(
  hexes: string[],
  schemeLabel: string,
  cohesion: number,
  clashes: string[],
  customCount: number,
): string {
  const lines = [
    `Generated from ${hexes.length} picked colour${hexes.length === 1 ? "" : "s"}: ${hexes
      .map((h) => h.toUpperCase())
      .join("  ")}`,
    `Scheme: ${schemeLabel} (${Math.round(cohesion * 100)}% cohesion).`,
    "Ramp per colour: shade → base → layer → highlight → edge. Shadows tinted cool, highlights tinted warm.",
  ];
  if (clashes.length > 0) {
    lines.push(`Heads-up: ${clashes.join(" ")}`);
  }
  if (customCount > 0) {
    lines.push(
      `${customCount} step${customCount === 1 ? "" : "s"} had no close catalog match and use a custom mix — swap in your nearest bottle.`,
    );
  }
  return lines.join("\n");
}

export async function generateRecipeFromColors(
  raw: unknown,
): Promise<ActionResult<{ id: string; slotCount: number; customCount: number }>> {
  // A session is required; saveRecipe scopes every write to the owner.
  await currentUserId();

  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid colours" };
  }
  const { hexes, attachedProjectId, brands } = parsed.data;

  const ramps = hexes
    .map((h) => buildLayerRamp(h))
    .filter((r): r is LayerRamp => r !== null);
  if (ramps.length === 0) {
    return { ok: false, error: "None of the colours could be parsed." };
  }

  const catalog = await getServerCatalog();
  const grounded = groundRampToCatalog(ramps, catalog, { brands });
  const slots = groundedColorsToSlots(grounded);
  if (slots.length === 0) {
    return { ok: false, error: "Couldn't build a recipe from those colours." };
  }

  const score = scoreHarmony(hexes);
  const schemeLabel = score.harmony ? getHarmonyMeta(score.harmony).label : "Custom";
  const name = score.harmony ? `${schemeLabel} scheme` : "Colour recipe";
  const customCount = slots.filter((s) => s.paintId === null).length;
  const notes = composeNotes(
    hexes,
    schemeLabel,
    score.cohesion,
    score.clashes.map((c) => c.reason),
    customCount,
  );

  const res = await saveRecipe({
    id: null,
    name,
    attachedProjectId: attachedProjectId ?? null,
    slots: slots.map((s) => ({ paintId: s.paintId, hex: s.hex, layer: s.layer })),
    inspo: [],
  });
  if (!res.ok) return res;

  await updateRecipe({ id: res.data.id, notesMd: notes });

  return { ok: true, data: { id: res.data.id, slotCount: slots.length, customCount } };
}
