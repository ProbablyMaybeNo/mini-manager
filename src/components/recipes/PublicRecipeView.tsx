import Link from "next/link";
import { getPaintMetaMap } from "@/db/queries/recipes";
import { techniqueLabel } from "@/components/recipes/TechniqueLabel";
import { AutoCloneOnMount, CloneButton } from "@/components/recipes/CloneButton";
import type { RecipeWithZones } from "@/lib/recipes/types";

interface Props {
  recipe: RecipeWithZones;
  /** Slug is passed in so the clone CTA / footer can reference the URL. */
  slug: string;
  /** True when the visitor is also the owner — clone button becomes a
   *  link back to the editor instead. */
  isOwner: boolean;
  /** When the URL carries `?clone=1` AND the visitor is signed-in, the
   *  view fires an auto-clone on mount instead of showing the manual
   *  button. */
  autoClone?: boolean;
}

/**
 * Server component — renders a published recipe read-only for anonymous
 * visitors. No client-side state. The clone CTA is delegated to a small
 * client component (P5.3) so this file stays SSR-friendly.
 */
export async function PublicRecipeView({
  recipe,
  slug,
  isOwner,
  autoClone = false,
}: Props) {
  const paintMeta = await getPaintMetaMap();

  return (
    <article className="max-w-3xl mx-auto px-4 md:px-6 py-8 space-y-8">
      <header className="space-y-3">
        <h1 className="font-mono text-2xl md:text-3xl font-semibold text-[var(--color-fg)]">
          {recipe.name}
        </h1>
        <div className="flex items-center gap-3 text-xs font-mono text-[var(--color-fg-muted)]">
          <span className="px-2 py-0.5 border border-[var(--color-border-strong)] uppercase tracking-wider">
            {recipe.bodyType}
          </span>
          <span aria-hidden>·</span>
          <span>
            {recipe.zones.length} zone
            {recipe.zones.length === 1 ? "" : "s"}
          </span>
        </div>
        {/* palette strip removed — same hex shown in each step row (UX-028) */}
      </header>

      {recipe.bodyType !== "infantry" ? (
        <p className="font-mono text-xs text-[var(--color-fg-muted)] italic">
          (Read-only view of a {recipe.bodyType} recipe — full silhouette
          editor in the app.)
        </p>
      ) : null}

      {recipe.zones.length === 0 ? (
        <p className="font-mono text-sm text-[var(--color-fg-muted)] italic">
          This recipe has no zones yet.
        </p>
      ) : (
        <section className="space-y-6">
          {recipe.zones.map((zone) => (
            <div
              key={zone.id}
              className="frame bg-[var(--color-bg-elevated)] p-4 md:p-5 space-y-3"
            >
              <h2 className="font-mono text-sm font-semibold uppercase tracking-wider text-[var(--color-green)]">
                {zone.name}
              </h2>
              {zone.steps.length === 0 ? (
                <p className="text-xs font-mono text-[var(--color-fg-subtle)] italic">
                  No steps recorded.
                </p>
              ) : (
                <ol className="space-y-2">
                  {zone.steps.map((step) => {
                    const meta = step.paintId
                      ? paintMeta.get(step.paintId) ?? null
                      : null;
                    const swatchHex =
                      step.customColorHex ?? meta?.hex ?? null;
                    return (
                      <li
                        key={step.id}
                        className="flex items-start gap-3 px-2 py-2 border border-[var(--color-border)] bg-[var(--color-bg-panel)]"
                      >
                        <span
                          aria-hidden
                          className="inline-block w-4 h-4 mt-0.5 border shrink-0"
                          style={{
                            background: swatchHex ?? "transparent",
                            borderColor: "var(--color-border-strong)",
                          }}
                        />
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-baseline gap-x-2 font-mono text-xs">
                            <span className="uppercase tracking-wider text-[var(--color-fg)]">
                              {techniqueLabel(step.technique)}
                            </span>
                            <span className="text-[var(--color-fg-muted)]">
                              {meta?.label
                                ? meta.label
                                : step.customColorHex
                                  ? "Custom mix"
                                  : "—"}
                            </span>
                            {swatchHex ? (
                              <span className="text-[var(--color-fg-subtle)]">
                                {swatchHex.toUpperCase()}
                              </span>
                            ) : null}
                          </div>
                          {step.notesMd ? (
                            <p className="text-xs font-mono italic text-[var(--color-fg-muted)] whitespace-pre-wrap">
                              {step.notesMd}
                            </p>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          ))}
        </section>
      )}

      {recipe.notesMd ? (
        <section className="frame bg-[var(--color-bg-elevated)] p-4 md:p-5 space-y-2">
          <h2 className="font-mono text-xs uppercase tracking-wider text-[var(--color-fg-muted)]">
            Notes
          </h2>
          <p className="font-mono text-sm text-[var(--color-fg)] whitespace-pre-wrap">
            {recipe.notesMd}
          </p>
        </section>
      ) : null}

      <footer className="border-t border-[var(--color-border)] pt-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:justify-between">
        {isOwner ? (
          <Link
            href={`/recipes/${recipe.id}`}
            className="font-mono text-sm uppercase tracking-wider px-4 py-2 border border-[var(--color-green)] text-[var(--color-green)] hover:bg-[color-mix(in_srgb,var(--color-green)_8%,transparent)] text-center"
          >
            [ Edit in Mini Manager ]
          </Link>
        ) : (
          <CloneButton slug={slug} />
        )}
        <div className="frame bg-[var(--color-bg-elevated)] px-4 py-3 space-y-2 text-center sm:text-left sm:max-w-xs">
          <p className="font-mono text-xs text-[var(--color-fg-muted)]">
            Mini Manager tracks every model from wishlist to complete and builds
            paint recipes from a 7k+ cross-brand library.
          </p>
          <Link
            href="/sign-in"
            className="inline-block font-mono text-xs uppercase tracking-wider px-3 py-1.5 border border-[var(--color-cyan)] text-[var(--color-cyan)] hover:bg-[color-mix(in_srgb,var(--color-cyan)_8%,transparent)]"
          >
            [ Sign up free ]
          </Link>
        </div>
      </footer>

      {autoClone && !isOwner ? <AutoCloneOnMount slug={slug} /> : null}
    </article>
  );
}
