import { NewRecipeButton } from "@/components/recipes/NewRecipeButton";

export default function RecipesPage() {
  return (
    <div className="p-6 md:p-8 max-w-6xl space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl">┌─ RECIPES ─</h1>
          <p className="text-sm text-[var(--color-fg-muted)] mt-2 max-w-xl font-sans">
            Paint schemes the way you mix them — ordered zones × technique
            stacks × pinned paints. Attach to a project, attach to a named
            model, or stand alone.
          </p>
        </div>
        <NewRecipeButton />
      </header>

      <p className="text-xs font-sans text-[var(--color-fg-muted)] frame px-3 py-3">
        Standalone + attached grids land in P3.7. Use{" "}
        <span className="font-mono">[ + ] New recipe</span> above to jump
        straight into the editor.
      </p>
    </div>
  );
}
