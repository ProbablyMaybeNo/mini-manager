/**
 * Monster / creature starter zones. Used as one-click preset population
 * in the recipe editor. Painter can add the whole list and edit/delete
 * any row, or skip the preset entirely and add zones by hand.
 */

export const MONSTER_ZONES = [
  { id: "hide-primary", name: "Hide — Primary" },
  { id: "hide-secondary", name: "Hide — Secondary" },
  { id: "scales-or-fur", name: "Scales / Fur" },
  { id: "horns-or-teeth", name: "Horns / Teeth" },
  { id: "claws", name: "Claws" },
  { id: "eyes", name: "Eyes" },
  { id: "belly-or-underside", name: "Belly / Underside" },
  { id: "wings", name: "Wings" },
  { id: "muscle-tone", name: "Muscle Tone" },
  { id: "tongue-or-mouth", name: "Tongue / Mouth" },
  { id: "spikes-or-frills", name: "Spikes / Frills" },
  { id: "base", name: "Base" },
] as const;

export type MonsterZoneId = (typeof MONSTER_ZONES)[number]["id"];
