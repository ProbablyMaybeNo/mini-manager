import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { cloneRecipeFromSlug } from "@/lib/actions/recipeSharing";

/**
 * POST /r/[slug]/clone
 *
 * Endpoint backing the `[ Clone to my recipes ]` button on the public
 * recipe view. Pure thin shim around `cloneRecipeFromSlug` — owner check,
 * deep-copy, and revalidation all live in the action.
 *
 *   - 401 when no session (CloneButton redirects to /sign-in)
 *   - 404 when the slug doesn't resolve OR the clone fails
 *   - 409 when the slug already belongs to the caller ("already yours")
 *   - 200 + `{ id }` on success
 *
 * Lives inside `/r/[slug]/` so the proxy matcher exclusion for `/r/*`
 * already covers it — no separate auth bypass needed.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { ok: false, error: "Sign in to clone this recipe." },
      { status: 401 },
    );
  }

  const result = await cloneRecipeFromSlug({ slug });
  if (!result.ok) {
    if (result.error === "This is already your recipe") {
      return NextResponse.json(result, { status: 409 });
    }
    if (result.error === "Recipe not found") {
      return NextResponse.json(result, { status: 404 });
    }
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json(result, { status: 200 });
}
