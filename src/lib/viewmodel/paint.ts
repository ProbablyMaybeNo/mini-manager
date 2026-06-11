import type { Paint as CatalogPaint, PaintType as CatalogPaintType } from "@/lib/paints/types";
import type { Paint, PaintType } from "@/lib/types";

/**
 * Catalog → contract PaintType. The static catalog carries a richer medium
 * vocabulary than the view contract; map each to the closest contract value
 * (display-only, lossy by design — never persisted back).
 */
const PAINT_TYPE: Record<CatalogPaintType, PaintType> = {
  Paint: "Acrylic",
  Wash: "Wash",
  Metallic: "Acrylic",
  Contrast: "Contrast",
  Air: "Acrylic",
  Primer: "Primer",
  Varnish: "Clear",
  Pigment: "Texture",
  Effect: "Texture",
  Ink: "Wash",
  Lacquer: "Clear",
};

export function mapPaintType(t: CatalogPaintType): PaintType {
  return PAINT_TYPE[t] ?? "Acrylic";
}

export interface InventoryFlags {
  ownedCount: number;
  isWishlisted: boolean;
}

/** Static catalog row + the painter's inventory flags → contract Paint. */
export function toPaint(p: CatalogPaint, inv?: InventoryFlags): Paint {
  return {
    id: p.id,
    name: p.name,
    brand: p.brand,
    line: p.line ?? "",
    hex: p.hex,
    type: mapPaintType(p.type),
    sku: p.sku ?? "",
    owned: (inv?.ownedCount ?? 0) > 0,
    wishlisted: inv?.isWishlisted ?? false,
  };
}
