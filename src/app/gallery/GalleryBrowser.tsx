"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { EmptyState, Panel, SearchField, Swatch } from "@/components/kit";
import { cn } from "@/lib/cn";
import type { GalleryRecipeCard } from "@/db/queries/recipes";

/**
 * Client browse layer over the server-fetched published-recipe list.
 * v1 keeps it simple: a name search + a brand facet, both filtering the
 * already-fetched array in memory. No extra round-trips.
 */
export function GalleryBrowser({
  recipes,
}: {
  recipes: ReadonlyArray<GalleryRecipeCard>;
}) {
  const [query, setQuery] = useState("");
  const [brand, setBrand] = useState<string | null>(null);

  // Every distinct brand across the published set, sorted — drives the facet.
  const allBrands = useMemo(() => {
    const set = new Set<string>();
    for (const r of recipes) for (const b of r.brands) set.add(b);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [recipes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return recipes.filter((r) => {
      const matchesQuery = q === "" || r.name.toLowerCase().includes(q);
      const matchesBrand = brand === null || r.brands.includes(brand);
      return matchesQuery && matchesBrand;
    });
  }, [recipes, query, brand]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div className="max-w-md">
          <SearchField
            name="gallery-search"
            aria-label="Search recipes by name"
            placeholder="Search recipes…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {allBrands.length > 0 && (
          <div
            className="flex flex-wrap items-center gap-2"
            role="group"
            aria-label="Filter by brand"
          >
            <BrandChip
              label="All"
              active={brand === null}
              onClick={() => setBrand(null)}
            />
            {allBrands.map((b) => (
              <BrandChip
                key={b}
                label={b}
                active={brand === b}
                onClick={() => setBrand((cur) => (cur === b ? null : b))}
              />
            ))}
          </div>
        )}
      </div>

      <p className="label-osd text-fg-dim" aria-live="polite">
        {filtered.length} recipe{filtered.length === 1 ? "" : "s"}
        {brand ? ` · ${brand}` : ""}
      </p>

      {filtered.length === 0 ? (
        <Panel label="GALLERY" className="p-4">
          <EmptyState
            glyph="▦"
            title="No recipes match"
            hint="Try a different search term or clear the brand filter."
          />
        </Panel>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r) => (
            <li key={r.slug}>
              <RecipeCard recipe={r} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BrandChip({
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
          ? "border-cyan bg-cyan/15 text-cyan"
          : "border-cyan/40 text-fg hover:border-cyan hover:text-cyan",
      )}
    >
      {label}
    </button>
  );
}

function RecipeCard({ recipe }: { recipe: GalleryRecipeCard }) {
  return (
    <Link
      href={`/r/${recipe.slug}`}
      className="group block h-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan"
    >
      <Panel
        cornerTicks
        className="flex h-full flex-col gap-3 p-4 transition-shadow group-hover:shadow-[0_0_6px_rgba(0,210,255,0.35)]"
      >
        <h2 className="font-h1 text-h1 text-cyan group-hover:text-glow-cyan">
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
      </Panel>
    </Link>
  );
}
