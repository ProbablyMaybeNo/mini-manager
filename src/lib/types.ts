/**
 * Mini Manager — view-model shapes (the single source of truth for data the UI renders).
 *
 * This module is the integration seam: the host app imports these exact types and passes
 * the same shapes in. The UI NEVER fetches or derives — every value here is supplied.
 * All async/derived values (match results, roll-ups, totals, streaks, auto-fill) are inputs.
 */

export type Hex = string;

/* ----------------------------------------------------------------------------
 * Project
 * ------------------------------------------------------------------------- */
export type ProjectType = "Army" | "Warband" | "Unit" | "Model" | "Terrain";

export type ProjectStatus =
  | "WISHLIST"
  | "OWNED"
  | "BUILDING"
  | "PRIMING"
  | "PAINTING"
  | "BASING"
  | "COMPLETE"
  | "SHELVED";

export type Priority = "Low" | "Med" | "High";

export interface Project {
  id: string;
  title: string;
  type: ProjectType;
  /** One hex per paint in the attached recipe; empty array → show an "attach" affordance. */
  recipeSwatches: Hex[];
  status: ProjectStatus;
  priority: Priority;
  /** 0–100. For containers this is the host-computed roll-up. */
  completionPercent: number;
  /** Total models in the project (the focus bench's progress denominator). */
  modelCount?: number;
  /** Models fully complete — seeds the focus bench's models stepper. */
  modelsComplete?: number;
  /** Epoch ms of the last edit — powers the /projects "Recently updated" sort
   *  (DOP-017). Optional so fixture/derived callers without a timestamp work. */
  updatedAt?: number;
  children?: Project[];
}

/* ----------------------------------------------------------------------------
 * Recipe
 * ------------------------------------------------------------------------- */
export interface RecipeSlot {
  paintId: string;
  swatch: Hex;
  brand: string;
  name: string;
  layer: string;
  note?: string;
}

export interface InspoRef {
  /** recipe_inspo row id; empty string for an unsaved (editor-local) entry. */
  id: string;
  url: string;
  /** Resolved og:image / direct-image URL, if known — render this as the thumb
   *  and fall back to `url` when null. */
  imageUrl?: string | null;
}

export interface Recipe {
  id: string;
  name: string;
  slots: RecipeSlot[];
  inspo: InspoRef[];
  assignedProjectId?: string;
  shareUrl?: string;
  /** Recipe-level notes (the editor's Notes panel). */
  notes?: string;
}

/* ----------------------------------------------------------------------------
 * Paint
 * ------------------------------------------------------------------------- */
export type PaintType =
  | "Acrylic"
  | "Contrast"
  | "Wash"
  | "Glaze"
  | "Primer"
  | "Clear"
  | "Texture"
  | "Enamel"
  | "Oil";

export interface Paint {
  id: string;
  name: string;
  brand: string;
  line: string;
  hex: Hex;
  type: PaintType;
  sku: string;
  owned: boolean;
  wishlisted: boolean;
}

/* ----------------------------------------------------------------------------
 * Collection
 * ------------------------------------------------------------------------- */
export type CollectionKind = "paint" | "model";

export interface CollectionItem {
  id: string;
  kind: CollectionKind;
  thumbnail: string;
  name: string;
  /** Paint manufacturer (paint rows). */
  company: string;
  vendor: string;
  price: string;
  status: ProjectStatus;
  sourceUrl: string;
  quantity?: number;
  projectId?: string;
  /** Game system + faction/army (model rows) — shown as Game/Army columns. */
  game?: string;
  army?: string;
  /** Attached recipe (paint rows) — the scheme this paint belongs to. */
  recipeId?: string;
  /** Paint medium type (paint rows) — Contrast / Wash / Acrylic / … */
  paintType?: string;
}

/* ----------------------------------------------------------------------------
 * Session / calendar / activity / match
 * ------------------------------------------------------------------------- */
export interface SessionStats {
  todayMinutes: number;
  weekMinutes: number;
  allTimeMinutes: number;
  streakDays: number;
}

export type CalendarEventKind = "tournament" | "deadline" | "battle" | "other";

export interface CalendarEvent {
  id: string;
  /** ISO date string (YYYY-MM-DD). */
  date: string;
  name: string;
  kind: CalendarEventKind;
  /** Optional free-text notes, surfaced in the calendar hover tooltip (D1). */
  notes?: string | null;
}

export interface ActivityEntry {
  id: string;
  /** Icon key the UI maps to a pixel glyph. */
  icon: string;
  text: string;
  when: string;
}

export interface MatchResult {
  paint: Paint;
  /** Host-provided ranking distance; the UI only displays it. */
  distanceScore: number;
}

/** Dashboard stat-box roll-ups — all host-computed, the UI only renders them. */
export interface DashboardSummary {
  activeProjects: number;
  completionPercent: number;
  streakDays: number;
  timeTotalMinutes: number;
}

/* ----------------------------------------------------------------------------
 * Filter object emitted by the Library filter slide-out
 * ------------------------------------------------------------------------- */
export interface LibraryFilter {
  colors: string[];
  brands: string[];
  status: Array<"owned" | "wishlist">;
  search?: string;
  hex?: Hex;
}

export const EMPTY_LIBRARY_FILTER: LibraryFilter = {
  colors: [],
  brands: [],
  status: [],
  search: "",
  hex: "",
};

/* ----------------------------------------------------------------------------
 * Pricing tier (host-supplied; price + seat counts come from billing, not the UI)
 * ------------------------------------------------------------------------- */
export interface PricingTier {
  id: string;
  name: string;
  price: string;
  cadence: string;
  features: string[];
  cta: string;
  featured?: boolean;
  seatsLeft?: number;
  seatsTotal?: number;
}

/* ----------------------------------------------------------------------------
 * Shell
 * ------------------------------------------------------------------------- */
export type NavKey =
  | "dashboard"
  | "focus"
  | "library"
  | "recipe"
  | "tools"
  | "collection"
  | "settings"
  | "account";
