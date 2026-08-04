/**
 * R4-5 — recipe naming, and the one place it is load-bearing.
 *
 * A new recipe auto-names itself, exactly the way a new project does ("New
 * Project"). That is deliberate and stays: an unsaved draft the painter has to
 * name before it will save is friction on the private half of the app, and the
 * server already refuses a genuinely blank name (`createRecipe`'s
 * `z.string().trim().min(1)`).
 *
 * The difference from a project is where the name ends up. The recipe share
 * card puts it up as the headline, under the MINI-MAINFRAME wordmark and above
 * mini-mainframe.com, and "Post to gallery" publishes that card to the curated
 * public surface. "New Project" on the roster is a lazy name; "UNTITLED
 * RECIPE" on the community gallery is the site's own branding around a
 * placeholder. So the guard sits at the outward-facing boundary, not on Save.
 */

/** The auto-name a brand-new recipe carries until the painter renames it. */
export const PLACEHOLDER_RECIPE_NAME = "Untitled recipe";

/** Has the painter actually named this recipe, or is it still the auto-name? */
export function isNamedRecipe(name: string | null | undefined): boolean {
  const trimmed = (name ?? "").trim();
  return (
    trimmed.length > 0 &&
    trimmed.toLowerCase() !== PLACEHOLDER_RECIPE_NAME.toLowerCase()
  );
}

/**
 * One wording for the guard, shared by the composer's caption, its click
 * refusal and the server action — so the explanation a painter reads is the
 * same sentence wherever they hit it.
 */
export const UNNAMED_RECIPE_GALLERY_ERROR =
  "Give this recipe a name before posting it to the gallery — the name is the card's headline.";
