import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { isProUser } from "@/lib/billing/enforce";
import { getServerCatalog } from "@/lib/paints/serverCatalog";
import { getInventoryByPaintId } from "@/db/queries/paintCoverage";
import { generateRecipe } from "@/lib/ai/recipeAi";
import {
  enforceDailyLimit,
  RateLimitBucket,
  recipeAiDailyLimit,
} from "@/lib/rateLimit/quota";

/**
 * POST /api/recipe/ai
 *
 * The AI Recipe Creator. Takes a natural-language command and returns a
 * paint recipe GROUNDED in the real catalog — Claude picks paintIds from a
 * brand-filtered candidate list, and every pick is validated against the
 * catalog server-side, so a hallucinated paint can never reach the response.
 *
 * Pro-gated via `isProUser` (inert while BILLING_ENFORCED is false — free
 * users get it until Stripe goes live). Needs ANTHROPIC_API_KEY in prod.
 *
 * Body:     { command: string }
 * 200:      { proposal: GroundedRecipeProposal, model }
 * 401/402:  auth / upgrade required
 */

const bodySchema = z.object({
  command: z.string().trim().min(1, "Describe what you want to paint.").max(600),
});

export async function POST(req: Request): Promise<NextResponse> {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  if (!userId) {
    return NextResponse.json({ error: "Sign in to use AI recipes." }, { status: 401 });
  }

  // Pro gate — inert until BILLING_ENFORCED flips at launch, but wired now so
  // the upgrade prompt is real the day billing turns on.
  if (!(await isProUser(userId))) {
    return NextResponse.json(
      {
        error: "AI Recipe Creator is a Pro feature — upgrade to generate recipes with AI.",
        upgradeUrl: "/pricing",
      },
      { status: 402 },
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be valid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  // Per-user daily quota (E7) — a hard ceiling on how many AI generations one
  // account can trigger in a day, independent of the billing flag. Metered
  // before the expensive catalog load + model call so an over-limit user is
  // refused cheaply.
  const quota = await enforceDailyLimit(
    RateLimitBucket.RecipeAi,
    userId,
    recipeAiDailyLimit(),
  );
  if (!quota.allowed) {
    return NextResponse.json(
      {
        error: `You've hit today's AI recipe limit (${quota.limit}/day). It resets tomorrow.`,
      },
      { status: 429 },
    );
  }

  const [catalog, inventory] = await Promise.all([
    getServerCatalog(),
    getInventoryByPaintId(userId),
  ]);

  const ownedPaintIds = new Set<string>();
  for (const [paintId, entry] of inventory) {
    if (entry.ownedCount > 0) ownedPaintIds.add(paintId);
  }

  const result = await generateRecipe(parsed.data.command, catalog, ownedPaintIds);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  return NextResponse.json({ proposal: result.proposal, model: result.model });
}
