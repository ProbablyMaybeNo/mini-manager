/**
 * Terrain starter zones. Ruins, hills, buildings, scatter pieces.
 * Used as one-click preset population in the recipe editor.
 */

export const TERRAIN_ZONES = [
  { id: "stone-primary", name: "Stone — Primary" },
  { id: "stone-trim", name: "Stone — Trim" },
  { id: "metal-details", name: "Metal Details" },
  { id: "wood", name: "Wood" },
  { id: "vegetation", name: "Vegetation" },
  { id: "dirt-or-ground", name: "Dirt / Ground" },
  { id: "weathering-wash", name: "Weathering Wash" },
  { id: "debris", name: "Debris" },
  { id: "windows-or-glass", name: "Windows / Glass" },
  { id: "paint-chipping", name: "Paint Chipping" },
  { id: "rust", name: "Rust" },
  { id: "base", name: "Base" },
] as const;

export type TerrainZoneId = (typeof TERRAIN_ZONES)[number]["id"];
