import { ImageResponse } from "next/og";
import { getRecipeBySlug } from "@/db/queries/recipes";
import { paletteForRecipe } from "@/db/queries/recipes";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

interface Params {
  slug: string;
}

/**
 * Dynamic Open Graph image for a public recipe URL. Renders a 1200x630
 * card showing the recipe name and a palette strip of up to eight
 * swatches. Cached for one hour because recipes change rarely; the OG
 * scrapers (Discord / Twitter / Slack) will re-fetch when needed.
 */
export default async function OpengraphImage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const recipe = await loadRecipe(slug);

  const name = recipe?.name ?? "Mini Manager";
  const subtitle = recipe
    ? `Paint recipe · ${recipe.zones.length} zone${
        recipe.zones.length === 1 ? "" : "s"
      }`
    : "Paint recipe";
  const swatches = recipe ? await paletteHexes(recipe) : [];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#050607",
          color: "#f5f7f8",
          padding: 64,
          fontFamily: "ui-monospace, monospace",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div
            style={{
              fontSize: 24,
              color: "#33ff66",
              letterSpacing: 4,
              textTransform: "uppercase",
            }}
          >
            ┌─ MINI MANAGER ─
          </div>
          <div
            style={{
              fontSize: 88,
              fontWeight: 600,
              lineHeight: 1.1,
              color: "#f5f7f8",
            }}
          >
            {truncate(name, 60)}
          </div>
          <div
            style={{
              fontSize: 28,
              color: "#98a2ad",
            }}
          >
            {subtitle}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
          }}
        >
          {swatches.length > 0 ? (
            swatches.map((hex, i) => (
              <div
                key={`${hex}-${i}`}
                style={{
                  width: 120,
                  height: 120,
                  background: hex,
                  border: "2px solid #2a3441",
                  borderRadius: 4,
                }}
              />
            ))
          ) : (
            <div
              style={{
                fontSize: 22,
                color: "#5a6772",
              }}
            >
              (no palette yet)
            </div>
          )}
        </div>
      </div>
    ),
    {
      ...size,
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    },
  );
}

async function loadRecipe(slug: string) {
  if (!slug || slug.length > 64) return null;
  try {
    return await getRecipeBySlug(slug);
  } catch {
    return null;
  }
}

async function paletteHexes(
  recipe: Awaited<ReturnType<typeof getRecipeBySlug>>,
): Promise<string[]> {
  if (!recipe) return [];
  const map = await paletteForRecipe(recipe);
  return Array.from(map.values()).slice(0, 8);
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}
