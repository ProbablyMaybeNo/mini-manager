import { INFANTRY_ZONES } from "./infantry";
import { VEHICLE_ZONES } from "./vehicle";
import { MONSTER_ZONES } from "./monster";
import { TERRAIN_ZONES } from "./terrain";

/**
 * Body-type starter zone lookup. The recipe editor's "Use starter zones"
 * dropdown reads from here. Each list is a sensible default a painter
 * can add wholesale to a fresh recipe, then edit / delete any row.
 *
 * Body type stays on `recipe.bodyType` as a metadata tag (used by the
 * `/recipes` filter); it does NOT gate the editor UI. Painters can
 * mix-and-match presets — add the Infantry pack, then drop in a couple
 * of Vehicle rows, then a custom "Tongues" row. Whatever the kit needs.
 */

export type StarterZone = { readonly id: string; readonly name: string };

export const ZONE_PRESETS = {
  infantry: INFANTRY_ZONES,
  vehicle: VEHICLE_ZONES,
  monster: MONSTER_ZONES,
  terrain: TERRAIN_ZONES,
} as const satisfies Record<string, ReadonlyArray<StarterZone>>;

export type ZonePresetKey = keyof typeof ZONE_PRESETS;

export const ZONE_PRESET_KEYS: ReadonlyArray<ZonePresetKey> = [
  "infantry",
  "vehicle",
  "monster",
  "terrain",
];

export const ZONE_PRESET_LABEL: Readonly<Record<ZonePresetKey, string>> = {
  infantry: "Infantry",
  vehicle: "Vehicle",
  monster: "Monster / Creature",
  terrain: "Terrain",
};

export function getZonePreset(key: string): ReadonlyArray<StarterZone> | null {
  if (key in ZONE_PRESETS) {
    return ZONE_PRESETS[key as ZonePresetKey];
  }
  return null;
}
