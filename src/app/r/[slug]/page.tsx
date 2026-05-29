import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getRecipeBySlug } from "@/db/queries/recipes";
import { PublicRecipeView } from "@/components/recipes/PublicRecipeView";

export const dynamic = "force-dynamic";

interface Params {
  slug: string;
}

async function loadRecipe(slug: string) {
  // Slugs are 10-char lowercase; reject obvious garbage early so the DB
  // doesn't see an unbounded query string.
  if (!slug || slug.length > 64) return null;
  return getRecipeBySlug(slug);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const recipe = await loadRecipe(slug);
  if (!recipe) {
    return {
      title: "Recipe not found · Mini Manager",
      robots: { index: false, follow: false },
    };
  }

  const description = recipe.notesMd
    ? recipe.notesMd.slice(0, 200)
    : `A paint recipe shared via Mini Manager — ${recipe.zones.length} zone${
        recipe.zones.length === 1 ? "" : "s"
      }, ${recipe.bodyType}.`;

  return {
    title: `${recipe.name} · Mini Manager`,
    description,
    openGraph: {
      title: recipe.name,
      description,
      type: "article",
      siteName: "Mini Manager",
    },
    twitter: {
      card: "summary",
      title: recipe.name,
      description,
    },
  };
}

export default async function PublicRecipePage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<{ clone?: string }>;
}) {
  const { slug } = await params;
  const recipe = await loadRecipe(slug);
  if (!recipe) notFound();

  const session = await auth();
  const isOwner = Boolean(
    session?.user?.id && session.user.id === recipe.ownerId,
  );

  const { clone } = await searchParams;
  // Auto-clone only when the URL says so AND the visitor is signed in.
  // If unauth'd + clone=1, the auto-clone flow already kicked them to
  // sign-in earlier — landing here without a session means they bailed
  // and we should just render the normal view.
  const autoClone = clone === "1" && Boolean(session?.user?.id) && !isOwner;

  return (
    <PublicRecipeView
      recipe={recipe}
      slug={slug}
      isOwner={isOwner}
      autoClone={autoClone}
    />
  );
}
