import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getRecipeBySlug, getPaintMetaMap } from "@/db/queries/recipes";
import { techniqueLabel } from "@/lib/recipes/techniqueLabel";
import { Panel, Swatch } from "@/components/kit";
import { Logo } from "@/components/shell";
import { ShareLinkBar } from "@/components/public/ShareLinkBar";
import { CloneButton } from "@/components/recipe/CloneButton";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbJsonLd } from "@/lib/seo/structuredData";
import { SUPPORT_EMAIL } from "@/lib/support";
import { TrackPageView } from "@/components/analytics/TrackPageView";
import { AnalyticsEvent } from "@/lib/analytics/events";

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
  const title = `${recipe.name} · The Mini Mainframe`;
  const description = `A paint recipe shared via The Mini Mainframe — ${recipe.slots.length} slot${recipe.slots.length === 1 ? "" : "s"}.`;

  // No `openGraph.images` / `twitter.images` here on purpose — this
  // route's `opengraph-image.tsx` (file-convention image) resolves the
  // real image per-slug: the admin-approved gallery card PNG when one
  // exists, else a generated name+swatches fallback. Next wires that file
  // into both `og:image` and `twitter:image` automatically.
  //
  // R2-13 — the `twitter` block has to be spelled out even though it just
  // mirrors `openGraph`. The root layout declares a global `twitter:` block,
  // and per the X cards spec `twitter:*` beats `og:*` wherever both are
  // present — so overriding only `openGraph` left every shared recipe
  // unfurling on X as the generic product page instead of the recipe someone
  // wanted to show off. The picture was already right; the title undid it.
  //
  // `card` is repeated rather than inherited: Next replaces a declared
  // metadata field wholesale rather than merging into the parent's, so a
  // `twitter` block without it drops `summary_large_image` back to the small
  // card — which would trade a wrong title for a shrunken picture.
  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

/**
 * Public, no-auth recipe CARD — a clean, self-contained visual view of a
 * shared recipe (unlisted: reachable only via the direct link, never
 * surfaced on /gallery — see `recipes.isListed`). Top-to-bottom: title, the
 * shareable link itself, the paint squares, then the recipe's notes.
 */
export default async function PublicRecipePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [recipe, paintMeta, session] = await Promise.all([
    load(slug),
    getPaintMetaMap(),
    auth(),
  ]);
  if (!recipe) notFound();
  const isSignedIn = Boolean(session?.user?.id);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <TrackPageView event={AnalyticsEvent.RecipeCardView} props={{ slug }} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Recipe Gallery", path: "/gallery" },
          { name: recipe.name, path: `/r/${slug}` },
        ])}
      />
      <Logo href="/" size={36} />

      {/* TITLE — the recipe's name, top of the card. */}
      <header className="flex flex-col gap-2">
        <h1 className="font-mono text-title font-bold text-cyan-lite text-glow-cyan">{recipe.name}</h1>
        <p className="font-body text-body text-fg">
          Shared paint recipe · {recipe.slots.length} slot
          {recipe.slots.length === 1 ? "" : "s"}
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        {/* The shareable link itself — shown + copyable, directly under the title. */}
        <ShareLinkBar path={`/r/${slug}`} />
        <CloneButton slug={slug} isSignedIn={isSignedIn} size="sm" />
      </div>

      <Panel label="RECIPE" className="p-4">
        {recipe.slots.length === 0 ? (
          <p className="font-body text-body text-fg">No slots in this recipe yet.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {recipe.slots.map((s) => {
              const meta = s.paintId ? paintMeta.get(s.paintId) : null;
              const hex = meta?.hex ?? s.customColorHex ?? "#888888";
              // Custom-colour slots (no catalog paintId) still render
              // gracefully: the hex stands in for the name, and the meta
              // line drops the company/type fields it doesn't have.
              const name = meta?.name ?? hex;
              const metaParts = [techniqueLabel(s.technique)];
              if (meta) {
                if (meta.brand) metaParts.push(meta.brand);
                metaParts.push(meta.type);
              } else {
                metaParts.push("Custom colour");
              }
              return (
                <li
                  key={s.id}
                  className="flex items-center gap-3 rounded-[8px] border border-border bg-bg/40 p-3"
                >
                  <Swatch hex={hex} size="lg" className="h-14 w-14 shrink-0 rounded-[6px]" />
                  <div className="min-w-0">
                    <div className="break-words font-mono text-body font-bold text-fg-bright">
                      {name}
                    </div>
                    <div className="break-words font-mono text-[11px] uppercase tracking-wide text-fg-dim">
                      {metaParts.join(" · ")}
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

      <footer className="mt-auto pt-4 text-center font-body text-body text-fg">
        Made with{" "}
        <Link href="/" className="text-cyan-lite underline">
          The Mini Mainframe
        </Link>{" "}
        ·{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="text-cyan-lite underline">
          Contact
        </a>
      </footer>
    </main>
  );
}
