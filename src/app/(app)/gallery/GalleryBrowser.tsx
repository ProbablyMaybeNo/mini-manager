"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { EmptyState, Panel, SearchField, Swatch } from "@/components/kit";
import { CloneButton } from "@/components/recipe/CloneButton";
import { cn } from "@/lib/cn";
import { exportableImageSrc } from "@/lib/shareCard/imageSrc";
import { cardAspectRatio } from "@/lib/shareCard/layout";
import type { GalleryRecipeCard } from "@/db/queries/recipes";

type SortKey = "newest" | "oldest" | "popular";

/**
 * Client browse layer over the server-fetched published-card list: a name
 * search + a Newest/Oldest/Popular sort, all applied in memory (no
 * round-trips). Popular ranks by clone count (desc), tie-breaking on
 * recency. Brand faceting was dropped — painters browse the gallery by
 * what's new or what's loved, not by paint company.
 */
export function GalleryBrowser({
  recipes,
  isSignedIn,
}: {
  recipes: ReadonlyArray<GalleryRecipeCard>;
  isSignedIn: boolean;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = recipes.filter(
      (r) => q === "" || r.name.toLowerCase().includes(q),
    );
    return [...matched].sort((a, b) => {
      if (sort === "popular") {
        return b.cloneCount - a.cloneCount || b.updatedAt - a.updatedAt;
      }
      return sort === "newest"
        ? b.updatedAt - a.updatedAt
        : a.updatedAt - b.updatedAt;
    });
  }, [recipes, query, sort]);

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between md:gap-4">
        <div className="w-full max-w-md">
          <SearchField
            name="gallery-search"
            aria-label="Search cards by name"
            placeholder="Search cards…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {/* Equal-width thirds (MUX-020) — POPULAR / NEWEST / OLDEST were three
            different widths, so a set of mutually-exclusive options didn't read
            as one control. */}
        <div
          className="grid grid-cols-3 items-center gap-2 sm:flex sm:flex-wrap"
          role="group"
          aria-label="Sort cards"
        >
          <SortChip
            label="Popular"
            active={sort === "popular"}
            onClick={() => setSort("popular")}
          />
          <SortChip
            label="Newest"
            active={sort === "newest"}
            onClick={() => setSort("newest")}
          />
          <SortChip
            label="Oldest"
            active={sort === "oldest"}
            onClick={() => setSort("oldest")}
          />
        </div>
      </div>

      {/* Desktop only — on a phone this line pushed the first card further down
          to restate a number the grid itself shows (MUX-020). */}
      <p className="hidden label-osd text-fg-dim md:block" aria-live="polite">
        {visible.length} card{visible.length === 1 ? "" : "s"}
      </p>
      <p className="sr-only" aria-live="polite">
        {visible.length} card{visible.length === 1 ? "" : "s"}
      </p>

      {visible.length === 0 ? (
        <Panel label="GALLERY" className="p-4">
          <EmptyState
            glyph="▦"
            title="No cards match"
            hint="Try a different search term."
          />
        </Panel>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((r) => (
            <li key={r.slug}>
              <RecipeCard recipe={r} isSignedIn={isSignedIn} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SortChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        // min-h-11 → 44px comfortable touch target (WCAG 2.2 §2.5.8).
        // justify-center + w-full so the grid parent gives all three equal
        // widths and the labels centre inside them (MUX-020).
        "inline-flex min-h-11 w-full items-center justify-center border px-2 py-0.5 font-button text-button uppercase tracking-[0.15em] transition-colors sm:w-auto",
        active
          ? "border-cyan bg-cyan/15 text-cyan-lite"
          : "border-cyan/40 text-fg hover:border-cyan hover:text-cyan-lite",
      )}
    >
      {label}
    </button>
  );
}

function RecipeCard({
  recipe,
  isSignedIn,
}: {
  recipe: GalleryRecipeCard;
  isSignedIn: boolean;
}) {
  // Recipe-card phase 3 — an admin-approved gallery card renders as the
  // real branded PNG (a visual wall of cards); older `isListed` entries
  // (the curated `db:seed-gallery` set) have no cardImageUrl and keep the
  // original swatch-strip rendering. `imageFailed` catches a card image
  // that 404s/fails to load and falls back to the same swatch rendering
  // rather than showing a broken tile.
  const [imageFailed, setImageFailed] = useState(false);
  const showCardImage = recipe.cardImageUrl != null && !imageFailed;

  return (
    <Panel
      cornerTicks
      className="flex h-full flex-col gap-3 p-4 transition-shadow hover:shadow-[0_0_6px_rgba(0,210,255,0.35)]"
    >
      <Link
        href={`/r/${recipe.slug}`}
        className="group flex flex-1 flex-col gap-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan"
      >
        {showCardImage ? (
          // Pre-size the tile from the card's OWN stored ratio rather than
          // guessing square-unless-9:16, and fit the image inside it. The
          // guess happened to match while only 1:1 and 9:16 existed, but
          // `shareCard/layout.ts` has 16:9 and 4:5 queued — the moment either
          // ships, the old binary would have silently cropped them into a
          // square. Keeping the box pre-sized is what avoids layout shift.
          <div
            className="-mx-4 -mt-4 overflow-hidden bg-bg"
            style={{ aspectRatio: cardAspectRatio(recipe.cardImageRatio) }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={recipe.cardImageUrl ? exportableImageSrc(recipe.cardImageUrl) : undefined}
              alt={`${recipe.name} — paint recipe card`}
              className="h-full w-full object-contain"
              onError={() => setImageFailed(true)}
            />
          </div>
        ) : (
          <>
            <h2 className="font-h1 text-h1 text-cyan-lite group-hover:text-glow-cyan">
              {recipe.name}
            </h2>

            {recipe.swatches.length > 0 ? (
              <div className="flex flex-wrap gap-1" aria-label="Recipe colours">
                {recipe.swatches.map((hex, i) => (
                  <Swatch key={`${hex}-${i}`} hex={hex} size="md" />
                ))}
              </div>
            ) : (
              <p className="font-body text-body text-fg-faint">No colours yet</p>
            )}
          </>
        )}

        {showCardImage && (
          <h2 className="font-h1 text-h1 text-cyan-lite group-hover:text-glow-cyan">
            {recipe.name}
          </h2>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-2">
          {recipe.brands.length > 0 ? (
            recipe.brands.map((b) => (
              <span
                key={b}
                className="inline-flex items-center border border-purple/50 px-1.5 py-0.5 font-button text-button uppercase tracking-[0.12em] text-purple"
              >
                {b}
              </span>
            ))
          ) : (
            <span className="font-body text-body text-fg-faint">
              Custom colours
            </span>
          )}
        </div>

        <p className="label-osd text-fg-dim">
          {recipe.slotCount} slot{recipe.slotCount === 1 ? "" : "s"}
        </p>
      </Link>

      {/* Cloning a paintless post hands the visitor an empty recipe — a dead
          action dressed as the card's main call. Say what the card is
          instead. This is now reachable on purpose: composing a post with no
          paints is allowed, because a photo of a finished mini beats no
          post at all. */}
      {recipe.slotCount > 0 ? (
        <CloneButton slug={recipe.slug} isSignedIn={isSignedIn} size="sm" />
      ) : (
        <p className="label-osd text-fg-faint">Photo only — no paints listed</p>
      )}
    </Panel>
  );
}
