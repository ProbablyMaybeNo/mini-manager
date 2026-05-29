/**
 * Vehicle starter zones. Used as one-click preset population in the
 * recipe editor — painter can add the whole list and edit/delete any
 * row, or skip the preset entirely and add zones by hand. Per the
 * V2 design change (no silhouette mechanic): zones are pure text.
 */

export const VEHICLE_ZONES = [
  { id: "hull-primary", name: "Hull — Primary" },
  { id: "hull-secondary", name: "Hull — Secondary" },
  { id: "hull-trim", name: "Hull — Trim" },
  { id: "turret", name: "Turret" },
  { id: "weapon-main", name: "Weapon — Main" },
  { id: "weapon-secondary", name: "Weapon — Secondary" },
  { id: "tracks-or-wheels", name: "Tracks / Wheels" },
  { id: "windows-or-vision", name: "Windows / Vision Slits" },
  { id: "decals", name: "Decals / Markings" },
  { id: "engine-vents", name: "Engine Vents" },
  { id: "metal-details", name: "Metal Details" },
  { id: "base", name: "Base" },
] as const;

export type VehicleZoneId = (typeof VEHICLE_ZONES)[number]["id"];
