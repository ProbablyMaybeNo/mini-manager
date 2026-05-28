/**
 * Infantry zone metadata — drives the recipe editor's silhouette pane.
 * Each id is the canonical key stored on `recipeZone.silhouetteZoneId`.
 * Names are surfaced verbatim in the zone picker and silhouette tooltip.
 * `defaultStepCount` is a soft hint for "how many steps a careful
 * painter usually puts here" — used in P3.4's pre-fill suggestion when
 * the painter adds a fresh silhouette-mapped zone.
 *
 * v1 covers Infantry only. Vehicle / Monster / Terrain silhouettes
 * land in Phase 6.
 */

export const INFANTRY_ZONES = [
  { id: "head", name: "Head / Face", defaultStepCount: 3 },
  { id: "helmet", name: "Helmet", defaultStepCount: 3 },
  { id: "armor-primary", name: "Armor — Primary", defaultStepCount: 4 },
  { id: "armor-secondary", name: "Armor — Secondary", defaultStepCount: 4 },
  { id: "armor-trim", name: "Armor — Trim", defaultStepCount: 3 },
  { id: "cloak", name: "Cloak / Cape", defaultStepCount: 4 },
  { id: "weapon-main", name: "Weapon — Main", defaultStepCount: 3 },
  { id: "weapon-secondary", name: "Weapon — Secondary", defaultStepCount: 3 },
  { id: "weapon-metal", name: "Weapon — Metal", defaultStepCount: 3 },
  { id: "leather", name: "Leather / Straps", defaultStepCount: 3 },
  { id: "skin", name: "Exposed Skin", defaultStepCount: 4 },
  { id: "base", name: "Base", defaultStepCount: 3 },
] as const;

export type InfantryZoneId = (typeof INFANTRY_ZONES)[number]["id"];
export type InfantryZone = (typeof INFANTRY_ZONES)[number];

/** Look up a zone by id — small helper used wherever a recipeZone's
 *  silhouetteZoneId is rendered alongside a human name. */
export function findInfantryZone(
  id: string,
): InfantryZone | undefined {
  return INFANTRY_ZONES.find((z) => z.id === id);
}

export function isInfantryZoneId(id: string): id is InfantryZoneId {
  return INFANTRY_ZONES.some((z) => z.id === id);
}
