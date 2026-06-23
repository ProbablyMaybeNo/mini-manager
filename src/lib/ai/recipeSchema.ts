/**
 * Shared shapes for the AI Recipe Creator (The Mini Mainframe).
 *
 * The whole feature is built around ONE invariant: Claude may only ever
 * reference paints that exist in the real catalog. The proposal it returns
 * is validated against the catalog before it ever reaches the UI — any
 * paintId that isn't a real catalog row is dropped (see `groundRecipe`).
 *
 * These types are the seam between the server route, the grounding/
 * validation logic, and the confirmation-card UI.
 */

import type { TechniqueKey } from "@/db/schema";

/**
 * Recipe roles the model assigns paints to. Deliberately broader than the
 * raw DB `techniqueKeys` — painters speak in roles ("base", "shadow",
 * "metal", "trim") and we map those to the canonical layer on persist.
 * Kept as a const tuple so the tool schema + validator share one source.
 */
export const recipeRoles = [
  "base",
  "shadow",
  "highlight",
  "edge_highlight",
  "midtone",
  "wash",
  "metal",
  "trim",
  "detail",
  "skin",
  "accent",
] as const;
export type RecipeRole = (typeof recipeRoles)[number];

/** Free-text role → canonical DB technique. Mirrors saveRecipe's mapping
 *  but lives here so the AI path can persist without round-tripping through
 *  the kit "layer" string. Anything unknown falls back to basecoat. */
export const ROLE_TO_TECHNIQUE: Record<RecipeRole, TechniqueKey> = {
  base: "basecoat",
  shadow: "wash",
  highlight: "highlight",
  edge_highlight: "edge_highlight",
  midtone: "midcoat",
  wash: "wash",
  metal: "metallic",
  trim: "detail",
  detail: "detail",
  skin: "basecoat",
  accent: "midcoat",
};

/** One slot in the model's RAW proposal — references a candidate by paintId. */
export interface RawProposedSlot {
  role: string;
  paintId: string;
  note: string;
}

/** The model's raw, UNVALIDATED proposal (shape enforced by the tool schema). */
export interface RawRecipeProposal {
  summary: string;
  slots: RawProposedSlot[];
  techniqueNotes: string;
}

/**
 * A validated slot. `paintId`, `brand`, `name`, `hex` are guaranteed to come
 * from a real catalog row; `owned` is filled from the user's inventory.
 */
export interface GroundedSlot {
  role: RecipeRole;
  layer: TechniqueKey;
  paintId: string;
  brand: string;
  name: string;
  hex: string;
  note: string;
  owned: boolean;
}

/** The validated, catalog-grounded proposal handed to the UI. */
export interface GroundedRecipeProposal {
  summary: string;
  techniqueNotes: string;
  slots: GroundedSlot[];
  /** paintIds the model returned that did NOT exist in the catalog — dropped.
   *  Surfaced for observability/tests; the UI may ignore it. */
  droppedPaintIds: string[];
  /** Catalog paintIds in the proposal the user does not own → buy list. */
  missingPaintIds: string[];
}

/** Canonical role normaliser — the model occasionally returns near-misses
 *  ("base coat", "shadows", "metallic"); fold them onto the known set. */
export function normaliseRole(raw: string): RecipeRole {
  const k = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if ((recipeRoles as readonly string[]).includes(k)) return k as RecipeRole;
  switch (k) {
    case "basecoat":
    case "base_coat":
    case "body":
      return "base";
    case "shadows":
    case "shade":
    case "recess":
      return "shadow";
    case "highlights":
    case "hi":
      return "highlight";
    case "edge":
    case "edge_highlights":
      return "edge_highlight";
    case "mid":
    case "midcoat":
    case "midtones":
      return "midtone";
    case "metallic":
    case "metals":
    case "gold":
    case "silver":
    case "steel":
      return "metal";
    case "trims":
    case "rim":
      return "trim";
    case "details":
      return "detail";
    case "flesh":
    case "face":
      return "skin";
    default:
      return "base";
  }
}
