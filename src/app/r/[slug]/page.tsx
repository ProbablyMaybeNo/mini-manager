import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRecipeBySlug, getPaintMetaMap } from "@/db/queries/recipes";
import { techniqueLabel } from "@/lib/recipes/techniqueLabel";
import { Panel, Swatch } from "@/components/kit";
import { Logo } from "@/components/shell";

export const dynamic = "force-dynamic";

async function load(slug: string) {
  if (!slug || slug.length > 64) return null;
  return getRecipeBySlug(slug);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const recipe = await load(slug);
  if (!recipe) {
    return { title: "Recipe not found · The Mini Mainframe", robots: { index: false } };
  }
  return {
    title: `${recipe.name} · The Mini Mainframe`,
    description: `A paint recipe shared via The Mini Mainframe — ${recipe.slots.length} slot${recipe.slots.length === 1 ? "" : "s"}.`,
  };
}

/** Public, no-auth shared recipe view — composed from the kit primitives. */
export default async function PublicRecipePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [recipe, paintMeta] = await Promise.all([load(slug), getPaintMetaMap()]);
  if (!recipe) notFound();

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <header className="flex items-center gap-3">
        <Logo href="/" size={40} />
        <div>
          <h1 className="font-title text-title text-cyan text-glow-cyan">{recipe.name}</h1>
          <p className="font-body text-body text-fg">
            Shared paint recipe · {recipe.slots.length} slot
            {recipe.slots.length === 1 ? "" : "s"}
          </p>
        </div>
      </header>

      <Panel label="RECIPE" cornerTicks className="p-4">
        {recipe.slots.length === 0 ? (
          <p className="font-body text-body text-fg">No slots in this recipe yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {recipe.slots.map((s) => {
              const meta = s.paintId ? paintMeta.get(s.paintId) : null;
              const hex = meta?.hex ?? s.customColorHex ?? "#888888";
              return (
                <li key={s.id} className="flex items-center gap-3">
                  <Swatch hex={hex} size="lg" />
                  <div className="min-w-0">
                    <div className="font-body text-body text-fg">{meta?.label ?? hex}</div>
                    <div className="label-osd text-fg">
                      {techniqueLabel(s.technique)}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {recipe.notesMd ? (
        <Panel label="NOTES" className="p-4">
          <p className="whitespace-pre-wrap font-body text-body text-fg">
            {recipe.notesMd}
          </p>
        </Panel>
      ) : null}

      <footer className="text-center font-body text-body text-fg">
        Made with{" "}
        <a href="/" className="text-cyan hover:underline">
          The Mini Mainframe
        </a>
      </footer>
    </main>
  );
}
