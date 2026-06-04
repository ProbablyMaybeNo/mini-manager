import { getPaintMetaMap } from "@/db/queries/recipes";
import { techniqueLabel } from "@/components/recipes/TechniqueLabel";
import { AutoCloneOnMount, CloneButton } from "@/components/recipes/CloneButton";
import type { RecipeWithSlots } from "@/lib/recipes/types";
import { Button } from "@/components/ui/Button";

interface Props {
  recipe: RecipeWithSlots;
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
            {recipe.slots.length} slot
            {recipe.slots.length === 1 ? "" : "s"}
          </span>
        </div>
        {/* palette strip removed — same hex shown in each slot row (UX-028) */}
      </header>

      {recipe.slots.length === 0 ? (
        <p className="font-mono text-sm text-[var(--color-fg-muted)] italic">
          This recipe has no slots yet.
        </p>
      ) : (
        <section className="frame bg-[var(--color-bg-elevated)] p-4 md:p-5">
          <ol className="space-y-2">
            {recipe.slots.map((slot) => {
              const meta = slot.paintId
                ? paintMeta.get(slot.paintId) ?? null
                : null;
              const swatchHex = slot.customColorHex ?? meta?.hex ?? null;
              return (
                <li
                  key={slot.id}
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
                        {techniqueLabel(slot.technique)}
                      </span>
                      <span className="text-[var(--color-fg-muted)]">
                        {meta?.label
                          ? meta.label
                          : slot.customColorHex
                            ? "Custom mix"
                            : "—"}
                      </span>
                      {swatchHex ? (
                        <span className="text-[var(--color-fg-subtle)]">
                          {swatchHex.toUpperCase()}
                        </span>
                      ) : null}
                    </div>
                    {slot.notesMd ? (
                      <p className="text-xs font-mono italic text-[var(--color-fg-muted)] whitespace-pre-wrap">
                        {slot.notesMd}
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
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
          <Button as="a" href={`/recipes/${recipe.id}`} variant="primary" size="sm">
            Edit in Mini Manager
          </Button>
        ) : (
          <CloneButton slug={slug} />
        )}
        <div className="frame bg-[var(--color-bg-elevated)] px-4 py-3 space-y-2 text-center sm:text-left sm:max-w-xs">
          <p className="font-mono text-xs text-[var(--color-fg-muted)]">
            Mini Manager tracks every model from wishlist to complete and builds
            paint recipes from a 7k+ cross-brand library.
          </p>
          <Button as="a" href="/sign-in" variant="secondary" size="sm">
            Sign up free
          </Button>
        </div>
      </footer>

      {autoClone && !isOwner ? <AutoCloneOnMount slug={slug} /> : null}
    </article>
  );
}
