import { auth } from "@/auth";
import { loadEditorRecipe, loadProjectsForPicker } from "@/lib/appData";
import type { Recipe } from "@/lib/types";
import { RecipeEditorClient } from "./RecipeEditorClient";
import { RecipeNotFound } from "./RecipeNotFound";

function blankRecipe(name: string): Recipe {
  return { id: "new", name: name || "Untitled recipe", slots: [], inspo: [], notes: "" };
}

/**
 * Recipe editor route — server component. Loads the real recipe (with its
 * slots resolved to swatches/labels) + the user's projects, then hands them to
 * the client editor. `id === "new"` starts a blank recipe (name pre-fillable
 * via ?name=).
 */
export default async function RecipeEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const session = await auth();
  const userId = session?.user?.id ?? null;

  const nameParam = typeof sp.name === "string" ? sp.name : "";
  const projects = userId ? await loadProjectsForPicker(userId) : [];

  if (id === "new") {
    return <RecipeEditorClient initial={blankRecipe(nameParam)} projects={projects} />;
  }

  const recipe = userId ? await loadEditorRecipe(userId, id) : null;
  if (!recipe) return <RecipeNotFound id={id} />;

  return <RecipeEditorClient initial={recipe} projects={projects} />;
}
