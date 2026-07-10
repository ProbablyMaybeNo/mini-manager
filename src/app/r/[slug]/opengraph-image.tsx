import { ImageResponse } from "next/og";
import { getRecipeBySlug, getPaintMetaMap } from "@/db/queries/recipes";

/**
 * Recipe-card phase 3 — per-recipe OG image so an `/r/<slug>` link
 * unfurls as a real card on Discord/Reddit/X instead of bare text.
 *
 * Node runtime (not edge) — `getRecipeBySlug` goes through `@libsql/client/node`,
 * which isn't edge-compatible.
 *
 * Two paths:
 *   1. The recipe has an admin-approved gallery card (a real branded PNG,
 *      already rendered client-side by ShareCardComposer) — relay those
 *      bytes directly. This is the common case once a recipe's been
 *      through the gallery review flow.
 *   2. No approved card yet — generate a plain name + swatch-row fallback
 *      on the dark MINI-MAINFRAME ground so every shared link unfurls
 *      with SOMETHING branded, not the framework's blank default.
 */
export const runtime = "nodejs";
export const alt = "The Mini Mainframe — shared paint recipe";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const CYAN = "#00d2ff";
const BG = "#06080a";
const FG_DIM = "#b6c6cc";
const MONO_STACK =
  "ui-monospace, 'Cascadia Mono', 'Segoe UI Mono', 'DejaVu Sans Mono', Menlo, Consolas, monospace";

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const recipe = slug && slug.length <= 64 ? await getRecipeBySlug(slug) : null;

  // Path 1 — relay the real, already-branded card PNG.
  if (recipe?.galleryStatus === "approved" && recipe.galleryImageUrl) {
    try {
      const res = await fetch(recipe.galleryImageUrl);
      if (res.ok) {
        const bytes = await res.arrayBuffer();
        return new Response(bytes, {
          headers: { "content-type": res.headers.get("content-type") ?? "image/png" },
        });
      }
    } catch {
      // Fall through to the generated fallback below — an unreachable
      // Blob URL must never break the OG unfurl entirely.
    }
  }

  // Path 2 — generated name + swatch-row fallback.
  const swatches: string[] = [];
  if (recipe) {
    const paintMeta = await getPaintMetaMap();
    for (const s of recipe.slots) {
      const hex = s.customColorHex ?? (s.paintId ? paintMeta.get(s.paintId)?.hex : null);
      if (hex) swatches.push(hex);
      if (swatches.length >= 10) break;
    }
  }
  const title = recipe?.name ?? "Shared paint recipe";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: BG,
          backgroundImage:
            "radial-gradient(120% 120% at 50% 38%, rgba(0,210,255,0.16) 0%, rgba(0,210,255,0.04) 32%, rgba(6,8,10,0) 62%)",
          fontFamily: MONO_STACK,
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 44,
            left: 80,
            fontSize: 22,
            letterSpacing: 6,
            color: FG_DIM,
            textTransform: "uppercase",
          }}
        >
          mini-mainframe.com
        </div>

        <div
          style={{
            display: "flex",
            fontSize: title.length > 24 ? 64 : 88,
            fontWeight: 700,
            letterSpacing: 2,
            color: CYAN,
            textAlign: "center",
            lineHeight: 1.08,
            padding: "0 90px",
            textShadow: "0 0 18px rgba(0,210,255,0.5), 0 0 42px rgba(0,210,255,0.28)",
          }}
        >
          {title}
        </div>

        {swatches.length > 0 && (
          <div style={{ display: "flex", gap: 14, marginTop: 44 }}>
            {swatches.map((hex, i) => (
              <div
                key={`${hex}-${i}`}
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 8,
                  backgroundColor: hex,
                  border: "2px solid rgba(255,255,255,0.18)",
                }}
              />
            ))}
          </div>
        )}

        <div
          style={{
            position: "absolute",
            bottom: 56,
            left: 80,
            right: 80,
            height: 2,
            backgroundColor: "rgba(0,210,255,0.18)",
          }}
        />
      </div>
    ),
    { ...size },
  );
}
