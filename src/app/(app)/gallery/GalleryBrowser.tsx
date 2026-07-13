"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { EmptyState, Panel, SearchField, Swatch } from "@/components/kit";
import { CloneButton } from "@/components/recipe/CloneButton";
import { cn } from "@/lib/cn";
import type { GalleryRecipeCard } from "@/db/queries/recipes";

type SortKey = "newest" | "oldest";

/**
 * Client browse layer over the server-fetched published-card list: a name
 * search + a Newest/Oldest sort, both applied in memory (no round-trips).
 * Brand faceting was dropped — painters browse the gallery by what's new, not
 * by paint company.
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
    return [...matched].sort((a, b) =>
      sort === "newest" ? b.updatedAt - a.updatedAt : a.updatedAt - b.updatedAt,
    );
  }, [recipes, query, sort]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full max-w-md">
          <SearchField
            name="gallery-search"
            aria-label="Search cards by name"
            placeholder="Search cards…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div
          className="flex items-center gap-2"
          role="group"
          aria-label="Sort cards"
        >
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

      <p className="label-osd text-fg-dim" aria-live="polite">
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
        // min-h-6 keeps the hit area ≥24px (WCAG 2.2 §2.5.8).
        "inline-flex min-h-6 items-center border px-2 py-0.5 font-button text-button uppercase tracking-[0.15em] transition-colors",
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
          <div
            className={cn(
              "-mx-4 -mt-4 overflow-hidden bg-bg",
              recipe.cardImageRatio === "9:16" ? "aspect-[9/16]" : "aspect-square",
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={recipe.cardImageUrl ?? undefined}
              alt={`${recipe.name} — paint recipe card`}
              className="h-full w-full object-cover"
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

      <CloneButton slug={recipe.slug} isSignedIn={isSignedIn} size="sm" />
    </Panel>
  );
}
