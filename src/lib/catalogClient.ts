import { loadPaints } from "@/lib/paints/loader";
import type { Paint, PaintType } from "@/lib/types";

/** Catalog paint type → kit PaintType (the kit chip set is narrower). */
const PAINT_TYPE_MAP: Record<string, PaintType> = {
  Paint: "Acrylic",
  Wash: "Wash",
  // Metallic used to collapse to "Acrylic", which made metallics invisible to
  // every colour tool — that is how the Layering tool came to offer "Bronze"
  // as the shadow for Mephiston Red. The catalog has always carried the
  // distinction; only this mapping threw it away.
  Metallic: "Metallic",
  Contrast: "Contrast",
  Air: "Acrylic",
  Primer: "Primer",
  Varnish: "Clear",
  Pigment: "Texture",
  Effect: "Texture",
  Ink: "Wash",
  Lacquer: "Clear",
};

/**
 * Load the real paint catalog (the static /data/paints.json, IndexedDB-cached)
 * mapped onto the kit's Paint shape. Client-side only — the catalog is a
 * browser-served static asset. owned/wishlisted default false here; callers
 * that need the user's inventory merge it on (see the Library route).
 */
export async function loadKitCatalog(): Promise<Paint[]> {
  const catalog = await loadPaints();
  return catalog.map((p) => ({
    id: p.id,
    name: p.name,
    brand: p.brand,
    line: p.line ?? "",
    hex: p.hex,
    type: PAINT_TYPE_MAP[p.type] ?? "Acrylic",
    sku: p.sku ?? "",
    owned: false,
    wishlisted: false,
  }));
}
