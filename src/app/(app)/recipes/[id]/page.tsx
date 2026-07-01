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
  const fromParam = typeof sp.from === "string" ? sp.from : null;
  const projects = userId ? await loadProjectsForPicker(userId) : [];

  /** Resolve the project this recipe should "‹ back to" — the explicit ?from=
   *  hand-off (create-from-project) wins, else the recipe's own attachment.
   *  Only surfaced when the project is actually in the user's tree. */
  const backTo = (() => {
    if (id === "new") return undefined;
    // resolved below once the recipe loads for the attachedProjectId fallback.
    return fromParam
      ? projects.find((p) => p.id === fromParam)
      : undefined;
  })();

  if (id === "new") {
    return <RecipeEditorClient initial={blankRecipe(nameParam)} projects={projects} />;
  }

  const recipe = userId ? await loadEditorRecipe(userId, id) : null;
  if (!recipe) return <RecipeNotFound id={id} />;

  const backProject =
    backTo ??
    (recipe.assignedProjectId
      ? projects.find((p) => p.id === recipe.assignedProjectId)
      : undefined);

  return (
    <RecipeEditorClient
      initial={recipe}
      projects={projects}
      backTo={backProject ? { projectId: backProject.id, title: backProject.title } : undefined}
    />
  );
}
